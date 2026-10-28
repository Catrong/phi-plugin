import Config from "../../components/Config.js"
import fCompute from "../../model/game/fCompute.js"
import getInfo from "../../model/game/getInfo.js"
import { allLevel } from "../../model/game/constNum.js"
import picmodle from "../../model/render/picmodle.js"
import getPic from "../../model/render/getPic.js"
import logger from "../../components/Logger.js"
import { sendMessage } from "../../model/render/message.js"
import { guessTipsMessages } from "../../model/render/messages.js"



/**
 * @typedef {Object} guessIllDataLite
 * @property {string} illustration 曲绘路径
 * @property {number} width 展示的宽度
 * @property {number} height 展示的高度
 * @property {number} x 展示的X位置
 * @property {number} y 展示的Y位置
 * @property {number|boolean} style 是否全局视野 (0/1 or false/true)
 * @property {string} [ans] 答案图片路径(游戏结束时)
 */
class GuessTipsGameData {
    /**
     * @param {idString} songId 
     * @param {string[]} tips
     * @param {number} width 
     * @param {number} height 
     * @param {number} x 
     * @param {number} y 
     * 
     */
    constructor(songId, tips, width, height, x, y) {
        /**答案曲目id */
        this.songId = songId;
        /**开始时间 */
        this.startTime = new Date().getTime();
        /**上次提示时间 */
        this.tipTime = new Date().getTime();
        /**提示列表 */
        this.tips = tips;
        /**已发送提示的数量 */
        this.tipNum = 1;
        /**曲绘区域 */
        this.ill = {
            illustration: getInfo.getill(songId),
            width,
            height,
            x,
            y,
        }
    }
}

/**
 * @type {Record<string, GuessTipsGameData>}
 */
const tipsGameData = {}


/**
 * @import {GameList} from '../guessGame.js'
 */

