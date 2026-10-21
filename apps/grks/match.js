import send from '../../model/render/send.js'
import picmodle from '../../model/render/picmodle.js'
import logger from '../../components/Logger.js'
import getBanGroup from '../../model/user/getBanGroup.js'
import platform from '../../components/platform/index.js'
import { addScore } from '../../model/game/gameScore/index.js'
import { buildPuzzle } from '../../model/game/grks/hints.js'
import {
    applyMatchHint,
    buildView,
    createMatchSideState,
    defaultMatchHint,
    formatHintText,
    formatNow,
    matchHintType,
    maxMatchHints,
} from '../../model/game/grks/hints.js'
import { formatScoreValue, isCorrect, parseGuess, scoreForHintCount } from '../../model/game/grks/score.js'
import { isUsableImage, pickImageOrText } from '../../model/game/grks/renderResult.js'
import { chatTargetFromEvent, chatTargetKey } from '../../components/platform/sendTarget.js'
import { cmdPrefix, hasSoloGame, readConfig, sessionKeyOf, warnRenderFailure } from './solo.js'

/** @import {botEvent} from '../../components/baseClass.js' */
/** @import {grksHint, grksMatchSideState, grksPuzzle} from '../../model/game/grks/hints.js' */
/** @import {PlatformChatTargetLike} from '../../components/platform/sendTarget.js' */

/**
 * @typedef {object} grksQueueEntry 排队中的玩家
 * @property {string} userId
 * @property {any} target 会话目标
 * @property {string} sessionKey
 * @property {number} rks 自身 rks
 * @property {string} nickname
 * @property {number} joinedAt
 * @property {any} event
 */

/**
 * @typedef {object} grksMatchPlayer 对局中的一方
 * @property {string} userId
 * @property {any} target
 * @property {string} sessionKey
 * @property {string} nickname
 * @property {any} event
 * @property {grksPuzzle} puzzle 自己的 B30（对手要猜）
 * @property {grksMatchSideState} side 自己已给出的提示
 * @property {grksHint | null} pendingHint 本回合已给出的提示
 * @property {number | null} pendingGuess 本回合提交的猜测
 * @property {boolean} hasGuessed 本回合是否已提交猜测（含超时视为未猜）
 * @property {number} timeoutTurns 连续超时回合数
 */

/**
 * @typedef {object} grksMatch 一场匹配对局
 * @property {string} id
 * @property {number} createdAt
 * @property {number} turn
 * @property {boolean} settled
 * @property {ReturnType<typeof setTimeout> | null} timer
 * @property {[grksMatchPlayer, grksMatchPlayer]} players
 */

/** 匹配池。 @type {Map<string, grksQueueEntry>} */
const queue = new Map()
/** 进行中的对局。 @type {Map<string, grksMatch>} */
const matches = new Map()
/** 玩家 → 对局。 @type {Map<string, string>} */
const userMatch = new Map()

let matchSeq = 0
/** @type {ReturnType<typeof setInterval> | null} */
let scanTimer = null

/**
 * 从排队列表里选出最优配对（纯函数，便于测试）。
 * 规则：不同会话；rks 差最小；差值超过 `range` 时，只要双方等待时间超过 `waitTimeout` 就放宽。
 * @param {grksQueueEntry[]} entries
 * @param {{range: number, waitTimeout: number, now?: number}} options
 * @returns {{a: grksQueueEntry, b: grksQueueEntry, diff: number, relaxed: boolean} | null}
 */
