import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { useKoishiAdapter, KoishiRenderer } from '../components/platform/koishi.js'

useKoishiAdapter({}, { database: false })
const { default: KoishiShotium, loadKoishiShotiumSDK } = await import('../model/render/koishiShotium.js')

class Client extends EventEmitter {
    constructor() {
        super()
        this.closed = false
        this.closes = 0
        /** @type {{method: string, options: any}[]} */
        this.calls = []
        this.image = Buffer.from('single')
    }
    /** @param {any} options */
    async screenshot(options) {
        this.calls.push({ method: 'screenshot', options })
        return { image: this.image }
    }
    /** @param {any} options */
    async screenshotTiles(options) {
        this.calls.push({ method: 'screenshotTiles', options })
        return { tiles: [{ image: new Uint8Array([1, 2]) }, { image: Buffer.from([3]) }] }
    }
    close() {
        this.closes++
        this.closed = true
        this.emit('close')
    }
}

/** @template T @returns {{promise: Promise<T>, resolve: (value: T) => void}} */
function deferred() {
    let resolve = /** @type {(value: T) => void} */ (/** @type {unknown} */ (null))
    const promise = new Promise(/** @param {(value: T) => void} done */ done => { resolve = done })
    return { promise, resolve }
}

/** @param {(root: string, template: string, name: string) => Promise<void>} run */
async function withTemplate(run) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-koishi-shotium-'))
    const template = path.join(root, 'page.art')
    const name = `phi-koishi-shotium-test-${process.pid}-${path.basename(root)}`
    await fs.writeFile(template, '<body><div id="container">{{value}}</div></body>')
    try {
        await run(root, template, name)
    } finally {
        await fs.rm(path.resolve('temp/html', name), { recursive: true, force: true })
        await fs.rm(root, { recursive: true, force: true })
    }
}

/** @param {Client} [client] @param {any} [config] */
function create(client = new Client(), config = {}) {
    let loads = 0
    /** @type {any[]} */
    const connections = []
    const renderer = new KoishiShotium({
        sdkLoader: async () => {
            loads++
            return { daemon: { connect: async (/** @type {any} */ options) => { connections.push(options); return client } } }
        },
        ...config,
    }, 'test')
    return { renderer, client, connections, get loads() { return loads } }
}

test('Koishi Shotium 继承平台模板基类，构造及未用实例卸载均不加载 SDK', async () => {
    const fixture = create()
    assert.ok(fixture.renderer instanceof KoishiRenderer)
    assert.deepEqual(fixture.renderer.viewport, { width: 800, height: 600 })
    assert.equal(fixture.loads, 0)
    await fixture.renderer.shutdown()
    assert.equal(fixture.loads, 0)
    assert.equal(fixture.client.closes, 0)
    assert.equal(await fixture.renderer.browserInit(), false)
})

test('SDK 预检只加载模块，不启动引擎；缺依赖与原生加载失败均给出安装诊断', async () => {
    let connected = false
    const sdk = { daemon: { connect: async () => { connected = true; return new Client() } } }
    assert.equal(await loadKoishiShotiumSDK(async () => sdk), sdk)
    assert.equal(connected, false)
    const missing = Object.assign(new Error("Cannot find package '@pixel.js/shotium'"), { code: 'ERR_MODULE_NOT_FOUND' })
    await assert.rejects(loadKoishiShotiumSDK(async () => { throw missing }), /npm install @pixel\.js\/shotium/)
    await assert.rejects(loadKoishiShotiumSDK(async () => { throw new Error('native binary unavailable') }), /当前平台原生依赖.*native binary unavailable/)
    await assert.rejects(loadKoishiShotiumSDK(async () => ({})), /升级 @pixel\.js\/shotium/)
})

