import {
    registerGame,
    getGame,
    listGames,
    resolveGameMode,
    defaultModes,
} from './registry.js'
import {
    getPlayer,
    listPlayers,
    addScore,
    reloadStore,
    clearGame,
    getStoreFile,
    setStoreFile,
} from './store.js'
import {
    rankByScore,
    rankByWinRate,
    winRate,
    paginate,
    formatRanking,
    describeRow,
} from './ranking.js'

/**
 * 通用游戏积分榜入口。
 *
 * 新游戏接入步骤：
 * 1. `registerGame({ id, name, modes: { normal: {...}, match: {...} } })` 声明游戏；
 * 2. 结算时调用 `addScore(gameId, mode, userId, points, { result })`；
 * 3. 榜单命令 `grks lb` 支持 `lb <gameId> <mode>` 形式的通用查询。
 */

/** 内置游戏：猜 RKS。 */
export const GRKS_GAME = registerGame({
    id: 'grks',
    name: '猜RKS',
    modes: {
        normal: { label: '单机', winRate: false, trackResult: false },
        match: { label: '匹配', winRate: true, trackResult: true },
    },
})

/**
 * 查询并格式化一份榜单。
 * @param {object} options
 * @param {string} [options.gameId]
 * @param {string} [options.mode]
 * @param {import('./ranking.js').gameScoreRankKind} [options.kind]
 * @param {number} [options.page]
 * @param {number} [options.pageSize]
 * @param {number} [options.minMatches]
 * @param {string} [options.meId]
 * @returns {{ok: boolean, text: string, gameId?: string, mode?: string, kind?: string}}
 */
export function queryRanking(options) {
    const resolved = resolveGameMode(options.gameId, options.mode)
    if (!resolved) return { ok: false, text: '暂无可查询的游戏积分榜' }
    const { game, mode, modeMeta } = resolved
    const kind = options.kind === 'winRate' && modeMeta.winRate ? 'winRate' : 'score'
    const rows = listPlayers(game.id, mode)
    const sorted = kind === 'winRate'
        ? rankByWinRate(rows, options.minMatches ?? 1)
        : rankByScore(rows)
    const title = `${game.name} · ${modeMeta.label} ${kind === 'winRate' ? '胜率榜' : '积分榜'}`
    return {
        ok: true,
        gameId: game.id,
        mode,
        kind,
        text: formatRanking({
            title,
            kind,
            rows: sorted,
            meId: options.meId,
            page: options.page,
            pageSize: options.pageSize,
            minMatches: options.minMatches,
        }),
    }
}

export {
    registerGame,
    getGame,
    listGames,
    resolveGameMode,
    defaultModes,
    getPlayer,
    listPlayers,
    addScore,
    reloadStore,
    clearGame,
    getStoreFile,
    setStoreFile,
    rankByScore,
    rankByWinRate,
    winRate,
    paginate,
    formatRanking,
    describeRow,
}

export default {
    GRKS_GAME,
    registerGame,
    getGame,
    listGames,
    resolveGameMode,
    getPlayer,
    listPlayers,
    addScore,
    reloadStore,
    clearGame,
    getStoreFile,
    setStoreFile,
    rankByScore,
    rankByWinRate,
    winRate,
    paginate,
    formatRanking,
    describeRow,
    queryRanking,
}
