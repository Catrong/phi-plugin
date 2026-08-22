import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import art from 'art-template'
import JSZip from 'jszip'
import Config from '../components/Config.js'
import { phiMarket } from '../apps/market.js'
import { buildMarketQuickMarkdown, sendMarketQuickCommands } from '../model/game/markdown.js'
import getBanGroup from '../model/user/getBanGroup.js'
import getNotes from '../model/user/getNotes.js'
import send from '../model/render/send.js'
import picmodle from '../model/render/picmodle.js'
import themeManager from '../model/theme/manager.js'
import themePolicy from '../model/theme/policy.js'
import { themesDir } from '../model/theme/paths.js'
import themeUseService, { ThemeUseService } from '../model/theme/useService.js'
import makeRequest from '../model/api/makeRequest.js'
import { downloadThemeArchive, ThemeMarketClientError } from '../model/theme/marketClient.js'
import {
    fetchThemeCatalog,
    fetchThemeDetail,
    getLocalThemeCatalog,
    getLocalThemeDetail,
    normalizeMarketTheme,
    THEME_MARKET_PAGE_SIZE,
} from '../model/theme/catalog.js'
import {
    installMarketArchive,
    isMarketThemeCached,
    marketWorkPath,
    recoverMarketInstall,
    withMarketInstallLock,
} from '../model/theme/installer.js'

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