test('并发初始化共享一次 SDK 加载及长连接，daemon 使用插件目录命名', async () => {
    const fixture = create()
    const second = create()
    try {
        const clients = await Promise.all([fixture.renderer.browserInit(), fixture.renderer.browserInit()])
        assert.deepEqual(clients, [fixture.client, fixture.client])
        assert.equal(fixture.loads, 1)
        assert.equal(fixture.connections.length, 1)
        assert.match(fixture.connections[0].name, /^phi-koishi-[a-f0-9]{20}$/)
        assert.equal(fixture.connections[0].idleTimeoutMs, 300000)
        await second.renderer.browserInit()
        assert.equal(second.connections[0].name, fixture.connections[0].name)
        await fixture.renderer.shutdown()
        assert.equal(fixture.client.closes, 1)
        assert.equal(second.client.closes, 0)
    } finally {
        await Promise.all([fixture.renderer.shutdown(), second.renderer.shutdown()])
    }
})

test('PNG 清晰度、透明背景、页面加载参数及保存路径保持兼容，截图只有一次', async () => {
    await withTemplate(async (root, template, name) => {
        const fixture = create(undefined, { puppeteerTimeout: 5000, viewport: { width: 1800, height: 800 } })
        const input = {
            tplFile: template, saveId: 'caller', value: '正文', imgType: /** @type {const} */ ('png'),
            quality: 23, omitBackground: true, path: path.join(root, 'nested', 'image.png'),
            pageGotoParams: { timeout: 1234, waitUntil: ['networkidle0', 'load'] },
        }
        try {
            assert.equal(await fixture.renderer.screenshot(name, input), fixture.client.image)
            const options = fixture.client.calls[0].options
            assert.equal(fixture.client.calls.length, 1)
            assert.equal(options.selector, '#container, body:not(:has(#container))')
            assert.equal(options.type, 'png')
            assert.equal(options.quality, undefined)
            assert.equal(options.omitBackground, true)
            assert.equal(options.allowFileAccess, true)
            assert.equal(options.path, undefined)
            assert.deepEqual(options.viewport, { width: 1800, height: 800 })
            assert.deepEqual(options.pageGotoParams, { timeout: 1234, waitUntil: 'networkidle' })
            assert.deepEqual(await fs.readFile(input.path), fixture.client.image)
            assert.equal(input.saveId, 'caller')
            assert.equal(/** @type {any} */ (input).resPath, undefined)
            assert.deepEqual(await fs.readdir(path.resolve('temp/html', name)), [])
        } finally {
            await fixture.renderer.shutdown()
        }
    })
})

test('JPEG 忽略透明背景，WebP 保留透明背景且品质归一，单次捕获', async () => {
    await withTemplate(async (_root, template, name) => {
        const fixture = create()
        try {
            await fixture.renderer.screenshot(name, { tplFile: template, imgType: 'jpeg', quality: 95, omitBackground: true })
            await fixture.renderer.screenshot(name, { tplFile: template, imgType: 'webp', quality: 99.4, omitBackground: true, pageGotoParams: { timeout: 0 } })
            await fixture.renderer.screenshot(name, { tplFile: template, imgType: 'jpeg', quality: 150 })
            const [jpeg, webp, invalidQuality] = fixture.client.calls.map(call => call.options)
            assert.equal(jpeg.quality, 95)
            assert.equal(jpeg.omitBackground, undefined)
            assert.equal(webp.quality, 99)
            assert.equal(webp.omitBackground, true)
            assert.equal(webp.pageGotoParams.timeout, 0)
            assert.equal(invalidQuality.quality, 90)
            assert.equal(new Set(fixture.client.calls.map(call => call.options.file)).size, 3)
        } finally {
            await fixture.renderer.shutdown()
        }
    })
})

test('分页只加载一次并返回 Buffer 数组，维持 JPEG 和保存首图的原有语义', async () => {
    await withTemplate(async (root, template, name) => {
        const fixture = create()
        const savePath = path.join(root, 'pages', 'first.jpg')
        try {
            assert.deepEqual(await fixture.renderer.screenshot(name, {
                tplFile: template, multiPage: true, multiPageHeight: 40001, imgType: 'png', quality: 96, path: savePath,
            }), [Buffer.from([1, 2]), Buffer.from([3])])
            assert.equal(fixture.client.calls.length, 1)
            assert.equal(fixture.client.calls[0].method, 'screenshotTiles')
            assert.deepEqual(fixture.client.calls[0].options.tile, { height: 32000 })
            assert.equal(fixture.client.calls[0].options.type, 'jpeg')
            assert.equal(fixture.client.calls[0].options.quality, 96)
            assert.equal(fixture.client.calls[0].options.selector, '#container, body:not(:has(#container))')
            assert.deepEqual(await fs.readFile(savePath), Buffer.from([1, 2]))
        } finally {
            await fixture.renderer.shutdown()
        }
    })
})

