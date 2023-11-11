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
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(绑定|bind).*$`,
                    fnc: 'bind'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(更新存档|update)$`,
                    fnc: 'update'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(解绑|unbind)$`,
                    fnc: 'unbind'
                }
            ]
        })

    }

    async bind(e) {

        if (e.isGroup) {
            if (!Config.getDefOrConfig('config', 'isGuild')) {

                send.send_with_At(e, `\n请注意保护好自己的sessionToken哦！`, false, { recallMsg: 10 })
                // return true
            }
        }

        var sessionToken = e.msg.replace(/(#|\/)(.*)(绑定|bind)(\s*)/g, '')
        sessionToken = sessionToken.replace(" ", '')
        sessionToken = sessionToken.replace(/[\<\>]/g, '')


        if (!sessionToken) {
            send.send_with_At(e, `喂喂喂！你还没输入sessionToken呐！请将 <sessionToken> 替换为你Phigros账号的sessionToken哦！\n帮助：/${Config.getDefOrConfig('config', 'cmdhead')} tk help\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
            return true
        }

        if (!Config.getDefOrConfig('config', 'isGuild')) {

            e.reply("正在绑定，请稍等一下哦！\n >_<", false, { recallMsg: 5 })
            // return true
        }

        var User = await get.getsave(e.user_id)
        if (User) {
            if (User.session) {
                if (User.session == sessionToken) {
                    send.send_with_At(e, `你已经绑定了该sessionToken哦！将自动执行update...\n如果需要删除统计记录请 ⌈/${Config.getDefOrConfig('config', 'cmdhead')} unbind⌋ 进行解绑哦！`)
                } else {
                    send.send_with_At(e, `检测到新的sessionToken，将自动删除之前的存档记录……`)

                    await get.delsave(e.user_id)
                    var pluginData = await get.getpluginData(e.user_id, true)

                    pluginData.rks = []
                    pluginData.data = []
                    pluginData.dan = []
                    pluginData.scoreHistory = {}
                    if (pluginData.plugin_data)
                        pluginData.plugin_data.task = []
                        pluginData.plugin_data.CLGMOD = []
                    await get.putpluginData(e.user_id, pluginData)
                }
            }
        }

        await this.build(e, sessionToken)


        return true
    }

    async update(e) {
        var User = await get.getData(`${e.user_id}.json`, `${get.userPath}`)
        if (!User) {
            e.reply(`没有找到你的存档哦！请先绑定sessionToken！\n帮助：/${Config.getDefOrConfig('config', 'cmdhead')} tk help\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`, true)
            return true
        }

        if (!Config.getDefOrConfig('config', 'isGuild') || !e.isGroup) {
            e.reply("正在更新，请稍等一下哦！\n >_<", true, { recallMsg: 5 })
        }
        await this.build(e, User.session)

        return true
    }

    /**保存PhigrosUser */
    async build(e, sessionToken) {
        try {
            var User = new PhigrosUser(sessionToken)

        } catch (err) {
            logger.error(`[phi-plugin]绑定sessionToken错误 ${sessionToken}`)
            send.send_with_At(e, `绑定sessionToken错误QAQ!\n错误的sstk:${sessionToken}\n帮助：/${Config.getDefOrConfig('config', 'cmdhead')} tk help\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
            return true
        }

        if (await get.buildingRecord(e, User)) {
            return true
        }

        /**图片 */

        /**新增曲目成绩 */
        var common_update = {}
        /**时间线 */
        var time_line = []
        /**每个时间有多少份 */
        var update_num = []

        var now = new Save(User)
        var pluginData = await get.getpluginData(e.user_id)

        for (var song in pluginData.scoreHistory) {
            var tem = pluginData.scoreHistory[song]
            for (var level in tem) {
                var history = tem[level]
                for (var i in history) {
                    var score_date = date_to_string(scoreHistory.date(history[i]))
                    var score = scoreHistory.extend(song, level, history[i], history[i - 1])
                    if (!common_update[score_date]) {
                        common_update[score_date] = []
                    }
                    if (!update_num[score_date]) {
                        update_num[score_date] = 0
                    }
                    ++update_num[score_date]
                    common_update[score_date].push(score)
                    if (!time_line.includes(score_date)) {
                        time_line.push(score_date)
                    }
                }
            }
        }

        var illlist = get.illlist

        time_line.sort((a, b) => new Date(b) - new Date(a))

        var newnum = common_update[date_to_string(now.saveInfo.updatedAt)] ? common_update[date_to_string(now.saveInfo.updatedAt)].length : 0
        var show = 0 //实际显示的数量
        var showdate = 0 //显示的天数

        for (var date in common_update) {

            common_update[date].sort((a, b) => { return b.rks_new - a.rks_new })

            common_update[date] = common_update[date].slice(0, 10)
            show += common_update[date].length
            ++showdate

        }

        while (showdate > Config.getDefOrConfig('config','HistoryScoreDate') || show > Config.getDefOrConfig('config','HistoryScoreNum')) {
            show -= common_update[time_line[time_line.length - 1]].length
            delete common_update[time_line[time_line.length - 1]]
            --showdate
            time_line.pop()
        }

        var data = {
            PlayerId: now.saveInfo.PlayerId,
            Rks: Number(now.saveInfo.summary.rankingScore).toFixed(4),
            Date: now.saveInfo.updatedAt,
            ChallengeMode: (now.saveInfo.summary.challengeModeRank - (now.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: now.saveInfo.summary.challengeModeRank % 100,
            background: get.getill(illlist[Math.floor((Math.random() * (illlist.length - 1)))]),
            update: common_update,
            update_num: update_num,
            time_line: time_line,
            update_ans: newnum ? `更新了${newnum}份成绩` : `未收集到新成绩`,
            Notes: pluginData.plugin_data ? pluginData.plugin_data.money : 0,
            show: show,
            tips: get.tips[Math.floor((Math.random() * (get.tips.length - 1)) + 1)],
            dan: await get.getDan(e.user_id),
        }

        var midqiu = false
        if (new Date().toString().includes('Sep 29 2023')) {
            midqiu = true
        }
        if (midqiu) {
            data.tips = `${pluginData.plugin_data ? (pluginData.plugin_data.sp_info || '') : ''}中秋节快乐嗷！`
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

        var e = this.e

        var msg = e.msg.replace(' ', '')

        if (msg == '确认') {
            if (get.delsave(e.user_id)) {

                var pluginData = await get.getpluginData(e.user_id, true)

                if (pluginData) {
                    pluginData.rks = []
                    pluginData.data = []
                    pluginData.scoreHistory = {}
                    if (pluginData.plugin_data)
                        pluginData.plugin_data.task = []
                        pluginData.plugin_data.CLGMOD = []
                    await get.putpluginData(e.user_id, pluginData)
                }

                send.send_with_At(e, '解绑成功')
            } else {
                send.send_with_At(e, '没有找到你的存档哦！')
            }
        } else {
            send.send_with_At(e, `取消成功！`)
        }
        this.finish('doUnbind', false)
    }

}


/**
 * 转换时间格式
 * @param {Date|string} date 时间
 * @returns 2020/10/8 10:08:08
 */
function date_to_string(date) {
    date = new Date(date)

    var month = (date.getMonth() + 1) < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1
    var day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate()

    return `${date.getFullYear()}/${month}/${day} ${date.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}`
}
