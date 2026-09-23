import Config from '../../components/Config.js'
import getInfo from '../../model/game/getInfo.js'
import getNotes from '../../model/user/getNotes.js'
import fCompute from '../../model/game/fCompute.js'
import send from '../../model/render/send.js'
import picmodle from '../../model/render/picmodle.js'
import getPic from '../../model/render/getPic.js'
import readFile from '../../model/filesystem/getFile.js'
import { infoPath } from '../../model/filesystem/path.js'
import path from 'node:path'
import fs from 'node:fs'
import logger from '../../components/Logger.js'
import {
    buildSongPool,
    buildVersionIndex,
    createFribRow,
    guessCooldown,
    guessNumLimit,
    parseGuessNumTable,
    parseStartArgs,
    toRenderRows,
} from './frib19Utils.js'

/** @import {GameList} from '../guessGame.js' */
/** @import {botEvent} from '../../components/baseClass.js' */
/** @import {fribRow, fribSongInfo, fribVersionIndex} from './frib19Utils.js' */

/**
 * @typedef {object} fribGameData
 * @property {idString} ansId 答案曲目
 * @property {levelKind} level 对比使用的难度
 * @property {number | null} minDifficulty 定数下限
 * @property {number} maxGuess 最大猜测次数
 * @property {fribRow[]} rows 猜测记录
 * @property {idString[]} guessedIds 已猜过的曲目
 * @property {idString | null} lastGuessId 本局最近一次被猜测的曲目，用作背景曲绘
 * @property {number} lastGroupGuessTime 本群上次有效回答时间戳（毫秒）
 * @property {Record<string, number>} playerGuessTime 各玩家上次有效回答时间戳（毫秒）
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

/** 缓存对应的版本数据文件时间戳，用于识别 songVersion.csv / taptap-updates.json 的变化 */
let versionIndexStamp = ''

/**
 * 版本数据文件的时间戳签名：这两个文件不属于 getInfo 的曲目数据结构，
 * 单独用它识别变化，保证改动后下一次渲染即生效
 * @returns {string}
 */
function versionDataStamp() {
    return [songVersionPath, taptapUpdatesPath].map(file => {
        try {
            return fs.statSync(file).mtimeMs
        } catch {
            return 0
        }
    }).join(':')
}

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

/** songVersion.csv：曲目 id → 首次收录的版本号 */
const songVersionPath = path.join(infoPath, 'songVersion.csv')

/** taptap-updates.json：版本号、更新时间与版本名称 */
const taptapUpdatesPath = path.join(infoPath, 'taptap-updates.json')

/**
 * 读取 songVersion.csv，键统一补齐 .0 后缀
 * @returns {Record<string, number>}
 */
function loadSongVersion() {
    const raw = readFile.FileReader(songVersionPath, 'TXT')
    if (typeof raw !== 'string') return {}
    /** @type {Record<string, number>} */
    const result = {}
    for (const line of raw.replace(/\r/g, '').split('\n').slice(1)) {
        const comma = line.indexOf(',')
        if (comma <= 0) continue
        const id = line.slice(0, comma).trim()
        const code = Number(line.slice(comma + 1).trim())
        if (!id || !Number.isFinite(code)) continue
        result[id.endsWith('.0') ? id : `${id}.0`] = code
    }
    return result
}

/**
 * 读取 taptap-updates.json
 * @returns {Array<{ version_label?: string, update_date?: number, version_code?: number }>}
 */
function loadTaptapUpdates() {
    const data = readFile.FileReader(taptapUpdatesPath)
    return Array.isArray(data) ? data : []
}

/**
 * 获取版本索引：oldInfo 为准，songVersion.csv 补充，taptap-updates.json 提供版本名称与时间
 * @returns {fribVersionIndex}
 */
