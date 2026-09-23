import Config from '../../components/Config.js'
import getInfo from '../../model/game/getInfo.js'
import getNotes from '../../model/user/getNotes.js'
import fCompute from '../../model/game/fCompute.js'
import send from '../../model/render/send.js'
import picmodle from '../../model/render/picmodle.js'
import getPic from '../../model/render/getPic.js'
import logger from '../../components/Logger.js'
import {
    buildSongPool,
    buildVersionIndex,
    createFribRow,
    parseStartArgs,
    toRenderRows,
} from './frib19Utils.js'

/** @import {GameList} from '../guessGame.js' */
/** @import {botEvent} from '../../components/baseClass.js' */
/** @import {fribRow, fribVersionIndex} from './frib19Utils.js' */

/**
 * @typedef {object} fribGameData
 * @property {idString} ansId 答案曲目
 * @property {levelKind} level 对比使用的难度
 * @property {number | null} minDifficulty 定数下限
 * @property {number} maxGuess 最大猜测次数
 * @property {fribRow[]} rows 猜测记录
 * @property {idString[]} guessedIds 已猜过的曲目
 * @property {idString | null} lastGuessId 本局最近一次被猜测的曲目，用作背景曲绘
 * @property {ReturnType<typeof setTimeout> | null} timer 超时定时器
 * @property {botEvent} event 用于超时播报的事件
 */

/**
 * 进行中的游戏
 * @type {Record<string, fribGameData>}
 */
const fribGameData = {}

/**
 * 版本索引缓存，曲目信息热更新后自动重建
 * @type {fribVersionIndex | null}
 */
let versionIndexCache = null

/**@type {Record<string, Record<string, unknown>> | null} */
let versionIndexSource = null

/** 缓存对应的版本数量，用于识别同一引用的增量填充 */
let versionIndexSize = -1

/**
 * 读取数值配置，非法值回退默认
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function numberCfg(value, fallback) {
    const num = Number(value)
    return Number.isFinite(num) && num >= 0 ? num : fallback
}

/**
 * 获取版本索引
 * @returns {fribVersionIndex}
 */
function getVersionIndex() {
    const source = getInfo.historyDifficultyByVersion
    const size = source ? Object.keys(source).length : 0
    if (versionIndexCache && versionIndexSource === source && versionIndexSize === size) return versionIndexCache
    versionIndexSource = source
    versionIndexSize = size
    versionIndexCache = buildVersionIndex(getInfo.versionInfoByCode, source)
    return versionIndexCache
}

/**
 * 群聊或频道标识
 * @param {botEvent} e
 * @returns {string}
 */
function groupKey(e) {
    return String(e.group_id || e.chatId || e.user_id)
}

/**
 * 猜测者昵称
 * @param {botEvent} e
 * @returns {string}
 */
function playerName(e) {
    return String(e.sender?.user_name || e.sender?.nickname || e.sender?.card || e.user_id || '未知玩家')
}

/**
 * 对比上下文
 * @param {string} player
 * @param {levelKind} level
 * @returns {{ player: string, level: levelKind, versionIndex: fribVersionIndex, nearDifficulty: number, nearBpm: number, nearCombo: number, nearVersion: number }}
 */
function compareContext(player, level) {
    return {
        player,
        level,
        versionIndex: getVersionIndex(),
        nearDifficulty: numberCfg(Config.getUserCfg('config', 'FribNearDifficulty'), 0.3),
        nearBpm: numberCfg(Config.getUserCfg('config', 'FribNearBpm'), 20),
        nearCombo: numberCfg(Config.getUserCfg('config', 'FribNearCombo'), 200),
        nearVersion: numberCfg(Config.getUserCfg('config', 'FribNearVersion'), 2),
    }
}

/**
 * 难度展示文本
 * @param {levelKind} level
 * @param {number | null} minDifficulty
 * @returns {string}
 */
function levelText(level, minDifficulty) {
    return minDifficulty === null ? level : `${level} ${minDifficulty}+`
}

/**
 * 结束并清理游戏
 * @param {string} group_id
 * @param {GameList} gameList
 */
