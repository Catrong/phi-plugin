import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { acceptKoishiSettings, createKoishiRenderLifecycle, createKoishiSessionRegistry, koishiRenderConfigKeys } from '../components/platform/koishiRenderLifecycle.js'
import { useKoishiAdapter, KoishiRenderer } from '../components/platform/koishi.js'
import { clearPlatformAdapter, getPlatformAdapter } from '../components/platform/state.js'

const require = createRequire(import.meta.url)
const flush = () => new Promise(resolve => setImmediate(resolve))

/** @param {Partial<Parameters<typeof createKoishiRenderLifecycle>[0]>} [overrides] */
function createLifecycle(overrides = {}) {
    return createKoishiRenderLifecycle({
        ctx: {}, registry: createKoishiSessionRegistry(),
        async initialize() {}, validateConfig() {}, commitConfig() {}, stop() {}, async dispose() {},
        onError(error) { throw error }, ...overrides,
    })
}

test('all Koishi entry points require database and declare Puppeteer and Shotium optional', async () => {
    const cjs = require('../koishi.cjs')
    const esm = await import('../koishi.js')
    assert.deepEqual(cjs.inject, { required: ['database'], optional: ['puppeteer', 'shotium'] })
    assert.deepEqual(esm.inject, cjs.inject)
})

test('Koishi accepts rendering updates synchronously without restarting and rejects unavailable backend atomically', async () => {
    const { App } = require('koishi')
    const app = new App()
    await app.start()
    let starts = 0
    let commits = 0
    let effective = { renderer: 'puppeteer', renderNum: 1 }
    /** @type {ReturnType<typeof createKoishiRenderLifecycle> | undefined} */
    let lifecycle
    /** @param {any} ctx @param {Record<string, any>} config */
    function plugin(ctx, config) {
        starts++
        lifecycle = createLifecycle({ ctx,
            validateConfig(values) {
                if (values.renderer === 'unavailable') throw new Error('Shotium dependency is unavailable')
            },
            commitConfig(values) { commits++; effective = { ...effective, ...values } },
        })
        acceptKoishiSettings(ctx, koishiRenderConfigKeys, values => lifecycle?.update(values))
        return lifecycle.start()
    }
    const fork = app.plugin(plugin, { renderer: 'puppeteer', renderNum: 1 })
    try {
        await flush()
        fork.update({ renderer: 'shotium', renderNum: 2 })
        await flush()
        assert.equal(starts, 1)
        assert.deepEqual(effective, { renderer: 'shotium', renderNum: 2 })
        assert.equal(commits, 1)
        assert.equal(fork.config.renderer, 'shotium')
        assert.throws(() => fork.update({ renderer: 'unavailable', renderNum: 3 }), /dependency is unavailable/)
        assert.deepEqual(effective, { renderer: 'shotium', renderNum: 2 })
        assert.equal(commits, 1)
        assert.equal(fork.config.renderer, 'shotium')
    } finally {
        fork.dispose()
        await lifecycle?.close()
        await app.stop()
    }
})

test('credential rotation accepts three simultaneous fields without overriding rendering settings', async () => {
    const { App } = require('koishi')
    const app = new App()
    await app.start()
    let starts = 0
    let writes = 0
    /** @type {Record<string, any>} */
    let received = {}
    /** @param {any} ctx */
    function plugin(ctx) {
        starts++
        acceptKoishiSettings(ctx, ['apiBotClientId', 'apiBotClientSecret', 'apiBotSecretVersion'], values => {
            writes++
            received = values
        })
    }
    const fork = app.plugin(plugin, { renderer: 'shotium', apiBotClientId: '', apiBotClientSecret: '', apiBotSecretVersion: 0 })
    try {
        await flush()
        fork.update({ renderer: 'shotium', apiBotClientId: 'client', apiBotClientSecret: 'secret', apiBotSecretVersion: 1 })
        await flush()
        assert.equal(starts, 1)
        assert.equal(writes, 1)
        assert.deepEqual(received, { apiBotClientId: 'client', apiBotClientSecret: 'secret', apiBotSecretVersion: 1 })
    } finally {
        fork.dispose()
        await app.stop()
    }
})

test('two active contexts cannot replace the shared owner, and a rejected instance does not dispose it', async () => {
    const registry = createKoishiSessionRegistry()
    let closed = 0
    const first = createLifecycle({ registry, async dispose() { closed++ } })
    const second = createLifecycle({ registry, async dispose() { throw new Error('must not close') } })
    await first.start()
    await assert.rejects(second.start(), /同时启用多个 Koishi 实例/)
    await second.close()
    assert.equal(closed, 0)
    await first.close()
    assert.equal(closed, 1)
})

test('reload waits for the old jobs and resources before rebinding, and late old dispose cannot stop the new owner', async () => {
    const registry = createKoishiSessionRegistry()
    /** @type {(() => void) | undefined} */
    let release
    const blocked = new Promise(resolve => { release = () => resolve(undefined) })
    /** @type {string[]} */
    const order = []
    const old = createLifecycle({ registry,
        async initialize() { order.push('bind-old') },
        stop() { order.push('stop-old') },
        async dispose() { await blocked; order.push('release-old'); order.push('unbind-old') },
    })
    const next = createLifecycle({ registry,
        async initialize() { order.push('bind-new') },
        stop() { order.push('stop-new') },
    })
    await old.start()
    const closing = old.close()
    const starting = next.start()
    await flush()
    assert.deepEqual(order, ['bind-old', 'stop-old'])
    release?.()
    await closing
    await starting
    assert.deepEqual(order, ['bind-old', 'stop-old', 'release-old', 'unbind-old', 'bind-new'])
    await old.close()
    assert.ok(!order.includes('stop-new'))
    await next.close()
})

