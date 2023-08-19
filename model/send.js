import { segment } from "oicq";

class send {

    /**私聊省略@ */
    send_with_At(e, msg) {
        if (e.isGroup) {
            e.reply([segment.at(e.user_id), ` ${msg}`])
        } else {
            e.reply(msg)
        }
    }

}

export default new send()
