import plugin from '../../../lib/plugins/plugin.js'
import PhigrosUser from '../lib/PhigrosUser.js'
import get from '../model/getdata.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import Save from '../model/class/Save.js'


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
                }
            }
        }

        await this.build(e, sessionToken)


        return true
    }

    async update(e) {
        var User = await get.getData(`${e.user_id}.json`, `${get.userPath}`)
        if (!User) {
            e.reply(`没有找到你的存档哦！请先绑定sessionToken！\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`, true)
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
            this.User = new PhigrosUser(sessionToken)

        } catch (err) {
            logger.error(`[phi-plugin]绑定sessionToken错误 ${sessionToken}`)
            send.send_with_At(e, `绑定sessionToken错误QAQ!\n错误的sstk:${sessionToken}\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
            return true
        }

        if (await this.building())
            return true




        return false
    }

    async choose(e) {
        try {
            var num = Number(e.msg.replace(/(#|\/)/g, ''))
        } catch (err) {
            e.reply(`读取数字失败QAQ\n${err}`)
        }
        if (num % 1) {
            e.reply(`${num} 不是个数字吧！`)
            return true
        } else {
            this.choosenum = num
        }
        return false
    }

    async building() {

        try {
            await this.User.buildRecord()
        } catch (err) {
            send.send_with_At(this.e, "绑定失败！QAQ\n" + err)
            return true
        }
        var old = await get.getsave(this.e.user_id)
        var pluginData = await get.getpluginData(this.e.user_id, true)

        try {
            await get.putsave(this.e.user_id, this.User)
        } catch (err) {
            this.reply(`保存存档失败！\n${err}`)
            return true
        }




        if (!pluginData) {
            pluginData = {}
        }

        /**新增曲目成绩 */
        var common_update = []
        /**任务相关成绩 */
        var task_update = []

        /**取消对当次更新内容的存储 */
        if (pluginData.update) {
            delete pluginData.update
        }
        if (pluginData.task_update) {
            delete pluginData.task_update
        }
        /**data历史记录 */
        if (!pluginData.data) {
            pluginData.data = []
        }
        /**rks历史记录 */
        if (!pluginData.rks) {
            pluginData.rks = []
        }

        var now = new Save(this.User)
        var date = this.User.saveInfo.modifiedAt.iso

        var illlist = []

        for (var song in now.gameRecord) {
            illlist.push(get.getill(get.idgetsong(song, false)))
            if (old && song in old.gameRecord) {
                for (var i in now['gameRecord'][song]) {
                    if (now['gameRecord'][song][i]) {
                        var nowRecord = now['gameRecord'][song][i]
                        var oldRecord = old['gameRecord'][song][i]
                        if (oldRecord && ((nowRecord.acc != oldRecord.acc) || (nowRecord.score != oldRecord.score))) {
                            add_new_score(pluginData, common_update, task_update, Level[i], get.idgetsong(song, false), nowRecord, oldRecord)
                        } else if (!oldRecord) {
                            add_new_score(pluginData, common_update, task_update, Level[i], get.idgetsong(song, false), nowRecord)
                        }
                    }
                }
            } else {
                for (var i in now['gameRecord'][song]) {
                    if (now['gameRecord'][song][i]) {
                        var nowRecord = now['gameRecord'][song][i]
                        add_new_score(pluginData, common_update, task_update, Level[i], get.idgetsong(song, false), nowRecord)
                    }
                }
            }
        }

        var newnum = common_update.length + task_update.length

        common_update.sort(cmp())

        common_update = common_update.slice(0, 15)

        if (pluginData.data.length >= 2 && now.gameProgress.money == pluginData.data[pluginData.data.length - 2]['value']) {
            pluginData.data[pluginData.data.length - 1] = {
                "date": date,
                "value": now.gameProgress.money
            }
        } else {
            pluginData.data.push({
                "date": date,
                "value": now.gameProgress.money
            })
        }

        if (pluginData.rks.length >= 2 && now.saveInfo.summary.rankingScore == pluginData.rks[pluginData.rks.length - 2]['value']) {
            pluginData.rks[pluginData.rks.length - 1] = {
                "date": date,
                "value": now.saveInfo.summary.rankingScore
            }
        } else {
            pluginData.rks.push({
                "date": date,
                "value": now.saveInfo.summary.rankingScore
            })
        }

        get.putpluginData(this.e.user_id, pluginData)


        var data = {
            PlayerId: now.saveInfo.PlayerId,
            Rks: Number(now.saveInfo.summary.rankingScore).toFixed(4),
            Date: now.saveInfo.updatedAt,
            ChallengeMode: (now.saveInfo.summary.challengeModeRank - (now.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: now.saveInfo.summary.challengeModeRank % 100,
            background: illlist[Number((Math.random() * (illlist.length - 1)).toFixed(0))],
            update: common_update,
            task_update: task_update,
            update_ans: newnum ? `更新了${newnum}份成绩` : `未收集到新成绩`,
            Notes: pluginData.plugin_data ? pluginData.plugin_data.money : 0,
        }

        send.send_with_At(this.e, await get.getupdate(this.e, data))
        return false
    }

    async unbind(e) {
        if (get.delsave(e.user_id)) {

            var pluginData = await get.getpluginData(e.user_id, true)

            if (pluginData) {
                pluginData.rks = []
                pluginData.data = []
                if (pluginData.plugin_data)
                    pluginData.plugin_data.task = []
                await get.putpluginData(e.user_id, pluginData)
            }

            send.send_with_At(e, '解绑成功')
        } else {
            send.send_with_At(e, '没有找到你的存档哦！')
        }
        return true
    }
}


function cmp() {
    return function (a, b) {
        return b.rks_new - a.rks_new
        //return (b.rks_new - b.rks_old) - (a.rks_new - a.rks_old)
    }
}


/**
 * 处理新成绩
 * @param {Object} pluginData 
 * @param {Array} common_update 
 * @param {Array} task_update 
 * @param {EZ|HD|IN|AT|LEGACY} level 
 * @param {String} song 原曲名称
 * @param {Object} nowRecord 当前成绩
 * @param {Object} oldRecord 旧成绩
 */
function add_new_score(pluginData, common_update, task_update, level, song, nowRecord, oldRecord = { rks: 0, acc: 0, score: 0 }) {

    var task
    if (pluginData.plugin_data) {
        task = pluginData.plugin_data.task
    }
    if (task) {
        for (var i in task) {
            if (!task[i]) continue
            if (!task[i].finished && song == task[i].song && level == task[i].request.rank) {
                var isfinished = false
                var reward = 0
                switch (task[i].request.type) {
                    case 'acc': {
                        if (nowRecord.acc >= task[i].request.value) {
                            isfinished = true
                            pluginData.plugin_data.task[i].finished = true
                            pluginData.plugin_data.money += task[i].reward
                            reward = task[i].reward
                        }
                        break
                    }
                    case 'score': {
                        if (nowRecord.score >= task[i].request.value) {
                            isfinished = true
                            pluginData.plugin_data.task[i].finished = true
                            pluginData.plugin_data.money += task[i].reward
                            reward = task[i].reward
                        }
                        break
                    }
                }
                task_update.push({
                    "song": song,
                    "rank": level,
                    "illustration": get.getill(song),
                    "Rating": nowRecord.Rating,
                    "rks_old": oldRecord.rks,
                    "rks_new": nowRecord.rks,
                    "acc_old": oldRecord.acc,
                    "acc_new": nowRecord.acc,
                    "score_old": oldRecord.score,
                    "score_new": nowRecord.score,
                    "finished": isfinished,
                    "request": task[i].request.value,
                    "reward": reward,
                })
                return false
            }
        }

    }
    common_update.push({
        "song": song,
        "rank": level,
        "illustration": get.getill(song),
        "Rating": nowRecord.Rating,
        "rks_old": oldRecord.rks,
        "rks_new": nowRecord.rks,
        "acc_old": oldRecord.acc,
        "acc_new": nowRecord.acc,
        "score_old": oldRecord.score,
        "score_new": nowRecord.score
    })
    return false
}
