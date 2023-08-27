import { segment } from "oicq";
import Config from '../components/Config.js'
import get from "./getdata.js";

class send {

    /**私聊省略@ */
    send_with_At(e, msg) {
        if (e.isGroup) {
            if (typeof msg == 'string') {
                e.reply([segment.at(e.user_id), ` ${msg}`])
            } else {
                e.reply([segment.at(e.user_id), msg])
            }
        } else {
            e.reply(msg)
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
