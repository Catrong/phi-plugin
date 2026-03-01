import common from '../../../lib/common/common.js'
import Config from '../components/Config.js';
import send from '../model/send.js';
import altas from '../model/picmodle.js'
import ScoreHistory from '../model/class/scoreHistory.js';
import fCompute from '../model/fCompute.js';
import getInfo from '../model/getInfo.js';
import getSave from '../model/getSave.js';
import { allLevel, APII18NCN } from '../model/constNum.js';
import getNotes from '../model/getNotes.js';
import getPic from '../model/getPic.js';
import getBanGroup from '../model/getBanGroup.js';
import getSaveFromApi from '../model/getSaveFromApi.js';
import makeRequest from '../model/makeRequest.js';
import makeRequestFnc from '../model/makeRequestFnc.js';
import getUpdateSave from '../model/getUpdateSave.js';
import phiPluginBase from '../components/baseClass.js';
import logger from '../components/Logger.js';
import LevelRecordInfo from '../model/class/LevelRecordInfo.js';
import SongsInfo from '../model/class/SongsInfo.js';
import Version from '../components/Version.js';

/**@import {botEvent} from '../components/baseClass.js' */

const ChallengeModeName = ['白', '绿', '蓝', '红', '金', '彩']

/**@type {levelKind[]} */
const Level = ['EZ', 'HD', 'IN', 'AT'] //存档的难度映射

