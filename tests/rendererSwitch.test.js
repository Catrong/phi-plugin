// @ts-nocheck -- 用可控的假渲染器验证真实队列和资源生命周期。
import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import { PicModel } from '../model/render/picmodle.js'
import Config from '../components/Config.js'
import { bindHostSettings, updateHostSettings } from '../components/settings/host.js'
import platform from '../components/platform/index.js'

beforeEach(t => {
    t.after(bindHostSettings({ renderer: 'puppeteer', renderNum: 1, timeout: 20000 }, () => {}))
})

function pool(t) {
    const p = new PicModel({ registerCleanup: false })
    p.created = []
    p.createRenderer = settings => {
        const renderer = {
            backend: settings.renderer, timeout: settings.timeout, closed: 0, forced: 0,
            screenshot: async () => Buffer.from('image'),
            restart: async () => {},
            shutdown: async () => { renderer.closed++ },
            forceShutdown: () => { renderer.forced++ },
        }
        p.created.push(renderer)
        return renderer
    }
    t.after(() => p.close())
    return p
}

test('切换空闲槽位与截图超时配置时回收旧实例', async t => {
    const p = pool(t)
    const idx = await p.acquire(1000)
    const old = p.puppeteer[idx]
    p.release(idx)
    updateHostSettings({ renderer: 'shotium', timeout: 12000 })
    assert.equal(await p.acquire(1000), idx)
    assert.equal(p.puppeteer[idx].backend, 'shotium')
    assert.equal(p.puppeteer[idx].timeout, 12000)
    await Promise.resolve()
    assert.equal(old.closed, 1)
    p.release(idx)
    updateHostSettings({ renderer: 'puppeteer' })
    assert.equal(await p.acquire(1000), idx)
    assert.equal(p.puppeteer[idx].backend, 'puppeteer')
})

test('切换时保留进行中的请求，排队请求使用新后端且保持 FIFO', async t => {
    const p = pool(t)
    const idx = await p.acquire(1000)
    const old = p.puppeteer[idx]
    const first = p.acquire(1000)
    updateHostSettings({ renderer: 'shotium' })
    const second = p.acquire(1000)
    assert.equal(p.puppeteer[idx], old)
    assert.equal(old.closed, 0)
    p.release(idx)
    assert.equal(await first, idx)
    assert.equal(p.puppeteer[idx].backend, 'shotium')
    assert.equal(p.waiters.length, 1)
    p.release(idx)
    assert.equal(await second, idx)
    p.release(idx)
    assert.deepEqual(p.idle, [0])
    await Promise.resolve()
    assert.equal(old.closed, 1)
})

test('等待恢复后的槽位在 render 继续执行前已经锁定', async t => {
    const p = pool(t)
    const idx = await p.acquire(1000)
    const waiting = p.acquire(1000)
    p.release(idx)
    const assigned = p.puppeteer[idx]
    updateHostSettings({ renderer: 'shotium' })
    const next = p.acquire(1000)
    assert.equal(await waiting, idx)
    assert.equal(p.puppeteer[idx], assigned)
    assert.equal(assigned.closed, 0)
    p.release(idx)
    assert.equal(await next, idx)
    assert.equal(p.puppeteer[idx].backend, 'shotium')
})

test('动态减少并发不会关闭忙碌槽位或把多余槽位交给等待请求', async t => {
    updateHostSettings({ renderNum: 3 })
    const p = pool(t)
    const slots = await Promise.all([p.acquire(1000), p.acquire(1000), p.acquire(1000)])
    const old = p.puppeteer[2]
    const waiting = p.acquire(1000)
    updateHostSettings({ renderNum: 1 })
    p.release(1)
    assert.equal(p.waiters.length, 1)
    assert.deepEqual(p.idle, [])
    assert.equal(old.closed, 0)
    p.release(2)
    assert.equal(p.puppeteer.length, 1)
    assert.equal(p.waiters.length, 1)
    p.release(slots[0])
    assert.equal(await waiting, 0)
    p.release(0)
    assert.deepEqual(p.idle, [0])
})

