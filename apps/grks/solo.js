import Config from '../../components/Config.js'
import send from '../../model/render/send.js'
import picmodle from '../../model/render/picmodle.js'
import logger from '../../components/Logger.js'
import getBanGroup from '../../model/user/getBanGroup.js'
import { UserCredentials } from '../../model/user/userCredentials.js'
import { addScore } from '../../model/game/gameScore/index.js'
import { loadPuzzle, pickEntry } from '../../model/game/grks/pool.js'
import {
    applySoloHint,
    buildView,
    createSoloState,
    formatHintText,
    formatNow,
    intCfg,
    maxSoloHints,
} from '../../model/game/grks/hints.js'
import {
    DEFAULT_MAX_SCORE,
    DEFAULT_TOLERANCE,
    formatScoreValue,
    isCorrect,
    parseGuess,
    scoreForHintCount,
} from '../../model/game/grks/score.js'
import { isUsableImage, pickImageOrText } from '../../model/game/grks/renderResult.js'
import { chatTargetFromEvent, chatTargetKey } from '../../components/platform/sendTarget.js'

/** @import {botEvent} from '../../components/baseClass.js' */
/** @import {grksHint, grksPuzzle, grksSoloState} from '../../model/game/grks/hints.js' */

/**
 * @typedef {object} grksSoloGame 单机对局
 * @property {string} sessionKey 会话键
 * @property {string} userId 发起者
 * @property {grksPuzzle} puzzle 谜题
 * @property {grksSoloState} state 提示状态
 * @property {botEvent} event 最近一次有效事件
 * @property {number} startedAt 开始时间
 * @property {boolean} settled 是否已结算（并发下防止重复结算）
 * @property {ReturnType<typeof setTimeout> | null} timer 超时定时器
 * @property {ReturnType<typeof setTimeout> | null} tipTimer 提示冷却定时器
 */

/** 进行中的单机对局，键为会话键。 @type {Map<string, grksSoloGame>} */
const soloGames = new Map()

/**
 * 读取猜 RKS 相关配置，非法值回退默认。
 * @returns {any}
 */
export function readConfig() {
    /** @param {string} key @param {any} fallback */
    const cfg = (key, fallback) => {
        try {
            const value = Config.getUserCfg('config', /** @type {any} */ (key))
            return value === undefined || value === null ? fallback : value
        } catch {
            return fallback
        }
    }
    return {
        tolerance: Number(cfg('GrksTolerance', DEFAULT_TOLERANCE)) || DEFAULT_TOLERANCE,
        minRecord: intCfg(cfg('GrksMinRecord', 27), 27, 1, 30),
        maxScore: Number(cfg('GrksMaxScore', DEFAULT_MAX_SCORE)) || DEFAULT_MAX_SCORE,
        positionHintAt: intCfg(cfg('GrksPositionHintAt', 5), 5, 1, 30),
        hintRevealNum: intCfg(cfg('GrksHintRevealNum', 2), 2, 1, 10),
        tipCd: intCfg(cfg('GrksTipCd', 3), 3, 0, 3600),
        timeLength: intCfg(cfg('GrksTimeLength', 600), 600, 30, 86400),
        wrongLimit: intCfg(cfg('GrksWrongLimit', 0), 0, 0, 99),
        statsHint: String(cfg('GrksStatsHint', 'auto')),
        poolRefreshHours: intCfg(cfg('GrksPoolRefreshHours', 6), 6, 0, 168),
        matchWaitTimeout: intCfg(cfg('GrksMatchWaitTimeout', 300), 300, 10, 86400),
        matchRksRange: Number(cfg('GrksMatchRksRange', 0.5)) || 0.5,
        matchTurnTime: intCfg(cfg('GrksMatchTurnTime', 90), 90, 10, 3600),
        matchMaxTimeoutTurn: intCfg(cfg('GrksMatchMaxTimeoutTurn', 3), 3, 1, 20),
    }
}

/**
 * 会话键；私聊与群聊各自独立。
 * @param {botEvent} e
 * @returns {string}
 */
export function sessionKeyOf(e) {
    const key = chatTargetKey(chatTargetFromEvent(e))
    return key || `user:${String(e?.user_id || '')}`
}

/**
 * 命令头前缀。
 * @returns {string}
 */
export function cmdPrefix() {
    return `#${Config.getUserCfg('config', 'cmdhead')} grks`
}