export default new class guessTips {
    /**
     * 开始游戏
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    async start(e, gameList) {
        const { group_id } = e;
        if (gameList[group_id]) {
            sendMessage(e, guessTipsMessages.start.alreadyStarted, { quote: true })
            return false
        }
        /**
         * 提取id，要求有曲绘
         * @type {idString[]}
         */
        let hasIllIdList = []

        const allIdList = getInfo.all_idList || []

        allIdList.forEach(id => {
            if (getInfo.getill(id) && getInfo.info(id)) {
                hasIllIdList.push(id)
            }
        })

        if (!hasIllIdList.length) {
            logger.error('[phi-plugin] 提示猜歌无有效曲目')
            sendMessage(e, guessTipsMessages.start.noIllustration)
            return false
        }
        /**选中的歌曲id */
        let songId = hasIllIdList[fCompute.randInt(0, hasIllIdList.length - 1)]
        let info = getInfo.info(songId)
        if (!info) {
            sendMessage(e, guessTipsMessages.start.unknownError, { at: true })
            return false
        }
        /**文字提示 */
        let tips = []
        tips.push(`这首曲目隶属于 ${info.chapter}`)
        tips.push(`这首曲目的⌈BPM⌋值为 ${info.bpm}`)
        tips.push(`这首曲目的⌈作曲者⌋ 为 ${info.composer}`)
        tips.push(`这首曲目的⌈时长⌋为 ${info.length}`)
        tips.push(`这首曲目的⌈画师⌋为 ${info.illustrator}`)
        /**@type {levelKind[]} */
        const levels = /**@type {any} */ (Object.keys(info.chart))
        for (let level of levels) {
            if (!info.chart[level]) continue;
            tips.push(`这首曲目的 ⌈${level}⌋ 难度 ⌈定数⌋ 为 ${info.chart[level].difficulty}`)
            tips.push(`这首曲目的 ⌈${level}⌋ 难度 ⌈物量⌋ 为 ${info.chart[level].combo}`)
            tips.push(`这首曲目的 ⌈${level}⌋ 难度 ⌈谱师⌋ 为 ${info.chart[level].charter}`)
        }
        tips = fCompute.randArray(tips)
        tips = tips.splice(0, Config.getUserCfg('config', 'GuessTipsTipNum'))
        /**曲绘区域 */
        /**width */
        let width = fCompute.randInt(100, 150)
        /**height */
        let height = fCompute.randInt(100, 150)
        let x = fCompute.randInt(0, 2048 - width)
        let y = fCompute.randInt(0, 1080 - height)
        gameList[group_id] = { gameType: 'guessTips' }
        tipsGameData[group_id] = new GuessTipsGameData(songId, tips, width, height, x, y,)
        const currentGame = tipsGameData[group_id]
        const startTime = currentGame.startTime
        sendMessage(e, guessTipsMessages.start.intro(Config.getUserCfg('config', 'GuessTipsTipCD'), Config.getUserCfg('config', 'GuessTipsTipNum'), Config.getUserCfg('config', 'GuessTipsAnsTime')))
        sendMessage(e, guessTipsMessages.start.tipList(currentGame.tips, currentGame.tipNum))
        setTimeout(async (startTime) => {
            if (tipsGameData[group_id]?.startTime == startTime) {
                sendMessage(e, guessTipsMessages.common.noCorrect(currentGame.tipNum > currentGame.tips.length ? await picmodle.guess(e, { ...currentGame.ill, blur: 0, style: 1, }) : false, info.song))
                gameover(group_id, gameList)
            }
        }, Config.getUserCfg('config', 'GuessTipsTimeout') * 1000, startTime);
        return true
    }

    /**
     * 获取提示
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    async getTip(e, gameList) {
        const { group_id } = e;
        if (!gameList[group_id]) {
            return false
        }
        const nowTime = new Date().getTime()
        const currentGame = tipsGameData[group_id]
        if (nowTime - currentGame.tipTime < Config.getUserCfg('config', 'GuessTipsTipCD') * 1000) {
            sendMessage(e, guessTipsMessages.getTip.cooldown(Math.ceil((nowTime - currentGame.tipTime) / 1000)), { at: true })
            return false
        }
        if (currentGame.tipNum > currentGame.tips.length) {
            sendMessage(e, guessTipsMessages.getTip.noMoreTips, { at: true })
            return false
        }
        let image = false
        if (currentGame.tipNum == currentGame.tips.length) {
            setTimeout(async (startTime) => {
                if (tipsGameData[group_id]?.startTime == startTime) {
                    const currentGame = tipsGameData[group_id]
                    const info = getInfo.info(currentGame.songId)
                    sendMessage(e, guessTipsMessages.common.noCorrect([
                            await picmodle.guess(e, { ...currentGame.ill, blur: 0, style: 1, }),
                            await getPic.GetSongsInfoAtlas(e, currentGame.songId),
                        ], info?.song))
                    gameover(group_id, gameList)
                }
            }, 30 * 1000, currentGame.startTime)
            sendMessage(e, guessTipsMessages.getTip.revealIntro(Config.getUserCfg('config', 'GuessTipsAnsTime')))
            image = await picmodle.guess(e, { ...currentGame.ill, blur: 0, style: 0, })
        } else {
            ++currentGame.tipNum
        }
        sendMessage(e, guessTipsMessages.getTip.progress(image, currentGame.tips, currentGame.tipNum))
    }


    /**
     * 回答答案
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    async guess(e, gameList) {
        const { group_id, msg } = e;
        const currentGame = tipsGameData[group_id]
        if (!currentGame) {
            return false
        }
        let songId = getInfo.fuzzysongsnick(msg, 0.95)
        if (songId[0]) {
            for (let id of songId) {
                if (currentGame.songId == id) {
                    /** 先结束游戏，避免发送结算消息期间并发的猜中重复结算 */
                    gameover(group_id, gameList)
                    sendMessage(e, guessTipsMessages.guess.correct([
                            currentGame.tipNum == currentGame.tips.length + 1 ? await picmodle.guess(e, { ...currentGame.ill, blur: 0, style: 0, }) : false,
                            await getPic.GetSongsInfoAtlas(e, currentGame.songId),
                        ]), { at: true, quote: true })
                    return true
                }
            }
            if (songId[1]) {
                sendMessage(e, guessTipsMessages.guess.wrongRaw(msg), { at: true, quote: true, recallMsg: 5 })
            } else {
                sendMessage(e, guessTipsMessages.guess.wrongSong(getInfo.info(songId[0])?.song ?? songId[0]), { at: true, quote: true, recallMsg: 5 })
            }
            return false
        }
        return false
    }

    /**
     * 结束游戏
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    async ans(e, gameList) {
        const { group_id } = e;
        const currentGame = tipsGameData[group_id]
        if (!currentGame) {
            return false
        }
        const info = getInfo.info(currentGame.songId)
        /** 先结束游戏，避免发送结算消息期间并发的 ans 重复结算 */
        gameover(group_id, gameList)
        sendMessage(e, guessTipsMessages.ans.answer([
                currentGame.tipNum > currentGame.tips.length ? await picmodle.guess(e, { ...currentGame.ill, blur: 0, style: 1, }) : false,
                await getPic.GetSongsInfoAtlas(e, currentGame.songId),
            ], info?.song))
        gameover(group_id, gameList)
    }
}()

/**
 * 结束游戏
 * @param {string} group_id 
 * @param {GameList} gameList 
 */
function gameover(group_id, gameList) {
    delete tipsGameData[group_id];
    delete gameList[group_id];
}