test('动态增加并发先分配已等待的请求，全部槽位独占', async t => {
    const p = pool(t)
    assert.equal(await p.acquire(1000), 0)
    const waiting = p.acquire(1000)
    updateHostSettings({ renderNum: 3, renderer: 'shotium' })
    const newRequest = await p.acquire(1000)
    assert.equal(await waiting, 1)
    assert.equal(newRequest, 2)
    assert.deepEqual([...p.leased], [0, 1, 2])
    assert.equal(p.puppeteer[0].backend, 'puppeteer')
    assert.equal(p.puppeteer[1].backend, 'shotium')
})

test('动态减少并发后低位槽先空闲也不能补回超额在途请求', async t => {
    updateHostSettings({ renderNum: 3 })
    const p = pool(t)
    await Promise.all([p.acquire(1000), p.acquire(1000), p.acquire(1000)])
    const first = p.acquire(1000)
    updateHostSettings({ renderNum: 1 })
    p.release(0)
    assert.equal(p.leased.size, 2)
    assert.equal(p.waiters.length, 1)
    const second = p.acquire(1000)
    assert.equal(p.waiters.length, 2)
    p.release(1)
    assert.equal(p.leased.size, 1)
    assert.equal(p.waiters.length, 2)
    p.release(2)
    assert.equal(await first, 0)
    assert.equal(p.leased.size, 1)
    assert.equal(p.waiters.length, 1)
    p.release(0)
    assert.equal(await second, 0)
})

test('退出会等待正在回收的实例并清空等待队列，同步兜底包含旧实例', async t => {
    const p = pool(t)
    const idx = await p.acquire(1000)
    const old = p.puppeteer[idx]
    let finishClose
    old.shutdown = () => new Promise(resolve => { finishClose = resolve })
    p.release(idx)
    updateHostSettings({ renderer: 'shotium' })
    await p.acquire(1000)
    const waiting = p.acquire(1000)
    await Promise.resolve()
    assert.ok(finishClose)
    const closing = p.close()
    assert.equal(await waiting, -1)
    assert.equal(await p.acquire(1000), -1)
    assert.equal(p.puppeteer[0].closed, 1, '当前实例先行关闭，不必等待旧实例退出')
    p.forceClose()
    assert.equal(old.forced, 1)
    assert.equal(p.puppeteer[0].forced, 1)
    finishClose()
    await closing
    assert.equal(p.puppeteer[0].closed, 1)
})

test('非法 YAML 后端和并发值回退，合法配置继续恢复', t => {
    const p = pool(t)
    const original = Config.getConfig
    t.after(() => { Config.getConfig = original })
    Config.getConfig = () => ({ renderer: 'missing', renderNum: 0, timeout: 'bad' })
    assert.deepEqual(p.getRendererSettings(), { renderer: 'puppeteer', requested: 'puppeteer', source: 'local', count: 1, timeout: 20000 })
    Config.getConfig = () => ({ renderer: 'Shotium', renderNum: 2, timeout: 10000 })
    assert.deepEqual(p.getRendererSettings(), { renderer: 'shotium', requested: 'shotium', source: 'host', count: 2, timeout: 10000 })
})

test('生成数据与已分配后端一致，切换后下一个请求才启用静态图表', async t => {
    const p = pool(t)
    const first = await p.acquire(1000)
    p.release(first)
    let finishShot
    let dataSeen
    p.puppeteer[first].screenshot = async (_name, data) => {
        dataSeen = data
        updateHostSettings({ renderer: 'shotium' })
        return new Promise(resolve => { finishShot = () => resolve(Buffer.from('image')) })
    }
    const active = p.render('test/image', {}, { scale: 1 })
    await Promise.resolve()
    assert.equal(dataSeen.renderNoJs, false)
    assert.equal(typeof dataSeen.staticCharts.difficulty, 'function')
    finishShot()
    await active
    let nextData
    p.puppeteer[first].screenshot = async (_name, data) => {
        nextData = data
        throw new Error('截图失败')
    }
    assert.match(await p.render('test/image', {}, { scale: 1 }), /截图失败/)
    assert.equal(nextData.renderNoJs, true)
    assert.deepEqual(p.idle, [0])
    assert.equal(p.pressureCompleted, 1)
    assert.equal(p.pressureFailed, 1)
})

