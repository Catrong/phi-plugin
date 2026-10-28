import Config from '../../components/Config.js'
import { UserCredentials } from '../user/userCredentials.js';
import Save from "../save/Save.js";
import logger from "../../components/Logger.js";
import { canUseApi } from '../user/apiPermission.js';
import platform from "../../components/platform/index.js";
import { sendMessages } from "./messages.js";
import { sendMessage } from './message.js'

class send {

    /**
     * 普通回复，统一经过平台接口。
     * @param {*} e
     * @param {*} msg
     * @param {boolean} [quote=false]
     * @param {{}} [data={}]
     */
    static async reply(e, msg, quote = false, data = {}) {
        e = platform.wrapEvent(e)
        return platform.reply(e, msg, { quote, ...data })
    }

    /**
     * 私聊省略@
     * @param {*} e 
     * @param {*} msg 
     * @param {boolean} [quote=false] 是否引用回复
     * @param {{}} [data={}] recallMsg等
     */
    static async send_with_At(e, msg, quote = false, data = {}) {
        e = platform.wrapEvent(e)
        return platform.sendWithAt(e, msg, quote, data)
    }

    /**
     * 检查存档部分
     * @param {*} e 
     * @param {Number} [ver] 存档版本
     * @param {boolean} [send=true] 是否发送提示
     * @returns {Promise<Save|false>} 存档对象或false
     */
    static async getsave_result(e, ver = undefined, send = true) {

        let user_save = null
        const credentials = UserCredentials.fromEvent(e)
        let sessionToken = await credentials.getSessionToken()
        const allowApi = await canUseApi(e)
        if (allowApi) {
            try {
                user_save = await credentials.getUpdatedSaveFromApi()
                if (user_save) return user_save.save
            } catch (/**@type {any} */ err) {
                logger.warn(`[phi-plugin] getUpdatedSaveFromApi `, err)
            }
        }

        if (!sessionToken) {
            if (send) {
                await sendMessage(e, sendMessages.needSessionToken(), { at: true })
            }
            return false
        }

        user_save = (await credentials.getUpdatedSaveFromLocal(sessionToken))?.save


        if (!user_save || (ver && (!user_save.Recordver || user_save.Recordver < ver))) {
            if (send) {
                await sendMessage(e, sendMessages.needUpdate(), { at: true })
            }
            return false
        }

        return user_save
    }

    /**
     * 转发到私聊
     * @param {any} e 消息数组e
     * @param {any} msg 发送内容
     */
    static async pick_send(e, msg) {
        try {
            e = platform.wrapEvent(e)
            await platform.sendPrivate(e, msg)
            await platform.sleep(500)
        } catch (err) {
            logger.error(err)
            await sendMessage(e, sendMessages.forwardFailed, { at: true })
        }
    }

}

export default send
