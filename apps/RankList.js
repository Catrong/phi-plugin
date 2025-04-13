import plugin from '../../../lib/plugins/plugin.js'
import Save from '../model/class/Save.js'
import fCompute from '../model/fCompute.js'
import getInfo from '../model/getInfo.js'
import getRksRank from '../model/getRksRank.js'
import getSave from '../model/getSave.js'
import send from '../model/send.js'
import picmodle from '../model/picmodle.js'
import Config from '../components/Config.js'
import getNotes from '../model/getNotes.js'
import PhigrosUser from '../lib/PhigrosUser.js'
import getBanGroup from '../model/getBanGroup.js';

export class phiRankList extends plugin {

    constructor() {
        super({
            name: 'phi-rankList',
            event: 'message',
            priority: 1000,
            dsc: 'phigros rks 排行榜',
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(排行榜|ranklist).*$`,
                    fnc: 'rankList'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(封神榜|godlist)$`,
                    fnc: 'godList'
                }
            ]

        })
    }

    async rankList(e) {

        if (await getBanGroup.get(e.group_id, 'rankList')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }
        let plugin_data = await getNotes.getPluginData(e.user_id)
        let data = {
            Title: "RankingScore排行榜",
            totDataNum: 0,
            BotNick: Bot.nickname,
            users: [],
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.plugin_data?.theme || 'star',
        }
        let msg = e.msg.match(/\d+/)

        let rankNum
        data.totDataNum = (await getRksRank.getAllRank()).length

        if (msg) {
            rankNum = Math.max(Math.min(msg[0], data.totDataNum), 1) - 1
        } else {
            let sessionToken = save.getSessionToken()
            rankNum = await getRksRank.getUserRank(sessionToken)
        }


        let list = await getRksRank.getRankUser(0, 10)
        for (let i = 0; i < 3; i++) {
            data.users.push(await makeLargeLine(await getSave.getSaveBySessionToken(list[i])))
            data.users[i].index = i
        }

        if (rankNum < 3) {
            data.users[rankNum].me = true

            for (let i = 3; i < 10; i++) {
                data.users.push(await makeSmallLine(await getSave.getSaveBySessionToken(list[i])))
                data.users[i].index = i
            }
        } else if (rankNum < 10) {
            for (let i = 3; i < rankNum; i++) {
                data.users.push(await makeSmallLine(await getSave.getSaveBySessionToken(list[i])))
                data.users[i].index = i
            }

            data.users.push(await makeLargeLine(await getSave.getSaveBySessionToken(list[rankNum])))
            data.users[rankNum].me = true
            data.users[rankNum].index = rankNum

            for (let i = rankNum + 1; i < 10; i++) {
                data.users.push(await makeSmallLine(await getSave.getSaveBySessionToken(list[i])))
                data.users[i].index = i
            }
        } else {
            for (let i = 3; i < 5; i++) {
                data.users.push(await makeSmallLine(await getSave.getSaveBySessionToken(list[i])))
                data.users[i].index = i
            }

            list = await getRksRank.getRankUser(rankNum - 3, rankNum + 4)
            for (let i = 0; i < 3; ++i) {
                data.users.push(await makeSmallLine(await getSave.getSaveBySessionToken(list[i])))
                data.users[5 + i].index = rankNum - 3 + i
            }

            data.users.push(await makeLargeLine(await getSave.getSaveBySessionToken(list[3])))
            data.users[8].me = true
            data.users[8].index = rankNum

            for (let i = 4; i < list.length; ++i) {
                data.users.push(await makeSmallLine(await getSave.getSaveBySessionToken(list[i])))
                data.users[5 + i].index = rankNum + i - 3
            }
        }
        send.send_with_At(e, await picmodle.common(e, 'rankingList', data))
    }

    async godList(e) {

        if (await getBanGroup.get(e.group_id, 'godList')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let list = await getSave.getGod()
        let plugin_data = await getNotes.getPluginData(e.user_id)
        let data = {
            Title: "封神榜",
            totDataNum: 0,
            BotNick: Bot.nickname,
            users: [],
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.plugin_data?.theme || 'star',
        }

        if (!list) {
            data.totDataNum = 0
            send.send_with_At(e, await picmodle.common(e, 'rankingList', data))
            return true
        }

        data.totDataNum = list.length

        for (let i = 0; i < list.length; i++) {
            try {
                let godRecord = new PhigrosUser(list[i].match(/[a-zA-Z0-9]{25}/)[0])
                await godRecord.buildRecord()
                let god = new Save(godRecord, true)
                await god.init()
                data.users.push(await makeLargeLine(god))
                data.users[data.users.length].index = i
            } catch (e) { }
        }
        send.send_with_At(e, await picmodle.common(e, 'rankingList', data))
    }
}

/**
 * 创建一个详细对象
 * @param {Save} save 
 */
async function makeLargeLine(save) {
    if (!save) {
        return {
            playerId: "无效用户"
        }
    }
    // console.info(save)
    let user = {
        backgroundurl: null,
        avatar: getInfo.idgetavatar(save.saveInfo.summary.avatar) || 'Introduction',
        playerId: fCompute.convertRichText(save.saveInfo.PlayerId),
        rks: save.saveInfo.summary.rankingScore,
        ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
        ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
        created: fCompute.formatDate(save.saveInfo.createdAt),
        updated: fCompute.formatDate(save.saveInfo.gameFile.updatedAt),
        selfIntro: fCompute.convertRichText(save?.gameuser?.selfIntro),
        b19: []
    }
    user.backgroundurl = await fCompute.getBackground(save?.gameuser?.background)
    let b19 = await save.getB19(19)
    if (b19?.phi?.score) {
        user.b19.push({ difficulty: b19.phi.difficulty, acc: b19.phi.acc, Rating: b19.phi.Rating })
    }
    for (let i = 0; i < b19.b19_list.length; i++) {
        user.b19.push({ difficulty: b19.b19_list[i].difficulty, acc: b19.b19_list[i].acc, Rating: b19.b19_list[i].Rating })
    }
    return user
}

/**
 * 创建一个简略对象
 * @param {Save} save 
 */
async function makeSmallLine(save) {
    // console.info(save)
    if (!save) {
        return {
            playerId: "无效用户"
        }
    }
    return {
        avatar: getInfo.idgetavatar(save.saveInfo.summary.avatar) || 'Introduction',
        playerId: fCompute.convertRichText(save.saveInfo.PlayerId),
        rks: save.saveInfo.summary.rankingScore,
        ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
        ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
        updated: fCompute.formatDate(save.saveInfo.gameFile.updatedAt),
    }
}