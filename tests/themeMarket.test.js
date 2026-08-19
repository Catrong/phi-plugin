import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import JSZip from 'jszip'
import { pluginResources } from '../model/filesystem/path.js'
import themeManager from '../model/theme/manager.js'
import { downloadThemeArchive, ThemeMarketClientError } from '../model/theme/marketClient.js'
import { normalizeMarketTheme } from '../model/theme/catalog.js'
import {
    installMarketArchive,
    isMarketThemeCached,
    marketWorkPath,
    recoverMarketInstall,
    withMarketInstallLock,
} from '../model/theme/installer.js'

const themesDir = path.join(pluginResources, 'html', 'b19', 'themes')
const sha256 = 'b'.repeat(64)

/** @param {string} themeId @param {{topLevel?:boolean, unsafePath?:boolean}} [options] */
async function makeArchive(themeId, options = {}) {
    await recoverMarketInstall(themeId)
    const zip = new JSZip()
    const prefix = options.topLevel ? `${themeId}/` : ''
    zip.file(`${prefix}info.yaml`, `id: ${themeId}\nname: Market ${themeId}\ndescription: test\n`)
    zip.file(`${prefix}b19.css`, 'body { color: #fff; }\n')
    if (options.unsafePath) zip.file('../outside.txt', 'unsafe')
    const data = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    const archivePath = marketWorkPath(`test-${themeId}-${crypto.randomUUID()}.zip`)
    await fs.promises.writeFile(archivePath, data, { mode: 0o600 })
    return archivePath
}

test('verified downloader sends no credentials and enforces size and SHA-256', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'phi-market-download-'))
    const target = path.join(tempDir, 'theme.zip')
    const bytes = Buffer.from('verified zip bytes')
    const download = {
        downloadId: 'download-test',
        themeId: 'download-test',
        version: '1.0.0',
        fileName: 'download-test.zip',
        contentType: 'application/zip',
        size: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        downloadUrl: 'https://lyh.org.cn:18473/api/integrations/phi-plugin/download/opaque',
    }
    /** @type {typeof fetch} */
    const fetchImpl = async (_url, init) => {
        assert.deepEqual(init?.headers, { Accept: 'application/zip' })
        assert.equal('Authorization' in /** @type {any} */ (init?.headers), false)
        return new Response(bytes, {
            status: 200,
            headers: { 'Content-Type': 'application/zip', 'Content-Length': String(bytes.length) },
        })
    }
    try {
        await downloadThemeArchive(download, target, { fetchImpl })
        assert.deepEqual(await fs.promises.readFile(target), bytes)

        await assert.rejects(
            downloadThemeArchive({ ...download, sha256: '0'.repeat(64) }, target, { fetchImpl }),
            error => error instanceof ThemeMarketClientError && error.code === 'theme_package_integrity_failed',
        )
        assert.equal(fs.existsSync(target), false)
    } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true })
    }
})

test('market installer validates, installs, receipts and hides a theme from other users', async () => {
    const themeId = `markettest${Date.now()}`
    const target = path.join(themesDir, themeId)
    try {
        const archive = await makeArchive(themeId, { topLevel: true })
        const receipt = await withMarketInstallLock(() => installMarketArchive(themeId, {
            version: '1.2.3', sha256,
        }, archive))
        assert.equal(receipt.slug, themeId)
        assert.equal(await isMarketThemeCached(themeId, { version: '1.2.3', sha256 }), true)
        themeManager.scan()
        assert.equal(themeManager.getTheme(themeId)?.marketInstalled, true)
        assert.equal(themeManager.getThemeList().some(theme => theme.id === themeId), false)
        assert.equal(Boolean(themeManager.getThemeOptions()[themeId]), false)
        assert.equal(Boolean(themeManager.getThemeOptions(themeId)[themeId]), true)
    } finally {
        await fs.promises.rm(target, { recursive: true, force: true })
        themeManager.scan()
    }
})

test('market installer rejects traversal and preserves a same-name local theme', async () => {
    const unsafeId = `unsafe${Date.now()}`
    const localId = `local${Date.now()}`
    const localTarget = path.join(themesDir, localId)
    let unsafeArchive = ''
    let localArchive = ''
    try {
        unsafeArchive = await makeArchive(unsafeId, { unsafePath: true })
        await assert.rejects(
            withMarketInstallLock(() => installMarketArchive(unsafeId, { version: '1.0.0', sha256 }, unsafeArchive)),
            error => error instanceof ThemeMarketClientError && error.code === 'theme_package_unsafe_path',
        )
        assert.equal(fs.existsSync(path.resolve(themesDir, '..', 'outside.txt')), false)

        await fs.promises.mkdir(localTarget, { recursive: true })
        await fs.promises.writeFile(path.join(localTarget, 'info.yaml'), `id: ${localId}\nname: Local\n`)
        localArchive = await makeArchive(localId)
        await assert.rejects(
            withMarketInstallLock(() => installMarketArchive(localId, { version: '1.0.0', sha256 }, localArchive)),
            error => error instanceof ThemeMarketClientError && error.code === 'theme_conflicts_with_local_theme',
        )
        assert.match(await fs.promises.readFile(path.join(localTarget, 'info.yaml'), 'utf8'), /name: Local/)
    } finally {
        await fs.promises.rm(path.join(themesDir, unsafeId), { recursive: true, force: true })
        await fs.promises.rm(localTarget, { recursive: true, force: true })
        if (unsafeArchive) await fs.promises.rm(unsafeArchive, { force: true })
        if (localArchive) await fs.promises.rm(localArchive, { force: true })
        themeManager.scan()
    }
})

test('market install lock serializes concurrent operations', async () => {
    /** @type {string[]} */
    const order = []
    await Promise.all([
        withMarketInstallLock(async () => {
            order.push('first-start')
            await new Promise(resolve => setTimeout(resolve, 50))
            order.push('first-end')
        }),
        withMarketInstallLock(async () => {
            order.push('second-start')
            order.push('second-end')
        }),
    ])
    assert.deepEqual(order, ['first-start', 'first-end', 'second-start', 'second-end'])
})

test('market command is scoped to the configured command head and myset has no custom-theme bypass', () => {
    const command = fs.readFileSync(new URL('../apps/market.js', import.meta.url), 'utf8')
    const settings = fs.readFileSync(new URL('../apps/setting.js', import.meta.url), 'utf8')
    assert.equal(command.includes('reg: `^[#/]${commandHead}\\\\s+market'), true)
    assert.doesNotMatch(command, /\^\[#\/\]market/)
    assert.match(settings, /getThemeOptions\(pluginData\.theme\)/)
    assert.doesNotMatch(settings, /const custom = themeManager\.getTheme/)
})

test('market UI preserves Bot download capability without trusting anonymous responses', () => {
    assert.equal(normalizeMarketTheme({ slug: 'restricted-theme', name: 'Restricted', botDownloadAllowed: false }).botDownloadAllowed, false)
    assert.equal(normalizeMarketTheme({ slug: 'public-theme', name: 'Public', botDownloadAllowed: true }).botDownloadAllowed, true)
    assert.equal(normalizeMarketTheme({ slug: 'anonymous-theme', name: 'Anonymous' }).botDownloadAllowed, null)
    assert.equal(normalizeMarketTheme({ slug: 'inherited-theme', name: 'Inherited' }, false).botDownloadAllowed, false)
})
