import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { inflateSync } from 'node:zlib'
import { useKoishiAdapter } from '../../components/platform/koishi.js'

// 本脚本必须独立进程执行；既可使用隔离 SDK 注入，也可在隔离项目内验证标准包解析。
const sdkPath = process.env.PHI_SHOTIUM_SDK
const standardResolution = process.env.PHI_SHOTIUM_STANDARD === '1'
if (!standardResolution && (!sdkPath || !path.isAbsolute(sdkPath))) throw new Error('请用 PHI_SHOTIUM_SDK 指定隔离 SDK 的入口绝对路径，或设 PHI_SHOTIUM_STANDARD=1 使用标准包解析。')
useKoishiAdapter({}, { database: false })
const { default: KoishiShotium, loadKoishiShotiumSDK } = await import('../../model/render/koishiShotium.js')
const sdk = standardResolution ? await loadKoishiShotiumSDK() : await import(pathToFileURL(/** @type {string} */ (sdkPath)).href)
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-koishi-shotium-real-'))
const name = `koishi-shotium-smoke-${process.pid}`
const daemonOptions = { name: `phi-koishi-smoke-${process.pid}`, idleTimeoutMs: 600 }
const sdkConfig = standardResolution ? {} : { sdkLoader: async () => sdk }
const first = new KoishiShotium({ ...sdkConfig, shotiumDaemonOptions: daemonOptions }, 'first')
const second = new KoishiShotium({ ...sdkConfig, shotiumDaemonOptions: daemonOptions }, 'second')

/** @param {Buffer} image */
function png(image) {
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    const width = image.readUInt32BE(16)
    const height = image.readUInt32BE(20)
    assert.equal(image[24], 8)
    assert.equal(image[25], 6)
    let offset = 8
    const chunks = []
    while (offset < image.length) {
        const length = image.readUInt32BE(offset)
        if (image.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(image.subarray(offset + 8, offset + 8 + length))
        offset += length + 12
    }
    const scanlines = inflateSync(Buffer.concat(chunks))
    assert.equal(scanlines[4], 0, '透明 PNG 左上角应保留 alpha=0')
    return { width, height, bytes: image.length }
}

/** @param {any} value @returns {Buffer} */
function image(value) {
    assert.ok(Buffer.isBuffer(value))
    return value
}

try {
    const svg = path.join(root, 'local.svg')
    const template = path.join(root, 'page.art')
    const bodyTemplate = path.join(root, 'body.art')
    await fs.writeFile(svg, '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#f58220"/></svg>')
    await fs.writeFile(template, `<html><head><style>body{margin:0}#container{width:160px;height:450px;font:16px "Microsoft YaHei",sans-serif}img{margin-top:40px}</style></head><body><div id="container"><img src="${pathToFileURL(svg).href}"><p>Koishi 渲染 {{value}}</p></div></body></html>`)
    await fs.writeFile(bodyTemplate, '<html><style>body{margin:0;width:96px;height:64px;background:#1f6feb}</style><body>正文</body></html>')
    const transparent = image(await first.screenshot(name, { tplFile: template, value: '中文', imgType: 'png', omitBackground: true }))
    const pngStats = png(transparent)
    assert.deepEqual({ width: pngStats.width, height: pngStats.height }, { width: 160, height: 450 })
    const saveFile = path.join(root, 'saved', 'image.jpg')
    const jpeg = image(await first.screenshot(name, { tplFile: template, value: '品质 95', imgType: 'jpeg', quality: 95, path: saveFile }))
    assert.equal(jpeg.subarray(0, 3).toString('hex'), 'ffd8ff')
    assert.deepEqual(await fs.readFile(saveFile), jpeg)
    const webp = image(await second.screenshot(name, { tplFile: template, value: 'WebP', imgType: 'webp', quality: 91, omitBackground: true }))
    assert.equal(webp.toString('ascii', 0, 4), 'RIFF')
    assert.equal(webp.toString('ascii', 8, 12), 'WEBP')
    const tiles = await first.screenshot(name, { tplFile: template, value: '分页', multiPage: true, multiPageHeight: 200, quality: 95 })
    assert.ok(Array.isArray(tiles))
    assert.equal(tiles.length, 3)
    assert.ok(tiles.every(tile => tile.subarray(0, 3).toString('hex') === 'ffd8ff'))
    const beforeUnload = await sdk.daemon.status({ ...daemonOptions, spawn: false })
    // status 自身也占用一条短连接，额外两条才是渲染器的长连接。
    assert.equal(beforeUnload.connections, 3)
    const originalPid = beforeUnload.pid
    await first.shutdown()
    await first.shutdown()
    assert.equal(first.client, null)
    assert.deepEqual(first.watcher, {})
    const afterUnload = image(await second.screenshot(name, { tplFile: bodyTemplate, imgType: 'png' }))
    assert.equal(afterUnload.readUInt32BE(16), 96)
    assert.equal(afterUnload.readUInt32BE(20), 64)
    await second.restart()
    image(await second.screenshot(name, { tplFile: template, value: '重连', imgType: 'png' }))
    assert.equal((await sdk.daemon.status({ ...daemonOptions, spawn: false })).pid, originalPid)
    assert.deepEqual(await fs.readdir(path.resolve('temp/html', name)), [])
    await second.shutdown()
    const closedDeadline = Date.now() + 10000
    let stopped = false
    while (Date.now() < closedDeadline) {
        // status 的短连接会重置空闲计时，检查间隔必须超过 daemon 的空闲退出时间。
        await new Promise(resolve => setTimeout(resolve, 1200))
        const status = await sdk.daemon.status({ ...daemonOptions, spawn: false })
        if (!status.running) { stopped = true; break }
    }
    assert.equal(stopped, true, '最后连接断开后 daemon 应按空闲时间自动退出')
    console.log(JSON.stringify({ sdk: '0.12.2', standardResolution, png: pngStats, jpegBytes: jpeg.length, webpBytes: webp.length, tileCount: tiles.length, isolatedUnload: true, reconnectedDaemon: true, daemonIdleExited: true }))
} finally {
    await Promise.allSettled([first.shutdown(), second.shutdown()])
    await fs.rm(path.resolve('temp/html', name), { recursive: true, force: true })
    await fs.rm(root, { recursive: true, force: true })
}
