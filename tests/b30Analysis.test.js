// @ts-nocheck
import assert from 'node:assert/strict'
import test from 'node:test'
import {
    buildB30TagAnalysis,
    buildChartTagBatchRequest,
    buildRksHistogram,
    getB30AnalysisRecords,
} from '../model/b30Analysis.js'

const record = (id, rank, rks) => ({ id, rank, rks })

test('uses P3 and B27 and groups batch tag requests by chart', () => {
    const records = getB30AnalysisRecords({
        phi: [record('song-a', 'IN', 16), record('song-b', 'AT', 15.8), record('legacy-song', 'LEGACY', 15.7)],
        b19_list: [record('song-a', 'IN', 15.7), record('song-a', 'HD', 15.5), ...Array.from({ length: 30 }, (_, i) => record(`song-${i}`, 'IN', 15 - i / 100))],
    })
    assert.equal(records.filter(item => item.kind === 'phi').length, 3)
    assert.equal(records.filter(item => item.kind === 'best').length, 27)
    assert.deepEqual(records.slice(0, 4).map(item => item.slot), ['P1', 'P2', 'P3', 'B1'])
    assert.deepEqual(buildChartTagBatchRequest(records).find(item => item.song_id === 'song-a')?.rank.sort(), ['HD', 'IN'])
    assert.equal(buildChartTagBatchRequest(records).some(item => item.song_id === 'legacy-song'), false)
})

test('calculates weighted strong and weak chart tags', () => {
    const records = [record('a', 'IN', 16), record('b', 'AT', 14)]
    const response = {
        data: {
            a: { IN: { 纵连: 12, 交互: 10, 读谱: 8, 爆发: 6, 多押: 4, 耐力: 2 } },
            b: { AT: { 纵连: 2, 交互: 4, 读谱: 6, 爆发: 8, 多押: 10, 耐力: 12 } },
        },
        tree: {
            a: { IN: [
                { name: '读谱', voteCount: 8, sortOrder: 10 },
                { name: '硬抗', voteCount: 12, sortOrder: 20 },
                { name: '拆谱', voteCount: 6, sortOrder: 30 },
                { name: '定位', voteCount: 4, sortOrder: 40 },
                { name: '多指', voteCount: 12, sortOrder: 50 },
            ] },
            b: { AT: [
                { name: '读谱', voteCount: 6, sortOrder: 10 },
                { name: '硬抗', voteCount: 2, sortOrder: 20 },
                { name: '拆谱', voteCount: 8, sortOrder: 30 },
                { name: '定位', voteCount: 10, sortOrder: 40 },
                { name: '多指', voteCount: 16, sortOrder: 50 },
            ] },
        },
    }
    const result = buildB30TagAnalysis(records, response, 1)
    assert.equal(result.insufficient, false)
    assert.equal(result.strong[0].name, '纵连')
    assert.equal(result.weak[0].name, '耐力')
    assert.equal(result.totalVotes, 84)
    assert.deepEqual(result.categories.map(category => category.name), ['读谱', '硬抗', '拆谱', '定位', '多指'])
    assert.equal(result.categories[0].rks, 15.142857142857142)
    assert.equal(result.radar.categories.length, 5)
    assert.match(result.radar.points, /,/)
})

test('normalizes each chart tag contribution by that chart highest tag vote', () => {
    const records = [
        { ...record('a', 'IN', 16), kind: 'phi' },
        { ...record('b', 'AT', 14), kind: 'best' },
    ]
    const result = buildB30TagAnalysis(records, {
        data: {
            a: { IN: { 核心: 10, 单曲高分: 5, 共同: 1 } },
            b: { AT: { 核心: 1, 单曲低分: 20, 共同: 1 } },
        },
    }, 1)
    const core = result.strong.find(tag => tag.name === '核心')
    assert.ok(core)
    // 核心的权重为 10 / 10 与 1 / 20，而不是原始票数 10 与 1。
    assert.ok(Math.abs(core.rks - (16 + 14 * 0.05) / 1.05) < 1e-10)
})

test('marks tag data insufficient and builds a slot-based histogram with a horizontal average marker', () => {
    const records = [
        { ...record('a', 'IN', 15), kind: 'phi' },
        { ...record('b', 'IN', 15.5), kind: 'best' },
        { ...record('c', 'IN', 16), kind: 'best' },
    ]
    const tagResult = buildB30TagAnalysis(records, { data: { a: { IN: { 纵连: 1 } } } })
    assert.equal(tagResult.insufficient, true)

    const histogram = buildRksHistogram(records)
    assert.equal(histogram.count, 3)
    assert.equal(histogram.average, 15.5)
    assert.ok(histogram.averagePosition > 0 && histogram.averagePosition < 100)
    assert.deepEqual(histogram.slots.map(slot => slot.label), ['P1', 'B1', 'B2'])
    assert.deepEqual(histogram.slots.map(slot => slot.rks), [15, 15.5, 16])
    assert.ok(histogram.ticks.length >= 3)

    const singleValue = buildRksHistogram([{ ...record('only', 'LEGACY', 15.5), kind: 'best' }])
    assert.ok(Math.abs(singleValue.averagePosition - 50) < 1e-9)
})
