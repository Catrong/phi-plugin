import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire, registerHooks } from 'node:module'
import { randomUUID } from 'node:crypto'

// 仅独立进程执行：启动真实 Koishi 入口与 SDK，关闭联网 API，所有截图写入系统临时目录。
const require = createRequire(import.meta.url)
const { App } = require('koishi')
const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-koishi-entry-real-'))
process.chdir(outputRoot)
let forbidPuppeteer = true
let puppeteerResolves = 0
registerHooks({ resolve(specifier, context, next) {
    if (specifier === 'puppeteer') {
        puppeteerResolves++
        if (forbidPuppeteer) throw new Error('纯 Shotium 阶段禁止加载 Puppeteer')
    }
    return next(specifier, context)
} })

const entry = await import('../../koishi.js')
const { getPlatformAdapter } = await import('../../components/platform/state.js')
const { getHostSettings } = await import('../../components/settings/host.js')
const app = new App()
app.provide('database', {}, true)
app.provide('puppeteer', undefined, true)
await app.start()
let applications = 0
let hostBrowserClosed = 0
const plugin = {
    name: 'phi-plugin-entry-smoke', inject: entry.inject,
    async apply(ctx, config) { applications++; return entry.apply(ctx, config) },
}
const baseConfig = {
    renderer: 'shotium', renderNum: 1, timeout: 30000,
    openPhiPluginApi: false, watchInfoPath: false, database: false,
    cmdhead: 'entrysmoke', koishiShortcuts: [], githubProxy: false,
}
let fork = app.plugin(plugin, baseConfig)
let pool
let sdk
const daemonOptions = { name: `phi-entry-smoke-${process.pid}-${randomUUID()}`, idleTimeoutMs: 600 }
const results = { outputRoot, daemonOptions, sdk: '0.12.2' }

async function settle() {
    while (app.events._tasks.size) await Promise.allSettled([...app.events._tasks])
    await new Promise(resolve => setImmediate(resolve))
}

async function until(check, message, timeout = 15000) {
    const deadline = Date.now() + timeout
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10))
    assert.ok(check(), message)
}

const template = path.join(outputRoot, 'page.art')
await fs.writeFile(template, '<html><head><meta charset="utf-8"><style>body{margin:0}#container{box-sizing:border-box;width:180px;height:120px;background:{{color}};padding:15px;font:18px "Microsoft YaHei",sans-serif;color:white}</style></head><body><div id="container">Koishi {{text}}</div></body></html>')

async function capture(file, text, color = '#1967d2', backend = 'shotium') {
    const idx = await pool.acquire(5000)
    assert.ok(idx >= 0, '应成功借到当前渲染器')
    const slot = pool.puppeteer[idx]
    slot.config.shotiumDaemonOptions = daemonOptions
    slot.config.idleTimeout = 0
    const instance = await slot.getInstance()
    assert.ok(instance)
    if (backend === 'puppeteer') instance.config.userDataDir = path.join(outputRoot, 'chrome-profile')
    try {
        const image = await slot.screenshot('entry-smoke', {
            tplFile: template, text, color, imgType: 'png',
            pageGotoParams: { timeout: 30000, waitUntil: 'load' },
        })
        assert.ok(Buffer.isBuffer(image), '真实后端应返回 PNG Buffer')
        assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
        assert.equal(image.readUInt32BE(16), 180)
        assert.equal(image.readUInt32BE(20), 120)
        await fs.writeFile(path.join(outputRoot, file), image)
        return { bytes: image.length, width: 180, height: 120, instance }
    } finally {
        pool.release(idx)
    }
}

