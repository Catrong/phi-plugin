import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
    GRKS_GAME,
    addScore,
    clearGame,
    getGame,
    getPlayer,
    listGames,
    listPlayers,
    paginate,
    queryRanking,
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
    assert.match(scoreBoard.text, /user-1　10\.00 分/)
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
    assert.match(board.text, /x　3\.00 分/)
})