function endGame(group_id, gameList) {
    const game = fribGameData[group_id]
    if (game?.timer) clearTimeout(game.timer)
    delete fribGameData[group_id]
    delete gameList[group_id]
}

/**
 * 刷新待机超时定时器，超时后公布答案
 * @param {string} group_id
 * @param {GameList} gameList
 */
function refreshTimeout(group_id, gameList) {
    const game = fribGameData[group_id]
    if (!game) return
    if (game.timer) clearTimeout(game.timer)
    const seconds = numberCfg(Config.getUserCfg('config', 'FribTimeout'), 600)
    game.timer = setTimeout(() => {
        const current = fribGameData[group_id]
        if (!current || current !== game) return
        void timeoutGame(group_id, gameList)
    }, Math.max(1, seconds) * 1000)
    game.timer.unref?.()
}

/**
 * 超时结束，公布答案
 * @param {string} group_id
 * @param {GameList} gameList
 */
async function timeoutGame(group_id, gameList) {
    const game = fribGameData[group_id]
    if (!game) return
    /** 先结算占位，避免渲染期间被猜中/ans 抢先结算后重复播报 */
    endGame(group_id, gameList)
    const answer = getInfo.info(game.ansId)
    try {
        await send.reply(game.event, [
            `呜……${Config.getUserCfg('config', 'FribTimeout')}秒内没有新的有效猜测，这一局就到这里啦！正确答案是：${answer?.song}`,
            await renderGame(game.event, game, true),
        ])
    } catch (err) {
        logger.error('[phi-plugin][frib19]超时结算失败')
        logger.error(err)
    }
}

/**
 * 渲染猜测记录
 * @param {botEvent} e
 * @param {fribGameData} game
 * @param {boolean} showAnswer 是否公布答案行
 */
async function renderGame(e, game, showAnswer) {
    const answer = getInfo.info(game.ansId)
    if (!answer) return '获取曲目信息发生未知错误QAQ！'
    /** 背景使用本局最近一次猜测的曲目，尚未产生猜测时使用答案曲绘 */
    const background = getInfo.getill(game.lastGuessId ?? game.ansId)
    const pluginData = await getNotes.getNotesData(e.user_id)
    const answerRow = showAnswer ? createFribRow(answer, answer, compareContext('', game.level)) : null
    return await picmodle.frib19(e, {
        background,
        theme: pluginData?.theme,
        level: game.level,
        minDifficulty: game.minDifficulty,
        levelText: levelText(game.level, game.minDifficulty),
        maxGuess: game.maxGuess,
        round: game.rows.length,
        rows: toRenderRows(game.rows),
        answerRow: answerRow ? toRenderRows([answerRow])[0] : null,
        nearVersion: Config.getUserCfg('config', 'FribNearVersion'),
        nearDifficulty: Config.getUserCfg('config', 'FribNearDifficulty'),
        nearBpm: Config.getUserCfg('config', 'FribNearBpm'),
        nearCombo: Config.getUserCfg('config', 'FribNearCombo'),
        earliestVersion: getVersionIndex().earliestLabel,
        cmdhead: Config.getUserCfg('config', 'cmdhead'),
        timeout: Config.getUserCfg('config', 'FribTimeout'),
    })
}