try {
    await settle()
    assert.equal(fork.runtime.status, 2, `真实入口应启动完成，error=${fork.runtime.error || ''}`)
    assert.equal(applications, 1)
    assert.equal(app.puppeteer, undefined)
    pool = (await import('../../model/render/picmodle.js')).default
    const firstRuntime = await import('../../runtime.js')
    const firstOwner = pool.sessionOwner
    assert.ok(firstOwner)
    assert.equal(pool.getRendererSettings().renderer, 'shotium')
    const first = await capture('01-shotium.png', '首次启动')
    const firstClient = first.instance.client
    assert.ok(firstClient && !firstClient.closed)
    assert.equal(puppeteerResolves, 0)
    results.pureShotiumWithoutPuppeteer = { width: first.width, height: first.height, bytes: first.bytes, forbiddenPuppeteerResolves: puppeteerResolves }

    fork.update({ ...fork.config, renderNum: 2, timeout: 25000, renderQueueLimit: 8, waitingTimeout: 6000, randerQuality: 95, renderScale: 125 })
    await settle()
    assert.equal(applications, 1, '批量渲染配置修改不能重载入口')
    assert.equal(pool.sessionOwner, firstOwner)
    assert.equal(pool.rendererSettings.count, 2)
    assert.equal(pool.rendererSettings.timeout, 25000)
    assert.equal(getHostSettings().randerQuality, 95)
    assert.equal(getHostSettings().renderScale, 125)
    const updated = await capture('02-updated.png', '配置原位更新', '#673ab7')
    assert.equal(puppeteerResolves, 0)
    results.dynamicConfig = { applications, count: pool.rendererSettings.count, timeout: pool.rendererSettings.timeout, pngBytes: updated.bytes }

    assert.throws(() => fork.update({ ...fork.config, renderer: 'puppeteer' }), /koishi-plugin-puppeteer/)
    assert.equal(fork.config.renderer, 'shotium')
    assert.equal(getHostSettings().renderer, 'shotium')
    assert.equal(applications, 1)
    results.missingPuppeteerRejectedAtomically = true

    const oldAdapter = getPlatformAdapter()
    const oldSlots = [...pool.puppeteer]
    fork.dispose()
    await until(() => getPlatformAdapter() === undefined, '卸载应完成平台解绑')
    assert.equal(oldAdapter.isStopped(), true)
    assert.ok(oldSlots.every(slot => slot.shutdownRequested))
    assert.equal(firstClient.closed, true)
    assert.deepEqual(getHostSettings(), {})
    const watchers = (await import('../../components/FileWatcherRegistry.js')).default
    assert.equal(watchers.entries.size, 0)
    results.unloaded = { nativeClientClosed: firstClient.closed, templateWatchers: Object.keys(first.instance.watcher).length, registryWatchers: watchers.entries.size }

    fork = app.plugin(plugin, { ...baseConfig, cmdhead: 'entryreload' })
    await settle()
    assert.equal(fork.runtime.status, 2, `缓存重载应成功，error=${fork.runtime.error || ''}`)
    assert.equal(applications, 2)
    assert.notEqual(pool.sessionOwner, firstOwner)
    assert.equal((await import('../../runtime.js')).apps, firstRuntime.apps, '重载必须复用同一份缓存业务模块')
    assert.ok(watchers.entries.has('version:readme'))
    assert.ok(watchers.entries.has('b19:themes'))
    const reloaded = await capture('03-reloaded.png', '缓存重载后出图', '#008577')
    assert.notEqual(reloaded.instance.client, firstClient)
    assert.equal(puppeteerResolves, 0)
    results.cachedReload = { applications, nativeClientRecreated: reloaded.instance.client !== firstClient, pngBytes: reloaded.bytes }

    forbidPuppeteer = false
    const chrome = process.env.PHI_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    await fs.access(chrome)
    const hostBrowser = { close() { hostBrowserClosed++ }, process() { return { spawnfile: chrome } } }
    app.puppeteer = { config: { executablePath: chrome }, browser: hostBrowser }
    await settle()
    const applicationsBeforeSwitch = applications
    fork.update({ ...fork.config, renderer: 'puppeteer', renderNum: 1 })
    await settle()
    assert.equal(applications, applicationsBeforeSwitch)
    assert.equal(pool.getRendererSettings().renderer, 'puppeteer')
    const chromeImage = await capture('04-puppeteer.png', 'Puppeteer 原位切换', '#e65100', 'puppeteer')
    assert.notEqual(chromeImage.instance.browser, hostBrowser, '浏览器须归本插件实例所有')
    fork.update({ ...fork.config, renderer: 'shotium', timeout: 30000 })
    await settle()
    assert.equal(applications, applicationsBeforeSwitch)
    const back = await capture('05-back-to-shotium.png', '切回 Shotium', '#c2185b')
    await Promise.allSettled([...pool.retired.values()])
    assert.equal(chromeImage.instance.browser, false)
    assert.equal(hostBrowserClosed, 0)
    results.actualBidirectionalSwitch = { applicationsBeforeSwitch, applicationsAfterSwitch: applications, puppeteerBytes: chromeImage.bytes, shotiumBytes: back.bytes, hostBrowserClosed }

    sdk = await import('@pixel.js/shotium')
    fork.dispose()
    await until(() => getPlatformAdapter() === undefined, '最终卸载应完成')
    assert.equal(watchers.entries.size, 0)
    await new Promise(resolve => setTimeout(resolve, 1200))
    const status = await sdk.daemon.status({ ...daemonOptions, spawn: false })
    assert.equal(status.running, false, '测试的私有 daemon 应在所有连接释放后空闲退出')
    assert.equal(hostBrowserClosed, 0)
    results.finalCleanup = { registryWatchers: watchers.entries.size, hostBrowserClosed, daemonIdleExited: !status.running }
    await fs.writeFile(path.join(outputRoot, 'results.json'), JSON.stringify(results, null, 2))
    console.log(JSON.stringify(results))
} finally {
    fork.dispose()
    if (pool?.sessionOwner) await pool.endSession(pool.sessionOwner)
    await app.stop()
    await until(() => getPlatformAdapter() === undefined, '异常或结束时仍应释放 Context').catch(() => {})
}
