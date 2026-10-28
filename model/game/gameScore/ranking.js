/**
 * 游戏积分榜排名与文本格式化（纯函数，便于测试）。
 *
 * @typedef {import('./store.js').gameScoreRecord & {userId: string}} gameScoreRow 带用户标识的记录行
 * @typedef {'score' | 'winRate' | 'accuracy'} gameScoreRankKind 榜单类型
 */

import { gameScoreMessages } from '../../render/messages.js'
import { ANONYMOUS_PLAYER_PROFILE } from './profile.js'

/** 准确率榜与胜率榜的统一上榜门槛：至少完成 10 局。 */
export const RANK_MIN_PLAYS = 10

/**
 * 按累计积分排名：积分降序，同分场次少者优先（效率更高），再按最近更新。
 * @param {gameScoreRow[]} rows
 * @returns {gameScoreRow[]}
 */
export function rankByScore(rows) {
    return [...rows]
        .filter(row => row.plays > 0 || row.score > 0)
        .sort((a, b) =>
            b.score - a.score
            || a.plays - b.plays
            || String(a.userId).localeCompare(String(b.userId))
        )
}

/**
 * 计算胜率（0~1）；无对局时返回 0。
 * @param {gameScoreRow} row
 * @returns {number}
 */
export function winRate(row) {
    const total = row.wins + row.losses + row.draws
    return total > 0 ? row.wins / total : 0
}

/**
 * 平均每局需要的提示数；没有提示数统计时返回 null。
 * @param {{hintSum?: number, hintPlays?: number} | null | undefined} row
 * @returns {number | null}
 */
export function averageHints(row) {
    const plays = Math.max(0, Math.trunc(Number(row?.hintPlays) || 0))
    if (!plays) return null
    return (Number(row?.hintSum) || 0) / plays
}

/**
 * 按准确率排名：平均所需提示数升序（越少越准），同平均时总积分降序，
 * 再比较统计局数与用户标识；统计局数不足 `minPlays` 的玩家不参与。
 * @param {gameScoreRow[]} rows
 * @param {number} [minPlays]
 * @returns {gameScoreRow[]}
 */
export function rankByAccuracy(rows, minPlays = RANK_MIN_PLAYS) {
    const threshold = Math.max(1, Math.trunc(minPlays))
    return [...rows]
        .filter(row => row.hintPlays >= threshold)
        .sort((a, b) =>
            (averageHints(a) ?? Number.POSITIVE_INFINITY) - (averageHints(b) ?? Number.POSITIVE_INFINITY)
            || b.score - a.score
            || b.hintPlays - a.hintPlays
            || String(a.userId).localeCompare(String(b.userId))
        )
}

/**
 * 按胜率排名：胜率降序，场次多者优先；场次不足 `minMatches` 的玩家不参与。
 * @param {gameScoreRow[]} rows
 * @param {number} [minMatches]
 * @returns {gameScoreRow[]}
 */
export function rankByWinRate(rows, minMatches = RANK_MIN_PLAYS) {
    const threshold = Math.max(1, Math.trunc(minMatches))
    return [...rows]
        .filter(row => row.wins + row.losses + row.draws >= threshold)
        .sort((a, b) =>
            winRate(b) - winRate(a)
            || (b.wins + b.losses + b.draws) - (a.wins + a.losses + a.draws)
            || b.score - a.score
            || String(a.userId).localeCompare(String(b.userId))
        )
}

/**
 * 分页切片，返回当前页与总页数。
 * @template T
 * @param {T[]} rows
 * @param {number} [page] 1 起
 * @param {number} [pageSize]
 * @returns {{items: T[], page: number, pages: number, total: number}}
 */
export function paginate(rows, page = 1, pageSize = 10) {
    const size = Math.max(1, Math.trunc(pageSize))
    const total = rows.length
    const pages = Math.max(1, Math.ceil(total / size))
    const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages)
    return {
        items: rows.slice((current - 1) * size, current * size),
        page: current,
        pages,
        total,
    }
}

