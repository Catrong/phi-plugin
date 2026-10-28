import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
    GRKS_GAME,
    RANK_MIN_PLAYS,
    addScore,
    averageHints,
    clearGame,
    getGame,
    getPlayer,
    listGames,
    listPlayers,
    paginate,
    queryRanking,
    rankByAccuracy,
    rankByScore,
    rankByWinRate,
    registerGame,
    reloadStore,
    resolveGameMode,
    setStoreFile,
    winRate,
} from '../model/game/gameScore/index.js'

/** 每个用例使用独立的临时存储文件，避免污染插件 data 目录。 */
function useTempStore() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phi-gamescore-'))
    setStoreFile(path.join(dir, 'gameScore.json'))
    reloadStore()
    return dir
}

test('registers the built-in grks game with normal and match modes', () => {
    const game = getGame('grks')
    assert.equal(game?.id, GRKS_GAME.id)
    assert.equal(game?.name, '猜RKS')
    assert.equal(game?.modes.normal.label, '单机')
    assert.equal(game?.modes.match.winRate, true)
    assert.ok(listGames().some(item => item.id === 'grks'))

    const resolved = resolveGameMode('grks', 'match')
    assert.equal(resolved?.mode, 'match')
    assert.equal(resolved?.modeMeta.winRate, true)

    const fallback = resolveGameMode('grks', 'unknown')
    assert.equal(fallback?.mode, 'normal')
})

test('keeps scores, plays, best and match results per game mode', async () => {
    useTempStore()
    const first = await addScore('grks', 'normal', 'user-a', 5)
    assert.equal(first.score, 5)
    assert.equal(first.plays, 1)
    assert.equal(first.best, 5)

    const second = await addScore('grks', 'normal', 'user-a', 2.5)
    assert.equal(second.score, 7.5)
    assert.equal(second.plays, 2)
    assert.equal(second.best, 5)

    await addScore('grks', 'match', 'user-a', 10, { result: 'win' })
    await addScore('grks', 'match', 'user-a', 0, { result: 'loss' })
    const match = getPlayer('grks', 'match', 'user-a')
    assert.equal(match?.wins, 1)
    assert.equal(match?.losses, 1)
    assert.equal(match?.draws, 0)

    /** 单机与匹配分别记录，互不影响 */
    assert.equal(getPlayer('grks', 'normal', 'user-a')?.wins, 0)
    assert.equal(listPlayers('grks', 'match').length, 1)

    await clearGame('grks')
    assert.equal(listPlayers('grks', 'match').length, 0)
})

test('ranks by score then win rate with pagination', async () => {
    useTempStore()
    await addScore('grks', 'normal', 'a', 10)
    await addScore('grks', 'normal', 'b', 6)
    await addScore('grks', 'normal', 'c', 6)
    await addScore('grks', 'match', 'a', 10, { result: 'win' })
    await addScore('grks', 'match', 'a', 10, { result: 'win' })
    await addScore('grks', 'match', 'b', 5, { result: 'win' })
    await addScore('grks', 'match', 'b', 0, { result: 'loss' })
    await addScore('grks', 'match', 'b', 0, { result: 'loss' })
    await addScore('grks', 'match', 'c', 0, { result: 'draw' })

    const normalRows = rankByScore(listPlayers('grks', 'normal'))
    assert.deepEqual(normalRows.map(row => row.userId), ['a', 'b', 'c'])
    assert.equal(normalRows[1].plays, 1)

    const matchRows = listPlayers('grks', 'match')
    const rowB = matchRows.find(row => row.userId === 'b')
    assert.ok(rowB)
    assert.ok(Math.abs(winRate(rowB) - 1 / 3) < 1e-9)
    const ranked = rankByWinRate(matchRows, 1)
    assert.deepEqual(ranked.map(row => row.userId), ['a', 'b', 'c'])
    assert.deepEqual(rankByWinRate(matchRows, 3).map(row => row.userId), ['b'])

    const paged = paginate(ranked, 2, 2)
    assert.equal(paged.page, 2)
    assert.equal(paged.pages, 2)
    assert.equal(paged.total, 3)
    assert.equal(paged.items.length, 1)
})

