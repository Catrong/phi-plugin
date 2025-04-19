import plugin from '../../../lib/plugins/plugin.js'
import PhigrosUser from '../lib/PhigrosUser.js'
import get from '../model/getdata.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import Save from '../model/class/Save.js'
import scoreHistory from '../model/class/scoreHistory.js'
import getSave from '../model/getSave.js'
import getQRcode from '../lib/getQRcode.js'
import common from '../../../lib/common/common.js'
import fCompute from '../model/fCompute.js'
import getBanGroup from '../model/getBanGroup.js';
import { redisPath } from "../model/constNum.js"


export class phisstk extends plugin {
    constructor() {
        super({
            name: 'phi-sessionToken',
            dsc: 'sessionToken获取',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(绑定|bind)(.*([0-9a-zA-Z]{25}|qrcode).*)?$`,
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
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(sessionToken)$`,
                    fnc: 'getSstk'
                }
            ]
        })

    }

    async bind(e) {

        if (await getBanGroup.get(e.group_id, 'bind')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let sessionToken = e.msg.replace(/[#/](.*?)(绑定|bind)(\s*)/, "").match(/[0-9a-zA-Z]{25}|qrcode/g)

        sessionToken = sessionToken ? sessionToken[0] : null

        if (!sessionToken) {
            send.send_with_At(e, `喂喂喂！你还没输入sessionToken呐！\n扫码绑定：/${Config.getUserCfg('config', 'cmdhead')} bind qrcode\n普通绑定：/${Config.getUserCfg('config', 'cmdhead')} bind <sessionToken>`)
            return false
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
                    await send.send_with_At(e, [`请先将TapTap更新至最新版或使用TapTap扫描二维码进行登录！请勿错扫他人二维码。请注意，登录TapTap可能造成账号及财产损失，请在信任Bot来源的情况下扫码登录。\n二维码剩余时间:${qrcodeTimeOut}`, segment.image(await getQRcode.getQRcode(qrcode))], false, { recallMsg: recallTime });
                } else {
                    await send.send_with_At(e, `请点击链接进行登录嗷！请勿使用他人的链接。请注意，登录TapTap可能造成账号及财产损失，请在信任Bot来源的情况下扫码登录。\n链接剩余时间:${qrcodeTimeOut}\n${qrcode}`, false, { recallMsg: recallTime });
                }
                return
            }

            let request = await getQRcode.getRequest();
            let qrCodeMsg;
            if (Config.getUserCfg('config', 'TapTapLoginQRcode')) {
                qrCodeMsg = await send.send_with_At(e, [`请扫描二维码进行登录！如只有一个设备请长按识别二维码登录嗷！请勿错扫他人二维码。请注意，登录TapTap可能造成账号及财产损失，请在信任Bot来源的情况下扫码登录。`, segment.image(await getQRcode.getQRcode(request.data.qrcode_url))], false, { recallMsg: 60 });
            } else {
                qrCodeMsg = await send.send_with_At(e, `请点击链接进行登录嗷！请勿使用他人的链接。请注意，登录TapTap可能造成账号及财产损失，请在信任Bot来源的情况下扫码登录。\n${request.data.qrcode_url}`, false, { recallMsg: 60 });
            }
            let t1 = new Date();
            let result;
            /**是否发送过已扫描提示 */
            let flag = false;
            /**判断adapter是否为QQBot，如果是并且超时时间大于270秒则将超时时间改为270秒，以免被动消息回复超时**/
            let QRCodetimeout = request.data.expires_in
            if (e.bot?.adapter?.name === 'QQBot' && request.data.expires_in > 270) QRCodetimeout = 270
            /**利用redis的超时机制，设置一个生命与超时时间一致的键值作为倒计时器，不存储值仅提供倒计时 */
            await redis.set(timeOutKey, '1', { EX: QRCodetimeout })

            while (new Date() - t1 < QRCodetimeout * 1000) {
                result = await getQRcode.checkQRCodeResult(request);
                if (!flag) {
                    /**存储二维码链接，生命为3秒，以便在代码意外被终止再次触发时不会阻塞正常绑定 */
                    await redis.set(key, request.data.qrcode_url, { EX: 3 })
                }
                if (!result.success) {
                    if (result.data.error == "authorization_waiting" && !flag) {
                        send.send_with_At(e, `登录二维码已扫描，请确认登录`, false, { recallMsg: 10 });
                        if (e.group?.recallMsg) {
                            e.group.recallMsg(qrCodeMsg.message_id)
                        } else if (e.friend?.recallMsg) {
                            e.friend.recallMsg(qrCodeMsg.message_id)
                        }
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
                send.send_with_At(e, `操作超时，请重试！`);
                return true
            }
            try {
                sessionToken = await getQRcode.getSessionToken(result);
            } catch (err) {
                logger.error(err)
                let errorMsg = err.message || err.toString();
                // 脱敏可能的 sessionToken
                errorMsg = errorMsg.replace(/[a-z0-9]{25}/g, '[数据删除]');
                send.send_with_At(e, `获取sessionToken失败QAQ！请确认您的Phigros已登录TapTap账号！\n错误信息：${err}`)
                return true
            }
        }

        send.send_with_At(e, `请注意保护好自己的sessionToken呐！如果需要获取已绑定的sessionToken可以私聊发送 /${Config.getUserCfg('config', 'cmdhead')} sessionToken 哦！`, false, { recallMsg: 10 })


        if (!Config.getUserCfg('config', 'isGuild')) {

            e.reply("正在绑定，请稍等一下哦！\n >_<", false, { recallMsg: 5 })
            // return true
        }

        try {
            await this.build(e, sessionToken);
        } catch (error) {
            logger.error(error);
            let errorMessage = error.message || error.toString();
            // 脱敏可能的 sessionToken
            errorMessage = errorMessage.replace(
                /[a-z0-9]{25}/g, 
                match => match === sessionToken ? '[数据删除]' : match
            );
            send.send_with_At(e, "绑定失败，请检查 sessionToken 是否正确！\n错误信息：${errorMessage}")
        }
    
        return true
    }

    async update(e) {

        if (await getBanGroup.get(e.group_id, 'update')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let session = await getSave.get_user_token(e.user_id)
        if (!session) {
            e.reply(`没有找到你的存档哦！请先绑定sessionToken！\n帮助：/${Config.getUserCfg('config', 'cmdhead')} tk help\n格式：/${Config.getUserCfg('config', 'cmdhead')} bind <sessionToken>`, true)
            return true
        }

        if (!Config.getUserCfg('config', 'isGuild') || !e.isGroup) {
            e.reply("正在更新，请稍等一下哦！\n >_<", true, { recallMsg: 5 })
        }
        try {
            await this.build(e, session)
        } catch (error) {
            logger.error(error)
            send.send_with_At(e, `更新失败，请检查你的sessionToken是否正确QAQ！\n错误信息：${error}`)
        }

        return true
    }

    /**保存PhigrosUser */
    async build(e, sessionToken) {
        let User
        try {
            User = new PhigrosUser(sessionToken)
        } catch (err) {
            logger.error(`[phi-plugin]绑定sessionToken错误`, err)
            send.send_with_At(e, `绑定sessionToken错误QAQ！\n错误的sstk:${sessionToken}\n帮助：/${Config.getUserCfg('config', 'cmdhead')} tk help\n格式：/${Config.getUserCfg('config', 'cmdhead')} bind <sessionToken>`, false, { recallMsg: 10 })
            return true
        }

        /**记录存档rks,note变化 */
        let added_rks_notes = await get.buildingRecord(e, User)
        if (!added_rks_notes) {
            return true
        }

        if (added_rks_notes[0]) added_rks_notes[0] = `${added_rks_notes[0] > 0 ? '+' : ''}${added_rks_notes[0] >= 1e-4 ? added_rks_notes[0].toFixed(4) : ''}`
        if (added_rks_notes[1]) added_rks_notes[1] = `${added_rks_notes[1] > 0 ? '+' : ''}${added_rks_notes[1]}`


        /**图片 */

        /**标记数据中含有的时间 */
        let time_vis = {}

        /**总信息 */
        let tot_update = []


        let now = new Save(User)
        let pluginData = await get.getpluginData(e.user_id)

        // const RecordErr = now.checkRecord()

        // if (RecordErr) {
        //     send.send_with_At(e, '[测试功能，概率有误，暂时不清楚错误原因]\n请注意，你的存档可能存在一些问题：\n' + RecordErr)
        // }

        for (let song in pluginData.scoreHistory) {
            let tem = pluginData.scoreHistory[song]
            for (let level in tem) {
                let history = tem[level]
                for (let i in history) {
                    let score_date = fCompute.date_to_string(scoreHistory.date(history[i]))
                    let score_info = scoreHistory.extend(song, level, history[i], history[i - 1])
                    if (time_vis[score_date] == undefined) {
                        time_vis[score_date] = tot_update.length
                        tot_update.push({ date: score_date, color: getRandomBgColor(), update_num: 0, song: [] })
                    }
                    ++tot_update[time_vis[score_date]].update_num
                    tot_update[time_vis[score_date]].song.push(score_info)
                }
            }
        }

        let newnum = tot_update[time_vis[fCompute.date_to_string(now.saveInfo.modifiedAt.iso)]]?.update_num || 0

        tot_update.sort((a, b) => new Date(b.date) - new Date(a.date))

        /**实际显示的数量 */
        let show = 0
        /**每日显示上限 */
        const DayNum = Math.max(Config.getUserCfg('config', 'HistoryDayNum'), 2)
        /**显示日期上限 */
        const DateNum = Config.getUserCfg('config', 'HistoryScoreDate')
        /**总显示上限 */
        const TotNum = Config.getUserCfg('config', 'HistoryScoreNum')



        for (let date in tot_update) {

            /**天数上限 */
            if (date >= DateNum || TotNum < show + Math.min(DayNum, tot_update[date].update_num)) {
                tot_update.splice(date, tot_update.length)
                break
            }

            /**预处理每日显示上限 */
            tot_update[date].song.sort((a, b) => { return b.rks_new - a.rks_new })

            tot_update[date].song = tot_update[date].song.slice(0, Math.min(DayNum, TotNum - show))


            /**总上限 */
            show += tot_update[date].song.length

        }

        /**预分行 */
        let box_line = []

        box_line[box_line.length - 1]

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
        let task_data = pluginData?.plugin_data?.task
        let task_time = fCompute.date_to_string(pluginData?.plugin_data?.task_time)

        /**添加曲绘 */
        if (task_data) {
            for (let i in task_data) {
                if (task_data[i]) {
                    task_data[i].illustration = get.getill(task_data[i].song)
                    if (task_data[i].request.type == 'acc') {
                        task_data[i].request.value = task_data[i].request.value.toFixed(2) + '%'
                        if (task_data[i].request.value.length < 6) {
                            task_data[i].request.value = '0' + task_data[i].request.value
                        }
                    }
                }
            }
        }



        let user_data = await getSave.getHistory(e.user_id)

        let { rks_history, data_history, rks_range, data_range, rks_date, data_date } = user_data.getRksAndDataLine()

        let data = {
            PlayerId: fCompute.convertRichText(now.saveInfo.PlayerId),
            Rks: Number(now.saveInfo.summary.rankingScore).toFixed(4),
            Date: now.saveInfo.summary.updatedAt,
            ChallengeMode: (now.saveInfo.summary.challengeModeRank - (now.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: now.saveInfo.summary.challengeModeRank % 100,
            background: get.getill(get.illlist[Math.floor((Math.random() * (get.illlist.length - 1)))]),
            box_line: box_line,
            update_ans: newnum ? `更新了${newnum}份成绩` : `未收集到新成绩`,
            Notes: pluginData.plugin_data ? pluginData.plugin_data.money : 0,
            show: show,
            tips: get.tips[Math.floor((Math.random() * (get.tips.length - 1)) + 1)],
            task_data: task_data,
            task_time: task_time,
            dan: await get.getDan(e.user_id),
            added_rks_notes: added_rks_notes,
            theme: pluginData?.plugin_data?.theme || 'star',
            rks_date: [fCompute.date_to_string(rks_date[0]), fCompute.date_to_string(rks_date[1])],
            rks_history, rks_range,
        }

        send.send_with_At(e, [`PlayerId: ${fCompute.convertRichText(now.saveInfo.PlayerId, true)}`, await get.getupdate(e, data)])

        return false
    }



    async unbind(e) {

        if (await getBanGroup.get(e.group_id, 'unbind')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }


        if (!getSave.get_user_token(e.user_id)) {
            send.send_with_At(e, '没有找到你的存档信息嗷！')
            return false
        }

        this.setContext('doUnbind', false, 30)

        send.send_with_At(e, '解绑会导致历史数据全部清空呐QAQ！真的要这么做吗？（确认/取消）')

        return true
    }

    async doUnbind() {

        let e = this.e

        let msg = e.msg.replace(' ', '')

        if (msg == '确认') {
            let flag = true
            try {
                get.delsave(e.user_id)
            } catch (err) {
                send.send_with_At(e, err)
                flag = false
            }
            try {
                let pluginData = await get.getpluginData(e.user_id, true)

                if (pluginData) {
                    delete pluginData.rks
                    delete pluginData.data
                    delete pluginData.scoreHistory
                    delete pluginData.dan
                    if (pluginData.plugin_data) {
                        pluginData.plugin_data.task = []
                        pluginData.plugin_data.CLGMOD = []
                    }
                    await get.putpluginData(e.user_id, pluginData)
                }
                getSave.del_user_token(e.user_id)
            } catch (err) {
                send.send_with_At(e, err)
                flag = false
            }
            if (flag) {
                send.send_with_At(e, '解绑成功')
            } else {
                send.send_with_At(e, '没有找到你的存档哦！')
            }
        } else {
            send.send_with_At(e, `取消成功！`)
        }
        this.finish('doUnbind', false)
    }


    async clean(e) {
        this.setContext('doClean', false, 30, '超时已取消，请注意 @Bot 进行回复哦！')

        send.send_with_At(e, '请注意，本操作将会删除Phi-Plugin关于您的所有信息QAQ！（确认/取消）')

        return true
    }

    async doClean() {

        let e = this.e

        let msg = e.msg.replace(' ', '')

        if (msg == '确认') {
            let flag = true
            try {
                get.delsave(e.user_id)
            } catch (err) {
                send.send_with_At(e, err)
                flag = false
            }
            try {
                get.delpluginData(e.user_id)
            } catch (err) {
                send.send_with_At(e, err)
                flag = false
            }
            if (flag) {
                send.send_with_At(e, '解绑成功')
            }
        } else {
            send.send_with_At(e, `取消成功！`)
        }
        this.finish('doClean', false)
    }
    async getSstk(e) {
        if (e.isGroup) {
            send.send_with_At(e, `请私聊使用嗷`)
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            send.send_with_At(e, `未绑定存档，请先绑定存档嗷！`)
            return true
        }

        send.send_with_At(e, `PlayerId: ${fCompute.convertRichText(save.saveInfo.PlayerId, true)}\nsessionToken: ${save.session}\nObjectId: ${save.saveInfo.objectId}\nQQId: ${e.user_id}`)

    }

}


// 定义一个函数，接受一个整数参数，返回它的十六进制形式
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

/**计算/update宽度 */
function comWidth(num) {
    return num * 135 + 20 * num - 20
}
