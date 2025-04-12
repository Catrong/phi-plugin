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
import getNotes from '../model/getNotes.js';
import getPic from '../model/getPic.js';
import getBanGroup from '../model/getBanGroup.js';

const ChallengeModeName = ['白', '绿', '蓝', '红', '金', '彩']

const Level = ['EZ', 'HD', 'IN', 'AT', null] //存档的难度映射

const chap = {
    S: "单曲精选集",
    单曲: "单曲精选集",
    单曲精选集: "单曲精选集",
    C0: "Chapter Legacy 过去的章节",
    旧章: "Chapter Legacy 过去的章节",
    LEGACY: "Chapter Legacy 过去的章节",
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
    S4: "Side Story 4 无相乡",
    无相乡: "Side Story 4 无相乡",
    EXS: "Extra Story Chapter 极星卫",
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
    茶鸣拾贰律: "Chapter EX-茶鸣拾贰律 精选集",
    茶鸣十二律: "Chapter EX-茶鸣拾贰律 精选集",
    OVERRAPID: "Chapter EX-OverRapid 精选集",
    OR: "Chapter EX-OverRapid 精选集",
    ROTAENO: "Chapter EX-Rotaeno 精选集",
    方向盘: "Chapter EX-Rotaeno 精选集",
    CHUNITHM: "Chapter EX-CHUNITHM 精选集",
    中二: "Chapter EX-CHUNITHM 精选集",
    范式: "Chapter EX-Paradigm：Reboot 精选集",
    SHINOBI: "Chapter EX-SHINOBI SLASH 精选集",
    千恋万花: "Chapter EX-SHINOBI SLASH 精选集",
    TAKUMI: "Chapter EX-TAKUMI³精选集",
    塔库米: "Chapter EX-TAKUMI³精选集",
    三次方: "Chapter EX-TAKUMI³精选集",
    节奏大师: "Chapter EX-节奏大师精选集",
    齐秦太帅: "Chapter EX-节奏大师精选集",
    JZDS: "Chapter EX-节奏大师精选集",
    EGTS: "Chapter EX-EGTS 精选集",
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
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(b[0-9]+|rks|pgr|PGR|B[0-9]+|RKS).*$`,
                    fnc: 'b19'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(p|P)[0-9]+.*$`,
                    fnc: 'p30'
                },
                {
                    reg: `^[#/杠刚钢纲](${Config.getUserCfg('config', 'cmdhead')})(\\s*)[a(arc)啊阿批屁劈](\\s*)((b|B)[0-9]+|[比必币]([0-9]+|三零))$`,
                    fnc: 'arcgrosB19'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)lmtacc.*$`,
                    fnc: 'lmtAcc'
                },
                // {
                //     reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)best(\\s*)[1-9]?[0-9]?$`,
                //     fnc: 'bestn'
                // },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(score|单曲成绩)[1-2]?.*$`,
                    fnc: 'singlescore'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(suggest|推分(建议)?).*$`,
                    fnc: 'suggest'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)chap.*$`,
                    fnc: 'chap'
                }
            ]
        })
    }

    async b19(e) {

        if (await getBanGroup.get(e.group_id, 'b19')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }


        let nnum = e.msg.match(/(b|rks|pgr|PGR|B|RKS)[0-9]*/g)[0]

        nnum = Number(nnum.replace(/(b|rks|pgr|PGR|B|RKS)/g, ''))
        if (!nnum) {
            nnum = 33
        }

        nnum = Math.max(nnum, 33)
        nnum = Math.min(nnum, Config.getUserCfg('config', 'B19MaxNum'))

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


        if (!Config.getUserCfg('config', 'isGuild'))
            e.reply("正在生成图片，请稍等一下哦！\n//·/w\\·\\\\", false, { recallMsg: 5 })

        try {
            await get.buildingRecord(e, new PhigrosUser(save.session))

            save = await send.getsave_result(e)

            if (!save) {
                return true
            }

        } catch (err) {
            send.send_with_At(e, err)
            logger.error(err)
        }

        let save_b19 = await save.getB19(nnum)
        let stats = await save.getStats()


        let dan = await get.getDan(e.user_id)
        let money = save.gameProgress.money
        let gameuser = {
            avatar: get.idgetavatar(save.gameuser.avatar) || 'Introduction',
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save.saveInfo.summary.rankingScore,
            data: `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`,
            selfIntro: save.gameuser.selfIntro,
            backgroundUrl: await fCompute.getBackground(save.gameuser.background),
            PlayerId: fCompute.convertRichText(save.saveInfo.PlayerId),
            dan: dan,
        }

        let data = {
            phi: save_b19.phi,
            b19_list: save_b19.b19_list,
            PlayerId: gameuser.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: save.saveInfo.summary.updatedAt,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            dan: await get.getDan(e.user_id),
            background: bksong || getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.plugin_data?.theme || 'star',
            gameuser,
            nnum,
            stats,
        }

        let res = [await altas.b19(e, data)]
        if (Math.abs(save_b19.com_rks - save.saveInfo.summary.rankingScore) > 0.1) {
            res.push(`请注意，当前版本可能更改了计算规则\n计算rks: ${save_b19.com_rks}\n存档rks: ${save.saveInfo.summary.rankingScore}`)
        }
        send.send_with_At(e, res)
    }

    /**P30 */
    async p30(e) {

        if (await getBanGroup.get(e.group_id, 'p30')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }


        let nnum = e.msg.match(/(p|P)[0-9]*/g)[0]

        nnum = Number(nnum.replace(/(p|P)/g, ''))
        if (!nnum) {
            nnum = 33
        }

        nnum = Math.max(nnum, 33)
        nnum = Math.min(nnum, Config.getUserCfg('config', 'B19MaxNum'))

        let bksong = e.msg.replace(/^.*(p|P)[0-9]*\s*/g, '')

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


        if (!Config.getUserCfg('config', 'isGuild'))
            e.reply("正在生成图片，请稍等一下哦！\n//·/w\\·\\\\", false, { recallMsg: 5 })

        try {
            await get.buildingRecord(e, new PhigrosUser(save.session))

            save = await send.getsave_result(e)

            if (!save) {
                return true
            }

        } catch (err) {
            send.send_with_At(e, err)
            logger.error(err)
        }

        let save_b19 = await save.getBestWithLimit(nnum, [{ type: 'acc', value: [100, 100] }])
        let stats = await save.getStats()


        let dan = await get.getDan(e.user_id)
        let money = save.gameProgress.money
        let gameuser = {
            avatar: get.idgetavatar(save.gameuser.avatar) || 'Introduction',
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save_b19.com_rks,
            data: `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`,
            selfIntro: save.gameuser.selfIntro,
            backgroundUrl: await fCompute.getBackground(save.gameuser.background),
            PlayerId: fCompute.convertRichText(save.saveInfo.PlayerId),
            dan: dan,
        }

        let data = {
            phi: save_b19.phi,
            b19_list: save_b19.b19_list,
            PlayerId: gameuser.PlayerId,
            Rks: save_b19.com_rks.toFixed(4),
            Date: save.saveInfo.summary.updatedAt,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            dan: await get.getDan(e.user_id),
            background: bksong || getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.plugin_data?.theme || 'star',
            gameuser,
            nnum,
            stats,
            spInfo: "All Perfect Only Mode",
        }

        let res = [await altas.b19(e, data)]
        if (Math.abs(save_b19.com_rks - save.saveInfo.summary.rankingScore) > 0.1) {
            res.push(`计算rks: ${save_b19.com_rks}\n存档rks: ${save.saveInfo.summary.rankingScore}`)
        }
        send.send_with_At(e, res)
    }

    /**arc版查分图 */
    async arcgrosB19(e) {

        if (await getBanGroup.get(e.group_id, 'arcgrosB19')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }


        let nnum = e.msg.match(/(b|B)[0-9]*/g)
        nnum = nnum ? Number(nnum[0].replace(/(b|B)/g, '')) - 1 : 32
        if (!nnum) { nnum = 32 }

        nnum = Math.max(nnum, 30)
        nnum = Math.min(nnum, Config.getUserCfg('config', 'B19MaxNum'))

        let save_b19 = await save.getB19(nnum)

        let money = save.gameProgress.money
        let gameuser = {
            avatar: get.idgetavatar(save.gameuser.avatar) || 'Introduction',
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save.saveInfo.summary.rankingScore,
            data: `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`,
            selfIntro: save.gameuser.selfIntro,
            backgroundUrl: await fCompute.getBackground(save.gameuser.background),
            PlayerId: save.saveInfo.PlayerId,
        }
        let plugin_data = await getNotes.getNotesData(e.user_id)

        let data = {
            phi: save_b19.phi,
            b19_list: save_b19.b19_list,
            gameuser,
            PlayerId: fCompute.convertRichText(save.saveInfo.PlayerId),
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: save.saveInfo.summary.updatedAt,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            dan: await get.getDan(e.user_id),
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.plugin_data?.theme || 'star',
            nnum: nnum,
        }

        send.send_with_At(e, await altas.arcgros_b19(e, data))
    }

    /**限制最低acc后的rks */
    async lmtAcc(e) {
        if (await getBanGroup.get(e.group_id, 'lmtAcc')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return false
        }

        let acc = Number(e.msg.replace(/^.*lmtacc\s*/g, ''))

        if (!acc || acc < 0 || acc > 100) {
            send.send_with_At(e, `我听不懂 ${e.msg.replace(/^.*lmtacc\s*/g, '')} 是多少喵！请指定一个0-100的数字喵！\n格式：/${Config.getUserCfg('config', 'cmdhead')} lmtAcc <0-100>`)
            return false
        }

        let record = save.findAccRecord(acc)

        let phi = save.findAccRecord(100, true)

        let ans = 0

        if (phi) {
            ans += phi[0].rks
        }

        for (let i in record) {
            if (i == 19) break
            ans += record[i].rks
        }

        ans /= 20

        send.send_with_At(e, `acc: ${acc}%\nRKS: ${ans}`)

    }

    /**获取bestn文字版 */
    async bestn(e) {

        if (await getBanGroup.get(e.group_id, 'bestn')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
        }

        const save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        let num = e.msg.replace(/[#/](.*?)(best)(\s*)/g, '')

        if (Number(num) % 1 != 0) {
            await e.reply(`${num}不是个数字吧！`, true)
            return true
        }

        num = Number(num)

        if (!num)
            num = 19 //未指定默认b19

        let bastlist = save.getB19(num)

        let rkslist = bastlist.b19_list
        let phi = bastlist.phi

        if (Config.getUserCfg('config', 'isGuild')) {
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


            if (Config.getUserCfg('config', 'WordB19Img')) {

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

        if (await getBanGroup.get(e.group_id, 'singlescore')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        const save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        let picversion = Number(e.msg.match(/(score|单曲成绩)[1-2]?/g)[0].replace(/(score|单曲成绩)/g, '')) || 1


        let song = e.msg.replace(/[#/](.*?)(score|单曲成绩)[1-2]?(\s*)/g, '')

        if (!song) {
            send.send_with_At(e, `请指定曲名哦！\n格式：/${Config.getUserCfg('config', 'cmdhead')} score <曲名>`)
            return true
        }

        if (!(get.fuzzysongsnick(song)[0])) {
            send.send_with_At(e, `未找到 ${song} 的有关信息哦！`)
            return true
        }
        song = get.fuzzysongsnick(song)
        song = song[0]

        let Record = save.gameRecord
        let ans = Record[await getInfo.SongGetId(song)]

        if (!ans) {
            send.send_with_At(e, `我不知道你关于[${song}]的成绩哦！可以试试更新成绩哦！\n格式：/${Config.getUserCfg('config', 'cmdhead')} update`)
            return true
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
                    tem.date_new = fCompute.date_to_string(tem.date_new)
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
            Date: save.saveInfo.summary.updatedAt,
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
                            suggest: save.getSuggest(getInfo.SongGetId(song), i, 4, songsinfo['chart'][Level[i]]['difficulty']),
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
                            suggest: save.getSuggest(getInfo.SongGetId(song), i, 4, songsinfo['chart'][Level[i]]['difficulty']),
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

        if (await getBanGroup.get(e.group_id, 'suggest')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        const save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        /**处理范围要求 */
        let { range, isask, scoreAsk } = fCompute.match_request(e.msg)

        /**取出信息 */
        let Record = save.gameRecord

        /**计算 */
        let data = []

        for (let id in Record) {
            let song = get.idgetsong(id)
            if (!song) {
                logger.warn('[phi-plugin]', id, '曲目无信息')
                continue
            }
            let info = get.info(song, true)
            let record = Record[id]
            for (let lv in [0, 1, 2, 3]) {
                if (!info.chart[Level[lv]]) continue
                let difficulty = info.chart[Level[lv]].difficulty
                if (range[0] <= difficulty && difficulty <= range[1] && isask[lv]) {
                    if ((!record[lv] && !scoreAsk.NEW)) continue
                    if (record[lv] && !scoreAsk[record[lv].Rating.toUpperCase()]) continue
                    if (!record[lv]) {
                        record[lv] = {}
                    }
                    record[lv].suggest = save.getSuggest(id, lv, 4, difficulty)
                    if (record[lv].suggest.includes('无')) {
                        continue
                    }
                    data.push({ ...record[lv], ...info, illustration: get.getill(get.idgetsong(id), 'low'), difficulty: difficulty, rank: Level[lv] })
                }
            }
        }

        if (data.length > Config.getUserCfg('config', 'listScoreMaxNum')) {
            send.send_with_At(e, `谱面数量过多(${data.length})大于设置的最大值(${Config.getUserCfg('config', 'listScoreMaxNum')})，只显示前${Config.getUserCfg('config', 'listScoreMaxNum')}条！`)
        }

        data.splice(Config.getUserCfg('config', 'listScoreMaxNum'))

        data = data.sort(cmpsugg())

        let plugin_data = get.getpluginData(e.user_id)

        send.send_with_At(e, await altas.list(e, {
            head_title: "推分建议",
            song: data,
            background: get.getill(getInfo.illlist[fCompute.randBetween(0, getInfo.illlist.length - 1)]),
            theme: plugin_data?.plugin_data?.theme || 'star',
            PlayerId: save.saveInfo.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: save.saveInfo.summary.updatedAt,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            dan: await get.getDan(e.user_id)
        }))

    }

    /**查询章节成绩 */
    async chap(e) {

        if (await getBanGroup.get(e.group_id, 'chap')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }
        let msg = e.msg.replace(/^[#/].*chap\s*/, '').toUpperCase()
        if (msg == 'HELP' || !msg) {
            send.send_with_At(e, getPic.getimg('chapHelp'))
            return true
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return false
        }

        if (msg != 'ALL' && !chap[msg]) {
            send.send_with_At(e, `未找到${msg}章节QAQ！可以使用 /${Config.getUserCfg('config', 'cmdhead')} chap help 来查询支持的名称嗷！`)
            return false
        }

        let song_box = {}

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
                song_box[song] = { illustration: getInfo.getill(song, 'low'), chart: {} }
                let id = getInfo.idssong[song]
                /**曲目成绩对象 */
                let songRecord = save.getSongsRecord(id)
                let info = getInfo.info(song, true)
                for (let level in info.chart) {
                    let i = LevelNum[level]
                    /**跳过旧谱 */
                    if (!level) continue
                    let Record = songRecord[i]
                    song_box[song].chart[level] = {
                        difficulty: info.chart[level].difficulty,
                        Rating: Record?.Rating || 'NEW',
                        suggest: save.getSuggest(id, i, 4, info.chart[level].difficulty)
                    }
                    if (Record) {
                        song_box[song].chart[level].score = Record.score
                        song_box[song].chart[level].acc = Record.acc.toFixed(4)
                        song_box[song].chart[level].rks = Record.rks.toFixed(4)
                        song_box[song].chart[level].fc = Record.fc
                    }
                    ++count.tot
                    if (Record?.Rating) {
                        ++count[Record.Rating]
                        rankAcc[level] += Number(Record.acc || 0)
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

        send.send_with_At(e, await altas.chap(e, {
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


function comRecord(a, b) {
    return Number(a.acc).toFixed(4) == Number(b.acc).toFixed(4) && Number(a.score) == Number(b.score) && Number(a.rks) == Number(b.rks)
}
