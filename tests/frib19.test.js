import assert from 'node:assert/strict'
import test from 'node:test'

import {
    FRIB_STATE,
    FRIB_UNKNOWN_TEXT,
    buildSongPool,
    buildVersionIndex,
    compareBoolean,
    compareNumberRange,
    compareText,
    compareVersion,
    createFribRow,
    parseBpmRange,
    parseStartArgs,
    toRenderRows,
} from '../apps/guessGame/frib19Utils.js'

/**
 * 构造版本索引，测试中不关心里层类型
 * @param {[string, { label: string, order: number, beforeRange: boolean } | null][]} entries
 * @returns {import('../apps/guessGame/frib19Utils.js').fribVersionIndex}
 */
function versionIndex(entries) {
    return /** @type {any} */ ({ bySong: new Map(entries), orderOfCode: new Map(), earliestLabel: '3.4.0' })
}

/** 早于收录范围的版本，只比较早晚 */
const beforeRange = { label: '3.4.0-', order: -1, beforeRange: true }

/** @type {import('../apps/guessGame/frib19Utils.js').fribSongInfo} */
const answer = {
    id: 'Answer.Song',
    song: 'Answer Song',
    composer: 'Composer',
    chapter: 'Chapter 7 时钟链接',
    bpm: '190',
    isOriginal: true,
    chart: { IN: { difficulty: 15.4, combo: 1200 } },
}

/** @type {import('../apps/guessGame/frib19Utils.js').fribSongInfo} */
const guess = {
    id: 'Guess.Song',
    song: 'Guess Song',
    composer: 'Other',
    chapter: 'Chapter 5 霓虹灯牌',
    bpm: '170',
    isOriginal: false,
    chart: { IN: { difficulty: 15.2, combo: 1100 } },
}

test('BPM 文本支持单值、区间与非法数据', () => {
    assert.deepEqual(parseBpmRange('190'), { min: 190, max: 190 })
    assert.deepEqual(parseBpmRange('35~400'), { min: 35, max: 400 })
    assert.deepEqual(parseBpmRange('35~400~410'), { min: 35, max: 410 })
    assert.equal(parseBpmRange(''), null)
    assert.equal(parseBpmRange('unknown'), null)
    assert.equal(parseBpmRange(undefined), null)
})

test('开局参数解析难度与定数下限', () => {
    assert.deepEqual(parseStartArgs('/phi 弗一把'), { level: 'IN', minDifficulty: null })
    assert.deepEqual(parseStartArgs('/phi friberg IN 14+'), { level: 'IN', minDifficulty: 14 })
    assert.deepEqual(parseStartArgs('/phi fib at'), { level: 'AT', minDifficulty: null })
    assert.deepEqual(parseStartArgs('/phi 弗一把 ez 3.5+'), { level: 'EZ', minDifficulty: 3.5 })
    assert.deepEqual(parseStartArgs('/phi fri', 'HD'), { level: 'HD', minDifficulty: null })
    assert.deepEqual(parseStartArgs('/phi fri', /** @type {any} */ ('XX')), { level: 'IN', minDifficulty: null })
    assert.deepEqual(parseStartArgs('/phi 弗一把 -l 3'), { level: 'IN', minDifficulty: null })
    assert.deepEqual(parseStartArgs('/phi 弗一把 AT -l 2'), { level: 'AT', minDifficulty: null })
})

test('数值对比区分相同、相近与不同并给出方向', () => {
    assert.deepEqual(compareNumberRange({ min: 15.4, max: 15.4 }, { min: 15.4, max: 15.4 }, 0.3), {
        state: FRIB_STATE.SAME,
        arrow: '',
    })
    assert.deepEqual(compareNumberRange({ min: 15.2, max: 15.2 }, { min: 15.4, max: 15.4 }, 0.3), {
        state: FRIB_STATE.NEAR,
        arrow: 'up',
    })
    assert.deepEqual(compareNumberRange({ min: 15.9, max: 15.9 }, { min: 15.4, max: 15.4 }, 0.3), {
        state: FRIB_STATE.DIFF,
        arrow: 'down',
    })
    assert.deepEqual(compareNumberRange(null, { min: 15.4, max: 15.4 }, 0.3), {
        state: FRIB_STATE.UNKNOWN,
        arrow: '',
    })
})

test('文本与布尔属性对比忽略大小写且不产生箭头', () => {
    assert.deepEqual(compareText('Chapter 7', 'chapter 7'), { state: FRIB_STATE.SAME, arrow: '' })
    assert.deepEqual(compareText('A', 'B'), { state: FRIB_STATE.DIFF, arrow: '' })
    assert.deepEqual(compareText('', 'B'), { state: FRIB_STATE.UNKNOWN, arrow: '' })
    assert.deepEqual(compareBoolean(true, true), { state: FRIB_STATE.SAME, arrow: '' })
    assert.deepEqual(compareBoolean(false, true), { state: FRIB_STATE.DIFF, arrow: '' })
})