export function selectPair(entries, options) {
    const now = options.now ?? Date.now()
    const range = Number.isFinite(options.range) ? Math.max(0, options.range) : 0.5
    const waitMs = Math.max(0, options.waitTimeout) * 1000
    /** @type {{a: grksQueueEntry, b: grksQueueEntry, diff: number, relaxed: boolean} | null} */
    let best = null
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const a = entries[i]
            const b = entries[j]
            if (!a?.userId || !b?.userId) continue
            if (a.userId === b.userId) continue
            if (a.sessionKey && b.sessionKey && a.sessionKey === b.sessionKey) continue
            const diff = Math.abs(Number(a.rks) - Number(b.rks))
            const waited = now - Math.min(Number(a.joinedAt) || now, Number(b.joinedAt) || now)
            const relaxed = waited >= waitMs
            if (diff > range && !relaxed) continue
            /** 优先 rks 更接近；同等接近时优先等待更久的玩家 */
            const waitedScore = now - Math.max(Number(a.joinedAt) || now, Number(b.joinedAt) || now)
            if (!best
                || diff < best.diff - 1e-9
                || (Math.abs(diff - best.diff) <= 1e-9 && waitedScore > now - Math.max(Number(best.a.joinedAt) || now, Number(best.b.joinedAt) || now))) {
                best = { a, b, diff, relaxed }
            }
        }
    }
    return best
}

/**
 * 主动投递到目标会话。
 * @param {any} target
 * @param {any} msg
 * @returns {Promise<boolean>}
 */
async function deliver(target, msg) {
    try {
        const sender = platform.sendToChat
        if (typeof sender !== 'function') return false
        const ok = await sender(target, msg)
        return ok === true
    } catch (error) {
        logger.warn('[phi-plugin][grks] 向对手会话投递失败')
        logger.warn(error)
        return false
    }
}

/**
 * 玩家展示名。
 * @param {botEvent} e
 * @param {string} userId
 * @returns {string}
 */
function displayName(e, userId) {
    const sender = /** @type {any} */ (e).sender
    const name = sender?.card || sender?.nickname || sender?.name
    return String(name || userId)
}

/**
 * 加入匹配池。
 * @param {botEvent} e
 * @returns {Promise<boolean>}
 */
export async function join(e) {
    if (await getBanGroup.get(e, 'grksgame')) {
        await send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
        return false
    }
    const cfg = readConfig()
    const userId = String(e.user_id || '')
    if (!userId) return false
    if (userMatch.has(userId)) {
        await send.send_with_At(e, `你已在对局中，发送 ${cmdPrefix()} cancel 可退出`)
        return false
    }
    if (queue.has(userId)) {
        await send.send_with_At(e, `你已在匹配池中，当前排队 ${queue.size} 人；发送 ${cmdPrefix()} cancel 取消匹配`)
        return false
    }
    const target = chatTargetFromEvent(e)
    if (!target) {
        await send.send_with_At(e, '无法识别当前会话，请稍后重试')
        return false
    }
    if (hasSoloGame(e)) {
        await send.send_with_At(e, `当前会话还有进行中的单机对局，先发送 ${cmdPrefix()} ans 结束再匹配吧！`)
        return false
    }

    const save = await send.getsave_result(e)
    if (!save) return false
    const recordCount = save.getRecord().length
    if (recordCount < cfg.minRecord) {
        await send.send_with_At(e, `匹配模式需要 B30 数据完整：至少 ${cfg.minRecord} 条有效成绩，你当前只有 ${recordCount} 条`)
        return false
    }

    queue.set(userId, {
        userId,
        target,
        sessionKey: chatTargetKey(target) || sessionKeyOf(e),
        rks: Number(save.getRks()) || 0,
        nickname: displayName(e, userId),
        joinedAt: Date.now(),
        event: e,
    })
    startScanner()
    await send.send_with_At(e, `已加入匹配池（当前 ${queue.size} 人）\n匹配会优先选择 rks 相近且不在同一会话的对手，最长等待 ${cfg.matchWaitTimeout}s；发送 ${cmdPrefix()} cancel 可取消`)
    void tryMatch()
    return true
}

/**
 * 启动匹配扫描定时器。
 */
function startScanner() {
    if (scanTimer) return
    scanTimer = setInterval(() => {
        void tryMatch()
        expireQueue()
    }, 2000)
    scanTimer.unref?.()
}

/**
 * 移除等待过久的玩家并提示。
 */
function expireQueue() {
    const cfg = readConfig()
    const now = Date.now()
    for (const [userId, entry] of queue) {
        if (now - entry.joinedAt < cfg.matchWaitTimeout * 1000 * 4) continue
        queue.delete(userId)
        void deliver(entry.target, `匹配等待超时（${cfg.matchWaitTimeout * 4}s），已自动退出匹配池`)
    }
}

