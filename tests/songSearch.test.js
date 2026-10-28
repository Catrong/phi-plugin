import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSearchTable, parseSearchFilters, searchSongs } from '../model/game/songSearch.js'

/** @type {Record<string, any>} */
const SONGS = {
    'single-song': {
        id: 'single-song',
        song: 'Single Song',
        bpm: '180',
        chart: { IN: { difficulty: 15.4, combo: 1100 } },
    },
    'variable-song': {
        id: 'variable-song',
        song: 'Variable Song',
        bpm: '100',
        bpmList: [100, 240],
        chart: {
            HD: { difficulty: 11, combo: 800 },
            IN: { difficulty: 15.1, combo: 900 },
            AT: { difficulty: 16, combo: 1200 },
        },
    },
    'slow-song': {
        id: 'slow-song',
        song: 'Slow Song',
        bpm: '90',
        chart: { EZ: { difficulty: 3, combo: 300 } },
    },
}

test('解析筛选条件：单值、范围与整数定级扩展', () => {
    assert.deepEqual(parseSearchFilters('bpm 120-300 dif 15'), [
        { key: 'bpm', bottom: 120, top: 300, label: '120-300' },
        { key: 'difficulty', bottom: 15, top: 15.9, label: '15' },
    ])
    assert.deepEqual(parseSearchFilters('BPM:300 CMB 1000-1200'), [
        { key: 'bpm', bottom: 300, top: 300, label: '300' },
        { key: 'combo', bottom: 1000, top: 1200, label: '1000-1200' },
    ])
    assert.deepEqual(parseSearchFilters('dif 15.0'), [
        { key: 'difficulty', bottom: 15, top: 15, label: '15.0' },
    ])
    assert.deepEqual(parseSearchFilters('随便写点别的'), [])
})

test('检索按 bpmList 匹配变速曲目，并按条件逐步缩小范围', () => {
    const byBpm = searchSongs('bpm 200-250', SONGS)
    assert.deepEqual(byBpm.hits.map(hit => hit.id), ['variable-song'])

    const byDifficulty = searchSongs('dif 15', SONGS)
    assert.deepEqual(byDifficulty.hits.map(hit => hit.id), ['single-song', 'variable-song'])

    const byCombo = searchSongs('cmb 1000-1200', SONGS)
    assert.deepEqual(byCombo.hits.map(hit => hit.id), ['single-song', 'variable-song'])

    assert.deepEqual(searchSongs('bpm 9999', SONGS).hits, [])
})

test('多字段筛选分别满足时保留曲目，只高亮同时命中的难度', () => {
    const { filters, hits } = searchSongs('dif 15 cmb 1000-1200', SONGS)
    // IN 满足定级、AT 满足物量，分字段的曲目级筛选会保留该曲
    assert.deepEqual(hits.map(hit => hit.id), ['single-song', 'variable-song'])

    const table = buildSearchTable(hits, filters, 180)
    const variableRow = table.rows.find((_, index) => hits[index].id === 'variable-song')
    assert.ok(variableRow)

    /** @param {import('../model/game/songSearch.js').TableCell[]} row @param {number} index */
    const cellAt = (row, index) => row[index]
    assert.equal(cellAt(variableRow, 1).text, '100 / 240')
    assert.equal(cellAt(variableRow, 2).text, '-')
    assert.equal(cellAt(variableRow, 3).text, '11 · 800')
    assert.equal(cellAt(variableRow, 4).text, '15.1 · 900')
    assert.equal(cellAt(variableRow, 5).text, '16 · 1200')
    assert.equal(cellAt(variableRow, 4).highlight, undefined)
    assert.equal(cellAt(variableRow, 5).highlight, undefined)
})

test('表格按 list 上限截断并标记被筛选的列', () => {
    const { filters, hits } = searchSongs('dif 15 cmb 900-1200', SONGS)
    const table = buildSearchTable(hits, filters, 1)

    assert.equal(table.total, 2)
    assert.equal(table.shown, 1)
    assert.equal(table.truncated, true)
    assert.deepEqual(table.columns.map(column => column.title), ['曲目', 'BPM', 'EZ', 'HD', 'IN', 'AT'])
    assert.equal(table.columns[1].highlight, false)
    assert.deepEqual(table.columns.slice(2).map(column => column.highlight), [true, true, true, true])

    const row = table.rows[0]
    assert.equal(row[0].text, 'Single Song')
    assert.equal(row[0].subtext, 'single-song')
    assert.equal(row[3].text, '-')
    assert.equal(row[4].highlight, true)
    assert.equal(row[5].text, '-')
    assert.equal(row[5].className, 'level-AT')
})

test('无结果时返回空行，列结构保持稳定', () => {
    const { filters, hits } = searchSongs('bpm 9999', SONGS)
    const table = buildSearchTable(hits, filters, 180)
    assert.equal(table.total, 0)
    assert.equal(table.shown, 0)
    assert.equal(table.truncated, false)
    assert.deepEqual(table.rows, [])
    assert.equal(table.columns.length, 6)
})