test('版本对比按收录序号判定相近并处理未知版本', () => {
    const older = { label: '3.4.0', order: 0, beforeRange: false }
    const newer = { label: '3.5.1', order: 2, beforeRange: false }
    assert.deepEqual(compareVersion(older, newer, 2), { state: FRIB_STATE.NEAR, arrow: 'up' })
    assert.deepEqual(compareVersion(newer, older, 2), { state: FRIB_STATE.NEAR, arrow: 'down' })
    assert.deepEqual(compareVersion(older, older, 2), { state: FRIB_STATE.SAME, arrow: '' })
    assert.deepEqual(compareVersion(older, { label: '3.20.0', order: 30, beforeRange: false }, 2), { state: FRIB_STATE.DIFF, arrow: 'up' })
    assert.deepEqual(compareVersion(null, newer, 2), { state: FRIB_STATE.UNKNOWN, arrow: '' })
})

test('早于收录范围的版本只比较早晚且双方一致时视为相同', () => {
    const adjacent = { label: '3.4.1', order: 1, beforeRange: false }
    const far = { label: '3.4.3', order: 3, beforeRange: false }
    assert.deepEqual(compareVersion(beforeRange, beforeRange, 2), { state: FRIB_STATE.SAME, arrow: '' })
    assert.deepEqual(compareVersion(adjacent, beforeRange, 2), { state: FRIB_STATE.DIFF, arrow: 'down' })
    assert.deepEqual(compareVersion(beforeRange, adjacent, 2), { state: FRIB_STATE.DIFF, arrow: 'up' })
    assert.deepEqual(compareVersion(far, beforeRange, 2), { state: FRIB_STATE.DIFF, arrow: 'down' })
    assert.deepEqual(compareVersion(adjacent, far, 2), { state: FRIB_STATE.NEAR, arrow: 'up' })
})

test('版本索引把最早版本内的曲目记为最早版本号加短横', () => {
    const index = buildVersionIndex(
        { '92': { version_label: '3.4.0' }, '95': { version_label: '3.4.3' } },
        { '92': { 'Old.Song': {} }, '95': { 'Old.Song': {}, 'New.Song': {} } },
    )
    assert.deepEqual(index.bySong.get(/** @type {any} */ ('Old.Song')), {
        label: '3.4.0-',
        order: -1,
        beforeRange: true,
    })
    assert.deepEqual(index.bySong.get(/** @type {any} */ ('New.Song')), {
        label: '3.4.3',
        order: 1,
        beforeRange: false,
    })
    assert.equal(index.orderOfCode.get('95'), 1)
    assert.equal(index.earliestLabel, '3.4.0')
})

test('曲目池只保留拥有对应难度且满足定数下限的曲目', () => {
    /** @type {import('../apps/guessGame/frib19Utils.js').fribSongInfo[]} */
    const songs = [
        /** @type {any} */ ({ id: 'OnlyEZ.0', chart: { EZ: { difficulty: 3 } } }),
        /** @type {any} */ ({ id: 'LowIN.0', chart: { IN: { difficulty: 13.5 } } }),
        /** @type {any} */ ({ id: 'HighIN.0', chart: { IN: { difficulty: 15.4 } } }),
        /** @type {any} */ ({ id: 'NoChart.0' }),
    ]
    const infoOf = (/** @type {idString} */ id) => songs.find(item => item.id === id)
    assert.deepEqual(buildSongPool(/** @type {any} */ (['OnlyEZ.0', 'LowIN.0', 'HighIN.0', 'NoChart.0']), {
        level: 'IN',
        minDifficulty: null,
        infoOf,
    }), ['LowIN.0', 'HighIN.0'])
    assert.deepEqual(buildSongPool(/** @type {any} */ (['OnlyEZ.0', 'LowIN.0', 'HighIN.0']), {
        level: 'IN',
        minDifficulty: 14,
        infoOf,
    }), ['HighIN.0'])
    assert.deepEqual(buildSongPool(/** @type {any} */ (['OnlyEZ.0', 'Missing.0']), {
        level: 'EZ',
        minDifficulty: null,
        infoOf,
    }), ['OnlyEZ.0'])
})