test('initialization failure is cleaned up and the next context can take over', async () => {
    const registry = createKoishiSessionRegistry()
    /** @type {string[]} */
    const order = []
    const failed = createLifecycle({ registry,
        async initialize() { order.push('bound'); throw new Error('runtime failed') },
        stop() { order.push('stop') },
        async dispose() { order.push('released') },
    })
    await assert.rejects(failed.start(), /runtime failed/)
    await failed.close()
    assert.deepEqual(order, ['bound', 'stop', 'released'])
    const next = createLifecycle({ registry })
    await next.start()
    await next.close()
})

test('dispose during startup awaits initialization before releasing resources and ignores late config updates', async () => {
    /** @type {(() => void) | undefined} */
    let release
    let initialized = false
    let committed = false
    let cleaned = false
    const lifecycle = createLifecycle({
        async initialize() {
            await new Promise(resolve => { release = () => resolve(undefined) })
            initialized = true
        },
        commitConfig() { committed = true },
        async dispose() { assert.equal(initialized, true); cleaned = true },
    })
    const starting = lifecycle.start()
    await flush()
    const closing = lifecycle.close()
    lifecycle.update({ renderer: 'shotium' })
    await flush()
    assert.equal(cleaned, false)
    assert.equal(committed, false)
    release?.()
    await starting
    await closing
    assert.equal(cleaned, true)
})

test('the cached Koishi PluginBase creates new instances owned by the new adapter and disposes their context timers', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    /** @type {unknown[]} */
    const messages = []
    const old = useKoishiAdapter({}, { database: false, h: { image: () => 'old-image' } })
    const CachedBase = old.PluginBase
    const oldInstance = /** @type {any} */ (new CachedBase({ name: 'old' }))
    oldInstance.e = old.fromSession({ userId: '1', isDirect: true, content: '', send: (/** @type {unknown} */ value) => { messages.push(value) } })
    await old.close()
    const next = useKoishiAdapter({}, { database: false, h: { image: () => 'new-image' } })
    const fresh = /** @type {any} */ (new CachedBase({ name: 'new' }))
    fresh.e = next.fromSession({ userId: '2', isDirect: true, content: '', send: (/** @type {unknown} */ value) => { messages.push(value) } })
    try {
        await fresh.reply({ __phiSegment: true, type: 'image', data: 'data:image/png;base64,' })
        await oldInstance.reply({ __phiSegment: true, type: 'image', data: 'data:image/png;base64,' })
        assert.deepEqual(messages, ['new-image', 'old-image'])
        fresh.setContext('reply', false, 1, 'must not send after dispose')
        await next.close()
        t.mock.timers.tick(1000)
        await flush()
        assert.deepEqual(messages, ['new-image', 'old-image'])
        assert.equal(fresh.getKoishiContext?.(fresh.e), undefined)
    } finally {
        await next.close()
        clearPlatformAdapter(next)
        t.mock.timers.reset()
    }
})

test('adapter unload drains owned work and closes template watchers while retaining borrowed host services', async () => {
    let hostClosed = 0
    const host = { id: 'shotium', async render() { return Buffer.from('host') }, close() { hostClosed++ } }
    const adapter = useKoishiAdapter({ shotium: host, puppeteer: { browser: { close() { hostClosed++ } } } }, { database: false })
    /** @type {(() => void) | undefined} */
    let release
    let finished = false
    let watcherClosed = false
    const template = new KoishiRenderer()
    template.watcher.fake = /** @type {any} */ ({ async close() { watcherClosed = true } })
    const pending = adapter.runTask(async () => {
        await new Promise(resolve => { release = () => resolve(undefined) })
        finished = true
    }, null, [])
    await flush()
    adapter.stop()
    const closing = adapter.close()
    await flush()
    assert.equal(watcherClosed, false)
    assert.equal(await adapter.runTask(() => assert.fail('must reject new task'), null, []), false)
    release?.()
    await pending
    await closing
    assert.equal(finished, true)
    assert.equal(watcherClosed, true)
    assert.equal(hostClosed, 0)
    assert.equal(adapter.getActiveRendererName?.(), 'shotium')
    assert.equal(await adapter.getHostRenderer?.('shotium'), host)
    assert.equal(adapter.hasPuppeteerService?.(), true)
    clearPlatformAdapter(adapter)
    assert.equal(getPlatformAdapter(), undefined)
})

test('an old adapter cannot clear the new platform binding', async () => {
    const old = useKoishiAdapter({}, { database: false })
    const next = useKoishiAdapter({}, { database: false })
    clearPlatformAdapter(old)
    assert.equal(getPlatformAdapter(), next)
    await old.close()
    await next.close()
    clearPlatformAdapter(next)
})

test('real Koishi entry cleans up partial startup when its selected Puppeteer service is unavailable', async () => {
    const { apply } = await import('../koishi.js')
    const { getHostSettings } = await import('../components/settings/host.js')
    const { default: watchers } = await import('../components/FileWatcherRegistry.js')
    /** @type {Function[]} */
    const disposeCallbacks = []
    const ctx = {
        on(/** @type {string} */ event, /** @type {Function} */ callback) {
            if (event === 'dispose') disposeCallbacks.push(callback)
        },
    }
    await assert.rejects(apply(ctx, { renderer: 'puppeteer', database: false, openPhiPluginApi: false }), /koishi-plugin-puppeteer/)
    assert.deepEqual(getHostSettings(), {})
    assert.equal(getPlatformAdapter(), undefined)
    assert.equal(watchers.entries.size, 0)
    for (const callback of disposeCallbacks) await callback()
    assert.equal(getPlatformAdapter(), undefined)
})