/**
 * 尝试匹配一次。
 * @returns {Promise<void>}
 */
async function tryMatch() {
    if (queue.size < 2) return
    const cfg = readConfig()
    const picked = selectPair([...queue.values()], {
        range: cfg.matchRksRange,
        waitTimeout: cfg.matchWaitTimeout,
    })
    if (!picked) return
    queue.delete(picked.a.userId)
    queue.delete(picked.b.userId)
    const created = await createMatch(picked.a, picked.b, cfg)
    if (!created) {
        /** 建立失败：把双方放回池中，下一轮继续 */
        queue.set(picked.a.userId, { ...picked.a, joinedAt: Date.now() })
        queue.set(picked.b.userId, { ...picked.b, joinedAt: Date.now() })
    }
}

/**
 * 建立对局。
 * @param {grksQueueEntry} entryA
 * @param {grksQueueEntry} entryB
 * @param {any} cfg
 * @returns {Promise<boolean>}
 */
async function createMatch(entryA, entryB, cfg) {
    const puzzleA = await loadOwnPuzzle(entryA.event, cfg)
    const puzzleB = await loadOwnPuzzle(entryB.event, cfg)
    if (!puzzleA || !puzzleB) {
        await deliver(entryA.target, '匹配失败：对手的 B30 数据不可用，已重新排队')
        await deliver(entryB.target, '匹配失败：对手的 B30 数据不可用，已重新排队')
        return false
    }
    /** @type {grksMatchPlayer} */
    const playerA = newPlayer(entryA, puzzleA)
    /** @type {grksMatchPlayer} */
    const playerB = newPlayer(entryB, puzzleB)
    const id = `grks-${Date.now()}-${++matchSeq}`
    /** @type {grksMatch} */
    const match = {
        id,
        createdAt: Date.now(),
        turn: 1,
        settled: false,
        timer: null,
        players: [playerA, playerB],
    }

    const helloA = await deliver(playerA.target, `匹配成功！对手：${playerB.nickname}\n第 1 回合开始：\n· 给出提示：${cmdPrefix()} hint <槽位> / ${cmdPrefix()} hint 3 [histogram|range] / ${cmdPrefix()} hint 4\n· 提交猜测：${cmdPrefix()} <数值>（对方 rks，容差 ±${cfg.tolerance}）`)
    const helloB = await deliver(playerB.target, `匹配成功！对手：${playerA.nickname}\n第 1 回合开始：\n· 给出提示：${cmdPrefix()} hint <槽位> / ${cmdPrefix()} hint 3 [histogram|range] / ${cmdPrefix()} hint 4\n· 提交猜测：${cmdPrefix()} <数值>（对方 rks，容差 ±${cfg.tolerance}）`)
    if (!helloA || !helloB) {
        await deliver(playerA.target, '匹配建立失败（无法向对手会话发送消息），已重新排队')
        await deliver(playerB.target, '匹配建立失败（无法向对手会话发送消息），已重新排队')
        return false
    }

    matches.set(id, match)
    userMatch.set(playerA.userId, id)
    userMatch.set(playerB.userId, id)
    await sendRoundView(match, cfg)
    resetTurnTimer(match, cfg)
    return true
}

/**
 * @param {grksQueueEntry} entry
 * @param {grksPuzzle} puzzle
 * @returns {grksMatchPlayer}
 */
function newPlayer(entry, puzzle) {
    return {
        userId: entry.userId,
        target: entry.target,
        sessionKey: entry.sessionKey,
        nickname: entry.nickname,
        event: entry.event,
        puzzle,
        side: createMatchSideState(),
        pendingHint: null,
        pendingGuess: null,
        hasGuessed: false,
        timeoutTurns: 0,
    }
}

/**
 * 读取玩家自己的 B30 作为谜题。
 * @param {botEvent} e
 * @param {any} cfg
 * @returns {Promise<grksPuzzle | null>}
 */
