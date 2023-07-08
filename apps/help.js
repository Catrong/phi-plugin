import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'

await get.init()

export class phirks extends plugin {
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
                }

            ]
        })

    }

    /**暂行帮助 */
    async help(e) {
        await e.reply(`⌈phi-plugin 帮助⌋ (所有#均可用/代替,空格均可省略)\n` +
            `⌈#${Config.getDefOrConfig('config', 'cmdhead')} bind xxx⌋ ⌈#${Config.getDefOrConfig('config', 'cmdhead')} 绑定xxx⌋ 绑定sessionToken\n` +
            `⌈#${Config.getDefOrConfig('config', 'cmdhead')} unbind⌋ ⌈#${Config.getDefOrConfig('config', 'cmdhead')} 解绑⌋ 删除sessionToken和存档记录\n` +
            `⌈#${Config.getDefOrConfig('config', 'cmdhead')} update⌋ ⌈#${Config.getDefOrConfig('config', 'cmdhead')} 更新存档⌋ 更新数据\n` +
            `⌈#${Config.getDefOrConfig('config', 'cmdhead')} b19⌋ ⌈#${Config.getDefOrConfig('config', 'cmdhead')} rks⌋ 获取b19图\n` +
            `⌈#${Config.getDefOrConfig('config', 'cmdhead')} score⌋ ⌈#${Config.getDefOrConfig('config', 'cmdhead')} 单曲成绩⌋ 获取单曲成绩\n` +
            `⌈#${Config.getDefOrConfig('config', 'cmdhead')} suggest⌋ ⌈#${Config.getDefOrConfig('config', 'cmdhead')} 推分⌋ 获取推分建议\n` +
            `⌈#${Config.getDefOrConfig('config', 'cmdhead')} 曲 xx⌋ ⌈#${Config.getDefOrConfig('config', 'cmdhead')} song xx⌋ 获取曲目图鉴\n` +
            `⌈#${Config.getDefOrConfig('config', 'cmdhead')} ill xxx⌋ ⌈#${Config.getDefOrConfig('config', 'cmdhead')} 曲绘 xxx⌋ 查看曲目曲绘\n` +
            `⌈#${Config.getDefOrConfig('config', 'cmdhead')} guess⌋ 开始猜曲绘，回答直接发送，⌈#答案⌋ 结束`)
        return true
    }
}