import Config from '../components/Config.js'
import getSave from "./getSave.js";
import Save from "./class/Save.js";
import getUpdateSave from "./getUpdateSave.js";
import logger from "../components/Logger.js";
import { canUseApi } from './apiPermission.js';
import platform from "../components/platform/index.js";

class send {

    /**
     * 普通回复，统一经过平台接口。
     * @param {*} e
     * @param {*} msg
     * @param {boolean} [quote=false]
     * @param {{}} [data={}]
     */
    async reply(e, msg, quote = false, data = {}) {
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
    async send_with_At(e, msg, quote = false, data = {}) {
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
    async getsave_result(e, ver = undefined, send = true) {

        let user_save = null
        let sessionToken = await getSave.get_user_token(e.user_id)
        const allowApi = await canUseApi(e)
        if (allowApi) {
            try {
                user_save = await getUpdateSave.getNewSaveFromApi(e)
                return user_save.save
            } catch (/**@type {any} */ err) {
                /**如果是没有绑定过就执行绑定 */
                if (err.message == '缺少 phigrosToken 参数') {
                    try {
                        if (!sessionToken) {
                            if (send) {
                                this.send_with_At(e, `请先绑定sessionToken哦！\n如果不知道自己的sessionToken可以尝试扫码绑定嗷！\n获取二维码：/${Config.getUserCfg('config', 'cmdhead')} bind qrcode\n帮助：/${Config.getUserCfg('config', 'cmdhead')} tk help\n格式：/${Config.getUserCfg('config', 'cmdhead')} bind <sessionToken>`)
                            }
                            return false
                        }

                        user_save = await getUpdateSave.getNewSaveFromApi(e, sessionToken)
                        return user_save.save
                    } catch (err) {
                        logger.warn(`[phi-plugin] API ERR`, err)
                    }
                }
            }
        }

        if (!sessionToken) {
            if (send) {
                this.send_with_At(e, `请先绑定sessionToken哦！\n如果不知道自己的sessionToken可以尝试扫码绑定嗷！\n获取二维码：/${Config.getUserCfg('config', 'cmdhead')} bind qrcode\n帮助：/${Config.getUserCfg('config', 'cmdhead')} tk help\n格式：/${Config.getUserCfg('config', 'cmdhead')} bind <sessionToken>`)
            }
            return false
        }

        user_save = (await getUpdateSave.getNewSaveFromLocal(e, sessionToken))?.save


        if (!user_save || (ver && (!user_save.Recordver || user_save.Recordver < ver))) {
            if (send) {
                this.send_with_At(e, `请先更新数据哦！\n格式：/${Config.getUserCfg('config', 'cmdhead')} update`)
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
    async pick_send(e, msg) {
        try {
            e = platform.wrapEvent(e)
            await platform.sendPrivate(e, msg)
            await platform.sleep(500)
        } catch (err) {
            logger.error(err)
            this.send_with_At(e, `转发失败QAQ！请尝试在私聊触发命令！`)
        }
    }

}

export default new send()
