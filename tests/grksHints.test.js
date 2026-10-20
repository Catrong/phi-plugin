import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHintArgs } from '../apps/grks.js'
import {
    BEST_SLOTS,
    NOINFO_TEXT,
    PHI_SLOTS,
    applyMatchHint,
    applySoloHint,
    buildPuzzle,
    buildView,
    challengeModeInfo,
    createMatchSideState,
    createSoloState,
    defaultMatchHint,
    formatHintText,
    matchHintType,
    normalizeSlotName,
    resolveStatsKind,
    soloHintKind,
    validateMatchHint,
} from '../model/game/grks/hints.js'

/**
 * 构造一条 B30 成绩。
 * @param {string} id
 * @param {number} rks
 * @param {Record<string, unknown>} [extra]
 * @returns {any}
 */
function record(id, rks, extra = {}) {
    return {
        id,
        song: `Song ${id}`,
        rank: 'IN',
        difficulty: 15,
        score: 995000,
        acc: 99.1,
        rks,
        illustration: `ill-${id}.png`,
        fc: false,
        ...extra,
    }
}

/**
 * 构造 PHP 的 B30 数据（默认 P3 + B27）。
 * @param {{phi?: number, best?: number, base?: number}} [options]
 * @returns {{phi: any[], b19_list: any[]}}
 */
function makeB30(options = {}) {
    const phiCount = options.phi ?? 3
    const bestCount = options.best ?? 27
    const base = options.base ?? 15.5
    return {
        phi: Array.from({ length: phiCount }, (_, index) => record(`p${index}`, base + 0.5 - index * 0.1)),
        b19_list: Array.from({ length: bestCount }, (_, index) => record(`b${index}`, base - index * 0.01)),
    }
}

/** 一份带完成度统计的谜题 */
function makePuzzle(options = {}) {
    return buildPuzzle({
        b30: makeB30(options),
        stats: [
            { title: 'EZ', tot: 100, cleared: 90, fc: 20, phi: 2 },
            { title: 'HD', tot: 100, cleared: 80, fc: 30, phi: 3 },
            { title: 'IN', tot: 100, cleared: 70, fc: 40, phi: 4 },
            { title: 'AT', tot: 10, cleared: 5, fc: 2, phi: 1 },
        ],
        challengeModeRank: 356,
        sourceToken: 'token-a',
    })
}

test('builds a puzzle with P3 + B27 slots and B30 rks', () => {
    const puzzle = makePuzzle()
    assert.equal(puzzle.recordCount, 30)
    assert.equal(puzzle.phiCount, 3)
    assert.equal(puzzle.bestCount, 27)
    assert.deepEqual(puzzle.slots.slice(0, 3).map(slot => slot.slot), PHI_SLOTS)
    assert.equal(puzzle.slots[puzzle.slots.length - 1].slot, 'B27')

    const expected = (puzzle.slots.reduce((sum, slot) => sum + slot.rks, 0)) / 30
    assert.ok(Math.abs(puzzle.rks - expected) < 1e-9)
    assert.ok(puzzle.analysis.max > puzzle.analysis.min)
    assert.equal(puzzle.analysis.histogram.count, 30)
    assert.equal(puzzle.stats.length, 4)
    assert.deepEqual(challengeModeInfo(356), { name: '白', level: 3, score: 56, colorIndex: 0 })
    assert.deepEqual(challengeModeInfo(1256), { name: '蓝', level: 12, score: 56, colorIndex: 2 })
    assert.deepEqual(challengeModeInfo(2156), { name: '彩', level: 21, score: 56, colorIndex: 5 })

    const small = buildPuzzle({ b30: makeB30({ phi: 1, best: 5 }), stats: [] })
    assert.equal(small.recordCount, 6)
    assert.equal(small.stats.length, 0)
})

test('walks the solo hint ladder around the position threshold', () => {
    const puzzle = makePuzzle()
    let state = createSoloState('token-a')
    const cfg = { PositionHintAt: 5, HintRevealNum: 2, StatsHint: 'auto' }
    /** @type {string[]} */
    const kinds = []
    for (let index = 0; index < 8; index++) {
        const result = applySoloHint(state, puzzle, cfg, () => 0)
        kinds.push(result.hint.kind)
        state = result.state
        assert.equal(state.hintCount, index + 1)
        assert.equal(state.positionRevealed, index + 1 >= 5)
    }
    assert.deepEqual(kinds, ['records', 'records', 'records', 'records', 'records', 'stats', 'challenge', 'records'])
    assert.equal(soloHintKind({ ...state, hintCount: 0 }, 5), 'records')
    assert.equal(soloHintKind({ ...state, hintCount: 4 }, 5), 'records')
    assert.equal(soloHintKind({ ...state, hintCount: 5 }, 5), 'stats')
    assert.equal(soloHintKind({ ...state, hintCount: 6 }, 5), 'challenge')
    assert.equal(soloHintKind({ ...state, hintCount: 7 }, 5), 'records')
})