async function loadOwnPuzzle(e, cfg) {
    const save = await send.getsave_result(e, undefined, false)
    if (!save) return null
    if (save.getRecord().length < cfg.minRecord) return null
    try {
        const b30 = await save.getB19(e, 33, { avgType: 'none' })
        const stats = await save.getStats().catch(() => [])
        return buildPuzzle({
            b30,
            stats,
            challengeModeRank: save.saveInfo?.summary?.challengeModeRank,
            sourceToken: String(save.getSessionToken()),
        })
    } catch (error) {
        logger.warn('[phi-plugin][grks] 构建匹配谜题失败')
        logger.warn(error)
        return null
    }
}

/**
 * 对手。
 * @param {grksMatch} match
 * @param {grksMatchPlayer} player
 * @returns {grksMatchPlayer}
 */
function opponentOf(match, player) {
    return match.players[0] === player ? match.players[1] : match.players[0]
}

/**
 * 一方本局计入准确率榜的提示数。
 * 猜对时取对手实际给出的提示条数；未猜出（超时 / 判负 / 主动退出）按满提示计入，
 * 避免靠放弃拉低平均值。
 * @param {grksMatch} match
 * @param {grksMatchPlayer} player
 * @param {any} cfg
 * @returns {number}
 */
function hintsUsedBy(match, player, cfg) {
    const opponent = opponentOf(match, player)
    const guess = player.pendingGuess
    const hit = guess !== null && guess !== undefined
        && isCorrect(Number(guess), opponent.puzzle.rks, cfg.tolerance)
    return hit ? opponent.side.hintCount : maxMatchHints(opponent.puzzle)
}

/**
 * 渲染并发送一方的"自己的 B30"面板；有图时只发图，渲染失败才用文字兜底。
 * @param {grksMatch} match
 * @param {grksMatchPlayer} player
 * @param {any} cfg
 * @param {string} [extra]
 * @returns {Promise<boolean>}
 */
async function sendOwnPanel(match, player, cfg, extra = '') {
    const footnote = [
        `第 ${match.turn} 回合　已提示 ${player.side.hintCount} 条　剩余可提示 ${player.puzzle.slots.length - player.side.revealedSlots.length} 个槽位`,
        `提示指令：${cmdPrefix()} hint <槽位>　统计：${cmdPrefix()} hint 3 [histogram|range]　课题：${cmdPrefix()} hint 4`,
        `猜测指令：${cmdPrefix()} <数值>（本回合截止前提交，双方同回合结算）`,
        extra,
    ].filter(Boolean).join('\n')
    const view = buildView({
        puzzle: player.puzzle,
        revealedSlots: player.side.revealedSlots,
        positionRevealed: true,
        mode: 'match',
        hintCommand: cmdPrefix(),
        hint: null,
        /** 持有者面板同样保留已经给过的统计与课题，不再重新盖遮罩 */
        statsKind: player.side.statsKind,
        challengeRevealed: player.side.challengeRevealed,
        playerLabel: 'B30',
        date: formatNow(),
        footnote,
    })
    let image = null
    try {
        image = await picmodle.grks(player.event, view)
    } catch (error) {
        logger.warn('[phi-plugin][grks] 匹配面板渲染失败')
        logger.warn(error)
    }
    warnRenderFailure(image, '匹配面板')
    return await deliver(player.target, pickImageOrText(image, `第 ${match.turn} 回合\n${footnote}`))
}

/**
 * 发送回合视图给双方。
 * @param {grksMatch} match
 * @param {any} cfg
 */
async function sendRoundView(match, cfg) {
    for (const player of match.players) {
        await sendOwnPanel(match, player, cfg)
    }
}

/**
 * 重置回合计时器。
 * @param {grksMatch} match
 * @param {any} cfg
 */
function resetTurnTimer(match, cfg) {
    if (match.timer) clearTimeout(match.timer)
    match.timer = setTimeout(() => {
        void onTurnTimeout(match, cfg)
    }, Math.max(10, cfg.matchTurnTime) * 1000)
    match.timer.unref?.()
}

/**
 * 回合超时：自动补默认提示，未提交的猜测视为未猜，然后结算。
 * @param {grksMatch} match
 * @param {any} cfg
 */