function getVersionIndex() {
    const oldHistory = getInfo.historyDifficultyByVersion
    const size = oldHistory ? Object.keys(oldHistory).length : 0
    const stamp = versionDataStamp()
    if (versionIndexCache && versionIndexSource === oldHistory && versionIndexSize === size && versionIndexStamp === stamp) {
        return versionIndexCache
    }
    versionIndexSource = oldHistory
    versionIndexSize = size
    versionIndexStamp = stamp
    versionIndexCache = buildVersionIndex({
        oldVersionInfo: getInfo.versionInfoByCode,
        oldHistory,
        songVersion: loadSongVersion(),
        taptapUpdates: loadTaptapUpdates(),
    })
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
 * 附加该难度的真实谱师名录，供弗一把的谱师列使用
 * @param {any} info `getInfo.info()` 返回的曲目信息
 * @returns {fribSongInfo}
 */
function withCharters(info) {
    return { ...info, charters: getInfo.charters?.[info?.id] }
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
 * 记录一次有效回答的时间，供个人冷却与群冷却使用
 * @param {fribGameData} game
 * @param {botEvent} e
 */
function markGuessed(game, e) {
    const now = Date.now()
    game.lastGroupGuessTime = now
    game.playerGuessTime[String(e.user_id ?? '')] = now
}

/**
 * 读取参与人数次数表配置
 * @returns {number[]}
 */
function guessNumTable() {
    return parseGuessNumTable(Config.getUserCfg('config', 'FribGuessNumTable'))
}

/**
 * 按当前参与人数刷新本局可猜次数，参与人数取本局有效回答过的玩家数
 * @param {fribGameData} game
 */
function refreshMaxGuess(game) {
    game.maxGuess = guessNumLimit(Object.keys(game.playerGuessTime).length, guessNumTable())
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
    const answerRow = showAnswer ? createFribRow(withCharters(answer), withCharters(answer), compareContext('', game.level)) : null
    return await picmodle.frib19(e, {
        background,
        theme: pluginData?.theme,
        level: game.level,
        minDifficulty: game.minDifficulty,
        levelText: levelText(game.level, game.minDifficulty),
        maxGuess: game.maxGuess,
        round: game.rows.length,
        players: Object.keys(game.playerGuessTime).length,
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
        const maxGuess = guessNumLimit(1, guessNumTable())
        /** @type {fribGameData} */
        const game = {
            ansId,
            level,
            minDifficulty,
            maxGuess,
            rows: [],
            guessedIds: [],
            lastGuessId: null,
            lastGroupGuessTime: 0,
            playerGuessTime: {},
            timer: null,
            event: e,
        }
        fribGameData[group_id] = game
        gameList[group_id] = { gameType: 'frib19' }
        send.reply(e, [
            `下面开始进行弗一把哦！本局按「${levelText(level, minDifficulty)}」谱面对比，定数与物量均以该难度为准嗷！`,
            `直接发送曲名进行猜测，参与的人越多本局可猜次数越多（1 人 ${guessNumLimit(1, guessNumTable())} 次，最多 ${guessNumLimit(99, guessNumTable())} 次）；猜中或次数用尽后公布答案，连续 ${Config.getUserCfg('config', 'FribTimeout')} 秒没有有效猜测会自动结束呐！`,
            `发送 /${Config.getUserCfg('config', 'cmdhead')} ans 可以提前公布答案哦！回答冷却：个人 ${Config.getUserCfg('config', 'FribSelfGuessCd')}s、群聊 ${Config.getUserCfg('config', 'FribGroupGuessCd')}s。`,
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
            game.rows.push(createFribRow(withCharters(answer), withCharters(answer), compareContext(playerName(e), game.level)))
            game.lastGuessId = game.ansId
            markGuessed(game, e)
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
        /** 回答冷却：个人冷却与群冷却同时生效 */
        const cooldown = guessCooldown({
            now: Date.now(),
            selfSeconds: numberCfg(Config.getUserCfg('config', 'FribSelfGuessCd'), 30),
            groupSeconds: numberCfg(Config.getUserCfg('config', 'FribGroupGuessCd'), 5),
            lastSelfGuess: game.playerGuessTime[String(e.user_id ?? '')] ?? 0,
            lastGroupGuess: game.lastGroupGuessTime,
        })
        if (cooldown.seconds > 0) {
            send.send_with_At(e, `${cooldown.kind === 'self' ? '你的' : '群里的'}回答冷却还有 ${cooldown.seconds}s 呐，先耐心等下哇QAQ`, true, { recallMsg: 5 })
            return true
        }
        const guessInfo = getInfo.info(guessId)
        if (!guessInfo) return false
        game.rows.push(createFribRow(withCharters(guessInfo), withCharters(answer), compareContext(playerName(e), game.level)))
        game.guessedIds.push(guessId)
        game.lastGuessId = guessId
        markGuessed(game, e)
        refreshMaxGuess(game)
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
