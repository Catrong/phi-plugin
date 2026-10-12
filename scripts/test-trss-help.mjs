// 在已安装本插件的 TRSS 根目录执行：node plugins/phi-plugin/scripts/test-trss-help.mjs
// 实际调用宿主 Shotium 和帮助命令；回复只收集到本地，不连接聊天账号。
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const requireHost = createRequire(path.join(root, 'package.json'))
assert.equal(requireHost('./package.json').name, 'trss-yunzai', '请在 TRSS 根目录运行')
const { imageSize } = requireHost('image-size')
globalThis.logger ||= { ...console, mark: console.log, debug() {}, green: value => value, red: value => value }
const { default: cfg } = await import(pathToFileURL(path.join(root, 'lib/config/config.js')).href)
assert.equal(cfg.renderer.name, 'shotium', '请先把宿主 renderer.yaml 的 name 设置为 shotium')
const { default: pic } = await import('../model/render/picmodle.js')
const { default: getInfo } = await import('../model/game/getInfo.js')
const { default: watchers } = await import('../components/FileWatcherRegistry.js')
const { bindHostSettings, updateHostSettings } = await import('../components/settings/host.js')
const { default: loader } = await import(pathToFileURL(path.join(root, 'lib/renderer/loader.js')).href)
const host = loader.getRenderer('shotium')
assert.equal(host.id, 'shotium')
const unbind = bindHostSettings({ renderer: 'auto', renderNum: 3, renderScale: 100, openPhiPluginApi: false, watchInfoPath: false }, () => {})
assert.deepEqual([pic.getRendererSettings().renderer, pic.getRendererSettings().source], ['shotium', 'host'])
const out = path.resolve('temp', `phi-help-smoke-${Date.now()}`)
await fs.mkdir(out, { recursive: true })
const records = []
const saved = new Set()
const invalidReplies = []
let replies = 0
let sequence = 0
let renderer
const originalShot = host.shot
host.shot = async function (...args) {
    const [method, options] = typeof args[0] === 'string' ? args : ['screenshot', args[0]]
    const id = ++sequence
    const html = await fs.readFile(new URL(options.file), 'utf8')
    const result = await originalShot.apply(this, args)
    const images = method === 'screenshotTiles' ? result.tiles.map(tile => tile.image) : [result.image]
    const sizes = images.map(image => imageSize(image))
    const scale = Number(html.match(/transform:scale\(([\d.]+)\)/)?.[1] || 1) * host.config.scale
    const row = { id, method, scale, sizes, requests: result.stats.requests, failed: result.stats.failed }
    records.push(row)
    const key = `${html.match(/class="elem-[^"]*"/)?.[0]}-${scale}-${method}`
    const invalidSize = sizes.some(size => Math.abs(size.width - 1200 * scale) > 1)
        || sizes.reduce((sum, size) => sum + size.height, 0) <= 3000 * scale
    if (!saved.has(key) || row.failed || invalidSize) {
        saved.add(key)
        await fs.writeFile(path.join(out, `${id}.html`), html)
        await Promise.all(images.map((image, index) => fs.writeFile(path.join(out, `${id}-${index + 1}.jpg`), image)))
    }
    assert.equal(row.failed, 0, `第 ${id} 次截图资源加载失败`)
    assert.ok(html.includes('_plugin') || html.includes('Phi-Plugin'), '必须调用真实帮助模板')
    assert.match(html, /name="pvis"[^>]*font-size:/, 'TRSS 下必须执行插件的静态文字适配')
    assert.ok(sizes.every(size => Math.abs(size.width - 1200 * scale) <= 1), `第 ${id} 次截图宽度被裁切`)
    assert.ok(sizes.reduce((sum, size) => sum + size.height, 0) > 3000 * scale, `第 ${id} 次截图高度被裁切`)
    return result
}

try {
    await getInfo.init()
    const { phihelp } = await import('../apps/help.js')
    const command = new phihelp()
    const event = {
        msg: '/phi help', user_id: 'phi-render-test', isMaster: false, isPrivate: true, isGroup: false,
        reply(message) {
            if (![message].flat().some(item => item?.type === 'image')) invalidReplies.push(message)
            replies++
            return Promise.resolve({ message_id: 'local-test' })
        },
    }
    for (let i = 0; i < 12; i++) assert.equal(await command.help({ ...event }), true)
    assert.equal(replies, 12)
    assert.equal(invalidReplies.length, 0, '帮助命令必须回复图片')
    const helpGroup = JSON.parse(await fs.readFile(new URL('../resources/info/help.json', import.meta.url), 'utf8'))
    const themes = ['star', 'default', 'snow']
    const scales = [50, 75, 100, 125, 150, 200]
    for (let batch = 0; batch < 42; batch++) {
        updateHostSettings({ renderScale: scales[batch % scales.length] })
        const results = await Promise.all(themes.map(theme => pic.help(event, { helpGroup, cmdHead: 'phi', isMaster: false, theme })))
        assert.ok(results.every(result => result?.type === 'image'), `第 ${batch + 1} 批帮助图失败`)
        console.log(`已完成 ${batch + 1}/42 批，缩放 ${scales[batch % scales.length]}%`)
    }
    updateHostSettings({ renderScale: 100 })
    const pages = await pic.common(event, 'help', { helpGroup, cmdHead: 'phi', theme: 'star', multiPage: true, multiPageHeight: 1234 })
    assert.ok(Array.isArray(pages) && pages.length > 1, '分页必须输出多张图片')
    renderer = pic.puppeteer.find(slot => slot?.instance)?.instance
    assert.ok(renderer, '必须实际初始化插件渲染器')
    assert.ok(Object.keys(renderer.html).length > 0, '模板缓存必须归插件实例所有')
    assert.ok(Object.keys(renderer.watcher).length > 0, '模板监听器必须归插件实例所有')
    const htmlDir = path.resolve('temp/html/phi-plugin/help/help')
    assert.equal((await fs.readdir(htmlDir)).filter(file => /_shotium_.*\.html$/.test(file)).length, 0, '完成后必须清理本次临时 HTML')
    console.log(`通过：12 次帮助命令、126 次并发/缩放渲染、1 次分页。结果目录：${out}`)
} catch (error) {
    process.exitCode = 1
    console.error(error)
} finally {
    await fs.writeFile(path.join(out, 'results.json'), JSON.stringify({ shotium: requireHost('shotium/package.json').version, replies, records, passed: !process.exitCode }, null, 2))
    host.shot = originalShot
    unbind()
    await pic.close()
    await getInfo.close()
    await Promise.all([...watchers.entries.values()].map(entry => entry.lease.close()))
    await host.stop()
    await Promise.all(Object.values(cfg.watcher).map(watcher => watcher.close()))
    // 宿主 loader 的配置监听属于本次独立测试进程。
    process.exit(process.exitCode || 0)
}
