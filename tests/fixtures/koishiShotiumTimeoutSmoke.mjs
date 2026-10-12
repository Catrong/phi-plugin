import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { useKoishiAdapter } from '../../components/platform/koishi.js'

const sdkPath = process.env.PHI_SHOTIUM_SDK
if (!sdkPath || !path.isAbsolute(sdkPath)) throw new Error('请设置隔离 SDK 入口的 PHI_SHOTIUM_SDK。')
useKoishiAdapter({}, { database: false })
const { default: KoishiShotium } = await import('../../model/render/koishiShotium.js')
const sdk = await import(pathToFileURL(sdkPath).href)
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-koishi-shotium-timeout-'))
const daemonOptions = { name: `phi-koishi-timeout-smoke-${process.pid}`, idleTimeoutMs: 600 }
const name = `koishi-shotium-timeout-smoke-${process.pid}`
let beginCSS
const cssStarted = new Promise(resolve => { beginCSS = resolve })
/** @type {http.ServerResponse | undefined} */
let cssResponse
const server = http.createServer((_request, response) => {
    cssResponse = response
    beginCSS()
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const address = /** @type {import('node:net').AddressInfo} */ (server.address())
const captured = []
const sdkLoader = async () => ({ daemon: { connect: async options => {
    const client = await sdk.daemon.connect(options)
    const screenshot = client.screenshot.bind(client)
    client.screenshot = async options => {
        const item = { file: fileURLToPath(options.file), settled: false, error: '', failedResources: -1 }
        captured.push(item)
        try { const result = await screenshot(options); item.failedResources = result.stats.failed; return result } catch (error) { item.error = String(error); throw error }
        finally { item.settled = true }
    }
    return client
} } })
const first = new KoishiShotium({ sdkLoader, shotiumDaemonOptions: daemonOptions }, 'slow')
const second = new KoishiShotium({ sdkLoader, shotiumDaemonOptions: daemonOptions, puppeteerTimeout: 30 }, 'timed')
try {
    const templateA = path.join(root, 'slow.art')
    const templateB = path.join(root, 'queued.art')
    const localCSS = path.join(root, 'local.css')
    await fs.writeFile(localCSS, 'body{margin:0}#container{width:80px;height:40px;background:#20a0ff}')
    await fs.writeFile(templateA, `<html><head><link rel="stylesheet" href="http://127.0.0.1:${address.port}/slow.css"></head><body><div id="container" style="width:80px;height:40px">慢CSS</div></body></html>`)
    await fs.writeFile(templateB, `<html><head><link rel="stylesheet" href="${pathToFileURL(localCSS).href}"></head><body><div id="container">排队截图</div></body></html>`)
    const slow = first.screenshot(name, { tplFile: templateA, pageGotoParams: { timeout: 3000 } })
    await cssStarted
    await assert.rejects(second.screenshot(name, { tplFile: templateB, pageGotoParams: { timeout: 3000 } }), /截图超时/)
    const nativeAfterOuterTimeout = await sdk.daemon.status({ ...daemonOptions, spawn: false })
    const queuedFileExists = await fs.stat(captured[1].file).then(() => true, () => false)
    assert.equal(queuedFileExists, true, '原生排队任务尚未完成时必须保留 HTML')
    assert.equal(captured[1].settled, false)
    const following = second.screenshot(name, { tplFile: templateB, pageGotoParams: { timeout: 3000 } })
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.equal(captured.length, 2, '后续任务先等待此实例已超时的原生任务，不能不断堆积 daemon 队列')
    cssResponse?.end('body{margin:0}')
    await slow
    assert.ok(Buffer.isBuffer(await following))
    assert.ok(captured.every(item => item.settled && !item.error && item.failedResources === 0))
    assert.deepEqual(await fs.readdir(path.resolve('temp/html', name)), [])
    console.log(JSON.stringify({ inFlightAfterOuterTimeout: nativeAfterOuterTimeout.inFlight, queuedFileExists, boundedNativeQueue: true, captured: captured.map(item => ({ settled: item.settled, error: item.error, failedResources: item.failedResources })) }))
} finally {
    cssResponse?.end('body{margin:0}')
    await Promise.allSettled([first.shutdown(), second.shutdown()])
    await new Promise(resolve => server.close(resolve))
    await fs.rm(path.resolve('temp/html', name), { recursive: true, force: true })
    await fs.rm(root, { recursive: true, force: true })
}
