// @ts-nocheck -- Isolated pools use the production prototype without starting browsers.
import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import rendererPool from '../model/render/picmodle.js'
import { bindHostSettings, updateHostSettings } from '../components/settings/host.js'
import shared from '../components/settings/shared.cjs'
import { createGuobaConfigInfo, createGuobaSchemas } from '../components/settings/guoba.js'

const MAX_RENDER_QUEUE = 4
beforeEach(t => {
    const unbind = bindHostSettings({ renderQueueLimit: MAX_RENDER_QUEUE }, () => {})
    t.after(unbind)
})

function pool() {
    return Object.assign(Object.create(Object.getPrototypeOf(rendererPool)), {
        idle: [], waiters: [], rendering: new Set(), puppeteer: [],
        shuttingDown: false, closePromise: null, tot: 0,
        pressureMaxQueued: 0, pressureFailed: 0, pressureTimedOut: 0,
    })
}

test('queue refuses excess requests without adding waiters and preserves FIFO', async () => {
    const p = pool()
    const waiting = Array.from({ length: MAX_RENDER_QUEUE }, () => p.acquire(10000))
    assert.equal(await p.acquire(10000), -2)
    assert.equal(p.waiters.length, MAX_RENDER_QUEUE)
    assert.equal(p.pressureMaxQueued, MAX_RENDER_QUEUE)
    for (let i = 0; i < MAX_RENDER_QUEUE; i++) p.release(i)
    assert.deepEqual(await Promise.all(waiting), Array.from({ length: MAX_RENDER_QUEUE }, (_, i) => i))
    assert.equal(p.waiters.length, 0)
    p.release(0)
    assert.equal(await p.acquire(10000), 0)
    await p.close()
})

test('expired waiting requests free capacity', async () => {
    const p = pool()
    const waiting = Array.from({ length: MAX_RENDER_QUEUE }, () => p.acquire(10))
    await delay(30)
    assert.ok((await Promise.all(waiting)).every(value => value === -1))
    assert.equal(p.waiters.length, 0)
    const next = p.acquire(10000)
    p.release(0)
    assert.equal(await next, 0)
    await p.close()
})

test('full queue returns a busy message without counting a timeout', async () => {
    const p = pool()
    const waiting = Array.from({ length: MAX_RENDER_QUEUE }, () => p.acquire(10000))
    try {
        assert.match(await p.render('test/image', {}, {}), /请求较多/)
        assert.equal(p.pressureFailed, 1)
        assert.equal(p.pressureTimedOut, 0)
        assert.equal(p.rendering.size, 0)
        assert.equal(p.waiters.length, MAX_RENDER_QUEUE)
    } finally {
        await p.close()
        assert.ok((await Promise.all(waiting)).every(value => value === -1))
        assert.equal(p.waiters.length, 0)
    }
})

test('pool slot is released after a screenshot with a hanging page close', { timeout: 2000 }, async () => {
    const { default: Puppeteer } = await import('../model/render/puppeteer.js')
    const p = pool()
    const renderer = new Puppeteer({ pageCloseTimeout: 10, idleTimeout: 0 })
    const child = { pid: 0, exitCode: null, signalCode: null }
    renderer.browser = {
        newPage: async () => ({ isClosed: () => false, close: () => new Promise(() => {}) }),
        process: () => child,
        close: async () => { child.exitCode = 0 },
    }
    renderer.dealTpl = () => 'test.html'
    renderer.renderPage = async () => { renderer.renderNum++; return [Buffer.from('image')] }
    p.puppeteer = [renderer]
    p.idle = [0]
    try {
        await p.render('test/image', {}, { scale: 1 })
        assert.deepEqual(p.idle, [0])
        assert.equal(p.rendering.size, 0)
        assert.equal(child.exitCode, 0)
    } finally {
        await p.close()
    }
})

test('queue settings apply immediately, including zero waiting and lowering a full queue', async () => {
    const p = pool()
    const waiting = Array.from({ length: MAX_RENDER_QUEUE }, () => p.acquire(10000))
    try {
        updateHostSettings({ renderQueueLimit: 2 })
        assert.equal(await p.acquire(10000), -2)
        assert.equal(p.waiters.length, 4, 'existing requests are preserved')
        updateHostSettings({ renderQueueLimit: 5 })
        waiting.push(p.acquire(10000))
        assert.equal(p.waiters.length, 5)
        updateHostSettings({ renderQueueLimit: 0 })
        assert.equal(await p.acquire(10000), -2)
        for (let i = 0; i < waiting.length; i++) p.release(i)
        await Promise.all(waiting)
        p.release(0)
        assert.equal(await p.acquire(10000), 0, 'zero waiting still permits an idle slot')
        assert.equal(await p.acquire(10000), -2)
    } finally {
        await p.close()
    }
})

test('shared settings expose the queue limit and Guoba validates and saves it', () => {
    assert.equal(shared.defaults.renderQueueLimit, 32)
    assert.ok(shared.editable.some(item => item.key === 'renderQueueLimit'))
    assert.ok(createGuobaSchemas().some(item => item.field === 'renderQueueLimit'))
    const values = { ...shared.defaults }
    const panel = createGuobaConfigInfo({
        getUserCfg: (_name, key) => values[key],
        modify: (_name, key, value) => { values[key] = value },
    })
    panel.setConfigData({ renderQueueLimit: 7 })
    assert.equal(values.renderQueueLimit, 7)
    assert.throws(() => panel.setConfigData({ renderQueueLimit: -1 }))
    assert.throws(() => panel.setConfigData({ renderQueueLimit: 1001 }))
    assert.throws(() => panel.setConfigData({ renderQueueLimit: 1.5 }))
})
