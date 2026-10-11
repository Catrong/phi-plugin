import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import platform from '../components/platform/index.js'
import Shotium from '../model/render/shotium.js'

/** @param {any} host @param {(renderer: Shotium, root: string) => Promise<void>} run */
async function withHost(host, run) {
    const original = platform.getHostRenderer
    const originalLogger = globalThis.logger
    globalThis.logger ||= { ...console, mark() {}, green: value => value }
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-shotium-adapter-'))
    platform.getHostRenderer = async name => name === 'shotium' ? host : null
    const renderer = new Shotium({ puppeteerTimeout: 7890 }, `test-${process.pid}`)
    try {
        await run(renderer, root)
    } finally {
        await renderer.shutdown()
        platform.getHostRenderer = original
        globalThis.logger = originalLogger
        await fs.rm(root, { recursive: true, force: true })
    }
}

test('Shotium uses raw render, preserves options and keeps host state on the host', async () => {
    const rawImage = Buffer.from('raw-image')
    const host = {
        id: 'shotium',
        renderNum: 5,
        config: { quality: 77 },
        /** @type {any} */
        request: null,
        screenshot() { throw new Error('不可调用 segment 包装入口') },
        /** @param {string} _name @param {any} data */
        async render(_name, data) {
            this.request = data
            this.renderNum++
            this.capture()
            return rawImage
        },
        capture() { assert.equal(this, host) },
    }
    await withHost(host, async renderer => {
        const input = {
            tplFile: 'not-used.art', saveId: 'caller', imgType: /** @type {const} */ ('png'),
            omitBackground: true, quality: 64, path: 'output.png',
            pageGotoParams: { timeout: 2345, waitUntil: 'networkidle2' },
        }
        assert.equal(await renderer.screenshot('plugin/test', input), rawImage)
        assert.equal(host.renderNum, 6)
        assert.equal(host.request.imgType, 'png')
        assert.equal(host.request.omitBackground, true)
        assert.equal(host.request.quality, 64)
        assert.equal(host.request.path, 'output.png')
        assert.deepEqual(host.request.pageGotoParams, input.pageGotoParams)
        assert.match(host.request.saveId, /^caller_shotium_test-/)
        assert.equal(input.saveId, 'caller')
        assert.equal(renderer.renderNum, undefined)
    })
})

test('Shotium normalizes single and multiple Uint8Array images to Buffer', async () => {
    /** @type {any[]} */
    const requests = []
    const host = {
        id: 'shotium',
        /** @param {string} _name @param {any} data */
        async render(_name, data) {
            requests.push(data)
            return data.multiPage ? [new Uint8Array([1, 2]), Buffer.from([3])] : new Uint8Array([4])
        },
    }
    await withHost(host, async renderer => {
        assert.deepEqual(await renderer.screenshot('page', {}), Buffer.from([4]))
        const pages = await renderer.screenshot('page', { multiPage: true, multiPageHeight: 123 })
        assert.deepEqual(pages, [Buffer.from([1, 2]), Buffer.from([3])])
        assert.equal(requests[1].multiPageHeight, 123)
        assert.equal(requests[1].pageGotoParams.timeout, 7890)
        assert.notEqual(requests[0].saveId, requests[1].saveId)
    })
})

test('Shotium 单图及分页只捕获一次，仍由宿主引擎处理并累加宿主计数', async () => {
    /** @type {{method: string, options: Record<string, any>}[]} */
    const captures = []
    const options = { file: 'template.html', type: 'jpeg', scale: 1.25, quality: 95 }
    const host = {
        id: 'shotium',
        renderNum: 0,
        /** @param {string} method @param {Record<string, any>} captureOptions */
        async shot(method, captureOptions) {
            assert.equal(this, host)
            captures.push({ method, options: captureOptions })
            return method === 'screenshotTiles'
                ? { tiles: [{ image: Buffer.from('first') }, { image: Buffer.from('last') }] }
                : { image: Buffer.from('single') }
        },
        /** @param {string} _method @param {Record<string, any>} _options @returns {any} */
        shotContainer(_method, _options) { throw new Error('不可重试一次完整的页面加载') },
        /** @param {string} _name @param {Record<string, any>} captureOptions @param {number} pageHeight */
        async screenshotPages(_name, captureOptions, pageHeight) {
            const result = await this.shotContainer('screenshotTiles', { ...captureOptions, tile: { height: pageHeight } })
            const images = result.tiles.map((/** @type {{image: Buffer}} */ tile) => tile.image)
            this.renderNum += images.length
            return images
        },
        /** @param {string} name @param {Record<string, any>} data */
        async render(name, data) {
            if (data.multiPage) return this.screenshotPages(name, options, data.multiPageHeight)
            const result = await this.shotContainer('screenshot', options)
            this.renderNum++
            return result.image
        },
    }
    await withHost(host, async renderer => {
        assert.deepEqual(await renderer.screenshot('page', {}), Buffer.from('single'))
        assert.deepEqual(await renderer.screenshot('page', { multiPage: true, multiPageHeight: 123 }), [Buffer.from('first'), Buffer.from('last')])
        assert.deepEqual(captures, [
            { method: 'screenshot', options: { ...options, selector: '#container, body:not(:has(#container))' } },
            { method: 'screenshotTiles', options: { ...options, tile: { height: 123 }, selector: '#container, body:not(:has(#container))' } },
        ])
        assert.equal(host.renderNum, 3)
        assert.equal(renderer.renderNum, undefined)
        assert.deepEqual(options, { file: 'template.html', type: 'jpeg', scale: 1.25, quality: 95 })
    })
})

