
import plugin from '../../../lib/plugins/plugin.js'
import PhigrosUser from '../lib/PhigrosUser.js'
import get from '../model/getdata.js'
import { segment } from 'oicq'
import Config from '../components/Config.js'

await get.init()
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

                await e.reply([segment.at(e.user_id), `\n`, "请注意保护好自己的sessionToken哦！"], false, { recallMsg: 10 })
                // return true
            }
        }

        var sessionToken = e.msg.replace(/(#|\/)(.*)(绑定|bind)(\s*)/g, '')
        sessionToken = sessionToken.replace(" ", '')

        if (!Config.getDefOrConfig('config', 'isGuild')) {

            e.reply("正在绑定，请稍等一下哦！\n >_<", false, { recallMsg: 5 })
            // return true
        }

        var User = await get.getsave(e.user_id)
        if (User) {
            if (User.session) {
                if (User.session == sessionToken) {
                    GuildSentAt(e, `你已经绑定了该sessionToken哦！将自动执行update...\n如果需要删除统计记录请 ⌈#${Config.getDefOrConfig('config', 'cmdhead')} unbind⌋ 进行解绑哦！`)
                }
            }
        }

        await this.build(e, sessionToken)


        return true
    }

    async update(e) {
        var User = await get.getData(`${e.user_id}.json`, `${get.userPath}`)
        if (!User) {
            e.reply(`没有找到你的存档哦！请先绑定sessionToken！\n#${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`, true)
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
            logger.error("[phi-plugin]绑定sessionToken错误")
            await e.reply(`绑定sessionToken错误QAQ!\n错误的sstk:${sessionToken}\n#${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
            return true
        }

        if (await this.building())
            return true

        try {
            await get.putsave(e.user_id, this.User)
        } catch (err) {
            e.reply(`保存存档失败！\n${err}`)
            return true
        }



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
            this.e.reply("绑定失败！QAQ\n" + err)
            return true
        }
        var old = await get.getsave(this.e.user_id)
        var pluginData = await get.getpluginData(this.e.user_id)

        if (!pluginData) {
            pluginData = {}
        }

        /**新增曲目成绩 */
        pluginData.update = []
        /**data历史记录 */
        if (!pluginData.data) {
            pluginData.data = []
        }
        /**rks历史记录 */
        if (!pluginData.rks) {
            pluginData.rks = []
        }

        var now = this.User
        var date = new Date()

        var illlist = []

        for (var song in now.gameRecord) {
            if (old && song in old.gameRecord) {
                for (var i in now['gameRecord'][song]) {
                    if (now['gameRecord'][song][i]) {
                        var nowRecord = now['gameRecord'][song][i]
                        var oldRecord = old['gameRecord'][song][i]
                        if (!oldRecord || (nowRecord.acc != oldRecord.acc) || (nowRecord.score != oldRecord.score)) {
                            illlist.push(get.getill(get.idgetsong(song, false)))
                            pluginData.update.push({
                                "song": song,
                                "rank": Level[i],
                                "illustration": get.getill(get.idgetsong(song, false)),
                                "rks_old": oldRecord.rks,
                                "rks_new": nowRecord.rks,
                                "acc_old": oldRecord.acc,
                                "acc_new": nowRecord.acc,
                                "score_old": oldRecord.score,
                                "score_new": nowRecord.score
                            })
                        }
                    }
                }
            } else {
                for (var i in now['gameRecord'][song]) {
                    if (now['gameRecord'][song][i]) {
                        illlist.push(get.getill(get.idgetsong(song, false)))
                        var nowRecord = now['gameRecord'][song][i]
                        pluginData.update.push({
                            "song": song,
                            "illustration": get.getill(get.idgetsong(song, false)),
                            "rank": Level[i],
                            "rks_old": 0,
                            "rks_new": nowRecord.rks,
                            "acc_old": 0,
                            "acc_new": nowRecord.acc,
                            "score_old": 0,
                            "score_new": nowRecord.score
                        })
                    }
                }
            }
        }

        pluginData.update.sort(cmp())
        pluginData.update = pluginData.update.slice(0, 15)

        pluginData.data.push({
            "date": date,
            "value": now.gameProgress.money
        })
        pluginData.rks.push({
            "date": date,
            "value": now.saveInfo.summary.rankingScore
        })

        get.putpluginData(this.e.user_id, pluginData)

        var data = {
            PlayerId: now.saveInfo.PlayerId,
            Rks: Number(now.saveInfo.summary.rankingScore).toFixed(4),
            Date: now.saveInfo.updatedAt,
            ChallengeMode: (now.saveInfo.summary.challengeModeRank - (now.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: now.saveInfo.summary.challengeModeRank % 100,
            background: illlist[Number((Math.random() * (illlist.length - 1)).toFixed(0))],
            update: pluginData.update,
        }
        await GuildSentAt(this.e, await get.getupdate(this.e, data))
        return false
    }

    async unbind(e) {
        if (get.delsave(e.user_id)) {
            get.delpluginData(e.user_id)
            GuildSentAt(e, '解绑成功')
        } else {
            GuildSentAt(e, '没有找到你的存档哦！')
        }
        return true
    }
}

/**如果为频道模式'@'不换行，否则换行 */
async function GuildSentAt(e, msg) {

    if (Config.getDefOrConfig('config', 'isGuild')) {
        /**频道模式'@'取消换行 */
        await e.reply([segment.at(e.user_id), msg])
    } else {
        await e.reply([segment.at(e.user_id), `\n`, msg])
    }
}


function cmp() {
    return function (a, b) {
        return (b.rks_new - b.rks_old) - (a.rks_new - a.rks_old)
    }
}