test('猜测行按相近范围给出颜色状态与箭头', () => {
    const row = createFribRow(guess, answer, {
        player: '废酱',
        level: 'IN',
        versionIndex: versionIndex([
            ['Answer.Song', { label: '3.5.1', order: 2, beforeRange: false }],
            ['Guess.Song', { label: '3.4.0', order: 0, beforeRange: false }],
        ]),
        nearDifficulty: 0.3,
        nearBpm: 20,
        nearCombo: 200,
        nearVersion: 2,
    })
    assert.equal(row.player, '废酱')
    assert.equal(row.song, 'Guess Song')
    assert.equal(row.hit, false)
    assert.deepEqual(row.composer, { value: 'Other', state: FRIB_STATE.DIFF, arrow: '' })
    assert.deepEqual(row.version, { value: '3.4.0', state: FRIB_STATE.NEAR, arrow: 'up' })
    assert.deepEqual(row.chapter, { value: 'Chapter 5 霓虹灯牌', state: FRIB_STATE.DIFF, arrow: '' })
    assert.deepEqual(row.original, { value: '非独占', state: FRIB_STATE.DIFF, arrow: '' })
    assert.deepEqual(row.difficulty, { value: '15.2', state: FRIB_STATE.NEAR, arrow: 'up' })
    assert.deepEqual(row.bpm, { value: '170', state: FRIB_STATE.NEAR, arrow: 'up' })
    assert.deepEqual(row.combo, { value: '1100', state: FRIB_STATE.NEAR, arrow: 'up' })
})

test('命中行与缺失数据行分别标记命中与数据未知', () => {
    const hit = createFribRow(answer, answer, {
        player: '废酱',
        level: 'IN',
        versionIndex: versionIndex([]),
        nearDifficulty: 0.3,
        nearBpm: 20,
        nearCombo: 200,
        nearVersion: 2,
    })
    assert.equal(hit.hit, true)
    assert.deepEqual(hit.version, { value: FRIB_UNKNOWN_TEXT, state: FRIB_STATE.UNKNOWN, arrow: '' })
    assert.deepEqual(hit.difficulty, { value: '15.4', state: FRIB_STATE.SAME, arrow: '' })
    assert.deepEqual(hit.original, { value: '独占', state: FRIB_STATE.SAME, arrow: '' })

    const empty = createFribRow({ id: 'Empty.0', song: 'Empty' }, answer, {
        player: '废酱',
        level: 'IN',
        versionIndex: versionIndex([]),
        nearDifficulty: 0.3,
        nearBpm: 20,
        nearCombo: 200,
        nearVersion: 2,
    })
    assert.equal(empty.bpm.value, '—')
    assert.equal(empty.bpm.state, FRIB_STATE.UNKNOWN)
    assert.equal(empty.combo.value, '—')
    assert.equal(empty.chapter.value, '—')
})

test('早于收录范围的曲目展示最早版本号加短横且只比较早晚', () => {
    const early = /** @type {any} */ ({
        id: 'Early.0',
        song: 'Early Song',
        bpm: '150',
        chart: { IN: { difficulty: 15, combo: 1000 } },
    })
    const context = {
        player: '废酱',
        level: /** @type {levelKind} */ ('IN'),
        versionIndex: versionIndex([
            ['Early.0', { label: '3.4.0-', order: -1, beforeRange: true }],
            ['Answer.Song', { label: '3.5.1', order: 2, beforeRange: false }],
        ]),
        nearDifficulty: 0.3,
        nearBpm: 20,
        nearCombo: 200,
        nearVersion: 2,
    }
    assert.deepEqual(createFribRow(early, answer, context).version, {
        value: '3.4.0-',
        state: FRIB_STATE.DIFF,
        arrow: 'up',
    })
    assert.deepEqual(createFribRow(answer, early, context).version, {
        value: '3.5.1',
        state: FRIB_STATE.DIFF,
        arrow: 'down',
    })
    assert.deepEqual(createFribRow(early, early, context).version, {
        value: '3.4.0-',
        state: FRIB_STATE.SAME,
        arrow: '',
    })
})

test('渲染行保持模板约定的七列顺序', () => {
    const row = createFribRow(guess, answer, {
        player: '废酱',
        level: 'IN',
        versionIndex: versionIndex([]),
        nearDifficulty: 0.3,
        nearBpm: 20,
        nearCombo: 200,
        nearVersion: 2,
    })
    const rendered = toRenderRows([row])
    assert.equal(rendered.length, 1)
    assert.equal(rendered[0].player, '废酱')
    assert.equal(rendered[0].hit, false)
    assert.deepEqual(rendered[0].cells.map(cell => cell.cls), [
        'artistCell',
        'versionCell',
        'chapterCell',
        'originalCell',
        'difficultyCell',
        'bpmCell',
        'comboCell',
    ])
})
