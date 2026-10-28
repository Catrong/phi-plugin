import Config from '../components/Config.js'
import send from '../model/render/send.js'
import Save from '../model/save/Save.js'
import ScoreHistory from '../model/save/scoreHistory.js'
import getQRcode from '../lib/getQRcode.js'
import common from '../components/common.js'
import fCompute from '../model/game/fCompute.js'
import getBanGroup from '../model/user/getBanGroup.js';
import { allLevel, redisPath } from "../model/game/constNum.js"
import makeRequest from '../model/api/makeRequest.js'
import saveHistory from '../model/save/saveHistory.js'
import getNotes from '../model/user/getNotes.js'
import { APII18NCN } from '../model/game/constNum.js'
import phiPluginBase from '../components/baseClass.js'
import logger from '../components/Logger.js'
import segment from '../components/segment.js'
import getInfo from '../model/game/getInfo.js'
import picmodle from '../model/render/picmodle.js'
import { canUseApi } from '../model/user/apiPermission.js'
import platform, { redis } from '../components/platform/index.js'
import { UserCredentials } from '../model/user/userCredentials.js'
import { sendMessage } from '../model/render/message.js'
import { sessionMessages } from '../model/render/messages.js'

/**@import {botEvent} from '../components/baseClass.js' */

export class phisstk extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-sessionToken',
            dsc: 'sessionToken获取',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(cn|gb)?(绑定|bind).*$`,
                    fnc: 'bind'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(更新存档|update)$`,
                    fnc: 'update'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(解绑|unbind)$`,
                    fnc: 'unbind'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(clean)$`,
                    fnc: 'clean'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)session[tT]oken$`,
                    fnc: 'getSstk'
                }
            ]
        })

    }

    /**
     *
     * @param {botEvent} e
     * @returns
     */
    async bind(e) {

        const credentials = UserCredentials.fromEvent(e)

        if (await getBanGroup.get(e, 'bind')) {
            sendMessage(e, sessionMessages.bind.banned, { at: true })
            return false
        }

        let sessionToken =/**@type {phigrosToken} */ (e.msg.replace(/[#/](.*?)(cn|gb)?(绑定|bind)(\s*)/, "").match(/[0-9a-zA-Z]{25}|qrcode/g)?.[0])
        const useWhich = e.msg.match(/[#/](.*?)(cn|gb)?(绑定|bind)(\s*)/)?.[2]

        /** @type {boolean} */
        let isGlobal = useWhich ? useWhich === 'gb' : Config.getUserCfg('config', 'defaultGlobal');
        const allowApi = await canUseApi(e)
        let apiBindingSucceeded = false

        /**精简回复模式：仅发送二维码、绑定成功提示、成绩更新图与API不可用提示，避免官方Bot被动回复超出条数限制 */
        const simpleReply = Config.getUserCfg('config', 'SimpleBindReply')

        let localPhigrosToken = await credentials.getSessionToken()

        if (!sessionToken) {
            let apiId = e.msg.replace(/[#/](.*?)(绑定|bind)(\s*)/, "").match(/[0-9]+/g)?.[0]
            if (apiId && allowApi) {
                const result = await credentials.bindWithApiId(apiId)
                if (result?.apiUserId) {
                    let updateData = await credentials.getUpdatedSaveFromApi()
                    let history = await credentials.getCloudHistory(['data', 'rks', 'scoreHistory'])
                    if (updateData && history) await build(e, updateData, history, 'bind', { simpleReply, apiUserId: result.apiUserId })
                    else sendMessage(e, sessionMessages.bind.apiSaveUnavailable, { at: true })
                    return true
                }
                if (!result) {
                    sendMessage(e, sessionMessages.bind.apiUserNotFound(apiId || ''), { at: true })
                    return false
                }
            } else {
                if (apiId) {
                    sendMessage(e, sessionMessages.bind.apiUnavailable, { at: true })
                    return false
                }
            }
            if (!localPhigrosToken) {
                sendMessage(e, sessionMessages.bind.missingToken(), { at: true })
                return false
            }

        }

        if (sessionToken == "qrcode") {
            /**用户若已经触发且未绑定，则发送原来的二维码 */
            let key = `${redisPath}:qrcode:${e.user_id}`
            let timeOutKey = `${redisPath}:qrcodeTimeOut:${e.user_id}`
            let qrcode = await redis.get(key)
            if (qrcode) {
                let qrcodeTimeOut = await redis.ttl(timeOutKey)
                let recallTime = qrcodeTimeOut
                if (qrcodeTimeOut >= 60) recallTime = 60
                if (Config.getUserCfg('config', 'TapTapLoginQRcode')) {
                    await sendMessage(e, sessionMessages.bind.qrcodeImageHint(await getQRcode.getQRcode(qrcode), qrcodeTimeOut), { at: true, recallMsg: recallTime });
                } else {
                    await sendMessage(e, sessionMessages.bind.qrcodeLinkHint(qrcodeTimeOut, qrcode), { at: true, recallMsg: recallTime });
                }
                return
            }

            let request = await getQRcode.getRequest(isGlobal);
            let qrCodeMsg;
            if (Config.getUserCfg('config', 'TapTapLoginQRcode')) {
                qrCodeMsg = await sendMessage(e, sessionMessages.bind.qrcodeImageHint(await getQRcode.getQRcode(request.data.qrcode_url), request.data.expires_in), { at: true, recallMsg: 60 });
            } else {
                qrCodeMsg = await sendMessage(e, sessionMessages.bind.qrcodeLinkOnly(request.data.qrcode_url), { at: true, recallMsg: 60 });
            }
            let t1 = new Date().getTime();
            /**@type {any} */
            let result;
            /**是否发送过已扫描提示 */
            let flag = false;
            /**判断adapter是否为QQBot，如果是并且超时时间大于270秒则将超时时间改为270秒，以免被动消息回复超时**/
            let QRCodetimeout = request.data.expires_in
            if (fCompute.getAdapterName(e) === 'QQBot' && request.data.expires_in > 270) QRCodetimeout = 270
            /**利用redis的超时机制，设置一个生命与超时时间一致的键值作为倒计时器，不存储值仅提供倒计时 */
            await redis.set(timeOutKey, '1', { EX: QRCodetimeout })

            while (new Date().getTime() - t1 < QRCodetimeout * 1000) {
                result = await getQRcode.checkQRCodeResult(request, isGlobal);
                if (!flag) {
                    /**存储二维码链接，生命为3秒，以便在代码意外被终止再次触发时不会阻塞正常绑定 */
                    await redis.set(key, request.data.qrcode_url, { EX: 3 })
                }
                if (!result.success) {
                    if (result.data.error == "authorization_waiting" && !flag) {
                        if (!simpleReply) sendMessage(e, sessionMessages.bind.qrcodeScanned, { at: true, recallMsg: 10 });
                        platform.recall(e, qrCodeMsg)
                        flag = true;
                    }
                } else {
                    break
                }
                await common.sleep(2000)
            }

            redis.del(key) //绑定完成、超时后删除键值
            redis.del(timeOutKey)

            if (!result.success) {
                sendMessage(e, sessionMessages.bind.timeout, { at: true });
                return true
            }
            try {
                sessionToken = await getQRcode.getSessionToken(result, isGlobal);
            } catch (err) {
                logger.error(err)
                sendMessage(e, sessionMessages.bind.tokenFailed(err), { at: true })
                return true
            }
        }

        sessionToken = sessionToken || localPhigrosToken

        if (!simpleReply && !Config.getUserCfg('config', 'isGuild')) {

            sendMessage(e, sessionMessages.bind.binding, { recallMsg: 5 })
            // return true
        }

        if (allowApi) {
            try {

                let result = await credentials.bindWithSessionToken(sessionToken, isGlobal)
                if (result?.apiUserId) {
                    apiBindingSucceeded = true
                    let oldHistory = await credentials.getLocalHistory()
                    if (oldHistory) {
                        await credentials.uploadHistory(oldHistory)
                    }
                    let updateData = await credentials.getUpdatedSaveFromApi()
                    let history = await credentials.getCloudHistory(['data', 'rks', 'scoreHistory'])
                    if (updateData && history) await build(e, updateData, history, 'bind', { simpleReply, apiUserId: result.apiUserId })
                    else sendMessage(e, sessionMessages.bind.apiSaveUnavailable, { at: true })
                    return true
                }
                logger.warn('[phi-plugin] API绑定未完成，将改用当前 Bot 本地绑定')
            } catch (err) {
                logger.warn('[phi-plugin] API绑定异常，将仅更改本地绑定状态', err)
            }
        }



        try {
            let updateData = apiBindingSucceeded
                ? await credentials.getUpdatedSaveFromLocal(sessionToken, isGlobal)
                : await credentials.bindLocallyWithSessionToken(sessionToken, isGlobal)
            if (!updateData) return true;
            let history = await credentials.getLocalHistory()
            await build(e, updateData, history, 'bind', { simpleReply })
        } catch (error) {
            logger.error(error)
            sendMessage(e, sessionMessages.bind.updateFailed(error), { at: true })
        }

        return true
    }

    /**
     *
     * @param {botEvent} e
     * @returns
     */
    async update(e) {

        const credentials = UserCredentials.fromEvent(e)

        if (await getBanGroup.get(e, 'update')) {
            sendMessage(e, sessionMessages.update.banned, { at: true })
            return false
        }
        let updateData;
        let history;
        if (await canUseApi(e)) {
            try {

                if (!Config.getUserCfg('config', 'isGuild') || !e.isGroup) {
                    sendMessage(e, sessionMessages.update.updating, { quote: true, recallMsg: 5 })
                }

                updateData = await credentials.getUpdatedSaveFromApi()
                history = await credentials.getCloudHistory(['data', 'rks', 'scoreHistory'])
            } catch (/**@type {any} */ err) {
                if (err?.message != APII18NCN.userNotFound) {
                    makeRequest.handleApiError(e, err, {
                        errorPrefix: '从API获取存档失败，本次更新将使用本地数据QAQ！',
                        notifyUser: true,
                        logTag: 'API错误 update from api',
                        loggerLevel: 'warn'
                    })
                }
            }
        }
        if (!updateData || !history) {

            let session = await credentials.getSessionToken()
            if (!session) {
                sendMessage(e, sessionMessages.update.noSave(), { quote: true })
                return true
            }

            if (!Config.getUserCfg('config', 'isGuild') || !e.isGroup) {
                sendMessage(e, sessionMessages.update.updating, { quote: true, recallMsg: 5 })
            }

            try {
                updateData = await credentials.getUpdatedSaveFromLocal(session)
                if (!updateData) return true;
                history = await credentials.getLocalHistory()
            } catch (error) {
                logger.error(error)
                sendMessage(e, sessionMessages.update.tokenFailed(error), { at: true })
                return true
            }
        }

        try {
            await build(e, updateData, history, 'update')
        } catch (error) {
            logger.error(error)
            sendMessage(e, sessionMessages.update.failed(error), { at: true })
        }

        return true
    }


    /**
     * @param {botEvent} e
     */
    async unbind(e) {

        const credentials = UserCredentials.fromEvent(e)

        if (await getBanGroup.get(e, 'unbind')) {
            sendMessage(e, sessionMessages.unbind.banned, { at: true })
            return false
        }


        const { sessionToken, apiId } = await credentials.getLocalCredentials()
        if (!sessionToken && !apiId) {
            sendMessage(e, sessionMessages.unbind.noCredentials, { at: true })
            return false
        }

        this.setContext('doUnbind', false, 30, sessionMessages.unbind.timeout.text)

        sendMessage(e, sessionMessages.unbind.confirm, { at: true })

        return true
    }

    async doUnbind() {

        let e = this.e
        const credentials = UserCredentials.fromEvent(e)

        let msg = e.msg.replace(' ', '')

        if (msg == '确认') {
            let flag = true
            try {
                await credentials.unbindAndReport()
            } catch (/**@type {any} */err) {
                sendMessage(e, sessionMessages.unbind.failed(err), { at: true })
                logger.error(err)
                flag = false
            }
            if (flag) try {
                let pluginData = await getNotes.getNotesData(e.user_id)

                if (pluginData) {
                    if (pluginData) {
                        pluginData.task = []
                    }
                    getNotes.putNotesData(e.user_id, pluginData)
                }
            } catch (/**@type {any} */err) {
                sendMessage(e, sessionMessages.unbind.failed(err), { at: true })
                logger.error(err)
                flag = false
            }
            if (flag) {
                sendMessage(e, sessionMessages.unbind.success, { at: true })
            } else {
                sendMessage(e, sessionMessages.unbind.noSave, { at: true })
            }
        } else {
            sendMessage(e, sessionMessages.unbind.cancelled, { at: true })
        }
        this.finish('doUnbind', false)
    }

    /**
     *
     * @param {botEvent} e
     * @returns
     */
    async clean(e) {
        this.setContext('doClean', false, 30, sessionMessages.clean.timeout.text)

        sendMessage(e, sessionMessages.clean.confirm, { at: true })

        return true
    }

    async doClean() {

        let e = this.e
        const credentials = UserCredentials.fromEvent(e)

        let msg = e.msg.replace(' ', '')

        if (msg == '确认') {
            let flag = true
            try {
                await credentials.deleteLocalSave()
            } catch (/**@type {any} */err) {
                sendMessage(e, sessionMessages.clean.failed(err), { at: true })
                flag = false
            }
            try {
                getNotes.delNotesData(e.user_id)
            } catch (/**@type {any} */err) {
                sendMessage(e, sessionMessages.clean.failed(err), { at: true })
                flag = false
            }
            if (flag) {
                sendMessage(e, sessionMessages.clean.success, { at: true })
            }
        } else {
            sendMessage(e, sessionMessages.unbind.cancelled, { at: true })
        }
        this.finish('doClean', false)
    }

    /**
     *
     * @param {botEvent} e
     * @returns
     */
    async getSstk(e) {
        const credentialManager = UserCredentials.fromEvent(e)
        if (e.isGroup) {
            sendMessage(e, sessionMessages.getSstk.privateOnly, { at: true })
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            sendMessage(e, sessionMessages.getSstk.notBound, { at: true })
            return true
        }

        const credentials = await credentialManager.getLocalCredentials()
        sendMessage(e, sessionMessages.getSstk.tokenInfo({
            playerId: fCompute.convertRichText(save.saveInfo.PlayerId, true),
            sessionToken: credentials.sessionToken,
            objectId: save.saveInfo.objectId,
            userId: e.user_id,
            apiId: credentials.apiId || '未绑定',
        }), { at: true })

    }

}


/**
 * 定义一个函数，接受一个整数参数，返回它的十六进制形式
 * @param {number} num
 * @returns
 */
function toHex(num) {
    // 如果数字小于 16，就在前面补一个 0
    if (num < 16) {
        return "0" + num.toString(16);
    } else {
        return num.toString(16);
    }
}

// 定义一个函数，不接受参数，返回一个随机的背景色
function getRandomBgColor() {
    // 生成三个 0 到 200 之间的随机整数，分别代表红、绿、蓝分量
    let red = Math.floor(Math.random() * 201);
    let green = Math.floor(Math.random() * 201);
    let blue = Math.floor(Math.random() * 201);
    // 将三个分量转换为十六进制形式，然后拼接成一个 RGB 颜色代码
    let hexColor = "#" + toHex(red) + toHex(green) + toHex(blue);
    // 返回生成的颜色代码
    return hexColor;
}

/**
 * 计算/update宽度
 * @param {number} num
 */
function comWidth(num) {
    return num * 135 + 20 * num - 20
}

/**
 * 保存PhigrosUser
 * @param {botEvent} e
 * @param {{save:Save, added_rks_notes: number[]}} updateData
 * @param {saveHistory} history
 * @param {'bind'|'update'} buildKind 类型
 * @param {Object} [option={}]
 * @param {boolean} [option.simpleReply=false] 省略按钮
 * @param {string} [option.apiUserId] API绑定的用户ID
 */
async function build(e, updateData, history, buildKind, { simpleReply = false } = {}) {

    let { added_rks_notes, save } = updateData

    const displayAddedRksNotes = ['', ''];

    if (added_rks_notes[0]) displayAddedRksNotes[0] = `${added_rks_notes[0] > 0 ? '+' : ''}${added_rks_notes[0] >= 1e-4 ? added_rks_notes[0].toFixed(4) : ''}`
    if (added_rks_notes[1]) displayAddedRksNotes[1] = `${added_rks_notes[1] > 0 ? '+' : ''}${added_rks_notes[1]}`


    /**图片 */

    /**
     * 标记数据中含有的时间
     * @type {{[date:string]:number}}
     */
    let time_vis = {}

    /**历史记录的展示时区：来源时区缺失时用运行环境时区 */
    const historyTimezone = history?.getTimezone?.() ?? fCompute.timezoneOffset()

    /**
     * 总信息
     * @type {{date:string,
        * color:string,
        * update_num:number,
        * song:import('../model/save/scoreHistory.js').extendedScoreHistoryDetail[]
     * }[]}
     */
    let tot_update = []


    let now = save
    let pluginData = await getNotes.getNotesData(e.user_id)

    // const RecordErr = now.checkRecord()

    // if (RecordErr) {
    //     send.send_with_At(e, '[测试功能，概率有误，暂时不清楚错误原因]\n请注意，你的存档可能存在一些问题：\n' + RecordErr)
    // }
    for (let id of fCompute.objectKeys(history.scoreHistory)) {
        const tem = history.scoreHistory[id]
        for (let level of allLevel) {
            if (!tem[level]) continue
            /**v4 历史：dateValue 实例 */
            const levelRecords = ScoreHistory.toScoreDetails(tem[level])
            if (!levelRecords.length) continue
            for (let i = 0; i < levelRecords.length; i++) {
                let score_date = fCompute.formatDate(ScoreHistory.date(levelRecords[i]), undefined, historyTimezone)
                let score_info = ScoreHistory.extend(id, level, levelRecords[i], i ? levelRecords[i - 1] : undefined, 'low')
                if (time_vis[score_date] == undefined) {
                    time_vis[score_date] = tot_update.length
                    tot_update.push({ date: score_date, color: getRandomBgColor(), update_num: 0, song: [] })
                }
                ++tot_update[time_vis[score_date]].update_num
                tot_update[time_vis[score_date]].song.push(score_info)
            }
        }
    }

    let newnum = tot_update[time_vis[fCompute.formatDate(now.saveInfo.modifiedAt.iso, undefined, historyTimezone)]]?.update_num || 0

    tot_update.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    /**实际显示的数量 */
    let show = 0
    /**每日显示上限 */
    const DayNum = Math.max(Config.getUserCfg('config', 'HistoryDayNum'), 2)
    /**显示日期上限 */
    const DateNum = Config.getUserCfg('config', 'HistoryScoreDate')
    /**总显示上限 */
    const TotNum = Config.getUserCfg('config', 'HistoryScoreNum')



    for (let date = 0; date < tot_update.length; date++) {

        /**天数上限 */
        if (date >= DateNum || TotNum < show + Math.min(DayNum, tot_update[date].update_num)) {
            tot_update.splice(date, tot_update.length)
            break
        }

        /**预处理每日显示上限 */
        tot_update[date].song.sort((a, b) => { return (b.rks_new || 0) - (a.rks_new || 0) })

        tot_update[date].song = tot_update[date].song.slice(0, Math.min(DayNum, TotNum - show))


        /**总上限 */
        show += tot_update[date].song.length

    }

    /**
     * 预分行
     * @type {any[]}
     */
    let box_line = []

    /**循环中当前行的数量 */
    let line_num = 0


    line_num = 5
    let flag = false

    while (tot_update.length) {
        if (line_num == 5) {
            if (flag) {
                box_line.push([{ color: tot_update[0].color, song: tot_update[0].song.splice(0, 5) }])
            } else {
                box_line.push([{ date: tot_update[0].date, color: tot_update[0].color, song: tot_update[0].song.splice(0, 5) }])
            }
            let tem = box_line[box_line.length - 1]
            line_num = tem[tem.length - 1].song.length
        } else {
            let tem = box_line[box_line.length - 1]
            if (flag) {
                tem.push({ color: tot_update[0].color, song: tot_update[0].song.splice(0, 5 - line_num) })
            } else {
                tem.push({ date: tot_update[0].date, color: tot_update[0].color, song: tot_update[0].song.splice(0, 5 - line_num) })

            }
            line_num += tem[tem.length - 1].song.length
        }
        let tem = box_line[box_line.length - 1]
        tem[tem.length - 1].width = comWidth(tem[tem.length - 1].song.length)
        flag = true
        if (!tot_update[0].song.length) {
            tem[tem.length - 1].update_num = tot_update[0].update_num
            tot_update.shift()
            flag = false
        }
    }

    /**添加任务信息 */
    let task_data = pluginData?.task
    let task_time = fCompute.formatDate(pluginData?.task_time)

    /**添加曲绘 */
    if (task_data) {
        for (let i in task_data) {
            if (task_data[i]) {
                // @ts-ignore
                task_data[i].illustration = getInfo.getill(task_data[i].song, 'low', task_data[i].request.rank)
                if (task_data[i].request.type == 'acc') {
                    // @ts-ignore
                    task_data[i].request.value = task_data[i].request.value.toFixed(2) + '%'
                } else {
                    // @ts-ignore
                    task_data[i].request.value = task_data[i].request.value.toString().padStart(6, '0')
                }
                // @ts-ignore
                task_data[i].song = getInfo.idgetsong(task_data[i].song)
            }
        }
    }



    let { rks_history, rks_range, rks_date } = history.getRksLine()

    let data = {
        PlayerId: fCompute.convertRichText(now.saveInfo.PlayerId),
        Rks: Number(now.saveInfo.summary.rankingScore).toFixed(4),
        Date: fCompute.formatDate(now.saveInfo.summary.updatedAt),
        ChallengeMode: (now.saveInfo.summary.challengeModeRank - (now.saveInfo.summary.challengeModeRank % 100)) / 100,
        ChallengeModeRank: now.saveInfo.summary.challengeModeRank % 100,
        background: getInfo.getill(getInfo.illlist[Math.floor((Math.random() * (getInfo.illlist.length - 1)))], 'low'),
        box_line: box_line,
        update_ans: newnum ? `更新了${newnum}份成绩` : `未收集到新成绩`,
        Notes: pluginData?.money || 0,
        show: show,
        tips: getInfo.tips[Math.floor((Math.random() * (getInfo.tips.length - 1)) + 1)],
        task_data: task_data,
        task_time: task_time,
        // dan: await get.getDan(e.user_id),
        added_rks_notes: displayAddedRksNotes,
        theme: pluginData?.theme || 'star',
        rks_date: [fCompute.formatDate(rks_date[0], undefined, historyTimezone), fCompute.formatDate(rks_date[1], undefined, historyTimezone)],
        rks_history, rks_range,
    }

    const image = await picmodle.update(e, data);
    const playerId = fCompute.convertRichText(now.saveInfo.PlayerId, true);
    if (buildKind === 'bind') {
        sendMessage(e, sessionMessages.bind.bindSuccess(image, playerId), { at: true })
    } else if (buildKind === 'update') {
        sendMessage(e, sessionMessages.update.updateSuccess(image, playerId), { at: true })
    }

    return false
}