/**
 * 渲染并发送提示图；有图时只发图，渲染失败才用文字兜底。
 * @param {botEvent} e
 * @param {object} options
 * @param {grksPuzzle} options.puzzle
 * @param {grksSoloState} options.state
 * @param {grksHint} options.hint
 * @param {string} [options.playerLabel] 标题栏标识
 * @param {string} [options.footnote] 底部状态与指令说明
 * @returns {Promise<void>}
 */
export async function sendHintImage(e, options) {
    const view = buildView({
        puzzle: options.puzzle,
        revealedSlots: options.state.revealedSlots,
        positionRevealed: options.state.positionRevealed,
        mode: 'solo',
        hint: options.hint,
        /** 已公开的统计与课题在后续提示中继续显示 */
        statsKind: options.state.statsKind,
        challengeRevealed: options.state.challengeRevealed,
        playerLabel: options.playerLabel || '？？？',
        date: formatNow(),
        footnote: options.footnote || '',
    })
    const text = formatHintText({
        puzzle: options.puzzle,
        hint: options.hint,
        revealedSlots: options.state.revealedSlots,
        positionRevealed: options.state.positionRevealed,
    })
    let image = null
    try {
        image = await picmodle.grks(e, view)
    } catch (error) {
        logger.warn('[phi-plugin][grks] 提示图渲染失败，改为文字')
        logger.warn(error)
    }
    if (!isUsableImage(image)) {
        warnRenderFailure(image, '提示图')
        await send.send_with_At(e, text)
        return
    }
    await send.send_with_At(e, image)
}

/**
 * 渲染失败时记录原因：用户只看到文字兜底，渲染器返回的错误文案只能留在日志里。
 * @param {any} image 渲染结果
 * @param {string} label 日志中的用途说明
 */
export function warnRenderFailure(image, label) {
    if (typeof image === 'string') logger.warn(`[phi-plugin][grks] ${label}渲染失败，改为文字兜底：${image}`)
}

/**
 * 公布答案。
 * @param {grksSoloGame} game
 * @param {any} cfg
 * @param {string} reason
 * @returns {Promise<void>}
 */
async function revealAnswer(game, cfg, reason) {
    const { puzzle, event } = game
    const view = buildView({
        puzzle,
        revealedSlots: puzzle.slots.map(slot => slot.slot),
        positionRevealed: true,
        mode: 'solo',
        hint: null,
        /** 答案图沿用本局已公开的统计与课题，不额外泄露未公开的信息 */
        statsKind: game.state.statsKind,
        challengeRevealed: game.state.challengeRevealed,
        playerLabel: '---',
        date: formatNow(),
        footnote: `${reason}\n答案：${puzzle.rks.toFixed(4)}　提示 ${game.state.hintCount} 条`,
    })
    let image = null
    try {
        image = await picmodle.grks(event, view)
    } catch (error) {
        logger.warn('[phi-plugin][grks] 答案图渲染失败')
        logger.warn(error)
    }
    warnRenderFailure(image, '答案图')
    const text = `${reason}\n正确答案：${puzzle.rks.toFixed(4)}（±${cfg.tolerance}）\n提示次数：${game.state.hintCount}`
    await send.send_with_At(event, pickImageOrText(image, text))
}

/**
 * 清理对局。
 * @param {grksSoloGame} game
 * @returns {boolean} 是否确实清理了本次对局
 */
export function disposeGame(game) {
    if (game.settled) return false
    game.settled = true
    if (game.timer) clearTimeout(game.timer)
    if (game.tipTimer) clearTimeout(game.tipTimer)
    if (soloGames.get(game.sessionKey) === game) soloGames.delete(game.sessionKey)
    return true
}

/**
 * 开始一局单机。
 * @param {botEvent} e
 * @returns {Promise<boolean>}
 */
