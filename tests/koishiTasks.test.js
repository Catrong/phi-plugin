import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createKoishiAdapter, registerKoishiApps } from '../components/platform/koishi.js'

const { App, h } = createRequire(import.meta.url)('koishi')
const flush = () => new Promise(resolve => setImmediate(resolve))

test('Koishi schedules shared tasks, skips overlap, recovers after errors and disposes on reload', async t => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const app = new App()
    await app.start()
    let calls = 0
    let fail = false
    /** @type {(() => void) | undefined} */
    let release
    /** @type {unknown[][]} */
    const warnings = []
    const adapter = createKoishiAdapter(app, { h, database: false })
    adapter.logger.warn = (...args) => { warnings.push(args) }
    /** @param {any} ctx */
    function plugin(ctx) {
        registerKoishiApps(ctx, { sync: {
            task: { name: 'sync', interval: 60_000, async fnc() {
                calls++
                if (fail) throw new Error('offline')
                await new Promise(resolve => { release = () => resolve(undefined) })
            } },
        } }, adapter)
    }
    let fork = app.plugin(plugin)
    try {
        t.mock.timers.tick(59_999)
        assert.equal(calls, 0)
        t.mock.timers.tick(1)
        assert.equal(calls, 1)
        t.mock.timers.tick(120_000)
        assert.equal(calls, 1)
        release?.()
        await flush()
        fail = true
        t.mock.timers.tick(60_000)
        await flush()
        assert.equal(calls, 2)
        assert.equal(warnings.length, 1)
        fail = false
        t.mock.timers.tick(60_000)
        assert.equal(calls, 3)
        await fork.dispose()
        release?.()
        await flush()
        t.mock.timers.tick(120_000)
        assert.equal(calls, 3)
        fork = app.plugin(plugin)
        t.mock.timers.tick(60_000)
        assert.equal(calls, 4)
    } finally {
        release?.()
        await fork.dispose()
        await app.stop()
        t.mock.timers.reset()
    }
})