test('formats score and win rate boards and falls back for unknown games', async () => {
    useTempStore()
    await addScore('grks', 'normal', 'user-1', 10)
    await addScore('grks', 'match', 'user-1', 10, { result: 'win' })
    await addScore('grks', 'match', 'user-1', 5, { result: 'draw' })

    const scoreBoard = queryRanking({ gameId: 'grks', mode: 'normal', meId: 'user-1' })
    assert.equal(scoreBoard.ok, true)
    assert.match(scoreBoard.text, /猜RKS · 单机 积分榜/)
    assert.match(scoreBoard.text, /匿名用户　10\.00 分/)
    assert.match(scoreBoard.text, /我的排名：#1/)

    const rateBoard = queryRanking({ gameId: 'grks', mode: 'match', kind: 'winRate', minMatches: 1 })
    assert.match(rateBoard.text, /胜率榜/)
    assert.match(rateBoard.text, /50\.0%/)

    const empty = queryRanking({ gameId: 'grks', mode: 'match', kind: 'winRate', minMatches: 99 })
    assert.match(empty.text, /暂无符合条件的玩家/)

    const missing = queryRanking({ gameId: 'not-exists', mode: 'normal' })
    assert.equal(missing.ok, false)
    assert.match(missing.text, /暂无可查询/)
})

test('accepts third-party games through the public registry', async () => {
    useTempStore()
    registerGame({ id: 'demo', name: '示例游戏' })
    await addScore('demo', 'normal', 'x', 3)
    const board = queryRanking({ gameId: 'demo', mode: 'normal' })
    assert.equal(board.ok, true)
    assert.match(board.text, /示例游戏 · 单机 积分榜/)
    assert.match(board.text, /匿名用户　3\.00 分/)
})

test('accumulates hint counts for the accuracy statistics', async () => {
    useTempStore()
    await addScore('grks', 'normal', 'a', 10, { hints: 3 })
    await addScore('grks', 'normal', 'a', 0, { hints: 17 })
    const row = getPlayer('grks', 'normal', 'a')
    assert.equal(row?.plays, 2)
    assert.equal(row?.hintPlays, 2)
    assert.equal(row?.hintSum, 20)
    assert.equal(averageHints(row), 10)
    /** 不带提示数的对局只计场次，不参与平均 */
    await addScore('grks', 'normal', 'a', 0)
    const legacy = getPlayer('grks', 'normal', 'a')
    assert.equal(legacy?.plays, 3)
    assert.equal(legacy?.hintPlays, 2)
    assert.equal(averageHints(legacy), 10)
})

test('答题统计独立累加且持久化，旧对局不推算正确率', async () => {
    useTempStore()
    await addScore('grks', 'match', 'a', 10, { result: 'win', hints: 2 })
    assert.equal(getPlayer('grks', 'match', 'a')?.answers, undefined)
    await addScore('grks', 'match', 'a', 0, { result: 'loss', hints: 10, answers: { total: 3, correct: 0 } })
    const result = await addScore('grks', 'match', 'a', 5, { result: 'draw', hints: 2, answers: { total: 2, correct: 1 } })
    assert.deepEqual(result.answers, { total: 5, correct: 1 })
    if (!result.answers) assert.fail('缺少答题统计')
    result.answers.correct = 5
    const snapshot = getPlayer('grks', 'match', 'a')
    if (!snapshot?.answers) assert.fail('缺少答题统计快照')
    assert.deepEqual(snapshot.answers, { total: 5, correct: 1 })
    snapshot.answers.total = 99
    assert.deepEqual(getPlayer('grks', 'match', 'a')?.answers, { total: 5, correct: 1 })
    reloadStore()
    const restored = getPlayer('grks', 'match', 'a')
    assert.deepEqual(restored?.answers, { total: 5, correct: 1 })
    assert.equal(restored?.plays, 3)
    assert.equal(restored?.hintSum, 14)
    assert.equal(restored?.wins, 1)
    assert.equal(restored?.draws, 1)
    assert.equal(restored?.losses, 1)
})

test('非法答题计数立即失败，不增加场次或积分', async () => {
    useTempStore()
    for (const answers of [
        { total: -1, correct: 0 }, { total: 1, correct: -1 }, { total: 1, correct: 2 },
        { total: 1.5, correct: 1 }, { total: 1, correct: 0.5 },
        { total: NaN, correct: 0 }, { total: Infinity, correct: 0 },
        { total: Number.MAX_SAFE_INTEGER + 1, correct: 0 },
    ]) {
        await assert.rejects(addScore('grks', 'match', 'a', 10, { answers }), /答题统计/)
        assert.equal(getPlayer('grks', 'match', 'a'), null)
    }
    await addScore('grks', 'match', 'a', 0, { answers: { total: Number.MAX_SAFE_INTEGER, correct: 0 } })
    await assert.rejects(addScore('grks', 'match', 'a', 10, { answers: { total: 1, correct: 1 } }), /安全整数范围/)
    assert.equal(getPlayer('grks', 'match', 'a')?.plays, 1)
    assert.equal(getPlayer('grks', 'match', 'a')?.score, 0)
    assert.deepEqual(getPlayer('grks', 'match', 'a')?.answers, { total: Number.MAX_SAFE_INTEGER, correct: 0 })
})

test('存储中的答题统计严格校验，缺失字段保留无样本状态', () => {
    const directory = useTempStore()
    const file = path.join(directory, 'gameScore.json')
    for (const answers of [null, [], {}, { total: '1', correct: 0 }, { total: 1, correct: 2 }]) {
        fs.writeFileSync(file, JSON.stringify({ version: 1, games: { grks: { match: { a: { plays: 10, answers } } } } }))
        reloadStore()
        assert.throws(() => getPlayer('grks', 'match', 'a'), /答题统计/)
    }
    fs.writeFileSync(file, JSON.stringify({ version: 1, games: { grks: { match: { a: { plays: 10, wins: 5 } } } } }))
    reloadStore()
    assert.equal(getPlayer('grks', 'match', 'a')?.plays, 10)
    assert.equal(getPlayer('grks', 'match', 'a')?.answers, undefined)
})

test('ranks by average hints, then total score, with a 10 game threshold', async () => {
    useTempStore()
    /** sharp：10 局、平均 2 条 */
    for (let index = 0; index < 10; index++) await addScore('grks', 'normal', 'sharp', 1, { hints: 2 })
    /** vet-a / vet-b：同为平均 4 条，积分低者排后 */
    for (let index = 0; index < 10; index++) await addScore('grks', 'normal', 'vet-a', 5, { hints: 4 })
    for (let index = 0; index < 10; index++) await addScore('grks', 'normal', 'vet-b', 10, { hints: 4 })
    /** rookie：平均最好但只玩了 9 局，不上榜 */
    for (let index = 0; index < RANK_MIN_PLAYS - 1; index++) await addScore('grks', 'normal', 'rookie', 1, { hints: 1 })

    const rows = listPlayers('grks', 'normal')
    assert.deepEqual(rankByAccuracy(rows).map(row => row.userId), ['sharp', 'vet-b', 'vet-a'])
    assert.ok(rankByAccuracy(rows, 1).some(row => row.userId === 'rookie'))

    const board = queryRanking({ gameId: 'grks', mode: 'normal', kind: 'accuracy', meId: 'rookie' })
    assert.equal(board.ok, true)
    assert.match(board.text, /猜RKS · 单机 准确率榜（共 3 人）/)
    assert.match(board.text, /#1 匿名用户　平均 2\.00 条提示　10 局　积分 10\.00/)
    assert.match(board.text, /#2 匿名用户　平均 4\.00 条提示　10 局　积分 100\.00/)
    assert.match(board.text, /我的排名：未上榜（需要至少完成 10 局）/)

    /** 匹配模式同样提供准确率榜 */
    for (let index = 0; index < 10; index++) await addScore('grks', 'match', 'duel', 5, { result: 'win', hints: 3 })
    const matchBoard = queryRanking({ gameId: 'grks', mode: 'match', kind: 'accuracy' })
    assert.match(matchBoard.text, /猜RKS · 匹配 准确率榜/)
    assert.match(matchBoard.text, /匿名用户　平均 3\.00 条提示　10 局/)
})

test('requires 10 matches for the win rate board by default', async () => {
    useTempStore()
    await addScore('grks', 'match', 'a', 10, { result: 'win' })
    await addScore('grks', 'match', 'a', 10, { result: 'win' })
    const early = queryRanking({ gameId: 'grks', mode: 'match', kind: 'winRate' })
    assert.match(early.text, /暂无符合条件的玩家（至少 10 场匹配对局）/)

    for (let index = 0; index < 8; index++) await addScore('grks', 'match', 'a', 0, { result: 'loss' })
    const board = queryRanking({ gameId: 'grks', mode: 'match', kind: 'winRate' })
    assert.match(board.text, /胜率榜（共 1 人）/)
    assert.match(board.text, /匿名用户　胜率 20\.0%　2胜 8负 0平（10 场）/)
})
