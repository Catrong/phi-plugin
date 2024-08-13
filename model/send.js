import { segment } from "oicq";
import Config from '../components/Config.js'
import get from "./getdata.js";
import common from "../../../lib/common/common.js";
import getSave from "./getSave.js";
import Save from "./class/Save.js";

class send {

    /**
     * 私聊省略@
     * @param {*} e 
     * @param {*} msg 
     * @param {boolean} [quote=false] 是否引用回复
     * @param {{}} [data={}] recallMsg等
     */
    async send_with_At(e, msg, quote = false, data = {}) {
        if (e.isGroup) {
            if (typeof msg == 'string') {
                return e.reply([segment.at(e.user_id), ` ${msg}`], quote, data)
            } else if (Object.prototype.toString.call(msg) == '[object Array]') {
                return e.reply([segment.at(e.user_id), ...msg], quote, data)
            } else {
                return e.reply([segment.at(e.user_id), msg], quote, data)
            }
        } else {
            return e.reply(msg, quote, data)
        }
    }

    /**
     * 检查存档部分
     * @param {*} e 
     * @param {Number} ver 存档版本
     * @returns {Promise<Save>}
     * v1.0,取消对当次更新内容的存储，取消对task的记录，更正scoreHistory 
     * v1.1,更正scoreHistory
     * v1.2,由于曲名错误，删除所有记录，曲名使用id记录
     */
    async getsave_result(e, ver) {

        const sessionToken = await getSave.get_user_token(e.user_id)

        const user_save = await getSave.getSave(e.user_id)

        if (!sessionToken) {
            this.send_with_At(e, `请先绑定sessionToken哦！\n如果不知道自己的sessionToken可以尝试扫码绑定嗷！\n获取二维码：/${Config.getUserCfg('config', 'cmdhead')} bind qrcode\n帮助：/${Config.getUserCfg('config', 'cmdhead')} tk help\n格式：/${Config.getUserCfg('config', 'cmdhead')} bind <sessionToken>`)
            return false
        }

        if (!user_save || (ver && (!user_save.Recordver || user_save.Recordver < ver))) {
            this.send_with_At(e, `请先更新数据哦！\n格式：/${Config.getUserCfg('config', 'cmdhead')} update`)
            return false
        }

        return user_save
    }

    /**
     * 转发到私聊
     * @param {any} e 消息数组e
     * @param {any} msg 发送内容
     */
    async pick_send(e, msg) {
        try {
            await Bot.pickMember(e.group_id, e.user_id).sendMsg(msg)
            await common.sleep(500)
        } catch (err) {
            logger.error(err)
            this.send_with_At(e, `转发失败QAQ！请尝试在私聊触发命令！`)
        }
    }

}

export default new send()
