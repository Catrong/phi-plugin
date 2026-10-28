import Config from '../components/Config.js'
import picmodle from '../model/render/picmodle.js'
import getFile from '../model/filesystem/getFile.js'
import path from 'path'
import { infoPath } from '../model/filesystem/path.js'
import getBanGroup from '../model/user/getBanGroup.js';
import phiPluginBase from '../components/baseClass.js';
import getNotes from '../model/user/getNotes.js'
import getInfo from '../model/game/getInfo.js'
import { getApiAccessState } from '../model/user/apiPermission.js'
import { sendMessage } from '../model/render/message.js'
import { helpMessages } from '../model/render/messages.js'

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
            sendMessage(e, helpMessages.help.banned, { at: true })
            return false
        }

        const head = Config.getUserCfg('config', 'cmdhead')
        const displayHead = head.match(RegExp(head))?.[0] || head
        let pluginData = await getNotes.getNotesData(e.user_id)
        sendMessage(e, helpMessages.help.finalMessage({
            image: await picmodle.help(e, {
                helpGroup: helpGroup,
                cmdHead: displayHead || null,
                isMaster: e.isMaster,
                background: getInfo.getill(getInfo.illlist[Math.floor((Math.random() * (getInfo.illlist.length - 1)))]),
                theme: pluginData?.theme || 'star'
            })
        }), { quote: true })
        return true
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async tkhelp(e) {

        if (await getBanGroup.get(e, 'tkhelp')) {
            sendMessage(e, helpMessages.tkhelp.banned, { at: true })
            return false
        }

        sendMessage(e, helpMessages.tkhelp.tokenHelp(), { at: true })
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
        const apiAccess = await getApiAccessState(e)
        if (!apiAccess.enabled) {
            sendMessage(e, !apiAccess.globalEnabled
                ? helpMessages.apihelp.notConnected
                : !apiAccess.capabilityEnabled
                    ? helpMessages.apihelp.capabilityDisabled
                    : helpMessages.apihelp.userDisabled, { at: true })
            return false
        }

        const head = Config.getUserCfg('config', 'cmdhead')
        const displayHead = head.match(RegExp(head))?.[0] || head
        let pluginData = await getNotes.getNotesData(e.user_id)
        sendMessage(e, helpMessages.apihelp.finalMessage({
            image: await picmodle.help(e, {
                helpGroup: apiHelp,
                cmdHead: displayHead || null,
                isMaster: e.isMaster,
                background: getInfo.getill(getInfo.illlist[Math.floor((Math.random() * (getInfo.illlist.length - 1)))]),
                theme: pluginData?.theme || 'star'
            })
        }), { quote: true })
    }
}