test('reveals slots without duplicates and marks exhaustion', () => {
    const puzzle = makePuzzle()
    const cfg = { PositionHintAt: 100, HintRevealNum: 3, StatsHint: 'range' }
    let state = createSoloState('token-a')
    const seen = new Set()
    for (let index = 0; index < 10; index++) {
        const result = applySoloHint(state, puzzle, cfg, () => 0.42)
        for (const slot of result.hint.slots || []) {
            assert.equal(seen.has(slot), false, `槽位 ${slot} 重复提示`)
            seen.add(slot)
        }
        state = result.state
    }
    assert.equal(state.positionRevealed, false)
    assert.equal(seen.size, 30)

    const exhausted = applySoloHint(state, puzzle, cfg, () => 0)
    assert.equal(exhausted.hint.kind, 'exhausted')
    assert.equal(exhausted.state.hintCount, state.hintCount)
})

test('resolves the stats hint form from argument, config or random', () => {
    assert.equal(resolveStatsKind('auto', 'range'), 'range')
    assert.equal(resolveStatsKind('auto', 'histogram'), 'histogram')
    assert.equal(resolveStatsKind('range', undefined), 'range')
    assert.equal(resolveStatsKind('auto', undefined, () => 0.1), 'histogram')
    assert.equal(resolveStatsKind('auto', undefined, () => 0.9), 'range')
    assert.equal(resolveStatsKind(undefined, undefined, () => 0.9), 'range')
})

test('validates match hint arguments', () => {
    const puzzle = makePuzzle()
    const side = createMatchSideState()

    assert.deepEqual(validateMatchHint(side, puzzle, 'records', 'B7'), { ok: true, slot: 'B7' })
    assert.equal(validateMatchHint(side, puzzle, 'records', 'p1').ok, true)
    assert.equal(validateMatchHint(side, puzzle, 'records', 'B28').ok, false)
    assert.equal(validateMatchHint(side, puzzle, 'records', 'P4').ok, false)
    assert.match(String(validateMatchHint(side, puzzle, 'records', '').error), /需要指定槽位/)

    const used = { revealedSlots: ['B7'], hintCount: 1 }
    const repeated = validateMatchHint(used, puzzle, 'records', 'B7')
    assert.equal(repeated.ok, false)
    assert.match(String(repeated.error), /已经提示过/)

    assert.deepEqual(validateMatchHint(side, puzzle, 'stats', 'range'), { ok: true, statsKind: 'range' })
    assert.equal(validateMatchHint(side, puzzle, 'stats', '').ok, true)
    assert.equal(validateMatchHint(side, puzzle, 'stats', 'bar').ok, false)
    assert.equal(validateMatchHint(side, puzzle, 'challenge', '').ok, true)
    assert.equal(validateMatchHint(side, puzzle, 'challenge', 'x').ok, false)

    const missing = buildPuzzle({ b30: makeB30({ best: 5 }), stats: [] })
    assert.equal(validateMatchHint(side, missing, 'records', 'B10').ok, false)

    assert.equal(normalizeSlotName('b7'), 'B7')
    assert.equal(normalizeSlotName('B27'), 'B27')
    assert.equal(normalizeSlotName('B0'), null)
    assert.equal(normalizeSlotName('P0'), null)
    assert.equal(matchHintType('1'), 'records')
    assert.equal(matchHintType('3'), 'stats')
    assert.equal(matchHintType('4'), 'challenge')
    assert.equal(matchHintType('2'), null)
})