test('Shotium owns reliable template cache and closes only its template watchers', async () => {
    const name = `phi-shotium-template-${process.pid}`
    const outputDir = path.resolve('temp', 'html', name)
    const host = {
        id: 'shotium',
        /** @type {Record<string, string>} */
        html: { host: 'keep' },
        watcher: { host: 'keep' },
        /** @param {string} _name @param {any} _data @returns {string} */
        dealTpl(_name, _data) { throw new Error('不可使用宿主模板缓存') },
        stop() { throw new Error('不可关闭宿主引擎') },
        close() { throw new Error('不可关闭宿主连接') },
        /** @param {string} name @param {any} data */
        async render(name, data) {
            const filename = this.dealTpl(name, data)
            return Buffer.from(await fs.readFile(filename, 'utf8'))
        },
    }
    try {
        await withHost(host, async (renderer, root) => {
            const file = path.join(root, 'page.art')
            const replacement = path.join(root, 'replacement.art')
            await fs.writeFile(file, 'first {{value}}')
            assert.deepEqual(await renderer.screenshot(name, { tplFile: file, value: 1 }), Buffer.from('first 1'))
            await fs.writeFile(replacement, 'second {{value}}')
            await fs.rename(replacement, file)
            assert.deepEqual(await renderer.screenshot(name, { tplFile: file, value: 2 }), Buffer.from('second 2'))
            const watchers = Object.values(/** @type {any} */ (renderer.watcher))
            assert.equal(watchers.length, 1)
            let closes = 0
            for (const watcher of /** @type {any[]} */ (watchers)) {
                const close = watcher.close.bind(watcher)
                watcher.close = () => { closes++; return close() }
            }
            await renderer.restart()
            await renderer.shutdown()
            await renderer.shutdown()
            renderer.forceShutdown()
            assert.equal(closes, 1)
            assert.deepEqual(renderer.watcher, {})
            assert.deepEqual(host.html, { host: 'keep' })
            assert.deepEqual(host.watcher, { host: 'keep' })
            assert.equal(await renderer.browserInit(), false)
            assert.equal(await renderer.screenshot(name, {}), false)
        })
    } finally {
        await fs.rm(outputDir, { recursive: true, force: true })
    }
})

test('Shotium shutdown waits for pending host renders without shutting down the host', async () => {
    /** @type {() => void} */
    let started = () => {}
    const start = new Promise(resolve => { started = () => resolve(undefined) })
    /** @type {(value: Buffer) => void} */
    let finish = () => {}
    const image = new Promise(resolve => { finish = resolve })
    const host = {
        id: 'shotium',
        async render() { started(); return image },
        stop() { throw new Error('不可停止宿主') },
    }
    await withHost(host, async renderer => {
        const screenshot = renderer.screenshot('page', {})
        await start
        let closed = false
        const closing = renderer.shutdown().then(() => { closed = true })
        await Promise.resolve()
        assert.equal(closed, false)
        assert.equal(await renderer.screenshot('next', {}), false)
        finish(Buffer.from('done'))
        assert.deepEqual(await screenshot, Buffer.from('done'))
        await closing
        assert.equal(closed, true)
    })
})

test('Shotium reports a missing host explicitly and rejects wrapped image data', async () => {
    await withHost(null, async renderer => {
        await assert.rejects(renderer.screenshot('page', {}), /未找到宿主 Shotium/)
    })
    await withHost({ id: 'shotium', render: async () => ({ type: 'image' }) }, async renderer => {
        await assert.rejects(renderer.screenshot('page', {}), /无效的截图数据/)
    })
})

test('Shotium 在成功及失败后精确清理临时 HTML，保留原始模板和监听器', async () => {
    const name = `phi-shotium-cleanup-${process.pid}`
    const outputDir = path.resolve('temp', 'html', name)
    /** @type {string[]} */
    const generated = []
    let fail = false
    const rawImage = Buffer.from('raw-image')
    const host = {
        id: 'shotium',
        /** @param {string} _name @param {any} _data @returns {string} */
        dealTpl(_name, _data) { throw new Error('不可调用宿主模板方法') },
        /** @param {string} name @param {any} data */
        async render(name, data) {
            const file = this.dealTpl(name, data)
            generated.push(file)
            assert.match(await fs.readFile(file, 'utf8'), /value/)
            if (fail) throw new Error('host render failed')
            return rawImage
        },
    }
    try {
        await withHost(host, async (renderer, root) => {
            const tplFile = path.join(root, 'page.art')
            await fs.writeFile(tplFile, '{{text}}')
            assert.equal(await renderer.screenshot(name, { tplFile, text: 'value' }), rawImage)
            fail = true
            await assert.rejects(renderer.screenshot(name, { tplFile, text: 'value' }), /host render failed/)
            assert.equal(generated.length, 2)
            for (const file of generated) await assert.rejects(fs.stat(file), { code: 'ENOENT' })
            assert.deepEqual(await fs.readdir(outputDir), [])
            assert.equal(await fs.readFile(tplFile, 'utf8'), '{{text}}')
            assert.equal(Object.keys(/** @type {any} */ (renderer.watcher)).length, 1)
        })
    } finally {
        await fs.rm(outputDir, { recursive: true, force: true })
    }
})
