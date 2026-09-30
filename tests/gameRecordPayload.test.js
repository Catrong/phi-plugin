import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGameRecordPayload } from '../model/api/gameRecordPayload.js'

test('buildGameRecordPayload strips derived fields and LEGACY records', () => {
    const payload = buildGameRecordPayload({
        'Glaciaxion.SunsetRay.0': [
            {
                score: 1_000_000,
                acc: 100,
                fc: 1,
                id: 'Glaciaxion.SunsetRay.0',
                rank: 'EZ',
                Rating: 'phi',
                rks: 12.5,
                song: 'Glaciaxion',
                illustration: 'https://example.com/cover.png',
            },
            null,
            { score: 987_654, acc: 98.7654, fc: false, rank: 'IN' },
            null,
            { score: 900_000, acc: 95, fc: true, rank: 'LEGACY' },
        ],
    })

    assert.deepEqual(payload, {
        'Glaciaxion.SunsetRay.0': [
            { score: 1_000_000, acc: 100, fc: true },
            null,
            { score: 987_654, acc: 98.7654, fc: false },
            null,
        ],
    })
})
