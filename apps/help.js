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
        var head = Config.getDefOrConfig('config', 'cmdhead')
        head.replace('|','或')
        await e.reply(`⌈phi-plugin 帮助⌋ (所有#均可用/代替,空格均可省略)\n` +
            `⌈/${head} bind <sessionToken>⌋ 绑定sessionToken\n` +
            `⌈/${head} unbind⌋ 删除sessionToken和存档记录\n` +
            `⌈/${head} update⌋ 更新数据\n` +
            `⌈/${head} b19⌋ 获取b19图\n` +
            `⌈/${head} best1-99⌋ 获取文字版rks，未指定默认b19\n` +          
            `⌈/${head} score⌋ 获取单曲成绩\n` +
            `⌈/${head} suggest⌋ 获取推分建议\n` +
            `⌈/${head} song xx⌋ 获取曲目图鉴\n` +
            `⌈/${head} rand <条件>⌋ 随机曲目\n` +
            `⌈/${head} ill <曲名>⌋ 查看曲目曲绘\n` +
            `⌈/${head} data⌋ 查询data数量\n` +
            `⌈/${head} search <条件 值>⌋ 检索曲目，支持BPM 定数(dif) 物量(cmb)\n` +
            `⌈/${head} letter⌋ 根据字母猜曲名，⌈#出...⌋ 开指定的字母，⌈#第n个...⌋ 进行回答，⌈#字母答案⌋ 获取答案\n` +
            `⌈/${head} guess⌋ 开始猜曲绘，回答直接发送，⌈#答案⌋ 结束\n` +
            `---------------------\n` +
            `⌈sign/签到⌋ 每日签到获取Notes\n` +
            `⌈task/我的任务⌋ 查看自己的任务\n` +
            `⌈retask/刷新任务⌋ 刷新任务，需要花费20Notes`
        )
        return true
    }
}
