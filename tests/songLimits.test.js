import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { MAX_DIFFICULTY } from '../model/game/constNum.js'
import {
    CHALLENGE_SONG_COUNT,
    MAX_CHALLENGE_COLOR,
    RKS_DIVISOR,
    RKS_TOLERANCE,
    checkSaveRecord,
    checkSaveSummary,
    computeSongLimits,
    fallbackSongLimits,
} from '../model/game/songLimits.js'

/**
 * @param {string} id
 * @param {string} rank
 * @param {number} difficulty
 */
const chart = (id, rank, difficulty) => ({ id, rank, difficulty })

/** @param {number[]} list */
const sum = (list) => list.reduce((total, value) => total + value, 0)

test('课题上限允许同一档位重复，但不能超过该档张数', () => {
    const limits = computeSongLimits([
        chart('a', 'EZ', 0.5),
        chart('b', 'EZ', 1),
        chart('c', 'HD', 1.5),
        chart('d', 'IN', 16),
        chart('e', 'IN', 16.5),
        chart('f', 'AT', 18),
    ])
    // 16 档有 2 张，所以 18 + 16 + 16 可行；16 + 16 + 16 不可行
    assert.equal(limits.maxChallenge, 50)
    assert.deepEqual(limits.bestCombo, [16, 16, 18])
    assert.equal(limits.minChallenge, 2) // 0 + 1 + 1
    assert.equal(limits.maxChallengeUniqueSongs, 50)
    assert.equal(limits.chartCount, 6)
    assert.equal(limits.fallback, false)
})

test('rks 上限 = (定数最高的 27 张 + 其中前 3 张) / 30', () => {
    const difficulties = [18, 16.5, 16, 1.5, 1, 0.5]
    const limits = computeSongLimits(difficulties.map((difficulty, i) => chart(`s${i}`, 'AT', difficulty)))
    // 谱面不足 27 张时，27 条切片取到全部，满切片只取前 3 张
    const expected = (sum(difficulties) + sum([...difficulties].sort((a, b) => b - a).slice(0, 3))) / RKS_DIVISOR
    assert.ok(Math.abs(limits.maxRks - expected) < 1e-9)
})

test('rks 上限只统计定数最高的 27 张谱', () => {
    const charts = []
    for (let i = 0; i < 40; i++) charts.push(chart(`top${i}`, 'AT', 18 - i * 0.1))
    const limits = computeSongLimits(charts)
    const sorted = charts.map((item) => item.difficulty).sort((a, b) => b - a)
    const expected = (sum(sorted.slice(0, 27)) + sum(sorted.slice(0, 3))) / RKS_DIVISOR
    assert.ok(Math.abs(limits.maxRks - expected) < 1e-9)
    assert.ok(limits.maxRks < sorted[0])
})

test('三张谱来自同一首歌的组合不计入 unique 上限', () => {
    const limits = computeSongLimits([
        chart('same', 'IN', 16),
        chart('same', 'AT', 17),
        chart('other', 'EZ', 0.5),
    ])
    // 只看档位张数：0 + 16 + 17 可行
    assert.equal(limits.maxChallenge, 33)
    // 16 与 17 是同一首歌，凑不出三首不同曲目
    assert.equal(limits.maxChallengeUniqueSongs, 0)
})

test('定数表为空时退回保守上限', () => {
    const empty = computeSongLimits([])
    assert.deepEqual(empty, fallbackSongLimits())
    assert.equal(empty.fallback, true)
    assert.equal(empty.maxRks, MAX_DIFFICULTY)
    assert.equal(empty.maxChallenge, MAX_DIFFICULTY * CHALLENGE_SONG_COUNT)
})

test('存档概要校验：正常值通过', () => {
    // 30 张 18.0：rks 上限 = 18，课题上限 = 54
    const limits = computeSongLimits(Array.from({ length: 30 }, (_, i) => chart(`c${i}`, 'AT', 18)))
    assert.equal(limits.maxRks, 18)
    assert.equal(limits.maxChallenge, 54)
    assert.equal(checkSaveSummary({ rankingScore: 15.105, challengeModeRank: 348 }, limits).ok, true)
    // 恰好等于上限（含 float32 误差）也要放行
    assert.equal(checkSaveSummary({ rankingScore: limits.maxRks, challengeModeRank: 554 }, limits).ok, true)
    assert.equal(checkSaveSummary({ rankingScore: limits.maxRks + RKS_TOLERANCE / 2, challengeModeRank: 0 }, limits).ok, true)
    // 没有任何成绩
    assert.equal(checkSaveSummary({ rankingScore: 0, challengeModeRank: 0 }, limits).ok, true)
})