export class phib19 extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-b19',
            dsc: 'phiros b19查询',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)((b|B)\\s*[0-9]+|rks|pgr|RKS|PGR).*$`,
                    fnc: 'b19'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(p|x|fc|P|X|FC)\\s*[0-9]+.*$`,
                    fnc: 'p30'
                },
                {
                    reg: `^[#/杠刚钢纲](${Config.getUserCfg('config', 'cmdhead')})(\\s*)[a(arc)啊阿批屁劈]\\s*((b|B)[0-9]+|[比必币]([0-9]+|三零))$`,
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

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async b19(e) {

        if (await getBanGroup.get(e, 'b19')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }
        let save;
        let msg = e.msg

        let askOtherId = msg.match(/-id\s+([0-9]+)/i)
        msg = msg.replace(askOtherId?.[0] || '', '')

        if (askOtherId && Config.getUserCfg('config', 'openPhiPluginApi')) {
            let otherId = /** @type {apiUserId} */ (askOtherId[1]);

            try {
                save = await getUpdateSave.getUIDSaveFromApi(otherId);
            } catch (err) {
                send.send_with_At(e, `获取用户 ${otherId} 的存档失败！请确认该用户公开了存档且ID正确喵！\n错误信息：${err}`);
                return true;
            }
        } else {
            save = await send.getsave_result(e)
            if (!save) {
                return true
            }

        }

        let err = save.checkNoInfo()

        if (err.length) {
            send.send_with_At(e, "以下曲目无信息，可能导致b19显示错误\n" + err.join('\n'))
        }


        let numMsg = e.msg.match(/^.*?(b|rks|pgr)[0-9]*/i)?.[0]

        let nnum = Number(numMsg?.replace(/^.*?(b|rks|pgr)/i, '') ?? 33)
        if (!nnum) {
            nnum = 33
        }

        nnum = Math.max(nnum, 33)
        nnum = Math.min(nnum, Config.getUserCfg('config', 'B19MaxNum'))

        let bksong = msg.replace(/^.*?(b|rks|pgr)[0-9]*\s*/g, '')

        if (bksong) {
            let songId = getInfo.fuzzysongsnick(bksong)[0]
            if (songId) {
                // console.info(tem)
                bksong = getInfo.getill(songId, 'blur')
            } else {
                bksong = ''
            }
        }

        let plugin_data = await getNotes.getNotesData(e.user_id)

        if (!Config.getUserCfg('config', 'isGuild')) {
            e.reply("正在生成图片，请稍等一下哦！\n//·/w\\·\\\\", false, { recallMsg: 5 })
        }


        let save_b19 = await save.getB19(nnum)
        let stats = await save.getStats()

        const spInfo = [];

        /**
         * 回复的消息
         * @type {any[]}
         */
        const res = [];

        const saveVer = save.saveInfo.summary.gameVersion
        if (saveVer &&
            !isNaN(saveVer) &&
            saveVer != Number(Version.phigrosVerNum)) {
            if (saveVer < Number(Version.phigrosVerNum)) {
                spInfo.push(`${getInfo.versionInfoByCode[`${saveVer}`]?.version_label || saveVer} Update to ${Version.phigros}`)
                spInfo.push(`Real RKS: ${save_b19.com_rks.toFixed(4)}`)
                if (Math.abs(save_b19.com_rks - save.saveInfo.summary.rankingScore) > 1e-4) {
                    res.push(`请注意，当前版本可能更改了定数\n计算rks: ${save_b19.com_rks}\n存档rks: ${save.saveInfo.summary.rankingScore}`)
                }
            } else {
                spInfo.push(`${getInfo.versionInfoByCode[`${saveVer}`]?.version_label || saveVer} later than ${Version.phigros}`)

                if (Math.abs(save_b19.com_rks - save.saveInfo.summary.rankingScore) > 1e-4) {
                    res.push(`请注意，您的版本可能更改了定数或计算规则\n计算rks: ${save_b19.com_rks}\n存档rks: ${save.saveInfo.summary.rankingScore}`)
                }
            }

        } else {
            if (Math.abs(save_b19.com_rks - save.saveInfo.summary.rankingScore) > 1e-4) {
                res.push(`请注意，您的版本可能更改了定数或计算规则\n计算rks: ${save_b19.com_rks}\n存档rks: ${save.saveInfo.summary.rankingScore}`)
            }
        }


        // let dan = await get.getDan(e.user_id)
        let money = save.gameProgress?.money || [0, 0, 0, 0, 0]
        let gameuser = {
            avatar: getInfo.idgetavatar(save.gameuser.avatar),
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save.saveInfo.summary.rankingScore,
            data: `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`,
            selfIntro: save.gameuser.selfIntro,
            backgroundUrl: await fCompute.getBackground(save.gameuser.background),
            PlayerId: fCompute.convertRichText(save.saveInfo.PlayerId),
            // dan: dan,
        }
        // console.info(save_b19.b19_list)
        let data = {
            BSIllPath: getInfo.getill(/**@type {idString} */('BANGINGSTRIKE.DewPleiades.0'), 'common'),
            phi: save_b19.phi,
            b19_list: save_b19.b19_list,
            PlayerId: gameuser.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: fCompute.formatDate(save.saveInfo.summary.updatedAt),
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            // dan: await get.getDan(e.user_id),
            background: bksong || getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.theme || 'star',
            gameuser,
            nnum,
            stats,
            spInfo
        }

        res.unshift(await altas.b19(e, data))
        send.send_with_At(e, res)
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
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


        let numMsg = e.msg.match(/^.*?(p|x|fc)[0-9]+/i)?.[0]

        let nnum = Number(numMsg?.replace(/^.*?(p|x|fc)/i, '') || 33)
        if (!nnum) {
            nnum = 33
        }

        nnum = Math.max(nnum, 33)
        nnum = Math.min(nnum, Config.getUserCfg('config', 'B19MaxNum'))

        let bksong = e.msg.replace(/^.*?(p|x|fc)[0-9]+\s*/i, '')

        if (bksong) {
            let songId = getInfo.fuzzysongsnick(bksong)[0]
            if (songId) {
                // console.info(tem)
                bksong = getInfo.getill(songId, 'blur')
            } else {
                bksong = ''
            }
        }

        let plugin_data = await getNotes.getNotesData(e.user_id)


        if (!Config.getUserCfg('config', 'isGuild'))
            e.reply("正在生成图片，请稍等一下哦！\n//·/w\\·\\\\", false, { recallMsg: 5 })

        let save_b19;
        let spInfo = [];

        const type = e.msg.match(/^.*?(p|x|fc)([0-9]+)/i)?.[1].toLowerCase();
        switch (type) {
            case 'p': {
                save_b19 = await save.getBestWithLimit(nnum, [{ type: 'acc', value: [100, 100] }])
                spInfo.push("All Perfect Mode");
                break;
            }
            case 'fc': {
                save_b19 = await save.getBestWithLimit(nnum, [{ type: 'custom', value: (record) => ((record.fc === true) && (record.score != 1e6)) }], false)
                spInfo.push("Full Combo Mode");
                break;
            }
            case 'x': {
                save_b19 = await save.getBestWithLimit(nnum, [{
                    type: 'custom',
                    value: (record) => {
                        return fCompute.comJust1Good(record.score, getInfo.ori_info[record.id]?.chart?.[record.rank]?.combo || 1e9)
                    }
                }], false)
                spInfo.push("1 Good Mode");
                break;
            }
            default: {
                save_b19 = await save.getBestWithLimit(nnum, [{ type: 'acc', value: [100, 100] }])
                spInfo.push("All Perfect Mode");
            }
        }

        let stats = await save.getStats()


        // let dan = await get.getDan(e.user_id)
        let money = save.gameProgress.money
        let gameuser = {
            avatar: getInfo.idgetavatar(save.gameuser.avatar),
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save_b19.com_rks,
            data: `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`,
            selfIntro: save.gameuser.selfIntro,
            backgroundUrl: await fCompute.getBackground(save.gameuser.background),
            PlayerId: fCompute.convertRichText(save.saveInfo.PlayerId),
            // dan: dan,
        }

        let data = {
            phi: save_b19.phi,
            b19_list: save_b19.b19_list,
            PlayerId: gameuser.PlayerId,
            Rks: save_b19.com_rks.toFixed(4),
            Date: save.saveInfo.summary.updatedAt,
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            // dan: await get.getDan(e.user_id),
            background: bksong || getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.theme || 'star',
            gameuser,
            nnum,
            stats,
            spInfo,
        }

        let res = [await altas.b19(e, data)]
        res.push(`计算rks: ${save_b19.com_rks}\n存档rks: ${save.saveInfo.summary.rankingScore}`)
        send.send_with_At(e, res)
    }

    /**
     * arc版查分图
     * @param {botEvent} e 
     * @returns 
     */
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


        let numMsg = e.msg.match(/(b|B)[0-9]*/g)
        let nnum = numMsg ? Number(numMsg[0].replace(/(b|B)/g, '')) - 1 : 32
        if (!nnum) { nnum = 32 }

        nnum = Math.max(nnum, 30)
        nnum = Math.min(nnum, Config.getUserCfg('config', 'B19MaxNum'))

        let save_b19 = await save.getB19(nnum)

        let money = save.gameProgress.money
        let gameuser = {
            avatar: getInfo.idgetavatar(save.gameuser.avatar),
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
            // dan: await get.getDan(e.user_id),
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.theme || 'star',
            nnum: nnum,
        }

        send.send_with_At(e, await altas.arcgros_b19(e, data))
    }

    /**
     * 限制最低acc后的rks
     * @param {botEvent} e 
     * @returns 
     */
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

        let plugin_data = await getNotes.getNotesData(e.user_id)


        if (!Config.getUserCfg('config', 'isGuild'))
            e.reply("正在生成图片，请稍等一下哦！\n//·/w\\·\\\\", false, { recallMsg: 5 })

        let save_b19 = await save.getBestWithLimit(nnum, [{ type: 'acc', value: [acc, 100] }])
        let stats = await save.getStats()


        // let dan = await get.getDan(e.user_id)
        let money = save.gameProgress.money
        let gameuser = {
            avatar: getInfo.idgetavatar(save.gameuser.avatar),
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save_b19.com_rks,
            data: `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`,
            selfIntro: save.gameuser.selfIntro,
            backgroundUrl: await fCompute.getBackground(save.gameuser.background),
            PlayerId: fCompute.convertRichText(save.saveInfo.PlayerId),
            // dan: dan,
        }

        let data = {
            phi: save_b19.phi,
            b19_list: save_b19.b19_list,
            PlayerId: gameuser.PlayerId,
            Rks: save_b19.com_rks.toFixed(4),
            Date: save.saveInfo.summary.updatedAt,
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            // dan: await get.getDan(e.user_id),
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.theme || 'star',
            gameuser,
            nnum,
            stats,
            spInfo: [`ACC is limited to ${acc}%`],
        }

        let res = [await altas.b19(e, data)]
        res.push(`计算rks: ${save_b19.com_rks}\n存档rks: ${save.saveInfo.summary.rankingScore}`)
        send.send_with_At(e, res)

    }

    /**
     * 获取bestn文字版
     * @param {botEvent} e 
     * @returns 
     */
    async bestn(e) {

        if (await getBanGroup.get(e, 'bestn')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
        }

        const save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        let numMsg = e.msg.replace(/[#/](.*?)(best)(\s*)/g, '')

        if (Number(numMsg) % 1 != 0) {
            await e.reply(`${numMsg}不是个数字吧！`, true)
            return true
        }

        let num = Number(numMsg)

        if (!num)
            num = 19 //未指定默认b19

        const { b19_list, phi } = await save.getB19(num)


        let Remsg = []
        let tmsg = ''
        tmsg += `PlayerId: ${save.saveInfo.PlayerId} Rks: ${Number(save.saveInfo.summary.rankingScore).toFixed(4)} ChallengeMode: ${ChallengeModeName[(save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100]}${save.saveInfo.summary.challengeModeRank % 100} Date: ${save.saveInfo.updatedAt}`
        phi.forEach((item, index) => {
            if (item?.song) {
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
            send.pick_send(e, await common.makeForwardMsg(e, Remsg, undefined))
        } else {
            e.reply(await common.makeForwardMsg(e, Remsg, undefined))
        }
    }


    /**
     * @param {botEvent} e 
     * @returns 
     */
    async singlescore(e) {

        if (await getBanGroup.get(e, 'singlescore')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let song = e.msg.replace(/[#/](.*?)(score|单曲成绩)[1-2]?(\s*)/g, '')

        let difArgs = song.match(/-dif\s+(EZ|HD|IN|AT)/i)?.[0];
        if (difArgs) {
            song = song.replace(difArgs, '');
            difArgs = difArgs.replace(/-dif\s+/i, '').toUpperCase();
        }
        let unRankArgsMsg = song.match(/-unrank/i)?.[0];
        let unRankArgs;
        if (unRankArgsMsg) {
            song = song.replace(unRankArgsMsg, '');
            unRankArgs = true;
        } else {
            unRankArgs = false;
        }
        let orderByArgs = song.match(/-or\s+(acc|score|fc|time)/i)?.[0];
        if (orderByArgs) {
            song = song.replace(orderByArgs, '');
            orderByArgs = orderByArgs.replace(/-or\s+/i, '').toLowerCase();
            orderByArgs = orderByArgs.replace('time', 'update_at');
        } else {
            orderByArgs = 'acc';
        }

        if (!song) {
            send.send_with_At(e, `请指定曲名哦！\n格式：/${Config.getUserCfg('config', 'cmdhead')} score <曲名>`)
            return true
        }
        const songIds = getInfo.fuzzysongsnick(song)
        if (!songIds[0]) {
            send.send_with_At(e, `未找到 ${song} 的有关信息哦！`)
            return true
        }
        if (songIds.length > 1) {
            const options = {
                dif: difArgs,
                unRank: unRankArgs,
                orderBy: orderByArgs
            }
            this.choseMutiNick(e, songIds, options, (e, songId, options) => { getScore(songId, e, options); })
        } else {
            await getScore(songIds[0], e, {
                dif: difArgs,
                unRank: unRankArgs,
                orderBy: orderByArgs
            })
        }
        return true
    }

    /**
     * 推分建议，建议的是RKS+0.01的所需值
     * @param {botEvent} e 
     * @returns 
     */
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

        /**
         * @type {({ suggest: string } & { illustration: string, difficulty: number, rank: levelKind } & SongsInfo)[]}
         */
        let data = []



        for (const id of fCompute.objectKeys(Record)) {
            const info = getInfo.info(id)
            if (!info) {
                logger.warn('[phi-plugin]', id, '曲目无信息')
                continue
            }
            /**
             * @type {(((LevelRecordInfo | {}) & { suggest?: string }) | null)[]}
             */
            let record = Record[id]
            for (let lv of [0, 1, 2, 3]) {
                if (!info.chart[Level[lv]]) continue
                let difficulty = info.chart[Level[lv]]?.difficulty
                if (!difficulty) continue
                if (range[0] <= difficulty && difficulty <= range[1] && isask[lv]) {
                    if ((!record[lv] && !scoreAsk.NEW)) continue
                    if (!record[lv]) {
                        record[lv] = { suggest: '' };
                    } else {
                        if ('id' in record[lv] && !scoreAsk[record[lv].Rating == 'phi' ? 'PHI' : record[lv].Rating]) continue
                    }
                    const x = record[lv]
                    x.suggest = save.getSuggest(id, lv, 4, difficulty) || ''
                    if (!x.suggest || x.suggest.includes('无')) {
                        continue
                    }
                    data.push({
                        ...info,
                        difficulty: difficulty,
                        ...x,
                        rank: Level[lv],
                        illustration: getInfo.getill(id, 'low') ?? '',
                        suggest: x.suggest
                    })
                }
            }
        }

        if (data.length > Config.getUserCfg('config', 'listScoreMaxNum')) {
            send.send_with_At(e, `谱面数量过多(${data.length})大于设置的最大值(${Config.getUserCfg('config', 'listScoreMaxNum')})，只显示前${Config.getUserCfg('config', 'listScoreMaxNum')}条！`)
        }

        data.splice(Config.getUserCfg('config', 'listScoreMaxNum'))

        data = data.sort(cmpsugg())

        let plugin_data = await getNotes.getNotesData(e.user_id)

        send.send_with_At(e, await altas.list(e, {
            head_title: "推分建议",
            song: data,
            background: getInfo.getill(getInfo.illlist[fCompute.randBetween(0, getInfo.illlist.length - 1)]),
            theme: plugin_data?.theme || 'star',
            PlayerId: save.saveInfo.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: save.saveInfo.summary.updatedAt,
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            // dan: await get.getDan(e.user_id)
        }))

    }

    /**
     * 查询章节成绩
     * @param {botEvent} e 
     * @returns 
     */
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

        /**
         * @type {Record<string, { illustration: string, chart: Partial<Record<levelKind, Partial<{ difficulty: number, Rating: string, score?: number, acc?: string, rks?: string, fc?: boolean, suggest: string }>>> }>}
         */
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

        const ids = fCompute.objectKeys(getInfo.ori_info)

        for (const id of ids) {
            if (getInfo.ori_info[id]?.chapter == chap || msg == 'ALL') {
                song_box[id] = { illustration: getInfo.getill(id, 'low'), chart: {} }
                /**曲目成绩对象 */
                let songRecord = save.getSongsRecord(id)
                let info = getInfo.info(id, true)
                if (!info) continue;
                getInfo.allLevel?.forEach((level, i) => {
                    /**SP */
                    if (i === undefined) return
                    /**跳过旧谱 */
                    if (level == 'LEGACY') return
                    if (!info.chart[level]) return
                    if (!info.chart[level].difficulty) return
                    let Record = songRecord?.[i]
                    song_box[id].chart[level] = {
                        difficulty: info.chart[level].difficulty,
                        Rating: Record?.Rating || 'NEW',
                        suggest: save.getSuggest(id, i, 4, info.chart[level].difficulty)
                    }
                    if (Record) {
                        song_box[id].chart[level].score = Record.score
                        song_box[id].chart[level].acc = Record.acc.toFixed(4)
                        song_box[id].chart[level].rks = Record.rks.toFixed(4)
                        song_box[id].chart[level].fc = Record.fc
                    }
                    ++count.tot
                    if (Record?.Rating) {
                        ++count[Record.Rating]
                        rankAcc[level] += Number(Record.acc || 0)
                    } else {
                        ++count.NEW
                    }
                    ++rank[level]
                })
            }
        }

        /**
         * @type {Partial<Record<levelKind, number>>}
         */
        let progress = {}



        for (let level of Level) {
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

/**
 * 
 * @param {idString} songId 
 * @param {botEvent} e 
 * @param {any} args 
 * @returns 
 */
async function getScore(songId, e, args = {}) {


    const save = await send.getsave_result(e)

    if (!save) {
        return true
    }

    const info = getInfo.info(songId, true)
    if (!info) {
        send.send_with_At(e, `未找到${songId}的相关信息QAQ！`)
        return true
    }

    /**获取成绩 */

    let Record = save.gameRecord
    let songRecord = Record[songId]

    if (!songRecord) {
        send.send_with_At(e, `我不知道你关于[${info.song}]的成绩哦！可以试试更新成绩哦！\n格式：/${Config.getUserCfg('config', 'cmdhead')} update`)
        return true
    }

    // const dan = await get.getDan(e.user_id)

    /**获取历史成绩 */
    /**
     * @type {songRecordHistory | undefined}
     */
    let HistoryData = undefined;
    if (Config.getUserCfg('config', 'openPhiPluginApi')) {
        try {
            HistoryData = await getSaveFromApi.getSongHistory(e, songId)
        } catch (err) {
            logger.warn(`[phi-plugin] API ERR`, err)
            HistoryData = (await getSave.getHistory(e.user_id))?.scoreHistory[songId]
        }
    } else {
        HistoryData = (await getSave.getHistory(e.user_id))?.scoreHistory[songId]
    }

    /** @type {(import('../model/class/scoreHistory.js').extendedScoreHistoryDetail | {date_new: string})[]} */
    let history = []

    if (HistoryData) {
        for (let i of allLevel) {
            if (!HistoryData[i]) continue
            HistoryData[i].forEach((item) => {
                const tem = ScoreHistory.extend(songId, i, item)
                history.push({ ...tem, date_new: fCompute.formatDate(tem.date_new) })
            })
        }
    }

    history.sort((a, b) => new Date(b.date_new).getTime() - new Date(a.date_new).getTime())

    history.splice(16)


    let data = {
        songName: info.song,
        PlayerId: save.saveInfo.PlayerId,
        avatar: getInfo.idgetavatar(save.saveInfo.summary.avatar),
        Rks: Number(save.saveInfo.summary.rankingScore).toFixed(2),
        Date: save.saveInfo.summary.updatedAt,
        ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
        ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
        /**@type {Partial<Record<allLevelKind, any>>} */
        scoreData: {},
        // CLGMOD: dan?.Dan,
        // EX: dan?.EX,
        history: history,
        illustration: '',
    }

    for (let level of Level) {
        if (!info.chart[level]) break
        data.scoreData[level] = {};
        data.scoreData[level].difficulty = info.chart[level].difficulty
    }


    data.illustration = getInfo.getill(songId)
    // console.info(ans)
    /**
     * 用户游玩过的最高难度
     * @type {levelKind | ''}
     */
    let maxRank = ''
    songRecord.forEach((record, i) => {
        const chartInfo = info.chart[Level[i]]
        if (!chartInfo) return
        if (record) {
            data.scoreData[Level[i]] = {
                ...record,
                acc: record.acc.toFixed(4),
                rks: record.rks.toFixed(4),
                suggest: '',
            }
            const suggest = save.getSuggest(songId, i, undefined, chartInfo.difficulty);
            if (suggest != -1) {
                data.scoreData[Level[i]].suggest = suggest.toFixed(4) + '%'
                if (suggest < 98.5) {
                    data.scoreData[Level[i]].suggestType = 0
                } else if (suggest < 99) {
                    data.scoreData[Level[i]].suggestType = 1
                } else if (suggest < 99.5) {
                    data.scoreData[Level[i]].suggestType = 2
                } else if (suggest < 99.7) {
                    data.scoreData[Level[i]].suggestType = 3
                } else if (suggest < 99.85) {
                    data.scoreData[Level[i]].suggestType = 4
                } else {
                    data.scoreData[Level[i]].suggestType = 5
                }
            } else {
                data.scoreData[Level[i]].suggest = "无法推分"
            }
            maxRank = Level[i]
        } else {
            data.scoreData[Level[i]] = {
                ...data.scoreData[Level[i]],
                Rating: 'NEW',
                suggest: save.getSuggest(songId, i, 4, chartInfo.difficulty) || '无法推分'
            }
        }
    })

    maxRank = args?.dif || maxRank

    data.Rks = Number(save.saveInfo.summary.rankingScore).toFixed(4)

    if (Config.getUserCfg('config', 'openPhiPluginApi') && !args?.unRank) {
        try {
            const scoreRanklist = await makeRequest.getScoreRanklistByUser({
                ...makeRequestFnc.makePlatform(e),
                songId,
                rank: maxRank || 'IN',
                orderBy: args?.orderBy || 'acc'
            });
            scoreRanklist.users.forEach(item => {
                // @ts-ignore
                item.gameuser.challengeMode = Math.floor(item.gameuser.challengeModeRank / 100);
                item.gameuser.challengeModeRank = item.gameuser.challengeModeRank % 100;
                item.gameuser.avatar = getInfo.idgetavatar(item.gameuser.avatar);
                // @ts-ignore
                item.record.Rating = fCompute.rate(item.record.score, item.record.fc);
                // @ts-ignore
                item.record.updated_at = fCompute.formatDate(item.record.updated_at);
                if (item.index == scoreRanklist.userRank) {
                    // @ts-ignore
                    item.isUser = true;
                }
            })
            // @ts-ignore
            data.ranklist = scoreRanklist;
            // @ts-ignore
            data.ranklist.selected = maxRank;
        } catch (err) {
            // @ts-ignore
            if (err?.message != APII18NCN.userNotFound) {
                logger.warn(`[phi-plugin] API错误 getScoreRanklistByUser`)
                logger.warn(err)
            }
        }
        try {
            const apFcCount = await makeRequest.getSongApFcCount({ songId });
            if (apFcCount) {

                for (let level of Level) {
                    if (!info.chart[level]) break;
                    const count = apFcCount[level];
                    if (!count || !count.total) continue;
                    data.scoreData[level].apFcCount = {
                        ap: count.apCount / count.total,
                        fc: count.fcCount / count.total,
                        total: count.total
                    };
                }

            }
        } catch (err) {
            logger.warn(`[phi-plugin] API错误 getSongApFcCount`)
            logger.warn(err)
        }
    }


    send.send_with_At(e, await altas.score(e, data, 1))

}

function cmpsugg() {
    /** 
     * @param {object & {suggest: string, difficulty: number}} a 
     * @param {object & {suggest: string, difficulty: number}} b 
     * @returns 
     */
    const tem = (a, b) => {
        /**
         * @param {number} difficulty 
         * @param {number} suggest 
         * @returns 
         */
        function com(difficulty, suggest) {
            return difficulty + Math.min(suggest - 98, 1) * Math.min(suggest - 98, 1) * difficulty * 0.089
        }
        let s_a = Number(a.suggest.replace("%", ''))
        let s_b = Number(b.suggest.replace("%", ''))
        return com(a.difficulty, s_a) - com(b.difficulty, s_b)
        // return (Number(a.suggest.replace("%", '')) - a.rks) - (Number(b.suggest.replace("%", '')) - b.rks)
    }
    return tem
}