async function onTurnTimeout(match, cfg) {
    if (match.settled) return
    for (const player of match.players) {
        const idle = !player.pendingHint && !player.hasGuessed
        if (idle) player.timeoutTurns += 1
        if (!player.pendingHint) {
            const fallback = defaultMatchHint(player.side, player.puzzle)
            const applied = applyMatchHint(player.side, player.puzzle, fallback.type, fallback.arg, { StatsHint: cfg.statsHint })
            if (applied.ok) {
                player.side = applied.side
                player.pendingHint = applied.hint
                await deliverHintToOpponent(match, player)
            }
        }
        player.hasGuessed = true
    }
    const loser = match.players.find(player => player.timeoutTurns >= cfg.matchMaxTimeoutTurn)
    if (loser) {
        await settleMatch(match, {
            winner: opponentOf(match, loser),
            loser,
            reason: `${loser.nickname} 连续 ${cfg.matchMaxTimeoutTurn} 回合未行动，判负`,
        }, cfg)
        return
    }
    await settleRound(match, cfg)
}

/**
 * 把一方本回合的提示投递给对手。
 * 统计（类型 3）与课题/存档统计（类型 4）额外渲染一张对手视角的面板图，
 * 有图时只发图，渲染失败才用文字兜底。
 * @param {grksMatch} match
 * @param {grksMatchPlayer} player
 * @returns {Promise<boolean>}
 */
async function deliverHintToOpponent(match, player) {
    if (!player.pendingHint) return false
    const opponent = opponentOf(match, player)
    const text = formatHintText({
        puzzle: player.puzzle,
        hint: player.pendingHint,
        revealedSlots: player.side.revealedSlots,
        positionRevealed: true,
    })
    const kind = player.pendingHint.kind
    if (kind === 'stats' || kind === 'challenge') {
        const view = buildView({
            puzzle: player.puzzle,
            revealedSlots: player.side.revealedSlots,
            positionRevealed: true,
            mode: 'solo',
            hint: player.pendingHint,
            /** 对手视角同样保留已公开的统计与课题，后续提示不再隐藏 */
            statsKind: player.side.statsKind,
            challengeRevealed: player.side.challengeRevealed,
            playerLabel: '对手的 B30',
            date: formatNow(),
            footnote: [
                `对手 ${player.nickname} 给出的${kind === 'stats' ? '统计提示' : '课题与完成度提示'}`,
                `${cmdPrefix()} <数值> 提交猜测`,
            ].join('\n'),
        })
        let image = null
        try {
            image = await picmodle.grks(opponent.event, view)
        } catch (error) {
            logger.warn('[phi-plugin][grks] 对手提示图渲染失败，改为文字')
            logger.warn(error)
        }
        warnRenderFailure(image, '对手提示图')
        if (isUsableImage(image)) return await deliver(opponent.target, image)
    }
    return await deliver(opponent.target, `对手 ${player.nickname} 的提示：\n${text}`)
}

/**
 * 检查是否可以结算本回合。
 * @param {grksMatch} match
 * @param {any} cfg
 * @returns {Promise<void>}
 */
async function maybeAdvance(match, cfg) {
    if (match.settled) return
    const ready = match.players.every(player => Boolean(player.pendingHint) && player.hasGuessed)
    if (!ready) return
    await settleRound(match, cfg)
}

/**
 * 结算一回合。
 * @param {grksMatch} match
 * @param {any} cfg
 */
async function settleRound(match, cfg) {
    if (match.settled) return
    if (match.timer) {
        clearTimeout(match.timer)
        match.timer = null
    }
    const [a, b] = match.players
    const aGuessed = a.pendingGuess !== null && a.pendingGuess !== undefined
    const bGuessed = b.pendingGuess !== null && b.pendingGuess !== undefined
    const aHit = aGuessed && isCorrect(Number(a.pendingGuess), b.puzzle.rks, cfg.tolerance)
    const bHit = bGuessed && isCorrect(Number(b.pendingGuess), a.puzzle.rks, cfg.tolerance)

    if (aHit && bHit) {
        await settleMatch(match, { winner: null, reason: '双方同回合猜对，本局平局' }, cfg)
        return
    }
    if (aHit) {
        await settleMatch(match, { winner: a, reason: `${a.nickname} 先猜对了对手的 rks` }, cfg)
        return
    }
    if (bHit) {
        await settleMatch(match, { winner: b, reason: `${b.nickname} 先猜对了对手的 rks` }, cfg)
        return
    }

    /** 都未猜对：进入下一回合 */
    match.turn += 1
    for (const player of match.players) {
        player.pendingHint = null
        player.pendingGuess = null
        player.hasGuessed = false
    }
    await sendRoundView(match, cfg)
    resetTurnTimer(match, cfg)
}