test('卸载等待在途截图，再关闭自己的连接和全部 watcher', async () => {
    await withTemplate(async (_root, template, name) => {
        const capture = deferred()
        const started = deferred()
        const fixture = create()
        fixture.client.screenshot = async options => {
            fixture.client.calls.push({ method: 'screenshot', options })
            started.resolve(undefined)
            await capture.promise
            assert.equal(fixture.client.closed, false)
            return { image: Buffer.from('完成') }
        }
        const rendering = fixture.renderer.screenshot(name, { tplFile: template })
        await started.promise
        const watchers = Object.values(/** @type {any} */ (fixture.renderer.watcher))
        let closedWatchers = 0
        for (const watcher of /** @type {any[]} */ (watchers)) {
            const close = watcher.close.bind(watcher)
            watcher.close = async () => { closedWatchers++; await close() }
        }
        const closing = fixture.renderer.shutdown()
        assert.equal(await fixture.renderer.screenshot(name, { tplFile: template }), false)
        assert.equal(fixture.client.closes, 0)
        capture.resolve(undefined)
        assert.deepEqual(await rendering, Buffer.from('完成'))
        await closing
        await fixture.renderer.shutdown()
        assert.equal(fixture.client.closes, 1)
        assert.equal(closedWatchers, watchers.length)
        assert.deepEqual(fixture.renderer.watcher, {})
        assert.deepEqual(fixture.renderer.html, {})
        assert.equal(fixture.renderer.pending.size, 0)
    })
})

test('初始化途中卸载或强制退出，迟到的新连接立即释放', async () => {
    for (const force of [false, true]) {
        const connection = deferred()
        const started = deferred()
        const client = new Client()
        const renderer = new KoishiShotium({ sdkLoader: async () => ({ daemon: { connect: () => { started.resolve(undefined); return connection.promise } } }) })
        const initializing = renderer.browserInit()
        await started.promise
        const closing = force ? (renderer.forceShutdown(), renderer.shutdown()) : renderer.shutdown()
        connection.resolve(client)
        assert.equal(await initializing, false)
        await closing
        assert.equal(client.closes, 1)
        assert.equal(renderer.client, null)
    }
})

test('重启等待现有截图并只重连当前实例，不调用 SDK stop 或 daemon shutdown', async () => {
    await withTemplate(async (_root, template, name) => {
        const clients = [new Client(), new Client()]
        const capture = deferred()
        const started = deferred()
        clients[0].screenshot = async () => { started.resolve(undefined); await capture.promise; return { image: Buffer.from('first') } }
        let connections = 0
        const renderer = new KoishiShotium({ sdkLoader: async () => ({ daemon: { connect: async () => clients[connections++] } }) })
        try {
            const rendering = renderer.screenshot(name, { tplFile: template })
            await started.promise
            const restarting = renderer.restart()
            const following = renderer.screenshot(name, { tplFile: template })
            assert.equal(clients[0].closes, 0)
            capture.resolve(undefined)
            assert.deepEqual(await rendering, Buffer.from('first'))
            assert.equal(await restarting, true)
            assert.deepEqual(await following, clients[1].image)
            assert.equal(clients[0].closes, 1)
            assert.equal(connections, 2)
        } finally {
            await renderer.shutdown()
        }
    })
})

