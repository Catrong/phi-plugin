import plugin from '../../../lib/plugins/plugin.js'
import PhigrosUser from '../lib/PhigrosUser.js'
import get from '../model/getdata.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import Save from '../model/class/Save.js'
import scoreHistory from '../model/class/scoreHistory.js'

const Level = ['EZ', 'HD', 'IN', 'AT', 'LEGACY']
export class phisstk extends plugin {
    constructor() {
        super({
            name: 'phi-sessionToken',
            dsc: 'sessionToken获取',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(绑定.*[0-9a-zA-Z]{25}|bind).*$`,
                    fnc: 'bind'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(更新存档|update)$`,
                    fnc: 'update'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(解绑|unbind)$`,
                    fnc: 'unbind'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(clean)$`,
                    fnc: 'clean'
                }
            ]
        })

    }

    async bind(e) {

        if (e.isGroup) {
            try {
                await e.recall()
            }
            catch {
                if (!Config.getDefOrConfig('config', 'isGuild')) {

                    send.send_with_At(e, `\n请注意保护好自己的sessionToken哦！`, false, { recallMsg: 10 })
                    // return true
                }
            }
        }

        let sessionToken = e.msg.replace(/[#/](.*)(绑定|bind)(\s*)/, "").match(/[0-9a-zA-Z]{25}/g)
        sessionToken = sessionToken ? sessionToken[0] : null


        if (!sessionToken) {
            send.send_with_At(e, `喂喂喂！你还没输入sessionToken呐！请将 <sessionToken> 替换为你Phigros账号的sessionToken哦！\n帮助：/${Config.getDefOrConfig('config', 'cmdhead')} tk help\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
            return true
        }

        if (!Config.getDefOrConfig('config', 'isGuild')) {

            e.reply("正在绑定，请稍等一下哦！\n >_<", false, { recallMsg: 5 })
            // return true
        }

        try {
            await this.build(e, sessionToken)
        } catch (error) {
            logger.error(error)
            send.send_with_At(e, `更新失败，请检查你的sessionToken是否正确！\n错误信息：${error}`)
        }

        return true
    }

    async update(e) {
        let User = await get.getData(`${e.user_id}.json`, `${get.userPath}`)
        if (!User) {
            e.reply(`没有找到你的存档哦！请先绑定sessionToken！\n帮助：/${Config.getDefOrConfig('config', 'cmdhead')} tk help\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`, true)
            return true
        }

        if (!Config.getDefOrConfig('config', 'isGuild') || !e.isGroup) {
            e.reply("正在更新，请稍等一下哦！\n >_<", true, { recallMsg: 5 })
        }
        try {
            await this.build(e, User.session)
        } catch (error) {
            logger.error(error)
            send.send_with_At(e, `更新失败，请检查你的sessionToken是否正确！\n错误信息：${error}`)
        }

        return true
    }

    /**保存PhigrosUser */
    async build(e, sessionToken) {
        try {
            var User = new PhigrosUser(sessionToken)
        } catch (err) {
            logger.error(`[phi-plugin]绑定sessionToken错误`, err)
            send.send_with_At(e, `绑定sessionToken错误QAQ!\n错误的sstk:${sessionToken}\n帮助：/${Config.getDefOrConfig('config', 'cmdhead')} tk help\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`, false, { recallMsg: 10 })
            return true
        }

        /**记录存档rks,note变化 */
        let added_rks_notes = await get.buildingRecord(e, User)
        if (!added_rks_notes) {
            return true
        }

        if (added_rks_notes[0]) added_rks_notes[0] = `${added_rks_notes[0] > 0 ? '+' : ''}${added_rks_notes[0].toFixed(4)}`
        if (added_rks_notes[1]) added_rks_notes[1] = `${added_rks_notes[1] > 0 ? '+' : ''}${added_rks_notes[1]}`


        /**图片 */

        /**标记数据中含有的时间 */
        let time_vis = {}

        /**总信息 */
        let tot_update = []


        let now = new Save(User)
        let pluginData = await get.getpluginData(e.user_id)

        const RecordErr = now.checkRecord()

        if (RecordErr) {
            send.send_with_At(e, '[测试功能，概率有误，暂时不清楚错误原因]\n请注意，你的存档可能存在一些问题：\n' + RecordErr)
        }


        for (let song in pluginData.scoreHistory) {
            let tem = pluginData.scoreHistory[song]
            for (let level in tem) {
                let history = tem[level]
                for (let i in history) {
                    let score_date = date_to_string(scoreHistory.date(history[i]))
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

        let illlist = get.illlist

        let newnum = tot_update[time_vis[date_to_string(now.saveInfo.updatedAt)]] ? tot_update[time_vis[date_to_string(now.saveInfo.updatedAt)]].song.length : 0

        tot_update.sort((a, b) => new Date(b.date) - new Date(a.date))

        /**实际显示的数量 */
        let show = 0
        /**每日显示上限 */
        const DayNum = Math.max(Config.getDefOrConfig('config', 'HistoryDayNum'), 2)
        /**显示日期上限 */
        const DateNum = Config.getDefOrConfig('config', 'HistoryScoreDate')
        /**总显示上限 */
        const TotNum = Config.getDefOrConfig('config', 'HistoryScoreNum')



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
        let task_time = date_to_string(pluginData?.plugin_data?.task_time)

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

        let data = {
            PlayerId: now.saveInfo.PlayerId,
            Rks: Number(now.saveInfo.summary.rankingScore).toFixed(4),
            Date: now.saveInfo.updatedAt,
            ChallengeMode: (now.saveInfo.summary.challengeModeRank - (now.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: now.saveInfo.summary.challengeModeRank % 100,
            background: get.getill(illlist[Math.floor((Math.random() * (illlist.length - 1)))]),
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
        }

        send.send_with_At(e, await get.getupdate(e, data))

        return false
    }



    async unbind(e) {
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
                    pluginData.rks = []
                    pluginData.data = []
                    pluginData.scoreHistory = {}
                    if (pluginData.plugin_data) {
                        pluginData.plugin_data.task = []
                        pluginData.plugin_data.CLGMOD = []
                    }
                    await get.putpluginData(e.user_id, pluginData)
                }
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
        this.setContext('doClean', false, 30)

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
    return num * 330 + 20 * num - 20
}
