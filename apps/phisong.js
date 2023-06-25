
import plugin from '../../../lib/plugins/plugin.js'
import get from '../model/getdata.js'
import common from "../../../lib/common/common.js"

await get.init()

export class phirks extends plugin {
    constructor() {
        super({
            name: 'phigros图鉴',
            dsc: 'phigros图鉴',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: '^[#/]phi(曲| song).*$',
                    fnc: 'serch'
                },
                {
                    reg: '^[#/]phi(设置别名| setnick).*$',
                    fnc: 'setnick'
                }
                // {
                //     reg: '^[#/]phi(\s*)(删除别名|delnick).*$',
                //     fnc: 'delnick'
                // }
            ]
        })

    }


    /**歌曲图鉴 */
    async serch(e) {
        let msg = e.msg.replace(/[#/]phi(\s*)(曲|song)(\s*)/g, "")
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
                e.reply(`找到了${songs.length}首歌曲！`, true)
                for (var i in songs) {
                    msgRes[i] = await get.getsongsinfo(e, songs[i])
                }
                e.reply(await common.makeForwardMsg(e, msgRes, ""))
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
        let msg = e.msg.replace(/#phi设置别名(\s*)/g, "")
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

}