test('连接异常后下次请求建立新连接；渲染错误不重试完整页面，仍清理临时 HTML', async () => {
    await withTemplate(async (_root, template, name) => {
        const fixture = create()
        try {
            await fixture.renderer.browserInit()
            fixture.client.close()
            const replacement = new Client()
            replacement.screenshot = async options => { replacement.calls.push({ method: 'screenshot', options }); throw new Error('load failed') }
            fixture.renderer.sdkLoader = async () => ({ daemon: { connect: async () => replacement } })
            await assert.rejects(fixture.renderer.screenshot(name, { tplFile: template }), /load failed/)
            assert.equal(replacement.calls.length, 1)
            assert.deepEqual(await fs.readdir(path.resolve('temp/html', name)), [])
        } finally {
            await fixture.renderer.shutdown()
        }
    })
})

test('不兼容 SDK 给出明确升级提示，不静默切换 Puppeteer', async () => {
    const renderer = new KoishiShotium({ sdkLoader: async () => ({}) })
    try {
        await assert.rejects(renderer.browserInit(), /升级 @pixel\.js\/shotium 至 0\.12\.2/)
        assert.equal(renderer.client, null)
    } finally {
        await renderer.shutdown()
    }
})

test('总截图超时及时结束用户等待，原生结果返回前保留 HTML；卸载仍等待真正捕获完成', async () => {
    await withTemplate(async (_root, template, name) => {
        const fixture = create(undefined, { puppeteerTimeout: 15 })
        const other = create()
        const capture = deferred()
        fixture.client.screenshot = () => capture.promise
        // 保持事件循环，真实客户端的 socket 也会保持循环。
        const keepAlive = setTimeout(() => {}, 500)
        try {
            await other.renderer.browserInit()
            await assert.rejects(fixture.renderer.screenshot(name, { tplFile: template }), error => {
                assert.equal(/** @type {any} */ (error).isRenderTimeout, true)
                return /截图超时/.test(String(error))
            })
            assert.equal(fixture.client.closes, 0)
            assert.equal(other.client.closes, 0)
            assert.equal(fixture.renderer.client, fixture.client)
            assert.equal(fixture.renderer.captures.size, 1)
            assert.equal(fixture.renderer.blockedCaptures.size, 1)
            assert.equal((await fs.readdir(path.resolve('temp/html', name))).length, 1)
            const closing = fixture.renderer.shutdown()
            assert.equal(fixture.client.closes, 0)
            capture.resolve({ image: Buffer.from('late') })
            await closing
            assert.equal(fixture.client.closes, 1)
            assert.equal(fixture.renderer.captures.size, 0)
            assert.equal(fixture.renderer.blockedCaptures.size, 0)
            assert.deepEqual(await fs.readdir(path.resolve('temp/html', name)), [])
        } finally {
            clearTimeout(keepAlive)
            capture.resolve({ image: Buffer.from('late') })
            await Promise.all([fixture.renderer.shutdown(), other.renderer.shutdown()])
        }
    })
})

test('超时后的下一个请求等待原生任务排空，避免槽位释放后无限堆积 daemon 请求', async () => {
    await withTemplate(async (_root, template, name) => {
        const fixture = create(undefined, { puppeteerTimeout: 15 })
        const capture = deferred()
        let calls = 0
        fixture.client.screenshot = async () => {
            calls++
            if (calls === 1) await capture.promise
            return { image: Buffer.from(`图片${calls}`) }
        }
        const keepAlive = setTimeout(() => {}, 500)
        try {
            await assert.rejects(fixture.renderer.screenshot(name, { tplFile: template }), /截图超时/)
            const next = fixture.renderer.screenshot(name, { tplFile: template })
            await new Promise(resolve => setImmediate(resolve))
            assert.equal(calls, 1)
            assert.equal(fixture.renderer.blockedCaptures.size, 1)
            capture.resolve(undefined)
            assert.deepEqual(await next, Buffer.from('图片2'))
            assert.equal(fixture.renderer.blockedCaptures.size, 0)
            assert.equal(fixture.renderer.captures.size, 0)
            assert.deepEqual(await fs.readdir(path.resolve('temp/html', name)), [])
        } finally {
            clearTimeout(keepAlive)
            capture.resolve(undefined)
            await fixture.renderer.shutdown()
        }
    })
})
