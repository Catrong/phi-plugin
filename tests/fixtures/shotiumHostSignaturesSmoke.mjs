// 从 TRSS 根目录执行，使用真实宿主引擎验证单参数接口。
// 可通过 PHI_SHOTIUM_BASELINE 指定修复前适配器文件，复现 800×600 裁图。
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = process.cwd()
const requireHost = createRequire(path.join(root, 'package.json'))
assert.equal(requireHost('./package.json').name, 'trss-yunzai')
const { imageSize } = requireHost('image-size')
globalThis.logger ||= { ...console, mark() {}, debug() {}, green: x => x }
const { default: platform } = await import('../../components/platform/index.js')
const { default: Shotium } = await import('../../model/render/shotium.js')
const { default: loader } = await import(pathToFileURL(path.join(root, 'lib/renderer/loader.js')).href)
const nativeHost = loader.getRenderer('shotium')
const cfg = (await import(pathToFileURL(path.join(root, 'lib/config/config.js')).href)).default
const resources = fileURLToPath(new URL('../../resources', import.meta.url)).replace(/\\/g, '/')
const helpGroup = JSON.parse(await fs.readFile(`${resources}/info/help.json`, 'utf8'))
const out = path.resolve('temp', `phi-shotium-signatures-${Date.now()}`)
await fs.mkdir(out, { recursive: true })
const captures = []
const renderers = []
const originalLookup = platform.getHostRenderer
// 还原当事人描述的调用契约；不改本地宿主代码、不另起一套引擎。
const host = {
    id: 'shotium', renderNum: 0,
    async shot(options) {
        captures.push({ selector: options.selector ?? null, clip: options.clip ?? null, argumentCount: arguments.length })
        return nativeHost.shot('screenshot', options)
    },
    async shotContainer(options) {
        return this.shot({ ...options, selector: 'body' })
    },
    async screenshotPages(_name, options, pageHeight) {
        const full = await this.shot({ ...options, fullPage: true })
        const size = imageSize(full.image)
        const images = []
        for (let y = 0; y < size.height; y += pageHeight) {
            const result = await this.shot({ ...options, clip: { x: 0, y, width: size.width, height: Math.min(pageHeight, size.height - y) } })
            images.push(result.image)
        }
        this.renderNum += images.length
        return images
    },
    async render(name, data) {
        const file = this.dealTpl(name, data)
        const options = { file: pathToFileURL(path.resolve(file)).href, viewport: { width: 800, height: 600 }, type: 'jpeg', quality: 90, allowFileAccess: true }
        if (data.multiPage) return this.screenshotPages(name, options, data.multiPageHeight)
        const result = await this.shotContainer(options)
        this.renderNum++
        return result.image
    },
}
platform.getHostRenderer = async () => host
const data = {
    tplFile: `${resources}/html/help/help.art`, defaultLayout: `${resources}/html/common/layout/default.art`,
    _res_path: `${resources}/`, renderNoJs: true, helpGroup, cmdHead: 'phi', theme: 'default', themeInfo: null,
    sys: { scale: 'style="transform:scale(1.25)"' }, Version: { ver: 'test' }, _plugin: 'Phi-Plugin',
}
const summary = { engine: requireHost('shotium/package.json').version, before: null, after: [], tiles: [] }
try {
    if (process.env.PHI_SHOTIUM_BASELINE) {
        const Before = (await import(pathToFileURL(path.resolve(process.env.PHI_SHOTIUM_BASELINE)).href)).default
        const before = new Before({}, 'before')
        renderers.push(before)
        const image = await before.screenshot('phi-signatures/help', data)
        summary.before = imageSize(image)
        await fs.writeFile(path.join(out, 'before.jpg'), image)
        assert.deepEqual([summary.before.width, summary.before.height], [800, 600])
        assert.equal(captures.at(-1).selector, null)
        assert.equal(captures.at(-1).argumentCount, 2)
    }
    const fixed = new Shotium({}, 'fixed')
    renderers.push(fixed)
    for (let i = 0; i < 18; i++) {
        const image = await fixed.screenshot('phi-signatures/help', { ...data, theme: ['default', 'star', 'snow'][i % 3] })
        const size = imageSize(image)
        summary.after.push(size)
        assert.equal(size.width, 1500)
        assert.ok(size.height > 4000)
        assert.equal(captures.at(-1).argumentCount, 1)
        assert.equal(captures.at(-1).selector, '#container, body:not(:has(#container))')
        if (i === 0) await fs.writeFile(path.join(out, 'after.jpg'), image)
    }
    const pages = await fixed.screenshot('phi-signatures/help', { ...data, multiPage: true, multiPageHeight: 1500 })
    summary.tiles = pages.map(image => imageSize(image))
    assert.ok(summary.tiles.length > 1)
    assert.ok(summary.tiles.every(size => size.width === 1500 && size.height <= 1500))
    assert.equal(summary.tiles.reduce((sum, size) => sum + size.height, 0), summary.after[0].height)
    assert.equal(captures.at(-1).argumentCount, 1)
    assert.ok(captures.at(-1).clip)
    assert.equal(captures.at(-1).selector, null)
    console.log(JSON.stringify({ ...summary, after: summary.after[0], afterCount: summary.after.length, out }, null, 2))
} catch (error) {
    process.exitCode = 1
    console.error(error)
} finally {
    await fs.writeFile(path.join(out, 'results.json'), JSON.stringify({ ...summary, captures, passed: !process.exitCode }, null, 2))
    platform.getHostRenderer = originalLookup
    await Promise.all(renderers.map(renderer => renderer.shutdown()))
    await nativeHost.stop()
    await Promise.all(Object.values(cfg.watcher).map(watcher => watcher.close()))
    process.exit(process.exitCode || 0)
}
