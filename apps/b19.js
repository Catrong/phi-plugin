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
import getSaveFromApi from '../model/getSaveFromApi.js';

const ChallengeModeName = ['白', '绿', '蓝', '红', '金', '彩']

const Level = ['EZ', 'HD', 'IN', 'AT'] //存档的难度映射

/** @type {{[key:string]: songString[]}} */
const wait_to_chose_song = {}

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
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)best(\\s*)[1-9]?[0-9]?$`,
                    fnc: 'bestn'
                },
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

        if (await getBanGroup.get(e, 'b19')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }

        let err = save.checkNoInfo()

        if (err.length) {
            send.send_with_At(e, "以下曲目无信息，可能导致b19显示错误\n" + err.join('\n'))
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

        let plugin_data = await getNotes.getNotesData(e.user_id)


        if (!Config.getUserCfg('config', 'isGuild')) {
            e.reply("正在生成图片，请稍等一下哦！\n//·/w\\·\\\\", false, { recallMsg: 5 })
        }


        let save_b19 = await save.getB19(nnum)
        let stats = await save.getStats()


        let dan = await get.getDan(e.user_id)
        let money = save.gameProgress.money
        let gameuser = {
            avatar: get.idgetavatar(save.gameuser.avatar) || 'Introduction',
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save.saveInfo.summary.rankingScore,
            data: `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`,
            selfIntro: save.gameuser.selfIntro,
            backgroundUrl: await fCompute.getBackground(save.gameuser.background),
            PlayerId: fCompute.convertRichText(save.saveInfo.PlayerId),
            dan: dan,
        }
        // console.info(save_b19.b19_list)
        let data = {
            phi: save_b19.phi,
            b19_list: save_b19.b19_list,
            PlayerId: gameuser.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: save.saveInfo.summary.updatedAt,
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
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

        if (await getBanGroup.get(e, 'p30')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }

        let err = save.checkNoInfo()

        if (err.length) {
            send.send_with_At(e, "以下曲目无信息，可能导致b19显示错误\n" + err.join('\n'))
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

        let plugin_data = await getNotes.getNotesData(e.user_id)


        if (!Config.getUserCfg('config', 'isGuild'))
            e.reply("正在生成图片，请稍等一下哦！\n//·/w\\·\\\\", false, { recallMsg: 5 })

        let save_b19 = await save.getBestWithLimit(nnum, [{ type: 'acc', value: [100, 100] }])
        let stats = await save.getStats()


        let dan = await get.getDan(e.user_id)
        let money = save.gameProgress.money
        let gameuser = {
            avatar: get.idgetavatar(save.gameuser.avatar) || 'Introduction',
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
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
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
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

        if (await getBanGroup.get(e, 'arcgrosB19')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }


        let err = save.checkNoInfo()

        if (err.length) {
            send.send_with_At(e, "以下曲目无信息，可能导致b19显示错误\n" + err.join('\n'))
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
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
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
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
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
        if (await getBanGroup.get(e, 'lmtAcc')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return false
        }

        let err = save.checkNoInfo()

        if (err.length) {
            send.send_with_At(e, "以下曲目无信息，可能导致b19显示错误\n" + err.join('\n'))
        }


        let acc = Number(e.msg.replace(/^.*lmtacc\s*/g, ''))

        if (!acc || acc < 0 || acc > 100) {
            send.send_with_At(e, `我听不懂 ${e.msg.replace(/^.*lmtacc\s*/g, '')} 是多少喵！请指定一个0-100的数字喵！\n格式：/${Config.getUserCfg('config', 'cmdhead')} lmtAcc <0-100>`)
            return false
        }


        let nnum = 33

        let plugin_data = await get.getpluginData(e.user_id)


        if (!Config.getUserCfg('config', 'isGuild'))
            e.reply("正在生成图片，请稍等一下哦！\n//·/w\\·\\\\", false, { recallMsg: 5 })

        let save_b19 = await save.getBestWithLimit(nnum, [{ type: 'acc', value: [acc, 100] }])
        let stats = await save.getStats()


        let dan = await get.getDan(e.user_id)
        let money = save.gameProgress.money
        let gameuser = {
            avatar: get.idgetavatar(save.gameuser.avatar) || 'Introduction',
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
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
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            dan: await get.getDan(e.user_id),
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.plugin_data?.theme || 'star',
            gameuser,
            nnum,
            stats,
            spInfo: `ACC is limited to ${acc}%`,
        }

        let res = [await altas.b19(e, data)]
        if (Math.abs(save_b19.com_rks - save.saveInfo.summary.rankingScore) > 0.1) {
            res.push(`计算rks: ${save_b19.com_rks}\n存档rks: ${save.saveInfo.summary.rankingScore}`)
        }
        send.send_with_At(e, res)

    }

    /**获取bestn文字版 */
    async bestn(e) {

        if (await getBanGroup.get(e, 'bestn')) {
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

        const { b19_list, phi } = await save.getB19(num)


        let Remsg = []
        let tmsg = ''
        tmsg += `PlayerId: ${save.saveInfo.PlayerId} Rks: ${Number(save.saveInfo.summary.rankingScore).toFixed(4)} ChallengeMode: ${ChallengeModeName[(save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100]}${save.saveInfo.summary.challengeModeRank % 100} Date: ${save.saveInfo.updatedAt}`
        phi.forEach((item, index) => {
            if (item.song) {
                tmsg += `\n#φ:${item.song}<${item.rank}>${item.difficulty}`
            } else {
                tmsg += "\n你还没有满分的曲目哦！收掉一首歌可以让你的RKS大幅度增加的！"
            }
        })
        /**防止消息过长发送失败每条消息10行 */
        let tot = 1
        for (let i = 0; i < num && i < b19_list.length; ++i) {
            if (tot <= 10) {
                tmsg += `\n#B${i + 1}:${b19_list[i].song}<${b19_list[i].rank}>${b19_list[i].difficulty} ${b19_list[i].score} ${b19_list[i].Rating} ${b19_list[i].acc.toFixed(4)}%[${b19_list[i].rks.toFixed(4)}]->:${b19_list[i].suggest}`
            } else {
                Remsg.push(tmsg)
                tmsg = `#B${i + 1}:${b19_list[i].song}<${b19_list[i].rank}>${b19_list[i].difficulty} ${b19_list[i].score} ${b19_list[i].Rating} ${b19_list[i].acc.toFixed(4)}%[${b19_list[i].rks.toFixed(4)}]->:${b19_list[i].suggest}`
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




    }


    async singlescore(e) {

        if (await getBanGroup.get(e, 'singlescore')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let song = e.msg.replace(/[#/](.*?)(score|单曲成绩)[1-2]?(\s*)/g, '')

        if (!song) {
            send.send_with_At(e, `请指定曲名哦！\n格式：/${Config.getUserCfg('config', 'cmdhead')} score <曲名>`)
            return true
        }
        const songs = getInfo.fuzzysongsnick(song)
        if (!songs[0]) {
            send.send_with_At(e, `未找到 ${song} 的有关信息哦！`)
            return true
        }
        if (songs.length > 1) {
            send.send_with_At(e, fCompute.mutiNick(songs))
            wait_to_chose_song[e.user_id] = songs
            this.setContext('mutiNick', false, Config.getUserCfg('config', 'mutiNickWaitTimeOut'))
        } else {
            await getScore(songs[0], e)
        }
        return true
    }

    mutiNick() {
        const { msg } = this.e;
        const num = Number(msg.match(/([0-9]+)/)?.[0]);
        const songs = wait_to_chose_song[this.e.user_id];
        if (!num) {
            send.send_with_At(this.e, `请输入正确的序号哦！`);
        } else if (!songs[num - 1]) {
            send.send_with_At(this.e, `未找到${num}所对应的曲目哦！`);
        } else {
            const song = songs[num - 1];
            getScore(song, this.e);
        }
        delete wait_to_chose_song[this.e.user_id];
        this.finish('mutiNick', false)
        return true;
    }

    /**推分建议，建议的是RKS+0.01的所需值 */
    async suggest(e) {

        if (await getBanGroup.get(e, 'suggest')) {
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
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            dan: await get.getDan(e.user_id)
        }))

    }

    /**查询章节成绩 */
    async chap(e) {

        if (await getBanGroup.get(e, 'chap')) {
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

        let chap = fCompute.fuzzySearch(msg, getInfo.chapNick)[0]?.value

        if (!chap && msg != 'ALL') {
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
            if (getInfo.ori_info[song].chapter == chap || msg == 'ALL') {
                song_box[song] = { illustration: getInfo.getill(song, 'low'), chart: {} }
                let id = getInfo.idssong[song]
                /**曲目成绩对象 */
                let songRecord = save.getSongsRecord(id)
                let info = getInfo.info(song, true)
                for (let level in info.chart) {
                    let i = LevelNum[level]
                    /**SP */
                    if(i===undefined) continue
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
            chapName: msg == 'ALL' ? 'AllSong' : chap,
            chapIll: getInfo.getChapIll(msg == 'ALL' ? 'AllSong' : chap),
        }))

    }
}

async function getScore(song, e) {


    const save = await send.getsave_result(e)

    if (!save) {
        return true
    }

    let Record = save.gameRecord
    let ans = Record[getInfo.SongGetId(song)]

    if (!ans) {
        send.send_with_At(e, `我不知道你关于[${song}]的成绩哦！可以试试更新成绩哦！\n格式：/${Config.getUserCfg('config', 'cmdhead')} update`)
        return true
    }

    const dan = await get.getDan(e.user_id)

    /**获取历史成绩 */

    let HistoryData = null;
    if (Config.getUserCfg('config', 'openPhiPluginApi')) {
        try {
            HistoryData = await getSaveFromApi.getSongHistory(e, getInfo.SongGetId(song))
        } catch (err) {
            logger.warn(`[phi-plugin] API ERR`, err)
            HistoryData = await getSave.getHistory(e.user_id)
            if (HistoryData) {
                HistoryData = HistoryData[get.SongGetId(song)]
            }
        }
    } else {
        HistoryData = await getSave.getHistory(e.user_id)
        if (HistoryData) {
            HistoryData = HistoryData[get.SongGetId(song)]
        }
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
        ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
        ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
        scoreData: {},
        CLGMOD: dan?.Dan,
        EX: dan?.EX,
        history: history,
    }


    data.illustration = getInfo.getill(song)
    let songsinfo = getInfo.info(song, true);


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
