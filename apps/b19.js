import common from '../../../lib/common/common.js'
import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js';
import get from '../model/getdata.js'
import { segment } from "oicq";
import send from '../model/send.js';
import PhigrosUser from '../lib/PhigrosUser.js';
import altas from '../model/picmodle.js'
import scoreHistory from '../model/class/scoreHistory.js';
import fCompute from '../model/fCompute.js';
import getInfo from '../model/getInfo.js';
import getSave from '../model/getSave.js';
import { LevelNum } from '../model/constNum.js';


const ChallengeModeName = ['白', '绿', '蓝', '红', '金', '彩']

const Level = ['EZ', 'HD', 'IN', 'AT', null] //存档的难度映射

const chap = {
    S: "单曲精选集",
    C0: "Chapter Legacy 过去的章节",
    旧章: "Chapter Legacy 过去的章节",
    Legacy: "Chapter Legacy 过去的章节",
    C5: "Chapter 5 霓虹灯牌",
    霓虹灯牌: "Chapter 5 霓虹灯牌",
    C6: "Chapter 6 方舟蜃景",
    方舟蜃景: "Chapter 6 方舟蜃景",
    C7: "Chapter 7 时钟链接",
    时钟链接: "Chapter 7 时钟链接",
    C8: "Chapter 8 凌日潮汐",
    凌日潮汐: "Chapter 8 凌日潮汐",
    S1: "Side Story 1 忘忧宫",
    忘忧宫: "Side Story 1 忘忧宫",
    S2: "Side Story 2 弭刻日",
    弭刻日: "Side Story 2 弭刻日",
    S3: "Side Story 3 盗乐行",
    盗乐行: "Side Story 3 盗乐行",
    EX: "Extra Story Chapter 极星卫",
    极星卫: "Extra Story Chapter 极星卫",
    黑皇帝: "Chapter EX-Rising Sun Traxx 精选集",
    HYUN: "Chapter EX-HyuN 精选集",
    GOOD: "Chapter EX-GOOD 精选集",
    WAVEAT: "Chapter EX-WAVEAT 精选集",
    喵斯: "Chapter EX-Muse Dash 精选集",
    MUSE: "Chapter EX-Muse Dash 精选集",
    KALPA: "Chapter EX-KALPA 精选集",
    LANOTA: "Chapter EX-Lanota 精选集",
    盘子: "Chapter EX-Lanota 精选集",
    江米条: "Chapter EX-姜米條 精选集",
    姜米條: "Chapter EX-姜米條 精选集",
    茶鸣: "Chapter EX-茶鸣拾贰律 精选集",
    OR: "Chapter EX-OverRapid 精选集",
    方向盘: "Chapter EX-Rotaeno 精选集",
    ROTEANO: "Chapter EX-Rotaeno 精选集",
    中二: "Chapter EX-CHUNITHM 精选集",
    范式: "Chapter EX-Paradigm：Reboot 精选集",
    SHINOBI: "Chapter EX- SHINOBI SLASH 精选集",
    千恋万花: "Chapter EX-SHINOBI SLASH 精选集",
}

