import Config from "../../components/Config.js"
import fCompute from "../../model/fCompute.js"
import getInfo from "../../model/getInfo.js"
import { allLevel } from "../../model/constNum.js"
import send from "../../model/send.js"
import picmodle from "../../model/picmodle.js"
import getPic from "../../model/getPic.js"
import logger from "../../components/Logger.js"

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
            e.reply("请不要重复发起哦！", true)
            return false
        }
        /**
         * 提取id，要求有曲绘
         * @type {idString[]}
         */
        let hasIllIdList = []

        const allIdList = getInfo.idList || []

        allIdList.forEach(id => {
            if (getInfo.getill(id) && getInfo.info(id)) {
                hasIllIdList.push(id)
            }
        })

        if (!hasIllIdList.length) {
            logger.error('[phi-plugin] 猜曲绘无有效曲目')
            e.reply('当前曲库暂无有曲绘的曲目哦！更改曲库后需要重启哦！')
            return false
        }
        /**选中的歌曲id */
        let songId = hasIllIdList[fCompute.randBetween(0, hasIllIdList.length - 1)]
        let info = getInfo.info(songId)
        if (!info) {
            send.send_with_At(e, '获取曲目信息发生未知错误QAQ！')
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
        let width = fCompute.randBetween(100, 150)
        /**height */
        let height = fCompute.randBetween(100, 150)
        let x = fCompute.randBetween(0, 2048 - width)
        let y = fCompute.randBetween(0, 1080 - height)
        gameList[group_id] = { gameType: 'guessTips' }
        tipsGameData[group_id] = new GuessTipsGameData(songId, tips, width, height, x, y,)
        const currentGame = tipsGameData[group_id]
        const startTime = currentGame.startTime
        e.reply(`下面开始进行猜曲绘哦！可以直接发送曲名进行回答哦！每过${Config.getUserCfg('config', 'GuessTipsTipCD')}秒后可以请求下一条提示，共有${Config.getUserCfg('config', 'GuessTipsTipNum') + 1}条提示嗷！所有提示发送完毕${Config.getUserCfg('config', 'GuessTipsAnsTime')}秒后会自动结束游戏嗷！发送 /${Config.getUserCfg('config', 'cmdhead')} ans 也可以提前结束游戏呐！`)
        /**@type {string[]} */
        let resMsg = []
        for (let i = 0; i < currentGame.tipNum; i++) {
            resMsg.push(`${i + 1}.${currentGame.tips[i]}`)
        }
        e.reply(resMsg)
        setTimeout(async (startTime) => {
            if (tipsGameData[group_id]?.startTime == startTime) {
                e.reply([`呜……很遗憾，没有人答对喵！正确答案是：${info.song}`, currentGame.tipNum > currentGame.tips.length ? await picmodle.guess(e, { ...currentGame.ill, blur: 0, style: 1, }) : false])
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
            send.send_with_At(e, `提示的冷却时间还有${Math.ceil((nowTime - currentGame.tipTime) / 1000)}秒哦！`)
            return false
        }
        if (currentGame.tipNum > currentGame.tips.length) {
            send.send_with_At(e, `已经没有提示了呐，再仔细想想吧！`)
            return false
        }
        let rev = []
        if (currentGame.tipNum == currentGame.tips.length) {
            setTimeout(async (startTime) => {
                if (tipsGameData[group_id]?.startTime == startTime) {
                    const currentGame = tipsGameData[group_id]
                    const info = getInfo.info(currentGame.songId)
                    e.reply([`呜……很遗憾，没有人答对喵！正确答案是：${info?.song}`, await picmodle.guess(e, { ...currentGame.ill, blur: 0, style: 1, })])
                    e.reply(await getPic.GetSongsInfoAtlas(e, currentGame.songId))
                    gameover(group_id, gameList)
                }
            }, 30 * 1000, currentGame.startTime)
            e.reply(`接下来是曲绘提示哦！如果在${Config.getUserCfg('config', 'GuessTipsAnsTime')}秒内没有回答正确的话，将会自动公布答案哦！`)
            rev.push(await picmodle.guess(e, { ...currentGame.ill, blur: 0, style: 0, }))
        } else {
            ++currentGame.tipNum
        }
        let resMsg = ''
        for (let i = 0; i < currentGame.tipNum; i++) {
            resMsg += `${i + 1}.${currentGame.tips[i]}\n`
        }
        rev.unshift(resMsg)
        e.reply(rev)
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
                    send.send_with_At(e, '恭喜你，答对啦喵！ヾ(≧▽≦*)o', true)
                    if (currentGame.tipNum == currentGame.tips.length + 1) {
                        e.reply(await picmodle.guess(e, { ...currentGame.ill, blur: 0, style: 0, }))
                    }
                    e.reply(await getPic.GetSongsInfoAtlas(e, currentGame.songId))
                    gameover(group_id, gameList)
                    return true
                }
            }
            if (songId[1]) {
                send.send_with_At(e, `不是 ${msg} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
            } else {
                send.send_with_At(e, `不是 ${songId[0]} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
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
        e.reply([
            `好吧，下面开始公布答案。正确答案是：${info?.song}`,
            currentGame.tipNum > currentGame.tips.length ? await picmodle.guess(e, { ...currentGame.ill, blur: 0, style: 1, }) : false
        ])
        e.reply(await getPic.GetSongsInfoAtlas(e, currentGame.songId))
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