test('存档概要校验：rks 异常', () => {
    const limits = computeSongLimits([chart('a', 'AT', 18)])
    const reason = (/** @type {any} */ summary) => checkSaveSummary(summary, limits).reason
    assert.match(reason({ rankingScore: limits.maxRks + 1, challengeModeRank: 0 }), /超过上限/)
    assert.match(reason({ rankingScore: -0.1, challengeModeRank: 0 }), /负数/)
    assert.match(reason({ rankingScore: NaN, challengeModeRank: 0 }), /不是有效数字/)
    assert.match(reason({ challengeModeRank: 0 }), /不是有效数字/)
})

test('存档概要校验：课题分异常', () => {
    const limits = computeSongLimits([
        chart('a', 'EZ', 0.5),
        chart('b', 'IN', 16),
        chart('c', 'AT', 17),
        chart('d', 'AT', 18),
    ])
    const reason = (/** @type {number} */ challengeModeRank) => checkSaveSummary({ rankingScore: 3, challengeModeRank }, limits).reason
    assert.equal(reason(0), '')
    assert.match(reason(352), /课题总值 52 超出 1-51/)
    assert.match(reason(3518), /课题颜色档位 35 超出 1-5/)
    assert.match(reason(651), new RegExp(`课题颜色档位 6 超出 1-${MAX_CHALLENGE_COLOR}`))
    assert.match(reason(300), /课题总值 0 超出/)
    assert.match(reason(51), /课题颜色档位 0 超出/)
    assert.match(reason(351.5), /不是整数/)
    assert.match(reason(-100), /负数/)
})

test('成绩校验：正常值通过，缺失字段按 0 处理', () => {
    assert.equal(checkSaveRecord({ acc: 100, score: 1000000 }).ok, true)
    assert.equal(checkSaveRecord({ acc: 0, score: 0 }).ok, true)
    assert.equal(checkSaveRecord({}).ok, true)
    assert.equal(checkSaveRecord({ acc: null, score: null }).ok, true)
    assert.equal(checkSaveRecord({ acc: '99.5', score: '999999' }).ok, true)
})

test('成绩校验：越界与非法数字', () => {
    assert.deepEqual(checkSaveRecord({ acc: 102.57, score: 1000000 }), {
        ok: false, field: 'acc', reason: 'acc 102.57 超出 0-100',
    })
    assert.equal(checkSaveRecord({ acc: -0.1, score: 0 }).field, 'acc')
    assert.equal(checkSaveRecord({ acc: NaN, score: 0 }).field, 'acc')
    assert.equal(checkSaveRecord({ acc: undefined, score: 1000001 }).field, 'score')
    assert.equal(checkSaveRecord({ acc: 0, score: -1 }).field, 'score')
    assert.equal(checkSaveRecord({ acc: 0, score: Infinity }).field, 'score')
})

test('真实定数表算出的上限自洽且可达成', () => {
    const csv = fs.readFileSync('resources/info/info.csv', 'utf8').split(/\r?\n/).filter(Boolean)
    const head = csv[0].split('\t')
    /** @type {{ id: string, rank: string, difficulty: number }[]} */
    const charts = []
    for (const line of csv.slice(1)) {
        const cells = line.split('\t')
        for (const rank of ['EZ', 'HD', 'IN', 'AT']) {
            const raw = cells[head.indexOf(rank)]
            if (!raw) continue
            charts.push(chart(cells[0], rank, Number(raw)))
        }
    }
    const limits = computeSongLimits(charts)
    assert.equal(limits.fallback, false)
    assert.ok(charts.length > 300)
    assert.ok(limits.maxRks > 16 && limits.maxRks <= MAX_DIFFICULTY)
    assert.ok(limits.maxChallenge >= 40 && limits.maxChallenge <= MAX_DIFFICULTY * CHALLENGE_SONG_COUNT)
    assert.ok(limits.maxChallengeUniqueSongs <= limits.maxChallenge)
    assert.ok(limits.minChallenge >= 0)

    /** 声称的最大组合必须真的存在这么多张谱 */
    const combo = /** @type {number[]} */ (limits.bestCombo)
    assert.equal(combo.length, CHALLENGE_SONG_COUNT)
    assert.equal(sum(combo), limits.maxChallenge)
    for (const floor of combo) {
        assert.ok(charts.some((item) => Math.floor(item.difficulty) === floor), `缺少档位 ${floor}`)
    }
})