test('applies match hints and falls back to an unused slot', () => {
    const puzzle = makePuzzle()
    const cfg = { StatsHint: 'auto' }
    let side = createMatchSideState()

    const first = applyMatchHint(side, puzzle, 'records', 'B3', cfg, () => 0.2)
    assert.equal(first.ok, true)
    if (!first.ok) return
    assert.deepEqual(first.hint.slots, ['B3'])
    assert.deepEqual(first.side.revealedSlots, ['B3'])
    assert.equal(first.side.hintCount, 1)
    side = first.side

    const duplicated = applyMatchHint(side, puzzle, 'records', 'B3', cfg)
    assert.equal(duplicated.ok, false)

    const stats = applyMatchHint(side, puzzle, 'stats', 'bar', cfg)
    assert.equal(stats.ok, false)

    const challenge = applyMatchHint(side, puzzle, 'challenge', '', cfg)
    assert.equal(challenge.ok, true)
    if (challenge.ok) assert.equal(challenge.side.hintCount, 2)

    assert.deepEqual(defaultMatchHint(side, puzzle), { type: 'records', arg: 'P1' })
    const full = { revealedSlots: puzzle.slots.map(slot => slot.slot), hintCount: 30 }
    assert.deepEqual(defaultMatchHint(full, puzzle), { type: 'stats' })
})

test('builds solo and match views with placeholders', () => {
    const puzzle = makePuzzle()
    const revealed = ['P1', 'B3']

    const unknownPosition = buildView({
        puzzle,
        revealedSlots: revealed,
        positionRevealed: false,
        mode: 'solo',
    })
    assert.equal(unknownPosition.phiSongs.length, 0)
    assert.equal(unknownPosition.bestSongs.length, 0)
    assert.deepEqual(unknownPosition.ordered.map((/** @type {any} */ item) => item.slot), ['', ''])
    assert.ok(unknownPosition.ordered[0].record.rks >= unknownPosition.ordered[1].record.rks)
    assert.equal(unknownPosition.ordered[0].placeholder, '')
    assert.equal(unknownPosition.header.rks, '----')
    assert.equal(unknownPosition.recordInfo.blank, true)
    assert.equal(unknownPosition.recordInfo.masked, false)

    const soloGrid = buildView({
        puzzle,
        revealedSlots: revealed,
        positionRevealed: true,
        mode: 'solo',
    })
    assert.equal(soloGrid.phiSongs.length, 3)
    assert.equal(soloGrid.bestSongs.length, 27)
    assert.equal(soloGrid.phiSongs[0].slot, 'P1')
    assert.equal(soloGrid.phiSongs[0].revealed, true)
    assert.equal(soloGrid.phiSongs[0].rating, 'V')
    assert.equal(soloGrid.phiSongs[1].placeholder, NOINFO_TEXT)
    assert.equal(soloGrid.phiSongs[1].record, null)
    assert.equal(soloGrid.phiSongs[1].masked, false)
    assert.equal(soloGrid.bestSongs[2].slot, 'B3')
    assert.equal(soloGrid.bestSongs[2].revealed, true)
    assert.equal(soloGrid.bestSongs[1].placeholder, NOINFO_TEXT)
    assert.equal(soloGrid.showAnalysis, true)
    assert.equal(soloGrid.header.showChallenge, false)
    assert.equal(soloGrid.header.challengeMasked, false)
    assert.equal(soloGrid.analysisPanel.blank, true)
    assert.equal(soloGrid.analysisPanel.masked, false)

    const matchGrid = buildView({
        puzzle,
        revealedSlots: revealed,
        positionRevealed: true,
        mode: 'match',
        hintCommand: '#phi grks',
    })
    assert.equal(matchGrid.phiSongs[1].placeholder, '#phi grks hint P2')
    assert.equal(matchGrid.bestSongs[0].placeholder, '#phi grks hint B1')
    assert.equal(matchGrid.phiSongs[1].command, '#phi grks hint P2')
    /** 提示者底图完整：未公开槽位仍带真实成绩，只是被半透明遮罩盖住 */
    assert.equal(matchGrid.phiSongs[1].revealed, false)
    assert.equal(matchGrid.phiSongs[1].masked, true)
    assert.ok(matchGrid.phiSongs[1].record)
    assert.equal(matchGrid.bestSongs[0].masked, true)
    assert.equal(matchGrid.header.showChallenge, true)
    assert.equal(matchGrid.header.challengeMasked, true)
    assert.equal(matchGrid.header.challengeCommand, '#phi grks hint 4')
    assert.equal(matchGrid.recordInfo.masked, true)
    assert.equal(matchGrid.recordInfo.blank, false)
    assert.equal(matchGrid.recordInfo.command, '#phi grks hint 4')
    assert.equal(matchGrid.showAnalysis, true)
    assert.equal(matchGrid.analysisPanel.masked, true)
    assert.equal(matchGrid.analysisPanel.blank, false)
    assert.equal(matchGrid.analysisPanel.command, '#phi grks hint 3 (histogram|range)')
    assert.equal(matchGrid.analysis.count, 30)
    assert.ok(matchGrid.analysis.average > 0)

    const rangeView = buildView({
        puzzle,
        revealedSlots: revealed,
        positionRevealed: true,
        mode: 'solo',
        hint: { kind: 'stats', statsKind: 'range' },
    })
    assert.equal(rangeView.rangeHint, true)
    assert.equal(rangeView.analysisPanel.blank, true)
    assert.equal(rangeView.analysis.min, puzzle.analysis.min)
    assert.ok(rangeView.rangeRuler.minPosition >= 0 && rangeView.rangeRuler.minPosition <= 100)
    assert.ok(rangeView.rangeRuler.maxPosition >= rangeView.rangeRuler.minPosition)
    assert.ok(rangeView.rangeRuler.ticks.length > 0)
    assert.equal(rangeView.rangeRuler.min, puzzle.analysis.min)
    assert.equal(rangeView.rangeRuler.max, puzzle.analysis.max)

    const challengeView = buildView({
        puzzle,
        revealedSlots: revealed,
        positionRevealed: true,
        mode: 'solo',
        hint: { kind: 'challenge' },
    })
    assert.equal(challengeView.recordInfo.blank, false)
    assert.equal(challengeView.recordInfo.masked, false)
    assert.equal(challengeView.header.showChallenge, true)
    assert.equal(challengeView.header.ChallengeMode, 0)
    assert.equal(challengeView.header.ChallengeModeRank, 56)
})

