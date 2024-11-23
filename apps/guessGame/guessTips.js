import Config from "../../components/Config.js"
import fCompute from "../../model/fCompute.js"
import getInfo from "../../model/getInfo.js"
import { Level } from "../../model/constNum.js"
import send from "../../model/send.js"
import picmodle from "../../model/picmodle.js"
import getPic from "../../model/getPic.js"


export default new class guessTips {
    async start(e, gameList) {
        if (gameList[e.group_id]) {
            e.reply("请不要重复发起哦！", true)
            return false
        }
        /**提取原名，要求有曲绘 */
        let songList = []
        let totInfo = getInfo.ori_info
        for (let i in totInfo) {
            if (!getInfo.getill(i)) continue
            songList.push(i)
        }
        if (!songList.length) {
            getLogger.error('[phi-plugin] 猜曲绘无有效曲目')
            e.reply('当前曲库暂无有曲绘的曲目哦！更改曲库后需要重启哦！')
            return false
        }
        /**选中的歌曲原名 */
        let song = songList[fCompute.randBetween(0, songList.length - 1)]
        let info = totInfo[song]
        /**文字提示 */
        let tip = []
        tip.push(`这首曲目隶属于 ${info.chapter}`)
        tip.push(`这首曲目的⌈BPM⌋值为 ${info.bpm}`)
        tip.push(`这首曲目的⌈作曲者⌋ 为 ${info.composer}`)
        tip.push(`这首曲目的⌈时长⌋为 ${info.length}`)
        tip.push(`这首曲目的⌈画师⌋为 ${info.illustrator}`)
        for (let level in info.chart) {
            tip.push(`这首曲目的⌈${level}⌋难度⌈定数⌋为 ${info.chart[level].difficulty}`)
            tip.push(`这首曲目的⌈${level}⌋难度⌈物量⌋为 ${info.chart[level].combo}`)
            tip.push(`这首曲目的⌈${level}⌋难度⌈谱师⌋为 ${info.chart[level].charter}`)
        }
        tip = fCompute.randArray(tip)
        tip = tip.splice(0, Config.getUserCfg('config', 'GuessTipsTipNum'))
        /**曲绘区域 */
        /**width */
        let w_ = fCompute.randBetween(100, 150)
        /**height */
        let h_ = fCompute.randBetween(100, 150)
        let x_ = fCompute.randBetween(0, 2048 - w_)
        let y_ = fCompute.randBetween(0, 1080 - h_)
        let id = fCompute.randBetween(0, 1000000000)
        gameList[e.group_id] = {
            gameType: 'guessTips',
            id: id,
            song: song,
            startTime: new Date(),
            tipTime: new Date(),
            tips: tip,
            /**已发送提示的数量 */
            tipNum: 1,
            ill: {
                illustration: getInfo.getill(song),
                ans: getInfo.getill(song),
                width: w_,
                height: h_,
                x: x_,
                y: y_,
            }
        }
        e.reply(`下面开始进行猜曲绘哦！可以直接发送曲名进行回答哦！每过${Config.getUserCfg('config', 'GuessTipsTipCD')}秒后可以请求下一条提示，共有${Config.getUserCfg('config', 'GuessTipsTipNum') + 1}条提示嗷！所有提示发送完毕${Config.getUserCfg('config', 'GuessTipsAnsTime')}秒后会自动结束游戏嗷！发送 /${Config.getUserCfg('config','cmdhead')} ans 也可以提前结束游戏呐！`)
        let resMsg = ''
        for (let i = 0; i < gameList[e.group_id].tipNum; i++) {
            resMsg += `${i + 1}.${gameList[e.group_id].tips[i]}\n`
        }
        e.reply(resMsg)
        setTimeout(async (id) => {
            if (gameList[e.group_id] && gameList[e.group_id].id == id) {
                e.reply([`呜……很遗憾，没有人答对喵！正确答案是：${gameData.song}`, gameData.tipNum > gameData.tips.length ? await picmodle.guess(e, { ...gameData.ill, blur: 0, style: 1, }) : false])
            }
        }, Config.getUserCfg('config', 'GuessTipsTimeout') * 1000, id);
        return true
    }

    async getTip(e, gameList) {
        if (!gameList[e.group_id]) {
            return false
        }
        let nowTime = new Date()
        let gameData = gameList[e.group_id]
        if (nowTime - gameData.tipTime < Config.getUserCfg('config', 'GuessTipsTipCD') * 1000) {
            send.send_with_At(e, `提示的冷却时间还有${Math.ceil((nowTime - gameData.tipTime) / 1000)}秒哦！`)
            return false
        }
        if (gameData.tipNum > gameData.tips.length) {
            send.send_with_At(e, `已经没有提示了呐，再仔细想想吧！`)
            return false
        }
        let rev = []
        if (gameData.tipNum == gameData.tips.length) {
            setTimeout(async (id) => {
                if (gameList[e.group_id] && gameList[e.group_id].id == id) {
                    let gameData = gameList[e.group_id]
                    delete gameList[e.group_id]
                    e.reply([`呜……很遗憾，没有人答对喵！正确答案是：${gameData.song}`, await picmodle.guess(e, { ...gameData.ill, blur: 0, style: 1, })])
                    e.reply(await getPic.GetSongsInfoAtlas(e, gameData.song))
                }
            }, 30 * 1000, gameData.id)
            e.reply(`接下来是曲绘提示哦！如果在${Config.getUserCfg('config', 'GuessTipsAnsTime')}秒内没有回答正确的话，将会自动公布答案哦！`)
            rev.push(await picmodle.guess(e, { ...gameData.ill, blur: 0, style: 0, }))
        } else {
            ++gameData.tipNum
        }
        let resMsg = ''
        for (let i = 0; i < gameList[e.group_id].tipNum; i++) {
            resMsg += `${i + 1}.${gameList[e.group_id].tips[i]}\n`
        }
        rev.unshift(resMsg)
        e.reply(rev)
    }

    async guess(e, gameList) {
        if (!gameList[e.group_id]) {
            return false
        }
        let { msg, group_id } = e
        let song = getInfo.fuzzysongsnick(msg, 0.95)
        if (song[0]) {
            for (let i in song) {
                if (gameList[group_id].song == song[i]) {
                    let gameData = gameList[group_id]
                    delete (gameList[group_id])
                    send.send_with_At(e, '恭喜你，答对啦喵！ヾ(≧▽≦*)o', true)
                    if (gameData.tipNum == gameData.tips.length + 1) {
                        e.reply(await picmodle.guess(e, { ...gameData.ill, blur: 0, style: 0, }))
                    }
                    e.reply(await getPic.GetSongsInfoAtlas(e, gameData.song))
                    return true
                }
            }
            if (song[1]) {
                send.send_with_At(e, `不是 ${ans} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
            } else {
                send.send_with_At(e, `不是 ${song[0]} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
            }
            return false
        }
        return false
    }

    async ans(e, gameList) {
        if (!gameList[e.group_id]) {
            return false
        }
        let gameData = gameList[e.group_id]
        delete gameList[e.group_id]
        e.reply([`好吧，下面开始公布答案。正确答案是：${gameData.song}`, gameData.tipNum > gameData.tips.length ? await picmodle.guess(e, { ...gameData.ill, blur: 0, style: 1, }) : false])
        e.reply(await getPic.GetSongsInfoAtlas(e, gameData.song))
    }
}()
