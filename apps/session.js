
import plugin from '../../../lib/plugins/plugin.js'
import PhigrosUser from '../lib/PhigrosUser.js'
import get from '../model/getdata.js'
import common from "../../../lib/common/common.js"
import { segment } from 'oicq'
import Config from '../components/Config.js'

await get.init()

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
            await e.reply([segment.at(e.user_id), `\n`, "请注意保护好自己的sessionToken哦！"], false, { recallMsg: 10 })
            // return true
        }

        var sessionToken = e.msg.replace(/(#|\/)(.*)(绑定|bind)(\s*)/g, '')
        sessionToken.replace(" ", '')

        e.reply("正在绑定，请稍等一下哦！\n >_<", false, { recallMsg: 5 })

        if (await this.build(e, sessionToken))
            return true

        await e.reply([segment.at(e.user_id), `\n`, "绑定成功！"])
        return true
    }

    async update(e) {
        var User = await get.getData(`${e.user_id}.json`, `${get.userPath}`)
        if (!User) {
            e.reply('没有找到你的存档哦！请先 ⌈#phi bind⌋ 绑定sessionToken！', true)
            return true
        }
        e.reply("正在更新，请稍等一下哦！\n >_<", true, { recallMsg: 5 })

        if (await this.build(e, User.session))
            return true

        await e.reply("更新成功！", true)

        return true
    }

    /**保存PhigrosUser */
    async build(e, sessionToken) {
        try {
            this.User = new PhigrosUser(sessionToken)

        } catch (err) {
            logger.error("[phi-plugin]绑定sessionToken错误")
            await e.reply("绑定sessionToken错误QAQ!\n" + sessionToken)
            return true
        }

        if (await this.building())
            return true

        await get.setData(`${e.user_id}.json`, this.User, `${get.userPath}`)



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
            var t = await this.User.buildRecord()
        } catch (err) {
            this.e.reply("绑定失败！QAQ\n" + err)
            return true
        }
        if (t == 1) {
            /**获得多个存档 */
            let builder = []
            builder.push("发现多个存档，请发送 #[序号] 进行选择")
            var array = this.User.gameRecord
            for (let key in array) {
                let object = array[key];
                let str = `#${key}：\nobjectId：${object.objectId}\n创建时间：${object.createdAt}\n更新时间：${object.updatedAt}\nURL：${object.gameFile.url}`
                builder.push(str)
            }
            builder.push("示例 #1")

            logger.info("[phi-plugin]发现多个存档")
            console.info(builder)
            e.reply(common.makeForwardMsg(builder))

            this.setContext('choose')

            if (!this.choosenum)
                return true


            try {
                if (!this.User.chooseSave(this.choosenum)) {
                    logger.error(`[phi-plugin]未找到 ${this.choosenum} 号存档`)
                    this.e.reply(`没有找到 ${this.choosenum} 号存档哦！`)
                    return true
                }
                this.building()
            } catch (err) {
                logger.error(`[phi-plugin]绑定错误 ${err}`)
                this.e.reply(`出错啦！QAQ\n${err}`)
                return true
            }
        }
        return false
    }

    async unbind(e) {
        if (get.delData(`${e.user_id}.json`, get.userPath)) {
            e.reply('解绑成功', true)
        } else {
            e.reply('没有找到你的存档哦！', true)
        }
        return true
    }
}