import plugin from '../../../lib/plugins/plugin.js'
import get from '../model/getdata.js'
import { segment } from "oicq";

export class phirks extends plugin {
    constructor() {
        super({
            name: '屁股肉帮助',
            dsc: '屁股肉帮助',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: '^#(pgr|PGR|屁股肉|phi|Phi)(命令|帮助|菜单|help|说明|功能|指令|使用说明)$',
                    fnc: 'help'
                }
                
            ]
        })

    }

    /**暂行帮助 */
    async help(e) {
        await e.reply(await get.getimg('help'))
        return true
    }
}