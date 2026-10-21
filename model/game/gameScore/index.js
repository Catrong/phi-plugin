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
    rankByAccuracy,
    averageHints,
    winRate,
    paginate,
    formatRanking,
    describeRow,
    RANK_MIN_PLAYS,
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
 * 准确率榜与胜率榜默认要求至少 `RANK_MIN_PLAYS`（10）局，避免样本太少失真。
 * @param {object} options
 * @param {string} [options.gameId]
 * @param {string} [options.mode]
 * @param {import('./ranking.js').gameScoreRankKind} [options.kind]
 * @param {number} [options.page]
 * @param {number} [options.pageSize]
 * @param {number} [options.minPlays] 上榜门槛覆盖值（测试与第三方调用使用）
 * @param {number} [options.minMatches] `minPlays` 的旧名称
 * @param {string} [options.meId]
 * @returns {{ok: boolean, text: string, gameId?: string, mode?: string, kind?: string}}
 */
export function queryRanking(options) {
    const resolved = resolveGameMode(options.gameId, options.mode)
    if (!resolved) return { ok: false, text: '暂无可查询的游戏积分榜' }
    const { game, mode, modeMeta } = resolved
    const kind = options.kind === 'accuracy'
        ? 'accuracy'
        : options.kind === 'winRate' && modeMeta.winRate ? 'winRate' : 'score'
    const threshold = Math.max(1, Math.trunc(options.minPlays ?? options.minMatches ?? RANK_MIN_PLAYS))
    const rows = listPlayers(game.id, mode)
    const sorted = kind === 'accuracy'
        ? rankByAccuracy(rows, threshold)
        : kind === 'winRate'
            ? rankByWinRate(rows, threshold)
            : rankByScore(rows)
    const title = `${game.name} · ${modeMeta.label} ${rankKindLabel(kind)}`
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
            minPlays: threshold,
        }),
    }
}

/**
 * 榜单类型显示名。
 * @param {import('./ranking.js').gameScoreRankKind} kind
 * @returns {string}
 */
function rankKindLabel(kind) {
    if (kind === 'accuracy') return '准确率榜'
    if (kind === 'winRate') return '胜率榜'
    return '积分榜'
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
    rankByAccuracy,
    averageHints,
    RANK_MIN_PLAYS,
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
    rankByAccuracy,
    averageHints,
    RANK_MIN_PLAYS,
    winRate,
    paginate,
    formatRanking,
    describeRow,
    queryRanking,
}