/**
 * 终局结算：积分、胜负、通知并清理。
 * @param {grksMatch} match
 * @param {{winner: grksMatchPlayer | null, loser?: grksMatchPlayer, reason: string}} outcome
 * @param {any} cfg
 */
async function settleMatch(match, outcome, cfg) {
    if (match.settled) return
    match.settled = true
    if (match.timer) clearTimeout(match.timer)
    match.timer = null
    const [a, b] = match.players
    const winner = outcome.winner
    /** @type {Record<string, {points: number, result: 'win' | 'loss' | 'draw'}>} */
    const results = {}

    if (!winner) {
        /** 平局：双方各按自己收到的提示数计分 */
        results[a.userId] = { points: scoreForHintCount(b.side.hintCount, cfg.maxScore), result: 'draw' }
        results[b.userId] = { points: scoreForHintCount(a.side.hintCount, cfg.maxScore), result: 'draw' }
    } else {
        const loser = outcome.loser || opponentOf(match, winner)
        results[winner.userId] = { points: scoreForHintCount(loser.side.hintCount, cfg.maxScore), result: 'win' }
        results[loser.userId] = { points: 0, result: 'loss' }
    }

    for (const player of match.players) {
        const result = results[player.userId]
        try {
            await addScore('grks', 'match', player.userId, result.points, {
                result: result.result,
                hints: hintsUsedBy(match, player, cfg),
            })
        } catch (error) {
            logger.warn('[phi-plugin][grks] 记录匹配积分失败')
            logger.warn(error)
        }
    }

    const lines = [
        `🏁 对局结束：${outcome.reason}`,
        `答案：${a.nickname} 的 rks ${a.puzzle.rks.toFixed(4)}，${b.nickname} 的 rks ${b.puzzle.rks.toFixed(4)}`,
    ]
    for (const player of match.players) {
        const result = results[player.userId]
        const label = result.result === 'win' ? '胜' : result.result === 'draw' ? '平' : '负'
        lines.push(`${player.nickname}：${label}　得分 ${formatScoreValue(result.points)}　提示 ${opponentOf(match, player).side.hintCount} 条`)
    }

    for (const player of match.players) {
        await deliver(player.target, lines.join('\n'))
    }

    matches.delete(match.id)
    userMatch.delete(a.userId)
    userMatch.delete(b.userId)
}

/**
 * 匹配中提交提示。
 * @param {botEvent} e
 * @param {string} typeText
 * @param {string | undefined} arg
 * @returns {Promise<boolean>}
 */
export async function hint(e, typeText, arg) {
    const cfg = readConfig()
    const player = findPlayer(e)
    if (!player) {
        await send.send_with_At(e, `当前没有匹配对局，发送 ${cmdPrefix()} match 加入匹配池`)
        return false
    }
    const match = matches.get(/** @type {string} */ (userMatch.get(player.userId)))
    if (!match || match.settled) {
        await send.send_with_At(e, '对局已结束')
        return false
    }
    const type = matchHintType(typeText)
    if (!type) {
        await send.send_with_At(e, `提示类型只能是 1 / 3 / 4，例如：${cmdPrefix()} hint B7（等价于 hint 1 B7）`)
        return false
    }
    if (player.pendingHint) {
        await send.send_with_At(e, '本回合已经给过提示了，等待对手行动或提交猜测吧')
        return false
    }
    const applied = applyMatchHint(player.side, player.puzzle, type, arg, { StatsHint: cfg.statsHint })
    if (!applied.ok) {
        await send.send_with_At(e, applied.error)
        return false
    }
    player.side = applied.side
    player.pendingHint = applied.hint
    player.event = e
    const delivered = await deliverHintToOpponent(match, player)
    if (!delivered) {
        await send.send_with_At(e, `提示已记录，但向对手会话投递失败（Bot 可能不在对方群聊/好友中），本回合可能无法继续；可发送 ${cmdPrefix()} cancel 结束对局`)
    } else {
        await send.send_with_At(e, `已向对手发送提示（第 ${player.side.hintCount} 条）\n继续：${cmdPrefix()} hint 3 / ${cmdPrefix()} hint 4 不能再重复给提示，可直接提交猜测：${cmdPrefix()} <数值>`)
    }
    await maybeAdvance(match, cfg)
    return true
}

