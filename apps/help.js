import Config from '../components/Config.js'
import send from '../model/send.js'
import picmodle from '../model/picmodle.js'
import getFile from '../model/getFile.js'
import path from 'path'
import { infoPath } from '../model/path.js'
import getBanGroup from '../model/getBanGroup.js';
import phiPluginBase from '../components/baseClass.js';
import getNotes from '../model/getNotes.js'
import getInfo from '../model/getInfo.js'

/**@import {botEvent} from '../components/baseClass.js' */

const helpGroup = await getFile.FileReader(path.join(infoPath, 'help.json'))
const apiHelp = await getFile.FileReader(path.join(infoPath, 'help', 'api.json'))


export class phihelp extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-help',
            dsc: 'phigros屁股肉帮助',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(命令|帮助|菜单|help|说明|功能|指令|使用说明)$`,
                    fnc: 'help'
                },
                {
                    reg: `^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getUserCfg('config', 'cmdhead')}))(\\s*)to?k(en)?(\\s*)(命令|帮助|菜单|help|说明|功能|指令|使用说明)$`,
                    fnc: 'tkhelp'
                },
                {
                    reg: `^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getUserCfg('config', 'cmdhead')}))(\\s*)api(\\s*)(命令|帮助|菜单|help|说明|功能|指令|使用说明)$`,
                    fnc: 'apihelp'
                }

            ]
        })

    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async help(e) {

        if (await getBanGroup.get(e, 'help')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let head = Config.getUserCfg('config', 'cmdhead')
        head = head.match(RegExp(head))[0]
        let pluginData = await getNotes.getNotesData(e.user_id)
        e.reply(await picmodle.help(e, {
            helpGroup: helpGroup,
            cmdHead: head || null,
            isMaster: e.isMaster,
            background: getInfo.getill(getInfo.illlist[Math.floor((Math.random() * (getInfo.illlist.length - 1)))]),
            theme: pluginData?.theme || 'star'
        }), true)
        return true
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async tkhelp(e) {

        if (await getBanGroup.get(e, 'tkhelp')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        send.send_with_At(e, `sessionToken有关帮助：\n【推荐】：扫码登录TapTap获取token\n指令：/${Config.getUserCfg('config', 'cmdhead')} bind qrcode\n【基础方法】https://www.kdocs.cn/l/catqcMM9UR5Y\n绑定sessionToken指令：\n/${Config.getUserCfg('config', 'cmdhead')} bind <sessionToken>`)
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async apihelp(e) {

        // if (await getBanGroup.get(e, 'apihelp')) {
        //     send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
        //     return false
        // }
        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, `这里没有连接查分平台哦！`)
            return false
        }

        let head = Config.getUserCfg('config', 'cmdhead')
        head = head.match(RegExp(head))[0]
        let pluginData = await getNotes.getNotesData(e.user_id)
        e.reply(await picmodle.help(e, {
            helpGroup: apiHelp,
            cmdHead: head || null,
            isMaster: e.isMaster,
            background: getInfo.getill(getInfo.illlist[Math.floor((Math.random() * (getInfo.illlist.length - 1)))]),
            theme: pluginData?.theme || 'star'
        }), true)
    }
}