test('market installer visibility follows the Bot blacklist and whitelist policy', async () => {
    const themeId = `markettest${Date.now()}`
    const target = path.join(themesDir, themeId)
    const previousPolicy = themePolicy.snapshot()
    try {
        const archive = await makeArchive(themeId, { topLevel: true })
        const receipt = await withMarketInstallLock(() => installMarketArchive(themeId, {
            version: '1.2.3', sha256,
        }, archive))
        assert.equal(receipt.slug, themeId)
        assert.equal(await isMarketThemeCached(themeId, { version: '1.2.3', sha256 }), true)
        themeManager.scan()
        assert.equal(themeManager.getTheme(themeId)?.marketInstalled, true)
        themePolicy.apply({ mode: 'blacklist', entries: [] }, false)
        assert.equal(themeManager.getThemeList().some(theme => theme.id === themeId), true)
        assert.equal(Boolean(themeManager.getThemeOptions()[themeId]), true)
        themePolicy.apply({ mode: 'blacklist', entries: [themeId] }, false)
        assert.equal(themeManager.getThemeList().some(theme => theme.id === themeId), false)
        assert.equal(Boolean(themeManager.getThemeOptions(themeId)[themeId]), false)
        const blockedLocalTheme = getLocalThemeCatalog(themeId).themes[0]
        assert.equal(blockedLocalTheme?.slug, themeId)
        assert.equal(blockedLocalTheme?.botDownloadAllowed, false)
        await assert.rejects(
            new ThemeUseService().use(themeId),
            error => /** @type {any} */(error)?.code === 'theme_not_allowed_by_bot',
        )
        themePolicy.apply({ mode: 'whitelist', entries: [themeId] }, false)
        assert.equal(themeManager.getThemeList().some(theme => theme.id === themeId), true)
        assert.equal((await new ThemeUseService().use(themeId)).cached, true)
    } finally {
        themePolicy.apply(previousPolicy, false)
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

test('theme use validates Bot access before installing on demand', async () => {
    /** @type {string[]} */
    const calls = []
    const service = new ThemeUseService({
        getTheme: async slug => {
            calls.push(`validate:${slug}`)
            return /** @type {any} */ ({ slug, name: 'Ocean Salt', botDownloadAllowed: true })
        },
        install: async slug => {
            calls.push(`install:${slug}`)
            return /** @type {any} */ ({ cached: false, version: '1.0.0', theme: { id: slug, name: 'Ocean Salt' } })
        },
    })

    const result = await service.use('ocean-salt')
    assert.deepEqual(calls, ['validate:ocean-salt', 'install:ocean-salt'])
    assert.equal(result.cached, false)
    assert.equal(result.theme.id, 'ocean-salt')
    assert.equal(result.detail.slug, 'ocean-salt')
})

test('theme use rejects invalid slugs before contacting the market', async () => {
    let called = false
    const service = new ThemeUseService({
        getTheme: async () => { called = true; return /** @type {any} */ ({}) },
        install: async () => /** @type {any} */({}),
    })
    await assert.rejects(service.use('../unsafe'), error => /** @type {any} */(error)?.code === 'theme_slug_invalid')
    assert.equal(called, false)
})

test('installed custom themes can be listed, inspected, and used without the API', async () => {
    const catalog = getLocalThemeCatalog('milthm')
    assert.equal(catalog.localOnly, true)
    assert.equal(catalog.total, 1)
    assert.equal(catalog.themes[0]?.slug, 'milthm')
    assert.equal(catalog.themes[0]?.local, true)
    assert.equal(catalog.themes[0]?.botDownloadAllowed, true)

    const detail = getLocalThemeDetail('milthm')
    assert.equal(detail?.name, 'Milthm')
    assert.equal(detail?.compatibility, '本地已安装')

    let onlineCalls = 0
    const service = new ThemeUseService({
        getTheme: async () => { onlineCalls++; throw new Error('must stay offline') },
        install: async () => { onlineCalls++; throw new Error('must stay offline') },
    })
    const result = await service.use('milthm')
    assert.equal(result.cached, true)
    assert.equal(result.theme.id, 'milthm')
    assert.equal(onlineCalls, 0)
})

test('market slug command lets a regular user download and select the theme', async () => {
    const originals = {
        getUserCfg: Config.getUserCfg,
        getBan: getBanGroup.get,
        getNotesData: getNotes.getNotesData,
        putNotesData: getNotes.putNotesData,
        send: send.send_with_At,
        use: themeUseService.use,
    }
    const pluginData = { theme: 'default' }
    /** @type {string[]} */ const messages = []
    /** @type {string[]} */ const used = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'cmdhead' ? 'phi' : key === 'openPhiPluginApi')
    getBanGroup.get = async () => false
    getNotes.getNotesData = async () => /** @type {any} */(pluginData)
    getNotes.putNotesData = (_userId, data) => data === pluginData
    send.send_with_At = async (_event, message) => { messages.push(String(message)) }
    themeUseService.use = async slug => {
        used.push(slug)
        return /** @type {any} */ ({ cached: false, version: '1.0.0', theme: { id: slug, name: 'Ocean Salt' } })
    }
    try {
        const command = new phiMarket()
        const handled = await command.market(/** @type {any} */({
            msg: '/phi market ocean-salt', user_id: 'regular-user', isMaster: false,
        }))
        assert.equal(handled, true)
        assert.deepEqual(used, ['ocean-salt'])
        assert.equal(pluginData.theme, 'ocean-salt')
        assert.match(messages.at(-1) || '', /主题已启用/)
    } finally {
        Config.getUserCfg = originals.getUserCfg
        getBanGroup.get = originals.getBan
        getNotes.getNotesData = originals.getNotesData
        getNotes.putNotesData = originals.putNotesData
        send.send_with_At = originals.send
        themeUseService.use = originals.use
    }
})

test('market command is scoped to the configured command head and myset has no custom-theme bypass', () => {
    const command = fs.readFileSync(new URL('../apps/market.js', import.meta.url), 'utf8')
    const settings = fs.readFileSync(new URL('../apps/setting.js', import.meta.url), 'utf8')
    assert.equal(command.includes("reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\\\s*)market"), true)
    assert.doesNotMatch(command, /escapedCommandHead/)
    assert.doesNotMatch(command, /\^\[#\/\]market/)
    assert.doesNotMatch(command, /if \(!e\.isMaster\)/)
    assert.match(command, /themeUseService\.use\(themeId\)/)
    assert.match(command, /pluginData\.theme = themeId/)
    assert.match(settings, /getThemeOptions\(pluginData\.theme\)/)
    assert.match(settings, /themeUseService\.use\(canonicalValue\)/)
    assert.doesNotMatch(settings, /const custom = themeManager\.getTheme/)
})

test('market UI preserves Bot download capability and uses the phi-plugin-api proxy', async () => {
    assert.equal(normalizeMarketTheme({ slug: 'restricted-theme', name: 'Restricted', botDownloadAllowed: false }).botDownloadAllowed, false)
    assert.equal(normalizeMarketTheme({ slug: 'public-theme', name: 'Public', botDownloadAllowed: true }).botDownloadAllowed, true)
    assert.equal(normalizeMarketTheme({ slug: 'anonymous-theme', name: 'Anonymous' }).botDownloadAllowed, null)
    const marketTemplate = fs.readFileSync(new URL('../resources/html/market/market.art', import.meta.url), 'utf8')
    assert.match(marketTemplate, /botDownloadAllowed === true/)
    assert.match(marketTemplate, />可用</)
    assert.match(marketTemplate, />不可用</)

    const layoutData = {
        defaultLayout: path.resolve('resources/html/common/layout/default.art'),
        _res_path: '/resources/',
        theme: 'default',
        themeInfo: null,
        sys: { scale: '' },
        bodyClass: '',
    }
    const localTheme = getLocalThemeDetail('milthm')
    const localCatalogHtml = art.render(marketTemplate, {
        ...layoutData,
        ...getLocalThemeCatalog(),
        currentTheme: 'milthm',
        commandHead: 'phi',
    })
    assert.match(localCatalogHtml, /本地离线模式/)
    assert.match(localCatalogHtml, /policy-local/)
    const detailTemplate = fs.readFileSync(new URL('../resources/html/market/detail.art', import.meta.url), 'utf8')
    const localDetailHtml = art.render(detailTemplate, { ...layoutData, detail: localTheme })
    assert.match(localDetailHtml, /已安装，可离线使用/)

    const originals = {
        list: makeRequest.getThemeMarketList,
        detail: makeRequest.getThemeMarketDetail,
    }
    makeRequest.getThemeMarketList = async () => ({
        ok: true,
        themes: [
            { slug: 'proxy-theme', name: 'Proxy Theme', botDownloadAllowed: false },
            { slug: 'milthm', name: 'Remote Milthm', botDownloadAllowed: false },
        ],
    })
    makeRequest.getThemeMarketDetail = async themeId => ({
        ok: true,
        theme: { slug: themeId, name: 'Proxy Theme', downloadPolicy: 'bot_only' },
        botDownloadAllowed: false,
        releaseNotes: 'proxy response',
    })
    try {
        const catalog = await fetchThemeCatalog()
        assert.equal(catalog.themes[0].slug, 'milthm')
        assert.equal(catalog.themes[0].local, true)
        assert.equal(catalog.themes.filter(theme => theme.slug === 'milthm').length, 1)
        assert.equal(catalog.themes.find(theme => theme.slug === 'proxy-theme')?.botDownloadAllowed, false)
        const detail = await fetchThemeDetail('proxy-theme')
        assert.equal(detail.botDownloadAllowed, false)
        assert.equal(detail.releaseNotes, 'proxy response')
    } finally {
        makeRequest.getThemeMarketList = originals.list
        makeRequest.getThemeMarketDetail = originals.detail
    }
})

test('market command falls back to local custom themes when API is disabled or unavailable', async () => {
    const originals = {
        getUserCfg: Config.getUserCfg,
        getBan: getBanGroup.get,
        getNotesData: getNotes.getNotesData,
        list: makeRequest.getThemeMarketList,
        market: picmodle.market,
        marketDetail: picmodle.marketDetail,
        sendWithAt: send.send_with_At,
        reply: send.reply,
    }
    let apiEnabled = false
    let onlineCalls = 0
    /** @type {any[]} */ const catalogs = []
    /** @type {any[]} */ const details = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => {
        if (key === 'cmdhead') return 'phi'
        if (key === 'openPhiPluginApi') return apiEnabled
        if (key === 'LetterMarkdown') return false
        return undefined
    })
    getBanGroup.get = async () => false
    getNotes.getNotesData = async () => /** @type {any} */({ theme: 'default' })
    makeRequest.getThemeMarketList = async () => {
        onlineCalls++
        throw Object.assign(new Error('offline'), { code: 'api_offline' })
    }
    picmodle.market = /** @type {any} */ (async (/** @type {any} */ _event, /** @type {any} */ data) => { catalogs.push(data); return 'local-market' })
    picmodle.marketDetail = /** @type {any} */ (async (/** @type {any} */ _event, /** @type {any} */ data) => { details.push(data); return 'local-detail' })
    send.send_with_At = async () => undefined
    send.reply = async () => undefined

    try {
        const command = new phiMarket()
        const event = (/** @type {string} */ msg) => /** @type {any} */({ msg, user_id: 'offline-market-user' })
        assert.equal(await command.market(event('/phi market')), true)
        assert.equal(onlineCalls, 0)
        assert.equal(catalogs[0]?.localOnly, true)
        assert.equal(catalogs[0]?.themes.some((/** @type {any} */ theme) => theme.slug === 'milthm'), true)

        apiEnabled = true
        assert.equal(await command.market(event('/phi market')), true)
        assert.equal(onlineCalls, 1)
        assert.equal(catalogs[1]?.localOnly, true)

        apiEnabled = false
        assert.equal(await command.market(event('/phi market detail milthm')), true)
        assert.equal(details[0]?.detail.local, true)
        assert.equal(details[0]?.detail.slug, 'milthm')
    } finally {
        Config.getUserCfg = originals.getUserCfg
        getBanGroup.get = originals.getBan
        getNotes.getNotesData = originals.getNotesData
        makeRequest.getThemeMarketList = originals.list
        picmodle.market = originals.market
        picmodle.marketDetail = originals.marketDetail
        send.send_with_At = originals.sendWithAt
        send.reply = originals.reply
    }
})

test('market page sends one safe Markdown action row for each displayed theme', async () => {
    const themes = [
        { slug: 'ocean-salt', name: 'Ocean "Salt"', botDownloadAllowed: true },
        { slug: 'restricted-theme', name: 'Restricted | Theme', botDownloadAllowed: false },
    ]
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'cmdhead' ? 'custom' : key === 'LetterMarkdown')
    send.reply = async (_event, message) => { replies.push(message); return {} }
    try {
        const markdown = buildMarketQuickMarkdown(/** @type {any} */(themes), { page: 2, pageCount: 3 })
        assert.match(markdown, /Ocean "Salt" \| <qqbot-cmd-input text="\/custom market detail ocean-salt" show="查看详情"/)
        assert.match(markdown, /text="\/custom market ocean-salt" show="使用主题"/)
        assert.match(markdown, /Restricted \\| Theme \| <qqbot-cmd-input text="\/custom market detail restricted-theme" show="查看详情"/)
        assert.match(markdown, /text="\/custom market restricted-theme" show="使用主题"/)
        assert.match(markdown, /text="\/custompr" show="上一页"/)
        assert.match(markdown, /text="\/customnx" show="下一页"/)
        assert.equal((markdown.match(/^\|/gm) || []).length, themes.length + 4)

        await sendMarketQuickCommands(/** @type {any} */({}), /** @type {any} */(themes))
        assert.equal(replies.length, 1)
        assert.equal(replies[0]?.type, 'markdown')
        assert.match(replies[0]?.text || '', /\/custom market ocean-salt/)
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
    }
})

test('market page sends no quick-command text when Markdown is disabled or fails', async () => {
    const themes = /** @type {any} */ ([{ slug: 'ocean-salt', name: 'Ocean Salt', botDownloadAllowed: true }])
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    let calls = 0
    try {
        Config.getUserCfg = /** @type {any} */ (() => false)
        send.reply = async () => { calls++; return {} }
        await sendMarketQuickCommands(/** @type {any} */({}), themes)
        assert.equal(calls, 0)

        Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown')
        send.reply = async () => { calls++; throw new Error('markdown unavailable') }
        await sendMarketQuickCommands(/** @type {any} */({}), themes)
        assert.equal(calls, 1)

        send.reply = async () => { calls++; return { error: [new Error('markdown rejected')] } }
        await sendMarketQuickCommands(/** @type {any} */({}), themes)
        assert.equal(calls, 2)

        const guoba = fs.readFileSync(new URL('../guoba.support.js', import.meta.url), 'utf8')
        assert.match(guoba, /field: 'LetterMarkdown'/)
        assert.doesNotMatch(guoba, /field: 'letterMarkdown'/)
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
    }
})

test('market shorthand navigation preserves the current query and page state', async () => {
    const originals = {
        getUserCfg: Config.getUserCfg,
        getBan: getBanGroup.get,
        getNotesData: getNotes.getNotesData,
        list: makeRequest.getThemeMarketList,
        market: picmodle.market,
        sendWithAt: send.send_with_At,
        reply: send.reply,
    }
    /** @type {{query:string,page:number,pageCount:number,commandHead:string}[]} */ const rendered = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => {
        if (key === 'cmdhead') return 'custom'
        if (key === 'openPhiPluginApi') return true
        if (key === 'LetterMarkdown') return false
        return undefined
    })
    getBanGroup.get = async () => false
    getNotes.getNotesData = async () => /** @type {any} */({ theme: 'default' })
    makeRequest.getThemeMarketList = async () => ({
        ok: true,
        themes: Array.from({ length: THEME_MARKET_PAGE_SIZE + 2 }, (_, index) => ({
            slug: `ocean-theme-${index}`,
            name: `Ocean Theme ${index}`,
            summary: 'ocean results',
            botDownloadAllowed: true,
        })),
    })
    picmodle.market = /** @type {any} */ (async (/** @type {any} */ _event, /** @type {any} */ data) => {
        rendered.push({ query: data.query, page: data.page, pageCount: data.pageCount, commandHead: data.commandHead })
        return `market-page-${data.page}`
    })
    send.send_with_At = async () => undefined
    send.reply = async () => undefined

    try {
        const command = new phiMarket()
        const event = (/** @type {string} */ msg) => /** @type {any} */({
            msg, user_id: 'market-nav-user', group_id: 'market-nav-group', platform: 'test', isGroup: true,
        })
        assert.equal(await command.market(event('/custom market list ocean 1')), true)
        assert.equal(await command.marketPage(event('/customnx')), true)
        assert.equal(await command.marketPage(event('/custom pr')), true)
        assert.deepEqual(rendered, [
            { query: 'ocean', page: 1, pageCount: 2, commandHead: 'custom' },
            { query: 'ocean', page: 2, pageCount: 2, commandHead: 'custom' },
            { query: 'ocean', page: 1, pageCount: 2, commandHead: 'custom' },
        ])
        assert.match(String(command.rule?.[1]?.reg || ''), /nx\|pr\|上一页\|下一页/)
    } finally {
        Config.getUserCfg = originals.getUserCfg
        getBanGroup.get = originals.getBan
        getNotes.getNotesData = originals.getNotesData
        makeRequest.getThemeMarketList = originals.list
        picmodle.market = originals.market
        send.send_with_At = originals.sendWithAt
        send.reply = originals.reply
    }
})

test('market catalog filters before paginating and list-only requests do not alter user settings', async () => {
    const originalList = makeRequest.getThemeMarketList
    const themes = Array.from({ length: THEME_MARKET_PAGE_SIZE + 2 }, (_, index) => ({
        slug: `page-theme-${index}`,
        name: `Page Theme ${index}`,
        summary: 'pagination',
        updatedAt: `2026-08-${String(19 - Math.min(index, 18)).padStart(2, '0')}`,
    }))
    makeRequest.getThemeMarketList = async () => ({ ok: true, themes })
    try {
        const first = await fetchThemeCatalog('pagination', 1)
        assert.equal(first.page, 1)
        assert.equal(first.pageCount, 2)
        assert.equal(first.total, THEME_MARKET_PAGE_SIZE + 2)
        assert.equal(first.themes.length, THEME_MARKET_PAGE_SIZE)
        const second = await fetchThemeCatalog('pagination', 2)
        assert.equal(second.page, 2)
        assert.equal(second.themes.length, 2)
        assert.notEqual(first.themes[0].slug, second.themes[0].slug)
    } finally {
        makeRequest.getThemeMarketList = originalList
    }

    const command = fs.readFileSync(new URL('../apps/market.js', import.meta.url), 'utf8')
    assert.match(command, /fetchThemeCatalog/)
    assert.match(command, /marketDetail/)
    const listBranch = command.slice(command.indexOf('// 无参数'), command.indexOf('// detail/info'))
    assert.doesNotMatch(listBranch, /putNotesData\(/)
})
