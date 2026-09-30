import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import JSZip from 'jszip'
import {
    installMarketArchive,
    marketWorkPath,
    recoverAllMarketInstalls,
    recoverMarketInstall,
} from '../model/theme/installer.js'
import { cleanStaleMarketWork } from '../model/theme/recovery.js'
import { themesDir } from '../model/theme/paths.js'
import { addThemesToBackup, restoreThemesFromBackup } from '../model/save/getBackup.js'

const SHA256 = 'c'.repeat(64)

test('force updates and Git ignore rules preserve installed theme directories', () => {
    const gitignore = fs.readFileSync(new URL('../.gitignore', import.meta.url), 'utf8')
    const updateCommand = fs.readFileSync(new URL('../apps/update.js', import.meta.url), 'utf8')
    assert.match(gitignore, /^\/resources\/themes\/\*$/m)
    assert.match(updateCommand, /clean -fd -e resources\/themes\//)
})

/** @param {string} directory @param {string} themeId @param {string} marker */
async function writeMarketTheme(directory, themeId, marker) {
    await fs.promises.mkdir(directory, { recursive: true })
    await fs.promises.writeFile(path.join(directory, 'info.yaml'), `id: ${themeId}\nname: ${marker}\n`)
    await fs.promises.writeFile(path.join(directory, 'marker.txt'), marker)
    await fs.promises.writeFile(path.join(directory, '.phi-market.json'), `${JSON.stringify({
        installedAt: new Date().toISOString(),
        sha256: SHA256,
        slug: themeId,
        source: 'phi-theme-marketplace',
        version: '1.0.0',
    })}\n`)
}

/** @param {string} themeId */
async function makeArchive(themeId) {
    const zip = new JSZip()
    zip.file('info.yaml', `id: ${themeId}\nname: Downloaded\n`)
    zip.file('b19.css', 'body { color: white; }\n')
    const archivePath = marketWorkPath(`storage-${themeId}-${crypto.randomUUID()}.zip`)
    await fs.promises.mkdir(path.dirname(archivePath), { recursive: true })
    await fs.promises.writeFile(archivePath, await zip.generateAsync({ type: 'nodebuffer' }))
    return archivePath
}

test('market recovery matches the complete slug and keeps similarly prefixed backups', async () => {
    const base = `exact${Date.now()}${crypto.randomBytes(2).toString('hex')}`
    const other = `${base}-extra`
    const target = path.join(themesDir, base)
    const otherTarget = path.join(themesDir, other)
    const ownBackup = path.join(themesDir, `.phi-market-backup-${base}-${crypto.randomUUID()}`)
    const otherBackup = path.join(themesDir, `.phi-market-backup-${other}-${crypto.randomUUID()}`)
    try {
        await writeMarketTheme(target, base, 'current')
        await fs.promises.mkdir(otherTarget, { recursive: true })
        await fs.promises.writeFile(path.join(otherTarget, 'info.yaml'), `id: ${other}\nname: Local\n`)
        await writeMarketTheme(ownBackup, base, 'old')
        await writeMarketTheme(otherBackup, other, 'other')
        await recoverMarketInstall(base)
        assert.equal(fs.existsSync(ownBackup), false)
        assert.equal(fs.existsSync(otherBackup), true)
    } finally {
        await Promise.all([target, otherTarget, ownBackup, otherBackup].map(item =>
            fs.promises.rm(item, { recursive: true, force: true })))
    }
})

test('market recovery replaces a damaged marketplace target with a healthy backup', async () => {
    const themeId = `damaged${Date.now()}${crypto.randomBytes(2).toString('hex')}`
    const target = path.join(themesDir, themeId)
    const backup = path.join(themesDir, `.phi-market-backup-${themeId}-${crypto.randomUUID()}`)
    try {
        await fs.promises.mkdir(target, { recursive: true })
        await fs.promises.writeFile(path.join(target, 'info.yaml'), `id: ${themeId}\nname: Broken\n`)
        await fs.promises.writeFile(path.join(target, '.phi-market.json'), '{truncated')
        await writeMarketTheme(backup, themeId, 'healthy-backup')

        const result = await recoverMarketInstall(themeId)
        assert.equal(result.healthy, true)
        assert.equal(await fs.promises.readFile(path.join(target, 'marker.txt'), 'utf8'), 'healthy-backup')
        assert.equal(fs.existsSync(backup), false)
    } finally {
        await Promise.all([target, backup].map(item =>
            fs.promises.rm(item, { recursive: true, force: true })))
    }
})

test('startup recovery discovers interrupted installs without another install request', async () => {
    const themeId = `startup${Date.now()}${crypto.randomBytes(2).toString('hex')}`
    const target = path.join(themesDir, themeId)
    const backup = path.join(themesDir, `.phi-market-backup-${themeId}-${crypto.randomUUID()}`)
    try {
        await writeMarketTheme(backup, themeId, 'startup-backup')
        const failures = await recoverAllMarketInstalls()
        assert.equal(failures.some(item => item.themeId === themeId), false)
        assert.equal(await fs.promises.readFile(path.join(target, 'marker.txt'), 'utf8'), 'startup-backup')
    } finally {
        await Promise.all([target, backup].map(item =>
            fs.promises.rm(item, { recursive: true, force: true })))
    }
})

test('startup work cleanup also handles installs that never created a backup', async () => {
    const work = await fs.promises.mkdtemp(path.join(path.dirname(themesDir), '.phi-work-cleanup-'))
    const orphan = path.join(work, 'download-orphan.zip')
    try {
        await fs.promises.writeFile(orphan, 'partial download')
        await cleanStaleMarketWork(true, work)
        assert.equal(fs.existsSync(orphan), false)
    } finally {
        await fs.promises.rm(work, { recursive: true, force: true })
    }
})

test('a local theme conflict still removes the already downloaded archive', async () => {
    const themeId = `conflict${Date.now()}${crypto.randomBytes(2).toString('hex')}`
    const target = path.join(themesDir, themeId)
    let archivePath = ''
    try {
        await fs.promises.mkdir(target, { recursive: true })
        await fs.promises.writeFile(path.join(target, 'info.yaml'), `id: ${themeId}\nname: Local\n`)
        archivePath = await makeArchive(themeId)
        await assert.rejects(
            installMarketArchive(themeId, { version: '1.0.0', sha256: SHA256 }, archivePath),
            error => /** @type {any} */ (error)?.code === 'theme_conflicts_with_local_theme',
        )
        assert.equal(fs.existsSync(archivePath), false)
    } finally {
        await fs.promises.rm(target, { recursive: true, force: true })
        if (archivePath) await fs.promises.rm(archivePath, { force: true })
    }
})

test('theme backup includes installed themes and restore preserves an existing target', async () => {
    const themeId = `stored${Date.now()}${crypto.randomBytes(2).toString('hex')}`
    const target = path.join(themesDir, themeId)
    try {
        await fs.promises.mkdir(path.join(target, 'nested'), { recursive: true })
        await fs.promises.writeFile(path.join(target, 'info.yaml'), `id: ${themeId}\nname: Stored\n`)
        await fs.promises.writeFile(path.join(target, 'nested', 'asset.txt'), 'from-backup')

        const backup = new JSZip()
        const result = addThemesToBackup(backup)
        assert.ok(result.themes >= 1)
        assert.ok(backup.file(`themes/${themeId}/nested/asset.txt`))

        const restoreZip = new JSZip()
        restoreZip.file(`themes/${themeId}/info.yaml`, `id: ${themeId}\nname: Stored\n`)
        restoreZip.file(`themes/${themeId}/nested/asset.txt`, 'from-backup')
        await fs.promises.rm(target, { recursive: true, force: true })
        assert.deepEqual(await restoreThemesFromBackup(restoreZip), { restored: 1, skipped: 0 })
        assert.equal(await fs.promises.readFile(path.join(target, 'nested', 'asset.txt'), 'utf8'), 'from-backup')

        await fs.promises.writeFile(path.join(target, 'nested', 'asset.txt'), 'keep-current')
        assert.deepEqual(await restoreThemesFromBackup(restoreZip), { restored: 0, skipped: 1 })
        assert.equal(await fs.promises.readFile(path.join(target, 'nested', 'asset.txt'), 'utf8'), 'keep-current')
    } finally {
        await fs.promises.rm(target, { recursive: true, force: true })
    }
})

test('a POSIX theme backup streams and restores locally valid file names', {
    skip: process.platform === 'win32',
}, async () => {
    const themeId = `portable${Date.now()}${crypto.randomBytes(2).toString('hex')}`
    const target = path.join(themesDir, themeId)
    try {
        await fs.promises.mkdir(target, { recursive: true })
        await fs.promises.writeFile(path.join(target, 'info.yaml'), `id: ${themeId}\nname: Portable\n`)
        for (const fileName of ['palette:night.css', 'trailing.', 'CON.asset']) {
            await fs.promises.writeFile(path.join(target, fileName), fileName)
        }

        const backup = new JSZip()
        addThemesToBackup(backup)
        const bytes = await backup.generateAsync({ type: 'nodebuffer', streamFiles: true })
        await fs.promises.rm(target, { recursive: true, force: true })
        const loaded = await JSZip.loadAsync(bytes)
        const result = await restoreThemesFromBackup(loaded)
        assert.ok(result.restored >= 1)
        for (const fileName of ['palette:night.css', 'trailing.', 'CON.asset']) {
            assert.equal(await fs.promises.readFile(path.join(target, fileName), 'utf8'), fileName)
        }
    } finally {
        await fs.promises.rm(target, { recursive: true, force: true })
    }
})