/**
 * 匹配中提交猜测。
 * @param {botEvent} e
 * @param {string} rawValue
 * @returns {Promise<boolean>}
 */
export async function guess(e, rawValue) {
    const cfg = readConfig()
    const player = findPlayer(e)
    if (!player) {
        await send.send_with_At(e, `当前没有匹配对局，发送 ${cmdPrefix()} match 加入匹配池`)
        return false
    }
    const match = matches.get(/** @type {string} */ (userMatch.get(player.userId)))
    if (!match || match.settled) {
        await send.send_with_At(e, '对局已结束')
        return false
    }
    const value = parseGuess(rawValue)
    if (value === null) {
        await send.send_with_At(e, `请输入 0~99 的数值，例如：${cmdPrefix()} 15.25`)
        return false
    }
    if (player.hasGuessed) {
        await send.send_with_At(e, '本回合已经提交过猜测了，等待本回合结算')
        return false
    }
    player.pendingGuess = value
    player.hasGuessed = true
    player.event = e
    const opponentReady = opponentOf(match, player).hasGuessed
    await send.send_with_At(e, opponentReady
        ? `已提交猜测 ${value}，本回合双方都已完成，正在结算…`
        : `已提交猜测 ${value}，等待对手行动；双方都完成后统一结算`)
    await maybeAdvance(match, cfg)
    return true
}

/**
 * 由事件找到所属玩家。
 * @param {botEvent} e
 * @returns {grksMatchPlayer | null}
 */
function findPlayer(e) {
    const userId = String(e.user_id || '')
    const matchId = userMatch.get(userId)
    if (!matchId) return null
    const match = matches.get(matchId)
    if (!match) {
        userMatch.delete(userId)
        return null
    }
    return match.players.find(player => player.userId === userId) || null
}

/**
 * 退出匹配池或结束对局。
 * @param {botEvent} e
 * @returns {Promise<boolean>}
 */
export async function cancel(e) {
    const cfg = readConfig()
    const userId = String(e.user_id || '')
    if (queue.has(userId)) {
        queue.delete(userId)
        await send.send_with_At(e, '已退出匹配池')
        return true
    }
    const player = findPlayer(e)
    if (!player) {
        await send.send_with_At(e, `当前没有匹配中的对局，发送 ${cmdPrefix()} match 加入匹配池`)
        return false
    }
    const match = matches.get(/** @type {string} */ (userMatch.get(player.userId)))
    if (!match || match.settled) {
        await send.send_with_At(e, '对局已结束')
        return false
    }
    await settleMatch(match, { winner: opponentOf(match, player), loser: player, reason: `${player.nickname} 主动退出，对局结束` }, cfg)
    return true
}

/**
 * 清理全部对局（插件卸载或测试使用）。
 */
export function resetMatches() {
    for (const match of matches.values()) {
        if (match.timer) clearTimeout(match.timer)
        match.settled = true
    }
    matches.clear()
    userMatch.clear()
    queue.clear()
    if (scanTimer) {
        clearInterval(scanTimer)
        scanTimer = null
    }
}

/**
 * 当前排队人数（供状态提示）。
 * @returns {number}
 */
export function queueSize() {
    return queue.size
}

/**
 * 当前玩家是否在匹配池或对局中。
 * @param {string} userId
 * @returns {boolean}
 */
export function isMatching(userId) {
    return queue.has(String(userId)) || userMatch.has(String(userId))
}
