import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import get from '../model/getdata.js'
import atlas from '../model/picmodle.js'
import getFile from '../model/getFile.js'
import path from 'path'
import { infoPath } from '../model/path.js'

const helpGroup = await getFile.FileReader(path.join(infoPath, 'help.json'))


export class phihelp extends plugin {
    constructor() {
        super({
            name: 'phi-help',
            dsc: 'phigros屁股肉帮助',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getDefOrConfig('config', 'cmdhead')}))(\\s*)(命令|帮助|菜单|help|说明|功能|指令|使用说明)$`,
                    fnc: 'help'
                },
                {
                    reg: `^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getDefOrConfig('config', 'cmdhead')}))(\\s*)to?k(en)?(\\s*)(命令|帮助|菜单|help|说明|功能|指令|使用说明)$`,
                    fnc: 'tkhelp'
                }

            ]
        })

    }
    async help(e) {
        let head = Config.getDefOrConfig('config', 'cmdhead')
        head = head.match(RegExp(head))[0]
        let pluginData = await get.getpluginData(e.user_id)
        e.reply(await atlas.help(e, {
            helpGroup: helpGroup,
            cmdHead: head || null,
            isMaster: e.isMaster,
            background: get.getill(get.illlist[Math.floor((Math.random() * (get.illlist.length - 1)))]),
            theme: pluginData?.plugin_data?.theme || 'star'
        }), true)
        return true
    }

    async tkhelp(e) {
        send.send_with_At(e, `sessionToken有关帮助：\n【推荐】：使用网页扫码登录TapTap获取token\nhttps://pgr.afkeru.top\n【基础方法】https://potent-cartwheel-e81.notion.site/Phigros-Bot-f154a4b0ea6446c28f62149587cd5f31\n绑定sessionToken指令：\n/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
    }
}
