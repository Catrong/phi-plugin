import assert from 'node:assert/strict'
import test from 'node:test'

test('routes only the default B30 theme to Canvas without prewarming Chromium', async () => {
    const renderer = (await import('../model/render/picmodle.js')).default
    const originalCanvas = renderer.renderDefaultB30
    const originalCommon = renderer.common
    /** @type {any[]} */
    const calls = []

    renderer.renderDefaultB30 = async (data, cfg) => {
        calls.push({ kind: 'canvas', data, cfg })
        return 'canvas-result'
    }
    renderer.common = async (event, kind, data) => {
        calls.push({ kind: 'html', event, template: kind, data })
        return 'html-result'
    }

    try {
        assert.ok(renderer.puppeteer.length > 0)
        assert.ok(renderer.puppeteer.every(item => {
            const instance = /** @type {any} */ (item)
            return instance.browser === false && instance.initPromise === null
        }))

        const event = { user_id: 1 }
        assert.equal(await renderer.b19(event, { theme: 'default' }), 'canvas-result')
        assert.equal(await renderer.b19(event, { theme: 'snow' }), 'html-result')
        assert.deepEqual(calls.map(call => call.kind), ['canvas', 'html'])
        assert.equal(calls[1].template, 'b19')
    } finally {
        renderer.renderDefaultB30 = originalCanvas
        renderer.common = originalCommon
        await renderer.close()
    }
})