/**
 * 格式化积分榜文本。
 * @param {object} options
 * @param {string} options.title 标题
 * @param {gameScoreRankKind} options.kind 榜单类型
 * @param {gameScoreRow[]} [options.rows] 已排序的行（为空表示无数据）
 * @param {string} [options.meId] 当前用户 ID，用于追加“我的排名”
 * @param {string} [options.meLabel] 当前用户的展示名
 * @param {number} [options.page] 页码，1 起
 * @param {number} [options.pageSize] 每页条数
 * @param {number} [options.minPlays] 准确率榜 / 胜率榜的最低对局数（仅提示用）
 * @returns {string}
 */
export function formatRanking(options) {
    const rows = options.rows || []
    const pageSize = options.pageSize ?? 10
    const paged = paginate(rows, options.page ?? 1, pageSize)
    const meId = options.meId || ''
    const meIndex = rows.findIndex(row => row.userId === meId)
    return formatRankingPage({
        title: options.title, kind: options.kind, ...paged, pageSize,
        minPlays: options.minPlays ?? RANK_MIN_PLAYS,
        meId, meRank: meIndex >= 0 ? meIndex + 1 : null, me: meIndex >= 0 ? rows[meIndex] : null,
    })
}

/** @param {Pick<import('./index.js').gameScoreRankingPage, 'title' | 'kind' | 'total' | 'page' | 'pages' | 'pageSize' | 'items' | 'minPlays' | 'meId' | 'meRank' | 'me'>} options @returns {string} */
export function formatRankingPage(options) {
    const kind = options.kind
    const threshold = options.minPlays
    const paged = options
    const lines = [gameScoreMessages.boardTitle(options.title, paged.total)]
    if (!paged.total) {
        lines.push(emptyBoardHint(kind, threshold))
        return lines.join('\n')
    }
    if (paged.pages > 1) lines.push(gameScoreMessages.page(paged.page, paged.pages))
    paged.items.forEach((row, index) => {
        const rank = (paged.page - 1) * options.pageSize + index + 1
        lines.push(gameScoreMessages.rankLine(rank, describeRow(row, kind)))
    })
    if (options.meId) {
        if (options.meRank !== null && options.me) {
            lines.push(gameScoreMessages.myRank(options.meRank, describeRow(options.me, kind)))
        } else {
            lines.push(meRankHint(kind, threshold))
        }
    }
    return lines.join('\n')
}

/**
 * 空榜提示。
 * @param {gameScoreRankKind} kind
 * @param {number} threshold
 * @returns {string}
 */
function emptyBoardHint(kind, threshold) {
    if (kind === 'accuracy') return gameScoreMessages.empty.accuracy(threshold)
    if (kind === 'winRate') return gameScoreMessages.empty.winRate(threshold)
    return gameScoreMessages.empty.score
}

/**
 * 当前用户未上榜时的提示。
 * @param {gameScoreRankKind} kind
 * @param {number} threshold
 * @returns {string}
 */
function meRankHint(kind, threshold) {
    if (kind === 'accuracy') return gameScoreMessages.me.accuracy(threshold)
    if (kind === 'winRate') return gameScoreMessages.me.winRate(threshold)
    return gameScoreMessages.me.score
}

/**
 * 单行描述。
 * @param {gameScoreRow} row
 * @param {gameScoreRankKind} kind
 * @returns {string}
 */
export function describeRow(row, kind) {
    const name = row.profile?.name || ANONYMOUS_PLAYER_PROFILE.name
    if (kind === 'accuracy') {
        const average = averageHints(row)
        const averageText = average === null ? '--' : average.toFixed(2)
        return gameScoreMessages.describe.accuracy(name, averageText, row.plays, row.score.toFixed(2))
    }
    if (kind === 'winRate') {
        const total = row.wins + row.losses + row.draws
        return gameScoreMessages.describe.winRate(name, (winRate(row) * 100).toFixed(1), row.wins, row.losses, row.draws, total, row.score.toFixed(2))
    }
    return gameScoreMessages.describe.score(name, row.score.toFixed(2), row.plays, row.best.toFixed(2))
}
