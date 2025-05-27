import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import getFile from '../model/getFile.js'
import path from 'path'
import { infoPath } from '../model/path.js'
import makeRequest from '../model/makeRequest.js'
import makeRequestFnc from '../model/makeRequestFnc.js'

const helpGroup = await getFile.FileReader(path.join(infoPath, 'help.json'))


export class phihelp extends plugin {
    constructor() {
        super({
            name: 'phi-api-set',
            dsc: 'phigrosApi相关指令',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})setApiToken.*$`,
                    fnc: 'setApiToken'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})tkls$`,
                    fnc: 'tokenList'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})auth.*$`,
                    fnc: 'auth'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})clearApiData$`,
                    fnc: 'clearApiData'
                },
            ]
        })

    }

    async setApiToken(e) {

        // if (await getBanGroup.get(e.group_id, 'setApiToken')) {
        //     send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
        //     return false
        // }

        if (!Config.getUserCfg('config', 'phiPluginApiUrl')) {
            send.send_with_At(e, '这里没有连接查分平台哦！')
            return false
        }

        let apiToken = e.msg.replace(/^[#/].*?setApiToken\s*/, '')
        if (/[\s\x00-\x1F\x7F'"\\]/.test(apiToken)) {
            send.send_with_At(e, 'API Token 包含非法字符，请检查后重试！')
            return false
        }
        try {
            await makeRequest.setApiToken({ ...makeRequestFnc.makePlatform(e), token_new: apiToken })
        } catch (err) {
            send.send_with_At(e, '设置 API Token 失败: ' + err.message)
            return false
        }

        send.send_with_At(e, 'API Token 已设置为: \n' + apiToken)

        return true
    }

    async tokenList(e) {
        // if (await getBanGroup.get(e.group_id, 'tokenList')) {
        //     send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
        //     return false
        // }

        if (!Config.getUserCfg('config', 'phiPluginApiUrl')) {
            send.send_with_At(e, '这里没有连接查分平台哦！')
            return false
        }
        let tokenList = null
        try {
            tokenList = await makeRequest.tokenList(makeRequestFnc.makePlatform(e))
        } catch (err) {
            send.send_with_At(e, '获取 Token 列表失败: ' + err.message)
            return false
        }

        let resMsg = `已绑定${tokenList.platform_data.length}个平台\n`

        tokenList.platform_data.forEach((item, index) => {
            resMsg += `${index + 1}.\n`
            resMsg += `平台: ${item.platform}\n`
            resMsg += `平台ID: ${item.platform_id}\n`
            resMsg += `创建时间: ${item.create_at}\n`
            resMsg += `更新时间: ${item.update_at}\n`
            resMsg += `权限: ${item.authentication}\n`
        })

        send.send_with_At(e, resMsg)


        return true
    }

    async auth(e) {

        // if (await getBanGroup.get(e.group_id, 'setApiToken')) {
        //     send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
        //     return false
        // }

        if (!Config.getUserCfg('config', 'phiPluginApiUrl')) {
            send.send_with_At(e, '这里没有连接查分平台哦！')
            return false
        }

        let apiToken = e.msg.replace(/^[#/].*?auth\s*/, '')
        if (/[\s\x00-\x1F\x7F'"\\]/.test(apiToken)) {
            send.send_with_At(e, 'API Token 包含非法字符，请检查后重试！')
            return false
        }
        try {
            await makeRequest.setApiToken({ ...makeRequestFnc.makePlatform(e), token_new: apiToken, token_old: apiToken })
        } catch (err) {
            send.send_with_At(e, 'API Token 验证失败: ' + err.message)
            return false
        }

        send.send_with_At(e, '验证成功')

        return true
    }

    async clearApiData(e) {
        // if (await getBanGroup.get(e.group_id, 'clearApiData')) {
        //     send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
        //     return false
        // }

        if (!Config.getUserCfg('config', 'phiPluginApiUrl')) {
            send.send_with_At(e, '这里没有连接查分平台哦！')
            return false
        }

        try {
            await makeRequest.clear({ ...makeRequestFnc.makePlatform(e) })
        } catch (err) {
            send.send_with_At(e, '清除数据失败: ' + err.message)
            return false
        }

        send.send_with_At(e, '数据已清除')

        return true
    }

}