export class phib19 extends plugin {
    constructor() {
        super({
            name: 'phi-b19',
            dsc: 'phiros b19查询',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(b[0-9]+|rks|pgr|PGR|B[0-9]+|RKS).*$`,
                    fnc: 'b19'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)best(\\s*)[1-9]?[0-9]?$`,
                    fnc: 'bestn'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(score|单曲成绩)[1-2]?.*$`,
                    fnc: 'singlescore'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(suggest|推分(建议)?)$`,
                    fnc: 'suggest'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)chap.*$`,
                    fnc: 'chap'
                }
            ]
        })

    }

    async b19(e) {

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }


        let nnum = e.msg.match(/(b|rks|pgr|PGR|B|RKS)[0-9]*/g)[0]

        nnum = Number(nnum.replace(/(b|rks|pgr|PGR|B|RKS)/g, ''))
        if (!nnum) {
            nnum = 21
        }

        nnum = Math.max(nnum, 21)
        nnum = Math.min(nnum, Config.getDefOrConfig('config', 'B19MaxNum'))

        let bksong = e.msg.replace(/^.*(b|rks|pgr|PGR|B|RKS)[0-9]*\s*/g, '')

        if (bksong) {
            let tem = get.fuzzysongsnick(bksong)[0]
            if (tem) {
                // console.info(tem)
                bksong = get.getill(tem, 'blur')
            } else {
                bksong = undefined
            }
        }

        let plugin_data = await get.getpluginData(e.user_id)


        if (!Config.getDefOrConfig('config', 'isGuild'))
            e.reply("正在生成图片，请稍等一下哦！\n//·/w\\·\\\\", false, { recallMsg: 5 })

        /**自定义数量不更新存档 */
        if (nnum == 21) {

            try {
                get.buildingRecord(e, new PhigrosUser(save.session))

                save = await send.getsave_result(e)

                if (!save) {
                    return true
                }

            } catch (err) {
                send.send_with_At(e, err)
                logger.error(err)
            }
        }


        let phi = {}
        let b19_list = []
        let com_rks = 0 //计算得到的rks

        phi.rks = 0

        /**满分且 rks 最高的成绩数组 */
        let philist = save.findAccRecord(100, true)

        /**随机抽取一个 b0 */
        // console.info(philist)
        phi = philist[Math.floor(Math.random() * philist.length)]

        if (phi?.rks) {
            com_rks += Number(phi.rks) //计算rks
            phi.rks = phi.rks.toFixed(2)
            phi.acc = phi.acc.toFixed(2)
            phi.illustration = get.getill(phi.song)
            phi.suggest = "无法推分"
        }

        /**所有成绩 */
        let rkslist = save.getRecord()
        /**真实 rks */
        let userrks = save.saveInfo.summary.rankingScore
        /**考虑屁股肉四舍五入原则 */
        let minuprks = Math.floor(userrks * 100) / 100 + 0.005 - userrks
        if (minuprks < 0) {
            minuprks += 0.01
        }

        rkslist = rkslist.sort(cmp())
        let illlist = []
        for (let i = 0; i < nnum && i < rkslist.length; ++i) {
            /**计算rks */
            if (i < 19) com_rks += Number(rkslist[i].rks)
            /**是 Best 几 */
            rkslist[i].num = i + 1
            /**推分建议 */
            rkslist[i].suggest = fCompute.suggest(Number((i < 18) ? rkslist[i].rks : rkslist[18].rks) + minuprks * 20, rkslist[i].difficulty, 2)

            rkslist[i].rks = Number(rkslist[i].rks).toFixed(2)
            rkslist[i].acc = Number(rkslist[i].acc).toFixed(2)
            /**曲绘 */
            rkslist[i].illustration = get.getill(rkslist[i].song, 'common')
            /**b19列表 */
            b19_list.push(rkslist[i])
            /**背景列表 */
            illlist.push(get.getill(rkslist[i].song, 'blur'))
        }



        let data = {
            phi,
            b19_list,
            data: undefined,
            PlayerId: save.saveInfo.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: save.saveInfo.updatedAt,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            dan: await get.getDan(e.user_id),
            background: bksong || illlist[Number((Math.random() * (illlist.length - 1)).toFixed(0))],
            theme: plugin_data?.plugin_data?.theme || 'star',
            nnum: nnum,
        }
        if (save.gameProgress) {
            let money = save.gameProgress.money
            data.data = `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`
        }


        send.send_with_At(e, await altas.b19(e, data))
    }

    /**获取bestn文字版 */
    async bestn(e) {


        const save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        let num = e.msg.replace(/[#/](.*)(best)(\s*)/g, '')

        if (Number(num) % 1 != 0) {
            await e.reply(`${num}不是个数字吧！`, true)
            return true
        }

        num = Number(num)

        if (!num)
            num = 19 //未指定默认b19

        let Record = save.gameRecord
        let phi = {}

        phi.rks = 0

        /**取出信息 */
        let rkslist = []
        for (let song in Record) {
            for (let level in song) {
                if (level == 4) break
                let tem = Record[song][level]

                if (!tem) continue


                if (!tem) continue
                if (tem.acc >= 100) {
                    if (tem.rks > phi.rks) {
                        phi = tem
                    }
                }
                rkslist.push(tem)
            }
        }

        phi.suggest = "无法推分"

        let userrks = save.saveInfo.summary.rankingScore
        /**考虑屁股肉四舍五入原则 */
        let minuprks = Math.floor(userrks * 100) / 100 + 0.005 - userrks
        if (minuprks < 0) {
            minuprks += 0.01
        }

        rkslist = rkslist.sort(cmp())

        if (Config.getDefOrConfig('config', 'isGuild')) {
            /**频道模式 */

            let Remsg = []
            let tmsg = ''
            tmsg += `PlayerId: ${save.saveInfo.PlayerId} Rks: ${Number(save.saveInfo.summary.rankingScore).toFixed(4)} ChallengeMode: ${ChallengeModeName[(save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100]}${save.saveInfo.summary.challengeModeRank % 100} Date: ${save.saveInfo.updatedAt}`
            if (phi.song) {
                tmsg += `\n#φ:${phi.song}<${phi.rank}>${phi.difficulty}`
            } else {
                tmsg += "\n你还没有满分的曲目哦！收掉一首歌可以让你的RKS大幅度增加的！"
            }
            /**防止消息过长发送失败每条消息10行 */
            let tot = 1
            for (let i = 0; i < num && i < rkslist.length; ++i) {
                if (tot <= 10) {
                    tmsg += `\n#B${i + 1}:${rkslist[i].song}<${rkslist[i].rank}>${rkslist[i].difficulty} ${rkslist[i].score} ${rkslist[i].Rating} ${rkslist[i].acc.toFixed(4)}%[${rkslist[i].rks.toFixed(4)}]->:${fCompute.suggest(Number((i < 18) ? rkslist[i].rks : rkslist[18].rks) + minuprks * 20, rkslist[i].difficulty, 4)}`
                } else {
                    Remsg.push(tmsg)
                    tmsg = `#B${i + 1}:${rkslist[i].song}<${rkslist[i].rank}>${rkslist[i].difficulty} ${rkslist[i].score} ${rkslist[i].Rating} ${rkslist[i].acc.toFixed(4)}%[${rkslist[i].rks.toFixed(4)}]->:${fCompute.suggest(Number((i < 18) ? rkslist[i].rks : rkslist[18].rks) + minuprks * 20, rkslist[i].difficulty, 4)}`
                    tot = 0
                }
                ++tot
            }

            Remsg.push(tmsg)

            if (e.isGroup) {
                /**群聊只发送10条 */
                send.send_with_At(e, Remsg[0])
                send.send_with_At(e, `消息过长，自动转为私聊发送喵～`)
                send.pick_send(e, await common.makeForwardMsg(e, Remsg))
            } else {
                e.reply(await common.makeForwardMsg(e, Remsg))
            }

        } else {

            let Remsg = []
            Remsg.push(`PlayerId: ${save.saveInfo.PlayerId}\nRks: ${Number(save.saveInfo.summary.rankingScore).toFixed(4)}\nChallengeMode: ${ChallengeModeName[(save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100]}${save.saveInfo.summary.challengeModeRank % 100}\nDate: ${save.saveInfo.updatedAt}`)


            if (Config.getDefOrConfig('config', 'WordB19Img')) {

                if (phi.song) {
                    Remsg.push([`#φ:\n`,
                        segment.image(get.getill(phi.song, false)),
                        `\n${phi.song}\n` +
                        `${phi.rank} ${phi.difficulty}\n` +
                        `${phi.score} ${phi.Rating}\n` +
                        `${phi.acc.toFixed(2)}% ${phi.rks.toFixed(2)}\n` +
                        `推分: ${phi.suggest}`])
                } else {
                    Remsg.push("你还没有满分的曲目哦！收掉一首歌可以让你的RKS大幅度增加的！")
                }
                for (let i = 0; i < num && i < rkslist.length; ++i) {
                    Remsg.push([`#Best ${i + 1}: ${rkslist[i].song}\n`,
                    segment.image(get.getill(rkslist[i].song, false)),
                    `\n` +
                    `${rkslist[i].rank} ${rkslist[i].difficulty}\n` +
                    `${rkslist[i].score} ${rkslist[i].Rating}\n` +
                    `${Number(rkslist[i].acc).toFixed(4)}% ${Number(rkslist[i].rks).toFixed(4)}\n` +
                    `推分: ${fCompute.suggest(Number((i < 18) ? rkslist[i].rks : rkslist[18].rks) + minuprks * 20, rkslist[i].difficulty, 4)}`])
                }
            } else {
                /**无图模式 */
                if (phi.song) {
                    Remsg.push([`#φ: ${phi.song}\n` +
                        `${phi.rank} ${phi.difficulty}\n` +
                        `${phi.score} ${phi.Rating}\n` +
                        `${phi.acc.toFixed(2)}% ${phi.rks.toFixed(2)}\n` +
                        `推分: ${phi.suggest}`])
                } else {
                    Remsg.push("你还没有满分的曲目哦！收掉一首歌可以让你的RKS大幅度增加的！")
                }
                for (let i = 0; i < num && i < rkslist.length; ++i) {
                    Remsg.push([`#Best ${i + 1}: ${rkslist[i].song}\n` +
                        `${rkslist[i].rank} ${rkslist[i].difficulty}\n` +
                        `${rkslist[i].score} ${rkslist[i].Rating}\n` +
                        `${Number(rkslist[i].acc).toFixed(4)}% ${Number(rkslist[i].rks).toFixed(4)}\n` +
                        `推分: ${fCompute.suggest(Number((i < 18) ? rkslist[i].rks : rkslist[18].rks) + minuprks * 20, rkslist[i].difficulty, 4)}`])
                }
            }
            await e.reply(await common.makeForwardMsg(e, Remsg))
        }



    }