export async function start(e) {
    if (await banCheck(e)) return false
    const cfg = readConfig()
    const key = sessionKeyOf(e)
    if (soloGames.has(key)) {
        await send.send_with_At(e, `当前会话已有进行中的猜 RKS，先发送 ${cmdPrefix()} ans 结束或继续猜测吧！`)
        return false
    }

    /** 出题池排除自己：未绑定时不排除 */
    /** @type {string[]} */
    let ownTokens = []
    try {
        const token = await UserCredentials.fromEvent(e).getSessionToken()
        if (token) ownTokens = [String(token)]
    } catch {
        ownTokens = []
    }

    const picked = await pickEntry({
        excludeTokens: ownTokens,
        allowFallback: true,
        minRecord: cfg.minRecord,
        refreshHours: cfg.poolRefreshHours,
    })
    if (!picked) {
        await send.send_with_At(e, `暂无可出题的存档：需要本地存在有效成绩不少于 ${cfg.minRecord} 条的绑定存档`)
        return false
    }

    const puzzle = await loadPuzzle(picked.entry.token, { e })
    if (!puzzle || !puzzle.slots.length) {
        await send.send_with_At(e, '出题失败：该存档的 B30 数据不完整，请稍后再试')
        return false
    }

    const { state, hint } = applySoloHint(createSoloState(picked.entry.token), puzzle, {
        PositionHintAt: cfg.positionHintAt,
        HintRevealNum: cfg.hintRevealNum,
        StatsHint: cfg.statsHint,
    })

    /** @type {grksSoloGame} */
    const game = {
        sessionKey: key,
        userId: String(e.user_id || ''),
        puzzle,
        state,
        event: e,
        startedAt: Date.now(),
        settled: false,
        timer: null,
        tipTimer: null,
    }
    soloGames.set(key, game)

    await sendHintImage(e, {
        puzzle,
        state,
        hint,
        footnote: [
            '第 1 条提示',
            picked.fallback ? '题库中只有你自己的存档，本局以你自己的 B30 出题' : '',
            `猜测：${cmdPrefix()} <数值>　提示：${cmdPrefix()} tip　放弃：${cmdPrefix()} ans`,
            `答案容差 ±${cfg.tolerance}，待机 ${cfg.timeLength}s`,
        ].filter(Boolean).join('\n'),
    })
    resetTimeout(game, cfg)
    return true
}

/**
 * 重置待机超时。
 * @param {grksSoloGame} game
 * @param {any} cfg
 */
function resetTimeout(game, cfg) {
    if (game.timer) clearTimeout(game.timer)
    game.timer = setTimeout(() => {
        void timeoutGame(game, cfg)
    }, Math.max(30, cfg.timeLength) * 1000)
    game.timer.unref?.()
}

/**
 * 超时结算。
 * @param {grksSoloGame} game
 * @param {any} cfg
 */
async function timeoutGame(game, cfg) {
    if (game.settled) return
    if (!disposeGame(game)) return
    await revealAnswer(game, cfg, `超过 ${cfg.timeLength}s 没有猜测，本局结束`)
    await recordPlay(game, 0, maxSoloHints(game.puzzle, cfg))
}

/**
 * 记录一局（猜对才加分）。
 * @param {grksSoloGame} game
 * @param {number} points
 * @param {number} hints 本局计入准确率榜的提示数：猜对为本局实际提示数，未猜出按满提示
 */
async function recordPlay(game, points, hints) {
    if (!game.userId) return
    try {
        await addScore('grks', 'normal', game.userId, points, { hints })
    } catch (error) {
        logger.warn('[phi-plugin][grks] 记录单机积分失败')
        logger.warn(error)
    }
}

/**
 * 请求下一条提示。
 * @param {botEvent} e
 * @returns {Promise<boolean>}
 */
export async function tip(e) {
    const game = soloGames.get(sessionKeyOf(e))
    if (!game) {
        await send.send_with_At(e, `当前没有进行中的猜 RKS，发送 ${cmdPrefix()} 开始一局吧！`)
        return false
    }
    const cfg = readConfig()
    if (Date.now() - game.state.lastHintAt < cfg.tipCd * 1000) {
        await send.send_with_At(e, `提示冷却中，请 ${Math.ceil((cfg.tipCd * 1000 - (Date.now() - game.state.lastHintAt)) / 1000)}s 后再试`)
        return false
    }
    const result = applySoloHint(game.state, game.puzzle, {
        PositionHintAt: cfg.positionHintAt,
        HintRevealNum: cfg.hintRevealNum,
        StatsHint: cfg.statsHint,
    })
    game.state = result.state
    game.event = e
    resetTimeout(game, cfg)

    if (result.hint.kind === 'exhausted') {
        await sendHintImage(e, {
            puzzle: game.puzzle,
            state: game.state,
            hint: result.hint,
            footnote: `提示已全部公开\n猜测：${cmdPrefix()} <数值>　放弃：${cmdPrefix()} ans`,
        })
        return true
    }

    await sendHintImage(e, {
        puzzle: game.puzzle,
        state: game.state,
        hint: result.hint,
        footnote: [
            `第 ${game.state.hintCount} 条提示`,
            game.state.positionRevealed ? '位置已公开' : `第 ${cfg.positionHintAt} 条提示后公开位置`,
            `已使用提示 ${game.state.hintCount} 条，猜对可得 ${formatScoreValue(scoreForHintCount(game.state.hintCount, cfg.maxScore))} 分`,
            `猜测：${cmdPrefix()} <数值>　提示：${cmdPrefix()} tip　放弃：${cmdPrefix()} ans`,
        ].join('\n'),
    })
    return true
}

