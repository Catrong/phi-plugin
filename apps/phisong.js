
import plugin from '../../../lib/plugins/plugin.js'
import get from '../model/getdata.js'
import common from "../../../lib/common/common.js"
import Config from '../components/Config.js'

await get.init()

export class phirks extends plugin {
    constructor() {
        super({
            name: 'phi-图鉴',
            dsc: 'phigros图鉴',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(曲|song).*$`,
                    fnc: 'serch'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(设置别名|setnick).*$`,
                    fnc: 'setnick'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(删除别名|delnick).*$`,
                    fnc: 'delnick'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(曲绘|ill|Ill).*$`,
                    fnc: 'ill'
                },
                // {
                //     reg: `^[#/](${Config.getDefOrConfig('config','cmdhead')})(\\s*)(随机|rand)(1?)[0-9]?((\\s*)(AT|IN|HD|EZ)(\\s*))*$`,
                //     fnc: 'rand'
                // },
            ]
        })

    }


    /**歌曲图鉴 */
    async serch(e) {
        let msg = e.msg.replace(/[#/](.*)(曲|song)(\s*)/g, "")
        let songs = await get.songsnick(msg)
        if (songs[0]) {
            let msgRes

            if (!songs[1]) {
                songs = songs[0]
                // get.getsongsinfo(e, songs)
                msgRes = await get.getsongsinfo(e, songs)
                e.reply(msgRes)
            } else {
                msgRes = []
                for (var i in songs) {
                    msgRes[i] = await get.getsongsinfo(e, songs[i])
                }
                e.reply(await common.makeForwardMsg(e, msgRes, `找到了${songs.length}首歌曲！`))
            }
        } else {
            e.reply(`未找到${msg}的相关曲目信息QAQ`, true)
        }
        return true
    }

    /**设置别名 */
    async setnick(e) {
        if (!e.isMaster) {
            e.reply("只有主人可以设置别名哦！")
        }
        let msg = e.msg.replace(/#(.*)设置别名(\s*)/g, "")
        if (msg.includes("--->")) {
            msg = msg.replace(/(\s*)--->(\s*)/g, " ---> ")
            msg = msg.split(" ---> ")
        } else if (msg.includes("\n")) {
            msg = msg.split("\n")
        }
        if (msg[1]) {
            let mic = get.songsnick(msg[0])
            if (mic) {
                if (mic[1]) {
                    e.reply(`${msg[0]} 这个别名有多个匹配对象哦！试试用其他的名字吧！`)
                    return true
                }
            } else {
                e.reply(`输入有误哦！没有找到“${msg[0]}”这首曲子呢！`)
            }
            if (get.songsnick(msg[1]).includes(mic)) {
                /**已经添加过该别名 */
                e.reply(`${mic} 已经有 ${msg[1]} 这个别名了哦！`)
                return true
            } else {
                get.setnick(`${mic}`, `${msg[1]}`)
                e.reply("设置完成！")
            }
        } else {
            e.reply(`输入有误哦！请按照\n原名（或已有别名） ---> 别名\n的格式发送哦！`)
        }
        return true
    }

    async delnick(e) {
        var msg = e.msg.replace(/[#/](.*)(删除别名|delnick)(\s*)/g, '')
        var ans = Config.getConfig('nickconfig', msg)
        if (ans) {
            if (ans.length == 1) {
                Config.modifyarr('nickconfig', msg, ans[0], 'del', 'config')
                await e.reply("删除成功！")
            } else {
                this.nickConfig = ans
                this.nick = msg
                var Remsg = []
                Remsg.push("找到了多个别名！请发送 #序号 进行选择！")
                for (var i in ans) {
                    Remsg.push(`#${i}\n${ans[i]}`)
                }
                e.reply(common.makeForwardMsg(e, Remsg, "找到了多个结果！"))
                this.setContext('choosedelnick', true)

            }
        } else {
            await e.reply(`未找到 ${msg} 所对应的别名哦！`)
        }
        return true
    }

    async choosesdelnick(e) {
        var msg = e.msg.replace(/[#/](\s*)/g, '')
        if (this.nickConfig.indexOf(msg) != -1) {
            Config.modifyarr('nickconfig', this.nick, msg, 'del', 'config')
            await e.reply("删除成功！")
        } else {
            e.reply(`未找到 ${msg} 所对应的别名哦！`)
        }
        return true
    }

    async ill(e) {
        let msg = e.msg.replace(/[#/](.*)(曲绘|ill|Ill)(\s*)/g, "")
        let songs = await get.songsnick(msg)
        if (songs[0]) {
            let msgRes

            if (!songs[1]) {
                songs = songs[0]
                msgRes = await get.getillatlas(e, { illustration: get.info[songs]["illustration_big"], illustrator: get.info[songs]["illustrator"] })
                e.reply(msgRes)
            } else {
                msgRes = []
                for (var i in songs) {
                    msgRes[i] = await get.getillatlas(e, { illustration: get.info[songs[i]]["illustration_big"], illustrator: get.info[songs[i]]["illustrator"] })
                }
                e.reply(await common.makeForwardMsg(e, msgRes, `找到了${songs.length}首歌曲！`))
            }
        } else {
            e.reply(`未找到${msg}的相关曲目信息QAQ`, true)
        }
        return true

    }

    async rand(e) {
        var msg = e.msg.replace()
    }

}
