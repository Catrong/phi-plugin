import assert from 'node:assert/strict'
import test from 'node:test'
import {
    buildRksHistogram,
    getB30AnalysisRecords,
} from '../model/game/b30Analysis.js'

/** @param {string} id @param {string} rank @param {number} rks @returns {any} */
const record = (id, rank, rks) => ({ id, rank, rks })

test('uses P3 and B27 for the local RKS histogram', () => {
    const records = getB30AnalysisRecords({
        phi: [record('song-a', 'IN', 16), record('song-b', 'AT', 15.8), record('legacy-song', 'LEGACY', 15.7)],
        b19_list: [record('song-a', 'IN', 15.7), record('song-a', 'HD', 15.5), ...Array.from({ length: 30 }, (_, i) => record(`song-${i}`, 'IN', 15 - i / 100))],
    })
    assert.equal(records.filter(item => item.kind === 'phi').length, 3)
    assert.equal(records.filter(item => item.kind === 'best').length, 27)
    assert.deepEqual(records.slice(0, 4).map(item => item.slot), ['P1', 'P2', 'P3', 'B1'])
})

test('builds a slot-based histogram with a horizontal average marker', () => {
    const records = [
        { ...record('a', 'IN', 15), kind: 'phi', slot: 'P1' },
        { ...record('b', 'IN', 15.5), kind: 'best', slot: 'B1' },
        { ...record('c', 'IN', 16), kind: 'best', slot: 'B2' },
    ]

    const histogram = buildRksHistogram(records)
    assert.equal(histogram.count, 3)
    assert.equal(histogram.average, 15.5)
    assert.ok(histogram.averagePosition > 0 && histogram.averagePosition < 100)
    assert.deepEqual(histogram.slots.map(slot => slot.label), ['P1', 'B1', 'B2'])
    assert.deepEqual(histogram.slots.map(slot => slot.rks), [15, 15.5, 16])
    assert.ok(histogram.ticks.length >= 3)

    const singleValue = buildRksHistogram([{ ...record('only', 'LEGACY', 15.5), kind: 'best', slot: 'B1' }])
    assert.ok(Math.abs(singleValue.averagePosition - 50) < 1e-9)
})