export default new class frib19 {
    /**
     * 开始弗一把
     * @param {botEvent} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    async start(e, gameList) {
        const group_id = groupKey(e)
        if (fribGameData[group_id]) {
            send.reply(e, `当前群还有未结束的弗一把哦！发送 /${Config.getUserCfg('config', 'cmdhead')} ans 可以提前结束呐！`, true)
            return false
        }
        const { level, minDifficulty } = parseStartArgs(e.msg, Config.getUserCfg('config', 'FribDefaultLevel'))
        const pool = buildSongPool(getInfo.idList || [], {
            level,
            minDifficulty,
            infoOf: id => getInfo.info(id),
        })
        if (!pool.length) {
            send.send_with_At(e, `当前曲库没有符合「${levelText(level, minDifficulty)}」条件的曲目哦！换个难度或定数下限试试吧！`)
            return false
        }
        const ansId = pool[fCompute.randInt(0, pool.length - 1)]
        if (!getInfo.info(ansId)) {
            send.send_with_At(e, '获取曲目信息发生未知错误QAQ！')
            return false
        }
        const maxGuess = numberCfg(Config.getUserCfg('config', 'FribMaxGuess'), 8)
        /** @type {fribGameData} */
        const game = {
            ansId,
            level,
            minDifficulty,
            maxGuess: Math.max(1, Math.floor(maxGuess)),
            rows: [],
            guessedIds: [],
            lastGuessId: null,
            timer: null,
            event: e,
        }
        fribGameData[group_id] = game
        gameList[group_id] = { gameType: 'frib19' }
        send.reply(e, [
            `下面开始进行弗一把哦！本局按「${levelText(level, minDifficulty)}」谱面对比，定数与物量均以该难度为准嗷！`,
            `直接发送曲名进行猜测，共有 ${game.maxGuess} 次机会，猜中或次数用尽后公布答案；连续 ${Config.getUserCfg('config', 'FribTimeout')} 秒没有有效猜测会自动结束呐！`,
            `发送 /${Config.getUserCfg('config', 'cmdhead')} ans 可以提前公布答案哦！`,
        ])
        refreshTimeout(group_id, gameList)
        return true
    }

    /**
     * 猜测曲目
     * @param {botEvent} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    async guess(e, gameList) {
        const group_id = groupKey(e)
        const game = fribGameData[group_id]
        if (!game) return false
        const msg = String(e.msg ?? '').trim()
        /** 过滤命令、CQ码与超长文本，避免无效猜测消耗次数 */
        if (!msg || msg.length > 64 || msg.includes('[CQ:') || msg.startsWith('#') || msg.startsWith('/')) return false
        const ids = getInfo.fuzzysongsnick(msg, 0.95)
        if (!ids.length) return false
        const answer = getInfo.info(game.ansId)
        if (!answer) {
            endGame(group_id, gameList)
            return false
        }
        if (ids.includes(game.ansId)) {
            game.rows.push(createFribRow(answer, answer, compareContext(playerName(e), game.level)))
            game.lastGuessId = game.ansId
            try {
                await send.send_with_At(e, `恭喜你，猜中啦喵！ヾ(≧▽≦*)o`, true)
                await send.reply(e, ['正确答案是：', await renderGame(e, game, true)])
                await send.reply(e, await getPic.GetSongsInfoAtlas(e, game.ansId))
            } catch (err) {
                logger.error('[phi-plugin][frib19]结算消息发送失败')
                logger.error(err)
            } finally {
                endGame(group_id, gameList)
            }
            return true
        }
        const guessId = ids.find(id => !game.guessedIds.includes(id))
        if (!guessId) {
            send.send_with_At(e, `曲目[${getInfo.info(ids[0])?.song ?? msg}]已经猜过啦，换一首试试吧uwu`, true, { recallMsg: 5 })
            return true
        }
        const guessInfo = getInfo.info(guessId)
        if (!guessInfo) return false
        game.rows.push(createFribRow(guessInfo, answer, compareContext(playerName(e), game.level)))
        game.guessedIds.push(guessId)
        game.lastGuessId = guessId
        refreshTimeout(group_id, gameList)
        if (game.rows.length >= game.maxGuess) {
            try {
                await send.reply(e, [`很遗憾，猜测次数用完了喵！正确答案是：${answer.song}`, await renderGame(e, game, true)])
            } catch (err) {
                logger.error('[phi-plugin][frib19]结算消息发送失败')
                logger.error(err)
            } finally {
                endGame(group_id, gameList)
            }
            return true
        }
        await send.reply(e, await renderGame(e, game, false))
        return true
    }

    /**
     * 结束游戏并公布答案
     * @param {botEvent} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    async ans(e, gameList) {
        const group_id = groupKey(e)
        const game = fribGameData[group_id]
        if (!game) return false
        const answer = getInfo.info(game.ansId)
        try {
            await send.reply(e, [`好吧，下面开始公布答案。正确答案是：${answer?.song}`, await renderGame(e, game, true)])
        } catch (err) {
            logger.error('[phi-plugin][frib19]结算消息发送失败')
            logger.error(err)
        } finally {
            endGame(group_id, gameList)
        }
        return true
    }
}()
