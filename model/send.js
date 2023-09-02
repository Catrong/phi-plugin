import { segment } from "oicq";
import Config from '../components/Config.js'
import get from "./getdata.js";

class send {

    /**
     * 私聊省略@
     * @param {*} e 
     * @param {*} msg 
     * @param {boolean} [quote=false] 是否引用回复
     * @param {{}} [data={}] recallMsg等
     */
    send_with_At(e, msg, quote = false, data = {}) {
        if (e.isGroup) {
            if (typeof msg == 'string') {
                e.reply([segment.at(e.user_id), ` ${msg}`], quote, data)
            } else {
                e.reply([segment.at(e.user_id), msg], quote, data)
            }
        } else {
            e.reply(msg, quote)
        }
    }

    /**
     * 检查存档部分
     * @param {*} e 
     * @param {Number} ver 存档版本
     */
    async getsave_result(e, ver) {

        const save = await get.getsave(e.user_id)

        if (!save) {
            this.send_with_At(e, `请先绑定sessionToken哦！\n/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
            return false
        }


        if (!save.Recordver || save.Recordver < ver) {
            this.send_with_At(e, `请先更新数据哦！\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} update`)
            return false
        }

        return save
    }

}

export default new send()
