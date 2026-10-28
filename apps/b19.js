import common from '../components/common.js'
import Config from '../components/Config.js';
import send from '../model/render/send.js';
import picmodle from '../model/render/picmodle.js'
import ScoreHistory from '../model/save/scoreHistory.js';
import fCompute from '../model/game/fCompute.js';
import getInfo from '../model/game/getInfo.js';
import { allLevel, ChallengeModeName, LevelNum } from '../model/game/constNum.js';
import getNotes from '../model/user/getNotes.js';
import getPic from '../model/render/getPic.js';
import getBanGroup from '../model/user/getBanGroup.js';
import makeRequest from '../model/api/makeRequest.js';
import { buildGameRecordPayload } from '../model/api/gameRecordPayload.js';
import phiPluginBase from '../components/baseClass.js';
import logger from '../components/Logger.js';
import LevelRecordInfo from '../model/game/LevelRecordInfo.js';
import SongsInfo from '../model/game/SongsInfo.js';
import Version from '../components/Version.js';
import { canUseApi } from '../model/user/apiPermission.js';
import { UserCredentials } from '../model/user/userCredentials.js';
import {
    buildRksHistogram,
    getB30AnalysisRecords,
} from '../model/game/b30Analysis.js';
import { sendMessage } from '../model/render/message.js'
import { b19Messages } from '../model/render/messages.js'
import dateValue from '../model/save/dateVaule.js';

/**@import {botEvent} from '../components/baseClass.js' */

/**@type {levelKind[]} */
const Level = ['EZ', 'HD', 'IN', 'AT'] //存档的难度映射

