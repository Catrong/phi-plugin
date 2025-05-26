import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import getFile from '../model/getFile.js'
import path from 'path'
import { infoPath } from '../model/path.js'
import makeRequest from '../model/makeRequest.js'

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
                }

            ]
        })

    }

    async setApiToken(e) {

        // if (await getBanGroup.get(e.group_id, 'setApiToken')) {
        //     send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
        //     return false
        // }

        let apiToken = e.msg.replace(/^[#/].*?setApiToken\s*/, '')
        try {
            await makeRequest.setApiToken(apiToken)
        } catch (err) {
            send.send_with_At(e, '设置 API Token 失败: ' + err.message)
            return false
        }

        send.send_with_At(e, 'API Token 已设置为: \n' + apiToken)

        return true
    }

}
