import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'

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
                }

            ]
        })

    }

    /**暂行帮助 */
    async help(e) {
        await e.reply(`⌈phi-plugin 帮助⌋ (所有#均可用/代替,空格均可省略)\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>⌋ 绑定sessionToken\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} unbind⌋ 删除sessionToken和存档记录\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} update⌋ 更新数据\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} b19⌋ 获取b19图\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} best1-99⌋ 获取文字版rks，未指定默认b19\n` +          
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} score⌋ 获取单曲成绩\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} suggest⌋ 获取推分建议\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} song xx⌋ 获取曲目图鉴\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} rand <条件>⌋ 随机曲目\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} ill <曲名>⌋ 查看曲目曲绘\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} data⌋ 查询data数量\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} search <条件 值>⌋ 检索曲目，支持BPM 定数(dif) 物量(cmb)\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} letter⌋ 根据字母猜曲名，⌈#出...⌋ 开指定的字母，⌈#第n个...⌋ 进行回答，⌈#字母答案⌋ 获取答案\n` +
            `⌈/${Config.getDefOrConfig('config', 'cmdhead')} guess⌋ 开始猜曲绘，回答直接发送，⌈#答案⌋ 结束\n` +
            `---------------------\n` +
            `⌈sign/签到⌋ 每日签到获取Notes\n` +
            `⌈task/我的任务⌋ 查看自己的任务\n` +
            `⌈retask/刷新任务⌋ 刷新任务，需要花费20Notes`
        )
        return true
    }
}