export class phib19 extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-b19',
            dsc: 'phigros b30查询',
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
                    reg: `^[#/杠刚钢纲](${Config.getUserCfg('config', 'cmdhead')})(\\s*)[a啊阿批屁劈]\\s*((b|B)[0-9]+|[比必币]([0-9]+|三零))$`,
                    fnc: 'arcgrosB19'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)lmtacc.*$`,
                    fnc: 'lmtAcc'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)越级.*$`,
                    fnc: 'overLevelB30'
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
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(achievement|ahv).*$`,
                    fnc: 'achievement'
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
        const credentials = UserCredentials.fromEvent(e)

        if (await getBanGroup.get(e, 'b19')) {
            sendMessage(e, b19Messages.banned, { at: true })
            return false
        }
        let save;
        let msg = e.msg

        let askOtherId = msg.match(/-id\s+([0-9]+)/i)
        msg = msg.replace(askOtherId?.[0] || '', '')

        if (askOtherId && await canUseApi(e)) {
            let otherId = /** @type {apiUserId} */ (askOtherId[1]);

            try {
                save = await credentials.getCloudSaveByApiId(otherId);
                if (!save) throw new Error('API未返回存档')
            } catch (err) {
                sendMessage(e, b19Messages.b19.otherSaveFailed(otherId, err), { at: true });
                return true;
            }
        } else {
            save = await send.getsave_result(e)
            if (!save) {
                return true
            }

        }

        let err = save.checkNoInfo()


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
            sendMessage(e, b19Messages.generating, { recallMsg: 5 })
        }


        let save_b19 = await save.getB19(e, nnum, { avgType: plugin_data.b30AvgKind, color: plugin_data.b30AvgColor })
        let stats = await save.getStats()

        let b30Analysis = null
        if (plugin_data.showB30Analysis !== false && nnum == 33) {
            const records = getB30AnalysisRecords(save_b19)
            const histogram = buildRksHistogram(records)
            const apiEnabled = await canUseApi(e, 'scoreStatistics')
            let tagAnalysis = null
            if (apiEnabled && records.length) {
                tagAnalysis = askOtherId
                    ? await makeRequest.getB30TagAnalysis(
                        { api_user_id: /** @type {apiUserId} */ (askOtherId[1]) },
                        { event: e },
                    )
                    : await makeRequest.getB30TagAnalysis(
                        { gameRecord: buildGameRecordPayload(save.gameRecord) },
                        { event: e },
                    )
            }
            b30Analysis = {
                histogram,
                tagAnalysis,
                showTags: apiEnabled,
                histogramWide: !apiEnabled,
            }
        }

        // 处理版本与rks变化
        const spInfo = [];

        let changed = {
            comRKS: save_b19.com_rks,
            saveRKS: save.saveInfo.summary.rankingScore,
            changedKind: '',
        }

        const saveVer = save.saveInfo.summary.gameVersion
        if (saveVer &&
            !isNaN(saveVer) &&
            saveVer != Number(Version.phigrosVerNum)) {
            if (saveVer < Number(Version.phigrosVerNum)) {
                spInfo.push(`${getInfo.versionInfoByCode[`${saveVer}`]?.version_label || saveVer} Update to ${Version.phigros}`)
                spInfo.push(`Real RKS: ${save_b19.com_rks.toFixed(4)}`)
                if (Math.abs(save_b19.com_rks - save.saveInfo.summary.rankingScore) > 1e-4) {
                    changed.changedKind = 'lower';
                }
            } else {
                spInfo.push(`${getInfo.versionInfoByCode[`${saveVer}`]?.version_label || saveVer} later than ${Version.phigros}`)
                if (Math.abs(save_b19.com_rks - save.saveInfo.summary.rankingScore) > 1e-4) {
                    changed.changedKind = 'higher';
                }
            }

        } else {
            if (Math.abs(save_b19.com_rks - save.saveInfo.summary.rankingScore) > 1e-4) {
                changed.changedKind = 'higher';
            }
        }


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
        }
        let data = {
            BSIllPath: getInfo.getill(/**@type {idString} */('BANGINGSTRIKE.DewPleiades.0'), 'common'),
            phi: save_b19.phi,
            b19_list: save_b19.b19_list,
            PlayerId: gameuser.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: fCompute.formatDate(save.saveInfo.summary.updatedAt),
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            background: bksong || getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.theme || 'star',
            gameuser,
            nnum,
            stats,
            spInfo,
            b30Analysis,
        }
        const img = await picmodle.b19(e, data)
        sendMessage(e, b19Messages.b19.finalMessage(img, err, changed), { at: true })
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async p30(e) {

        if (await getBanGroup.get(e, 'p30')) {
            sendMessage(e, b19Messages.banned, { at: true })
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }

        let match = e.msg.match(/^.*?(p|x|fc)\s*([0-9]+)/i)
        let nnum = Number(match?.[2] || 33)
        if (!nnum) {
            nnum = 33
        }

        nnum = Math.max(nnum, 33)
        nnum = Math.min(nnum, Config.getUserCfg('config', 'B19MaxNum'))

        let bksong = e.msg.replace(/^.*?(p|x|fc)\s*[0-9]+\s*/i, '')

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
            sendMessage(e, b19Messages.generating, { recallMsg: 5 })

        let save_b19;
        let spInfo = [];

        const type = e.msg.match(/^.*?(p|x|fc)\s*([0-9]+)/i)?.[1].toLowerCase();
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
        sendMessage(e, b19Messages.p30.finalMessage(await picmodle.b19(e, data), save_b19.com_rks, save.saveInfo.summary.rankingScore), { at: true })
    }

    /**
     * arc版查分图
     * @param {botEvent} e 
     * @returns 
     */
    async arcgrosB19(e) {

        if (await getBanGroup.get(e, 'arcgrosB19')) {
            sendMessage(e, b19Messages.banned, { at: true })
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }


        let err = save.checkNoInfo()


        let numMsg = e.msg.match(/(b|B)[0-9]*/g)
        let nnum = numMsg ? Number(numMsg[0].replace(/(b|B)/g, '')) - 1 : 32
        if (!nnum) { nnum = 32 }

        nnum = Math.max(nnum, 30)
        nnum = Math.min(nnum, Config.getUserCfg('config', 'B19MaxNum'))

        let save_b19 = await save.getB19(e, nnum)

        // 处理版本与rks变化
        const spInfo = [];

        let changed = {
            comRKS: save_b19.com_rks,
            saveRKS: save.saveInfo.summary.rankingScore,
            changedKind: '',
        }

        const saveVer = save.saveInfo.summary.gameVersion
        if (saveVer &&
            !isNaN(saveVer) &&
            saveVer != Number(Version.phigrosVerNum)) {
            if (saveVer < Number(Version.phigrosVerNum)) {
                spInfo.push(`${getInfo.versionInfoByCode[`${saveVer}`]?.version_label || saveVer} Update to ${Version.phigros}`)
                spInfo.push(`Real RKS: ${save_b19.com_rks.toFixed(4)}`)
                if (Math.abs(save_b19.com_rks - save.saveInfo.summary.rankingScore) > 1e-4) {
                    changed.changedKind = 'lower';
                }
            } else {
                spInfo.push(`${getInfo.versionInfoByCode[`${saveVer}`]?.version_label || saveVer} later than ${Version.phigros}`)
                if (Math.abs(save_b19.com_rks - save.saveInfo.summary.rankingScore) > 1e-4) {
                    changed.changedKind = 'higher';
                }
            }

        } else {
            if (Math.abs(save_b19.com_rks - save.saveInfo.summary.rankingScore) > 1e-4) {
                changed.changedKind = 'higher';
            }
        }

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

        sendMessage(e, b19Messages.b19.finalMessage(await picmodle.arcgros_b19(e, data), err, changed), { at: true })
    }

    /**
     * 限制最低acc后的rks
     * @param {botEvent} e 
     * @returns 
     */
    async lmtAcc(e) {
        if (await getBanGroup.get(e, 'lmtAcc')) {
            sendMessage(e, b19Messages.banned, { at: true })
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return false
        }


        let acc = Number(e.msg.replace(/^.*lmtacc\s*/g, ''))

        if (!acc || acc < 0 || acc > 100) {
            sendMessage(e, b19Messages.lmtAcc.invalidAcc(e.msg.replace(/^.*lmtacc\s*/g, '')), { at: true })
            return false
        }


        let nnum = 33

        let plugin_data = await getNotes.getNotesData(e.user_id)


        if (!Config.getUserCfg('config', 'isGuild'))
            sendMessage(e, b19Messages.generating, { recallMsg: 5 })

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

        sendMessage(e, b19Messages.p30.finalMessage(await picmodle.b19(e, data), save_b19.com_rks, save.saveInfo.summary.rankingScore), { at: true })

    }

    /**
     * 越级b30：仅保留"越级"成绩(acc低于 98.5%+1.5×(Dr[+Fk])占比)的bestN分表
     * @param {botEvent} e
     * @returns
     */
    async overLevelB30(e) {
        if (await getBanGroup.get(e, 'b19')) {
            sendMessage(e, b19Messages.banned, { at: true })
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return false
        }

        /**是否计入Flick */
        let withFlick = /(?:越级?\s*(?:b\s*)?[0-9]*\s*)(flick|fl|fk|划键|划)\s*$/i.test(e.msg)

        /**显示数量，默认30 */
        let nnum = Number(e.msg.match(/越级?\s*(?:b\s*)?([0-9]*)/i)?.[1])
        if (!nnum) {
            nnum = 30
        }
        nnum = Math.min(nnum, Config.getUserCfg('config', 'B19MaxNum'))

        /**预先合并曲目信息，避免逐条成绩查找时重复展开 */
        const allCharts = getInfo.ori_info

        /**越级判定：acc低于 98.5+1.5×(Dr[+Fk])/总物量 */
        let overLevelLimit = (/**@type {{id: idString, rank: allLevelKind, acc: number}}*/record) => {
            const chart = allCharts[record.id]?.chart?.[record.rank]
            if (!chart?.drag || !chart?.flick || !chart?.combo) {
                return false
            }
            const overLevelLine = fCompute.getOverLevelLine(chart.drag, chart.flick, chart.combo, withFlick)
            return record.acc < overLevelLine
        }

        let save_b19 = await save.getBestWithLimit(nnum, [{ type: 'custom', value: overLevelLimit }], false)

        if (!save_b19.b19_list.length) {
            sendMessage(e, b19Messages.overLevelB30.noOverLevel(withFlick), { at: true })
            return true
        }

        let plugin_data = await getNotes.getNotesData(e.user_id)

        if (!Config.getUserCfg('config', 'isGuild'))
            sendMessage(e, b19Messages.generating, { recallMsg: 5 })

        let stats = await save.getStats()

        /**越级线显示与配色，分段同推分建议 */
        for (let x of save_b19.b19_list) {
            const chart = allCharts[x.id]?.chart?.[x.rank]
            if (!chart?.drag || !chart?.flick || !chart?.combo) continue
            const overLevelLine = fCompute.getOverLevelLine(chart.drag, chart.flick, chart.combo, withFlick)

            x.suggest = overLevelLine.toFixed(2) + '%'
            if (overLevelLine < 98.5) {
                x.suggestType = 0
            } else if (overLevelLine < 99) {
                x.suggestType = 1
            } else if (overLevelLine < 99.5) {
                x.suggestType = 2
            } else if (overLevelLine < 99.7) {
                x.suggestType = 3
            } else if (overLevelLine < 99.85) {
                x.suggestType = 4
            } else {
                x.suggestType = 5
            }
        }

        let money = save.gameProgress.money
        let gameuser = {
            avatar: getInfo.idgetavatar(save.gameuser.avatar),
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save.saveInfo.summary.rankingScore,
            data: `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`,
            selfIntro: save.gameuser.selfIntro,
            backgroundUrl: await fCompute.getBackground(save.gameuser.background),
            PlayerId: fCompute.convertRichText(save.saveInfo.PlayerId),
        }

        let data = {
            b19_list: save_b19.b19_list,
            PlayerId: gameuser.PlayerId,
            Rks: save.saveInfo.summary.rankingScore.toFixed(4),
            Date: save.saveInfo.summary.updatedAt,
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.theme || 'star',
            gameuser,
            nnum,
            stats,
            spInfo: [`越级线=98.5+1.5×${withFlick ? '(Dr+Fk)' : 'Dr'}占比`],
        }

        let sum_rks = save_b19.b19_list.reduce((sum, x) => sum + Number(x?.rks || 0), 0)
        sendMessage(e, b19Messages.overLevelB30.finalMessage(
            await picmodle.b19(e, data),
            (sum_rks / save_b19.b19_list.length).toFixed(4),
            save.saveInfo.summary.rankingScore
        ), { at: true })

    }

    /**
     * 获取bestn文字版
     * @param {botEvent} e 
     * @returns 
     */
    async bestn(e) {

        if (await getBanGroup.get(e, 'bestn')) {
            sendMessage(e, b19Messages.banned, { at: true })
        }

        const save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        let numMsg = e.msg.replace(/[#/](.*?)(best)(\s*)/g, '')

        if (Number(numMsg) % 1 != 0) {
            await sendMessage(e, b19Messages.bestn.notNumber(numMsg), { quote: true })
            return true
        }

        let num = Number(numMsg)

        if (!num)
            num = 19 //未指定默认b19

        const { b19_list, phi } = await save.getB19(e, num)


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
            await sendMessage(e, b19Messages.bestn.finalMessage({ text: [Remsg[0], b19Messages.bestn.tooLong.text].join('') }), { at: true })
            send.pick_send(e, await common.makeForwardMsg(e, Remsg, undefined))
        } else {
            await sendMessage(e, b19Messages.bestn.finalMessage({ text: await common.makeForwardMsg(e, Remsg, undefined) }))
        }
    }


    /**
     * @param {botEvent} e 
     * @returns 
     */
    async singlescore(e) {

        if (await getBanGroup.get(e, 'singlescore')) {
            sendMessage(e, b19Messages.banned, { at: true })
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
            sendMessage(e, b19Messages.singlescore.specifySong(), { at: true })
            return true
        }
        const songIds = getInfo.fuzzysongsnick(song)
        if (!songIds[0]) {
            sendMessage(e, b19Messages.singlescore.songNotFound(song), { at: true })
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
            sendMessage(e, b19Messages.banned, { at: true })
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


        let rks = save.saveInfo.summary.rankingScore
        let gameRecord = save.gameRecord
        for (let id of fCompute.objectKeys(gameRecord)) {
            gameRecord[id] = gameRecord[id]
        }

        let info = getInfo.ori_info

        const { com_rks, phi } = await save.getB19(e, 1000, { avgType: "none" });

        /**@type {Record<idString, Record<levelKind, number>>} */
        const allTaskList = {};
        /**
         * @type {{ id: idString; level: levelKind; apCount: number; total: number; illustration: string }[]}
         */
        const phiTaskList = [];

        if (await canUseApi(e, 'scoreStatistics')) {

            const res = await makeRequest.getAllSongAccAvgB30({
                songIds: fCompute.objectKeys(getInfo.ori_info),
                minRks: Math.floor((com_rks - 0.05) / 0.05) * 0.05,
                maxRks: Math.floor((com_rks + 0.05) / 0.05) * 0.05
            }, { event: e })
            if (res) {
                const ids = fCompute.objectKeys(res)
                ids.forEach(id => {
                    if (!info[id]) {
                        return;
                    }
                    if (!allTaskList[id]) {
                        allTaskList[id] = /** @type {Record<levelKind, number>} */ ({});
                    }
                    Level.forEach(lv => {
                        if (!info[id]?.chart?.[lv]) {
                            return;
                        }
                        const avg = res[id][lv].accAvg || 0;
                        if (avg > (save.gameRecord?.[id]?.[LevelNum[lv]]?.acc || 0)) {
                            allTaskList[id][lv] = avg;
                        }
                    })
                })
            }
            const apfcRes = await makeRequest.getSongsApFcCount({
                songId: fCompute.objectKeys(getInfo.ori_info),
                rank: Level,
                rksRange: {
                    min: Math.floor((com_rks - 0.05) / 0.05) * 0.05,
                    max: Math.floor((com_rks + 0.05) / 0.05) * 0.05
                }
            }, { event: e })
            if (apfcRes) {
                const ids = fCompute.objectKeys(apfcRes);
                ids.forEach(id => {
                    if (!info[id]) {
                        return;
                    }
                    Level.forEach(lv => {
                        if (!info[id]?.chart?.[lv]) {
                            return;
                        }
                        const songInfo = info[id];
                        const diff = info[id].chart[lv].difficulty;
                        if (!(phi.length < 3 || diff > (phi[2]?.difficulty || 0))) {
                            return;
                        }
                        if ((save.gameRecord?.[id]?.[LevelNum[lv]]?.score || 0) >= 1e6) {
                            return;
                        }
                        if (apfcRes[id][lv].apCount > 0) {
                            phiTaskList.push({
                                id,
                                level: lv,
                                total: apfcRes[id][lv].total || 0,
                                // diff: diff,
                                apCount: apfcRes[id][lv].apCount || 0,
                                ...songInfo,
                                illustration: getInfo.getill(id, 'low', lv) ?? '',
                            });
                        }
                    })
                })
            }
        }



        /**
         * @type {({ suggest: number, avg: number } & { illustration: string, difficulty: number, rank: levelKind } & SongsInfo)[][]}
         */
        let data = [[], [], [], [], [], []]



        for (const id of fCompute.objectKeys(Record)) {
            const songInfo = getInfo.info(id);
            if (!songInfo) {
                logger.warn('[phi-plugin]', id, '曲目无信息')
                continue
            }
            /**
             * @type {(((LevelRecordInfo | {}) & { suggest?: number }) | null)[]}
             */
            let record = Record[id]
            for (let lv of [0, 1, 2, 3]) {
                if (!songInfo.chart[Level[lv]]) continue
                let difficulty = songInfo.chart[Level[lv]]?.difficulty
                if (!difficulty) continue
                if (range[0] <= difficulty && difficulty <= range[1] && isask[lv]) {
                    if ((!record[lv] && !scoreAsk.NEW)) continue
                    if (!record[lv]) {
                        record[lv] = { suggest: -1 };
                    } else {
                        if ('id' in record[lv] && !scoreAsk[record[lv].Rating == 'phi' ? 'PHI' : record[lv].Rating]) continue
                    }
                    const x = record[lv]
                    x.suggest = save.getSuggest(id, lv, undefined, difficulty)
                    if (x.suggest == -1) {
                        continue
                    }
                    data[suggestType(x.suggest)].push({
                        ...songInfo,
                        difficulty: difficulty,
                        ...x,
                        rank: Level[lv],
                        illustration: getInfo.getill(id, 'low', Level[lv]) ?? '',
                        suggest: x.suggest,
                        avg: allTaskList[id]?.[Level[lv]] || 0,
                    })
                }
            }
        }

        if (data.length > Config.getUserCfg('config', 'listScoreMaxNum')) {
            sendMessage(e, b19Messages.suggest.tooMany(data.length, Config.getUserCfg('config', 'listScoreMaxNum')), { at: true })
        }

        data.splice(Config.getUserCfg('config', 'listScoreMaxNum'))

        for (let i = 0; i < data.length; ++i) {
            data[i] = data[i].sort(cmpsugg()).slice(0, 3);
        }

        const phidata = phiTaskList.sort((a, b) => {
            return b.apCount - a.apCount
        }).slice(0, 3);

        let plugin_data = await getNotes.getNotesData(e.user_id)

        sendMessage(e, b19Messages.suggest.finalMessage({
            image: await picmodle.common(e, 'suggest', {
                head_title: "推分建议",
                song: data,
                phisong: phidata,
                background: getInfo.getill(getInfo.illlist[fCompute.randInt(0, getInfo.illlist.length - 1)]),
                theme: plugin_data?.theme || 'star',
                PlayerId: save.saveInfo.PlayerId,
                Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
                Date: save.saveInfo.summary.updatedAt,
                ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
                ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
                // dan: await get.getDan(e.user_id)
            })
        }), { at: true })

    }

    /**
     * 查询章节成绩
     * @param {botEvent} e 
     * @returns 
     */
    async chap(e) {

        if (await getBanGroup.get(e, 'chap')) {
            sendMessage(e, b19Messages.banned, { at: true })
            return false
        }
        let msg = e.msg.replace(/^[#/].*chap\s*/, '').toUpperCase()
        if (msg == 'HELP' || !msg) {
            sendMessage(e, b19Messages.chap.helpMessage(getPic.getimg('chapHelp')), { at: true })
            return true
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return false
        }

        let chap = fCompute.fuzzySearch(msg, getInfo.chapNick)[0]?.value

        if (!chap && msg != 'ALL') {
            sendMessage(e, b19Messages.chap.notFound(msg), { at: true })
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

        sendMessage(e, b19Messages.chap.finalMessage({
            image: await picmodle.chap(e, {
                player: { id: save.saveInfo.PlayerId },
                count,
                song_box,
                progress,
                num: rank.EZ,
                chapName: msg == 'ALL' ? 'AllSong' : chap,
                chapIll: getInfo.getChapIll(msg == 'ALL' ? 'AllSong' : chap),
            })
        }), { at: true })

    }

    /**
     * 
     * @param {botEvent} e 
     */
    async achievement(e) {
        if (await getBanGroup.get(e, 'achievement')) {
            sendMessage(e, b19Messages.banned, { at: true })
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return false
        }

        const difMatch = e.msg.match(/[0-9]+/)
        let dif = Number(difMatch?.[0])

        if (!difMatch) {
            sendMessage(e, b19Messages.achievement.specifyDifficulty(), { at: true, quote: true })
            return false
        }

        if (dif > getInfo.MAX_DIFFICULTY) {
            sendMessage(e, b19Messages.achievement.difficultyTooHigh(getInfo.MAX_DIFFICULTY), { at: true })
            return false
        }

        // 定数下限为 0（4.0.1 起存在 0.5 定数的谱面，向下取整为 0 级）

        let matchVersion = e.msg.match(/-v\s*(\S+)/i)?.[1];
        let matchVerCode = 0;
        if (matchVersion) {
            if (matchVersion.includes('.')) {
                if (!getInfo.versionInfoByLabel[matchVersion]) {
                    sendMessage(e, b19Messages.achievement.versionNotFound(matchVersion), { at: true })
                    return true
                }
                matchVerCode = getInfo.versionInfoByLabel[matchVersion].version_code
            } else {
                let verCodeNum = Number(matchVersion)
                if (!getInfo.versionInfoByCode[verCodeNum]) {
                    sendMessage(e, b19Messages.achievement.versionNotFound(matchVersion), { at: true })
                    return true
                }
                matchVerCode = verCodeNum
            }
        } else {
            matchVerCode = Version.phigrosVerNum
        }

        const versionInfo = getInfo.versionInfoByCode[matchVerCode]
        if (!versionInfo) {
            console.error(`[phi-plugin] 版本信息获取失败，versionCode: ${matchVerCode}`);
            sendMessage(e, b19Messages.achievement.unknownError, { at: true })
            return true
        }

        let pluginData = await getNotes.getNotesData(e.user_id)
        const data = {
            title: {
                difficulty: dif,
                total: 0,
                version: versionInfo.version_label,
                dec: "Player Achievements"
            },
            /**@type {{difficulty: string, songs: {rank: string, illustration: string}[], rating: ratingKind}[]} */
            table: [],
            background: getInfo.getill(getInfo.illlist[Math.floor((Math.random() * (getInfo.illlist.length - 1)))], 'blur'),
            theme: pluginData?.theme || 'star',
            gameuser: save.getPlayerInfo(),
        }

        const info_by_difficulty = getInfo.historyDifficultyByVerDifficulty[versionInfo.version_code];
        for (let i = 0; i < 10; ++i) {
            const difStr = Math.round((dif + i * 0.1) * 10) / 10;
            if (!info_by_difficulty[difStr.toFixed(1)]) continue;
            data.title.total += info_by_difficulty[difStr.toFixed(1)].length;
            let minScore = Infinity;
            let fcFlag = true;
            data.table.push({
                difficulty: difStr.toFixed(1),
                songs: info_by_difficulty[difStr.toFixed(1)]?.map(chart => {
                    const playerRecord = save.getScore(chart.id, chart.rank);
                    minScore = Math.min(minScore, playerRecord?.score || 0);
                    if (!playerRecord?.fc) {
                        fcFlag = false;
                    }
                    return ({
                        rank: chart.rank,
                        illustration: getInfo.getill(chart.id, 'low', chart.rank),
                        score: playerRecord?.acc || 0,
                    })
                }) || [],
                rating: fCompute.rate(minScore, fcFlag)
            })

        }

        sendMessage(e, b19Messages.achievement.finalMessage({ image: await picmodle.common(e, 'table', data) }), { at: true })
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

    const credentials = UserCredentials.fromEvent(e)

    const save = await send.getsave_result(e)

    if (!save) {
        return true
    }

    const info = getInfo.info(songId, true)
    if (!info) {
        sendMessage(e, b19Messages.getScore.infoNotFound(songId), { at: true })
        return true
    }

    /**获取成绩 */

    let Record = save.gameRecord
    let songRecord = Record[songId]

    if (!songRecord) {
        sendMessage(e, b19Messages.getScore.noRecord(info.song), { at: true })
        return true
    }

    // const dan = await get.getDan(e.user_id)

    /**获取历史成绩 */
    /**
     * @type {Partial<Record<allLevelKind, dateValue<scoreDetailV4> | dateValueJSON<scoreDetailV4>>> | undefined}
     */
    let HistoryData = undefined;
    /**历史成绩的展示时区：优先 API 记录方时区，其次本地历史来源时区，最后运行环境 */
    let historyTimezone = '';
    /**读取本地历史，并顺带补齐展示时区 */
    const readLocalSongHistory = async () => {
        const localHistory = await credentials.getLocalHistory()
        if (!historyTimezone) historyTimezone = localHistory?.getTimezone?.()
        return localHistory?.scoreHistory[songId]
    };
    if (await canUseApi(e)) {
        try {
            const cloudRecord = await credentials.getCloudSongHistory(songId)
            HistoryData = cloudRecord?.data
            historyTimezone = cloudRecord?.timezone ?? historyTimezone
            if (!HistoryData) HistoryData = await readLocalSongHistory()
        } catch (err) {
            logger.warn(`[phi-plugin] API ERR`, err)
            HistoryData = await readLocalSongHistory()
        }
    } else {
        HistoryData = await readLocalSongHistory()
    }
    historyTimezone = historyTimezone || fCompute.timezoneOffset()

    /** @type {(import('../model/save/scoreHistory.js').extendedScoreHistoryDetail | {date_new: string})[]} */
    let history = []

    if (HistoryData) {
        for (let i of allLevel) {
            if (!HistoryData[i]) continue
            /**v4 历史：dateValue 实例或 dateValueJSON */
            for (const item of ScoreHistory.toScoreDetails(HistoryData[i])) {
                const tem = ScoreHistory.extend(songId, i, item)
                /**按记录方时区校准展示时间 */
                history.push({ ...tem, date_new: fCompute.formatDate(tem.date_new, undefined, historyTimezone) })
            }
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
                data.scoreData[Level[i]].suggestType = suggestType(suggest)
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

    // 处理每个难度的P/B位
    const { phi, b19_list } = await save.getB19(e, 27, { avgType: 'none', allPhi: true })

    phi.forEach((item, index) => {
        if (item?.id == songId) {
            data.scoreData[item.rank].phiN = Math.min(3, index + 1);
        }
    });

    b19_list.forEach((item, index) => {
        if (item.id == songId) {
            data.scoreData[item.rank].b19N = Math.min(27, index + 1);
        }
    });


    maxRank = args?.dif || maxRank

    data.Rks = Number(save.saveInfo.summary.rankingScore).toFixed(4)

    if (!args?.unRank && await canUseApi(e)) {
        const credentials = UserCredentials.fromEvent(e)
        const scoreRanklist = await credentials.getScoreRanklistByUser(
            {
                songId,
                rank: maxRank || 'IN',
                orderBy: args?.orderBy || 'acc'
            },
            {
                ignoreUnboundError: true,
            }
        )
        if (scoreRanklist) {
            scoreRanklist.users.forEach((/** @type {any} */ item) => {
                // @ts-ignore
                item.gameuser.ChallengeMode = Math.floor(item.gameuser.challengeModeRank / 100);
                item.gameuser.ChallengeModeRank = item.gameuser.challengeModeRank % 100;
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
        }
        const apFcCount = await makeRequest.getSongApFcCount({ songId }, { event: e })
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
    }


    sendMessage(e, b19Messages.getScore.finalMessage({ image: await picmodle.score(e, data, 1) }), { at: true })

}

function cmpsugg() {
    /** 
     * @param {object & {suggest: number, difficulty: number, avg: number}} a 
     * @param {object & {suggest: number, difficulty: number, avg: number}} b 
     * @returns 
     */
    const tem = (a, b) => {
        /**
         * @param {number} difficulty 
         * @param {number} suggest 
         * @param {number} avg
         * @returns 
         */
        function com(difficulty, suggest, avg) {
            return difficulty * 100 * (suggest - avg);
        }
        let s_a = a.suggest
        let s_b = b.suggest
        return com(a.difficulty, s_a, a.avg) - com(b.difficulty, s_b, b.avg)
        // return (Number(a.suggest.replace("%", '')) - a.rks) - (Number(b.suggest.replace("%", '')) - b.rks)
    }
    return tem
}

/**
 * 
 * @param {number} suggest 
 * @returns 
 */
function suggestType(suggest) {

    if (suggest < 98.5) {
        return 0;
    } else if (suggest < 99) {
        return 1;
    } else if (suggest < 99.5) {
        return 2;
    } else if (suggest < 99.7) {
        return 3;
    } else if (suggest < 99.85) {
        return 4;
    } else {
        return 5;
    }
}