    async singlescore(e) {
        const save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        let picversion = Number(e.msg.match(/(score|单曲成绩)[1-2]?/g)[0].replace(/(score|单曲成绩)/g, '')) || 1


        let song = e.msg.replace(/[#/](.*)(score|单曲成绩)[1-2]?(\s*)/g, '')

        if (!song) {
            send.send_with_At(e, `请指定曲名哦！\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} score <曲名>`)
            return true
        }

        if (!(get.fuzzysongsnick(song)[0])) {
            send.send_with_At(e, `未找到 ${song} 的有关信息哦！`)
            return true
        }
        song = get.fuzzysongsnick(song)
        song = song[0]

        let Record = save.gameRecord
        let ans

        for (let i in Record) {
            let now = await get.idgetsong(i)
            if (now == song) {
                ans = Record[i]
                break
            }
        }

        if (!ans) {
            send.send_with_At(e, `我不知道你关于[${song}]的成绩哦！可以试试更新成绩哦！\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} update`)
            return true
        }


        /**取出信息 */
        let rkslist = []
        for (let i in Record) {
            for (let level in i) {
                if (level == 4) break
                let tem = Record[i][level]
                if (!tem) continue
                rkslist.push(tem)
            }
        }

        rkslist = rkslist.sort(cmp())
        /**b19最低rks */
        let minrks = rkslist[Math.min(18, rkslist.length)]
        let userrks = save.saveInfo.summary.rankingScore
        /**考虑屁股肉四舍五入原则 */
        let minuprks = Math.floor(userrks * 100) / 100 + 0.005 - userrks
        if (minuprks < 0) {
            minuprks += 0.01
        }

        const dan = await get.getDan(e.user_id)

        /**获取历史成绩 */
        let pluginData = await get.getpluginData(e.user_id)

        let HistoryData = pluginData?.scoreHistory

        if (HistoryData) {
            HistoryData = HistoryData[get.SongGetId(song)]
        }

        let history = []

        if (HistoryData) {
            for (let i in HistoryData) {
                for (let j in HistoryData[i]) {
                    const tem = scoreHistory.extend(get.SongGetId(song), i, HistoryData[i][j])
                    tem.date_new = date_to_string(tem.date_new)
                    history.push(tem)
                }
            }
        }

        history.sort((a, b) => new Date(b.date_new) - new Date(a.date_new))

        history.splice(16)


        let data = {
            songName: song,
            PlayerId: save.saveInfo.PlayerId,
            avatar: get.idgetavatar(save.saveInfo.summary.avatar),
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(2),
            Date: save.saveInfo.updatedAt,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            scoreData: {},
            CLGMOD: dan?.Dan,
            EX: dan?.EX,
            history: history,
        }


        data.illustration = get.getill(song)
        let songsinfo = get.ori_info[song]

        switch (picversion) {
            case 2: {
                for (let i in ans) {
                    if (ans[i]) {
                        ans[i].acc = ans[i].acc.toFixed(2)
                        ans[i].rks = ans[i].rks.toFixed(2)
                        data[Level[i]] = {
                            ...ans[i],
                            //      b19最低rks          当前曲目rks     最低提升的rks          定数              保留位数
                            suggest: fCompute.suggest(Math.max(Number(minrks.rks), Number(ans[i].rks)) + minuprks * 20, Number(ans[i].difficulty), 4)
                        }
                    } else {
                        data[Level[i]] = {
                            Rating: 'NEW'
                        }
                    }
                    data[Level[i]].difficulty = Number(songsinfo['chart'][Level[i]]['difficulty']).toFixed(1)
                }
                send.send_with_At(e, await altas.score(e, data, 2))
                break;
            }
            default: {
                for (let i in Level) {
                    if (!songsinfo.chart[Level[i]]) break
                    data.scoreData[Level[i]] = {}
                    data.scoreData[Level[i]].difficulty = songsinfo['chart'][Level[i]]['difficulty']
                }
                // console.info(ans)
                for (let i in ans) {
                    if (!songsinfo['chart'][Level[i]]) break
                    if (ans[i]) {
                        ans[i].acc = ans[i].acc.toFixed(4)
                        ans[i].rks = ans[i].rks.toFixed(4)
                        data.scoreData[Level[i]] = {
                            ...ans[i],
                            suggest: fCompute.suggest(Math.max(Number(minrks.rks), Number(ans[i].rks)) + minuprks * 20, Number(ans[i].difficulty), 4),
                        }
                    } else {
                        data.scoreData[Level[i]] = {
                            Rating: 'NEW',
                        }
                    }
                }
                data.Rks = Number(save.saveInfo.summary.rankingScore).toFixed(4)
                send.send_with_At(e, await altas.score(e, data, 1))
                break;
            }
        }
        return true

    }

    /**推分建议，建议的是RKS+0.01的所需值 */
    async suggest(e) {

        const save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        let Record = save.gameRecord

        /**取出信息 */
        let rkslist = []
        for (let song in Record) {
            for (let level in song) {
                if (level == 4) break
                let tem = Record[song][level]
                if (!tem) continue
                rkslist.push(tem)
            }
        }

        rkslist = rkslist.sort(cmp())
        /**b19最低rks */
        let minrks = rkslist[Math.min(18, rkslist.length)]
        let userrks = save.saveInfo.summary.rankingScore
        /**考虑屁股肉四舍五入原则 */
        let minuprks = Math.floor(userrks * 100) / 100 + 0.005 - userrks
        if (minuprks < 0) {
            minuprks += 0.01
        }

        /**计算 */
        let suggestlist = []
        for (let i in rkslist) {
            let tem = rkslist[i]
            let suggest = fCompute.suggest(Number((i < 18) ? tem.rks : minrks.rks) + minuprks * 20, Number(tem.difficulty), 4)
            if (!suggest.includes("无")) {
                tem.acc = tem.acc
                tem.rks = tem.rks
                tem.suggest = suggest
                suggestlist.push(tem)
            }
        }


        suggestlist = suggestlist.sort(cmpsugg())

        if (Config.getDefOrConfig('config', 'isGuild')) {
            /**频道模式 */
            let Remsg = []
            let tmsg = ''

            /**防止消息过长发送失败每条消息10行 */
            let tot = 1
            tmsg += `PlayerId: ${save.saveInfo.PlayerId} Rks: ${Number(save.saveInfo.summary.rankingScore).toFixed(4)} CLG MOD: ${ChallengeModeName[(save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100]}${save.saveInfo.summary.challengeModeRank % 100} Date: ${save.saveInfo.updatedAt}`
            for (let i = 0; i < suggestlist.length; ++i) {
                if (tot <= 10) {
                    tmsg += `\n#${i + 1}: ${suggestlist[i].song}<${suggestlist[i].rank}>${suggestlist[i].difficulty} ${suggestlist[i].acc.toFixed(4)}% -> ${suggestlist[i].suggest}`
                } else {
                    Remsg.push(tmsg)
                    tmsg = `#${i + 1}: ${suggestlist[i].song}<${suggestlist[i].rank}>${suggestlist[i].difficulty} ${suggestlist[i].acc.toFixed(4)}% -> ${suggestlist[i].suggest}`
                    tot = 0
                }
                ++tot
            }
            Remsg.push(tmsg)

            if (e.isGroup) {
                /**群聊只发送10条 */
                send.send_with_At(e, Remsg[0])
                /**频道模式群聊自动转发私聊 */
                // send.send_with_At(e, `消息过长，自动转为私聊发送喵～`)
                // send.pick_send(e, await common.makeForwardMsg(e, Remsg))
            } else {
                await e.reply(await common.makeForwardMsg(e, Remsg))
            }

        } else {
            let Remsg = []

            /**判断是否发图 */
            if (Config.getDefOrConfig('config', 'WordSuggImg')) {
                for (let i = 0; i < suggestlist.length; ++i) {
                    Remsg.push([`# ${i + 1}: ${suggestlist[i].song}\n`,
                    segment.image(get.getill(suggestlist[i].song, false)),
                    `\n` +
                    `${suggestlist[i].rank} ${suggestlist[i].difficulty}\n` +
                    `${suggestlist[i].score} ${suggestlist[i].Rating}\n` +
                    `${suggestlist[i].acc.toFixed(4)}% ${suggestlist[i].rks.toFixed(4)}\n` +
                    `推分: ${suggestlist[i].suggest}`])
                }
            } else {
                for (let i = 0; i < suggestlist.length; ++i) {
                    Remsg.push([`# ${i + 1}: ${suggestlist[i].song}\n` +
                        `${suggestlist[i].rank} ${suggestlist[i].difficulty}\n` +
                        `${suggestlist[i].score} ${suggestlist[i].Rating}\n` +
                        `${suggestlist[i].acc.toFixed(4)}% ${suggestlist[i].rks.toFixed(4)}\n` +
                        `推分: ${suggestlist[i].suggest}`])
                }
            }

            await e.reply(common.makeForwardMsg(e, Remsg))
        }
    }

    /**查询章节成绩 */
    async chap(e) {
        let save = await send.getsave_result(e)
        if (!save) {
            return false
        }
        let msg = e.msg.replace(/^[#/].*chap\s*/, '').toUpperCase()
        if (msg == 'HELP') {
            let Remsg = '别名：章节名称\n'
            for (let nick in chap) {
                Remsg += `${nick}：${chap[nick]}\n`
            }
            e.reply(common.makeForwardMsg(e, Remsg))
            return true
        }
        if (msg != 'ALL' && !chap[msg]) {
            send.send_with_At(e, `未找到${msg}章节QAQ！可以使用 /${Config.getDefOrConfig('config', 'cmdhead')} chap help 来查询支持的名称嗷！`)
            return false
        }

        let song_box = {}
        let history = await getSave.getHistory(e.user_id)

        /**统计各评分出现次数 */
        let count = {
            tot: 0,
            phi: 0,
            FC: 0,
            V: 0,
            S: 0,
            A: 0,
            B: 0,
            C: 0,
            F: 0,
            NEW: 0
        }

        /**统计各难度出现次数 */
        let rank = {
            EZ: 0,
            HD: 0,
            IN: 0,
            AT: 0
        }

        /**统计各难度ACC和 */
        let rankAcc = {
            EZ: 0,
            HD: 0,
            IN: 0,
            AT: 0
        }

        for (let song in getInfo.ori_info) {
            if (getInfo.ori_info[song].chapter == chap[msg] || msg == 'ALL') {
                song_box[song] = { illustration: getInfo.getill(song), chart: {} }
                let id = getInfo.idssong[song]
                let Record1 = save.getSongsRecord(id)
                let Record2 = await history.getSongsLastRecord(id)
                let info = getInfo.info(song, true)
                for (let level in info.chart) {
                    let i = LevelNum[level]
                    /**跳过旧谱 */
                    if (!level) continue
                    let Record = {}
                    if (Record1[i]) {
                        Record1[i].date = save.saveInfo.modifiedAt.iso
                        if (Record2[level]) {
                            /**取最早 */
                            if (comRecord(Record1, Record2)) {
                                Record = Record1[i].date < Record2[level].date ? Record1[i] : Record2[level]
                            } else {
                                Record = Record1[i].date > Record2[level].date ? Record1[i] : Record2[level]
                            }
                        }
                    }
                    song_box[song].chart[level] = {
                        difficulty: info.chart[level].difficulty,
                        score: Record.score || null,
                        Rating: Record.Rating || 'NEW',
                        acc: Record.acc ? Number(Record.acc).toFixed(4) : null,
                        rks: Record.rks ? Number(Record.rks).toFixed(4) : null,
                        fc: Record1.fc || null,
                        date: date_to_string(Record.date) || null,
                        suggest: fCompute.suggest(Record.rks, info.chart[level].difficulty, 4) || null
                    }
                    ++count.tot
                    if (Record.Rating) {
                        ++count[Record.Rating]
                        rankAcc[level] += Number(Record.acc)
                    } else {
                        ++count.NEW
                    }
                    ++rank[level]
                }
            }
        }

        let progress = {}
        for (let level in rank) {
            if (rank[level]) {
                progress[level] = rankAcc[level] / rank[level]
            }
        }

        send.send_with_At(e, await altas.common(e, 'chap', {
            player: { id: save.saveInfo.PlayerId },
            count,
            song_box,
            progress,
            num: rank.EZ,
            chapName: msg == 'ALL' ? 'AllSong' : chap[msg],
            chapIll: getInfo.getChapIll(msg == 'ALL' ? 'AllSong' : chap[msg]),
        }))

    }
}

function cmp() {
    return function (a, b) {
        return b.rks - a.rks
    }
}

function cmpsugg() {
    return function (a, b) {
        function com(difficulty, suggest) {
            return difficulty + Math.min(suggest - 98, 1) * Math.min(suggest - 98, 1) * difficulty * 0.089
        }
        let s_a = Number(a.suggest.replace("%", ''))
        let s_b = Number(b.suggest.replace("%", ''))
        return com(a.difficulty, s_a) - com(b.difficulty, s_b)
        // return (Number(a.suggest.replace("%", '')) - a.rks) - (Number(b.suggest.replace("%", '')) - b.rks)
    }
}



/**
 * 转换时间格式
 * @param {Date|string} date 时间
 * @returns 2020/10/8 10:08:08
 */
function date_to_string(date) {
    if (!date) return undefined
    date = new Date(date)

    let month = (date.getMonth() + 1) < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1
    let day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate()

    return `${date.getFullYear()}/${month}/${day} ${date.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}`
}

function comRecord(a, b) {
    return Number(a.acc).toFixed(4) == Number(b.acc).toFixed(4) && Number(a.score) == Number(b.score) && Number(a.rks) == Number(b.rks)
}
