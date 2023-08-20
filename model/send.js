import { segment } from "oicq";

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

}

export default new send()