test('分页截图逐页包装为消息图片并归还槽位', async t => {
    const p = pool(t)
    const idx = await p.acquire(1000)
    p.release(idx)
    p.puppeteer[idx].screenshot = async () => [Buffer.from('page1'), Buffer.from('page2')]
    const result = await p.render('test/image', { multiPage: true }, { scale: 1 })
    assert.equal(result.length, 2)
    assert.ok(result.every(image => image.type === 'image'))
    assert.deepEqual(p.idle, [0])
    assert.equal(p.pressureCompleted, 1)
})

test('渲染质量实时传入截图，显式覆盖有效且 PNG 仍由后端选择无损编码', async t => {
    const p = pool(t)
    const idx = await p.acquire(1000)
    p.release(idx)
    const received = []
    p.puppeteer[idx].screenshot = async (_name, data) => {
        received.push({ quality: data.quality, type: data.imgType })
        return Buffer.from('image')
    }
    updateHostSettings({ randerQuality: 75 })
    await p.render('test/image', {}, { scale: 1 })
    updateHostSettings({ randerQuality: 95 })
    await p.render('test/image', {}, { scale: 1 })
    await p.render('test/image', { quality: 86.5 }, { scale: 1 })
    await p.render('test/image', { quality: NaN, imgType: 'png' }, { scale: 1 })
    assert.deepEqual(received, [
        { quality: 75, type: undefined }, { quality: 95, type: undefined },
        { quality: 87, type: undefined }, { quality: 100, type: 'png' },
    ])
    assert.equal(p.created.length, 1, '调整图片编码质量不重建浏览器槽位')
})

test('自动跟随只复用当前启用的 Shotium，宿主切换后忙碌槽位完成再回退', async t => {
    const original = platform.getActiveRendererName
    t.after(() => { platform.getActiveRendererName = original })
    platform.getActiveRendererName = () => 'shotium'
    updateHostSettings({ renderer: 'auto' })
    const p = pool(t)
    const idx = await p.acquire(1000)
    const old = p.puppeteer[idx]
    assert.equal(old.backend, 'shotium')
    assert.equal(p.rendererSettings.source, 'host')
    platform.getActiveRendererName = () => 'some-other-renderer'
    const waiting = p.acquire(1000)
    assert.equal(p.puppeteer[idx], old)
    assert.equal(p.rendererSettings.renderer, 'puppeteer')
    assert.equal(p.rendererSettings.source, 'local')
    p.release(idx)
    assert.equal(await waiting, idx)
    assert.equal(p.puppeteer[idx].backend, 'puppeteer')
})

test('结束会话保留在途渲染，取消排队后新 owner 可重新开放缓存的池', async t => {
    const p = pool(t)
    const owner = {}, next = {}
    await p.beginSession(owner)
    const idx = await p.acquire(1000)
    const old = p.puppeteer[idx]
    let finish
    let started
    const ready = new Promise(resolve => { started = resolve })
    old.screenshot = () => { started(); return new Promise(resolve => { finish = resolve }) }
    p.release(idx)
    const render = p.render('test/image', {}, { scale: 1 })
    await ready
    const queued = p.acquire(1000)
    const closing = p.endSession(owner)
    assert.equal(await queued, -1)
    assert.equal(old.closed, 0)
    assert.equal(await p.acquire(1000), -1)
    finish(Buffer.from('complete'))
    assert.equal((await render).type, 'image')
    await closing
    assert.equal(old.closed, 1)
    await p.beginSession(next)
    await p.acquire(1000)
    await p.endSession(owner)
    assert.equal(p.shuttingDown, false, '迟到的旧实例不能关闭新会话')
    p.release(0)
    await p.endSession(next)
})

test('惰性槽位切换与卸载不会加载或启动未使用的后端', async t => {
    const p = new PicModel({ registerCleanup: false })
    t.after(() => p.close())
    const idx = await p.acquire(1000)
    const unused = p.puppeteer[idx]
    assert.equal(unused.instance, null)
    p.release(idx)
    updateHostSettings({ renderer: 'shotium' })
    await p.acquire(1000)
    assert.equal(p.puppeteer[idx].instance, null)
    await p.close()
    assert.equal(unused.instance, null)
    assert.equal(unused.shutdownRequested, true)
})
