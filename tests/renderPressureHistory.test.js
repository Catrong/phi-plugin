import assert from 'node:assert/strict'
import test from 'node:test'
import { RenderPressureHistory } from '../model/render/renderPressureHistory.js'

/**
 * @param {string} windowStartedAt
 * @param {Partial<{capacity:number, active:number, queued:number, maxActive:number, maxQueued:number, completed:number, failed:number, timedOut:number}>} [overrides]
 */
function pressure(windowStartedAt, overrides = {}) {
    return {
        windowStartedAt,
        capacity: 2,
        active: 0,
        queued: 0,
        maxActive: 0,
        maxQueued: 0,
        completed: 0,
        failed: 0,
        timedOut: 0,
        ...overrides,
    }
}

test('render pressure history retains only the latest 30 minutes', () => {
    const history = new RenderPressureHistory()
    const base = Date.parse('2026-09-05T12:00:30.000Z')
    for (let minute = 0; minute <= 30; minute += 1) {
        const endedAt = new Date(base + minute * 60_000).toISOString()
        history.record(pressure(new Date(base + (minute - 1) * 60_000).toISOString()), endedAt)
    }

    const samples = history.snapshot()
    assert.equal(samples.length, 30)
    assert.equal(samples[0].endedAt, '2026-09-05T12:01:30.000Z')
    assert.equal(samples.at(-1)?.endedAt, '2026-09-05T12:30:30.000Z')
})

test('render pressure history merges repeated syncs in the same minute', () => {
    const history = new RenderPressureHistory()
    history.record(pressure('2026-09-05T12:00:00.000Z', {
        active: 1, maxActive: 1, completed: 2,
    }), '2026-09-05T12:00:15.000Z')
    history.record(pressure('2026-09-05T12:00:15.000Z', {
        queued: 1, maxQueued: 2, completed: 3, failed: 1,
    }), '2026-09-05T12:00:50.000Z')

    assert.deepEqual(history.snapshot(), [{
        startedAt: '2026-09-05T12:00:00.000Z',
        endedAt: '2026-09-05T12:00:50.000Z',
        capacity: 2,
        active: 0,
        queued: 1,
        maxActive: 1,
        maxQueued: 2,
        completed: 5,
        failed: 1,
        timedOut: 0,
    }])
})