test('renders text fallback for every hint kind', () => {
    const puzzle = makePuzzle()

    const recordsText = formatHintText({
        puzzle,
        hint: { kind: 'records', slots: ['P1', 'B3'] },
        revealedSlots: ['P1', 'B3'],
        positionRevealed: false,
    })
    assert.match(recordsText, /本次公开的成绩/)
    assert.match(recordsText, /位置尚未公开/)

    const withPosition = formatHintText({
        puzzle,
        hint: { kind: 'records', slots: ['B3'] },
        revealedSlots: ['B3'],
        positionRevealed: true,
    })
    assert.match(withPosition, /B3 IN/)

    const rangeText = formatHintText({
        puzzle,
        hint: { kind: 'stats', statsKind: 'range' },
        revealedSlots: [],
        positionRevealed: true,
    })
    assert.match(rangeText, /单曲等效 rks 区间/)

    const histogramText = formatHintText({
        puzzle,
        hint: { kind: 'stats', statsKind: 'histogram' },
        revealedSlots: [],
        positionRevealed: true,
    })
    assert.match(histogramText, /B30 等效 rks 分布/)

    const challengeText = formatHintText({
        puzzle,
        hint: { kind: 'challenge' },
        revealedSlots: ['P1'],
        positionRevealed: true,
    })
    assert.match(challengeText, /课题模式/)
    assert.match(challengeText, /合计：通关/)
    assert.match(challengeText, /已公开 1\/30 个槽位/)

    assert.match(formatHintText({ puzzle, hint: null, revealedSlots: [], positionRevealed: true }), /已全部公开/)
})

test('parses simplified hint arguments', () => {
    assert.deepEqual(parseHintArgs('#phi grks hint B7'), { type: '1', arg: 'B7' })
    assert.deepEqual(parseHintArgs('#phi grks hint 1 b7'), { type: '1', arg: 'B7' })
    assert.deepEqual(parseHintArgs('#phi 猜rks 提示 p1'), { type: '1', arg: 'P1' })
    assert.deepEqual(parseHintArgs('#phi grks hint 3'), { type: '3', arg: undefined })
    assert.deepEqual(parseHintArgs('#phi grks hint 3 range'), { type: '3', arg: 'range' })
    assert.deepEqual(parseHintArgs('#phi grks hint range'), { type: '3', arg: 'range' })
    assert.deepEqual(parseHintArgs('#phi grks hint histogram'), { type: '3', arg: 'histogram' })
    assert.deepEqual(parseHintArgs('#phi grks hint 4'), { type: '4', arg: undefined })
    assert.deepEqual(parseHintArgs('#phi grks hint'), {})
})