/**
 * 提交猜测。
 * @param {botEvent} e
 * @param {string} rawValue
 * @returns {Promise<boolean>}
 */
export async function guess(e, rawValue) {
    const game = soloGames.get(sessionKeyOf(e))
    if (!game) {
        await send.send_with_At(e, `当前没有进行中的猜 RKS，发送 ${cmdPrefix()} 开始一局吧！`)
        return false
    }
    if (String(e.user_id || '') !== game.userId) {
        await send.send_with_At(e, '这局游戏由发起者猜测，其他人可以发送 ' + cmdPrefix() + ' 开启新的一局')
        return false
    }
    const cfg = readConfig()
    const guessValue = parseGuess(rawValue)
    if (guessValue === null) {
        await send.send_with_At(e, `请输入 0~99 的数值，例如：${cmdPrefix()} 15.25`)
        return false
    }
    game.event = e
    if (isCorrect(guessValue, game.puzzle.rks, cfg.tolerance)) {
        if (!disposeGame(game)) return false
        const points = scoreForHintCount(game.state.hintCount, cfg.maxScore)
        await send.send_with_At(e, `🎉 猜对了！答案 ${game.puzzle.rks.toFixed(4)}，你猜 ${guessValue}（容差 ±${cfg.tolerance}）\n本局得分：${formatScoreValue(points)} 分（提示 ${game.state.hintCount} 条）`)
        await revealAnswer(game, cfg, '本局已结算')
        await recordPlay(game, points, game.state.hintCount)
        return true
    }

    game.state = { ...game.state, wrongCount: game.state.wrongCount + 1, lastGuessAt: Date.now() }
    resetTimeout(game, cfg)
    const direction = guessValue > game.puzzle.rks ? '偏大' : '偏小'
    if (cfg.wrongLimit > 0 && game.state.wrongCount >= cfg.wrongLimit) {
        if (!disposeGame(game)) return false
        await revealAnswer(game, cfg, `已经猜错 ${game.state.wrongCount} 次，本局结束`)
        await recordPlay(game, 0, maxSoloHints(game.puzzle, cfg))
        return true
    }
    const remain = cfg.wrongLimit > 0 ? `\n还可猜错 ${Math.max(0, cfg.wrongLimit - game.state.wrongCount)} 次` : ''
    await send.send_with_At(e, `不是这个值（${direction}）${remain}\n继续猜测：${cmdPrefix()} <数值>　提示：${cmdPrefix()} tip`)
    return true
}

/**
 * 放弃并公布答案。
 * @param {botEvent} e
 * @returns {Promise<boolean>}
 */
export async function ans(e) {
    const game = soloGames.get(sessionKeyOf(e))
    if (!game) {
        await send.send_with_At(e, '当前没有进行中的猜 RKS')
        return false
    }
    const cfg = readConfig()
    if (!disposeGame(game)) return false
    await revealAnswer(game, cfg, '本局已放弃')
    await recordPlay(game, 0, maxSoloHints(game.puzzle, cfg))
    return true
}

/**
 * 群禁用检查。
 * @param {botEvent} e
 * @returns {Promise<boolean>} 是否被禁用
 */
async function banCheck(e) {
    if (await getBanGroup.get(e, 'grksgame')) {
        await send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
        return true
    }
    return false
}

/**
 * 该会话是否已有单机对局（供匹配模式提示冲突）。
 * @param {botEvent} e
 * @returns {boolean}
 */
export function hasSoloGame(e) {
    return soloGames.has(sessionKeyOf(e))
}

/**
 * 清理指定会话的对局（不发送消息）。
 * @param {string} sessionKey
 * @returns {boolean}
 */
export function clearSoloGame(sessionKey) {
    const game = soloGames.get(sessionKey)
    if (!game) return false
    return disposeGame(game)
}
