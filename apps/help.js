import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import get from '../model/getdata.js'

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

    /**暂行帮助 */
    async help(e) {
        let head = Config.getDefOrConfig('config', 'cmdhead')
        head = head.replace('|', '或')
        if (head) {
            //head += ' '
            e.reply([`命令头：⌈/${head}⌋`, get.getimg('help')], true)
        } else {
            e.reply(get.getimg('help'), true)
        }
        /**
        await e.reply(`⌈phi-plugin 帮助⌋ (所有/均可用#代替,空格均可省略)\n` +
            `⌈/${head}bind <sessionToken>⌋ 绑定sessionToken\n` +
            `⌈/${head}unbind⌋ 删除sessionToken和存档记录\n` +
            `⌈/${head}update⌋ 更新数据\n` +
            `⌈/${head}pgr⌋ 获取b19图\n` +
            `⌈/${head}info⌋ 获取个人信息统计\n` +
            `⌈/${head}lvsco(scolv) <定数> <难度（可选）>⌋ 获取范围成绩图\n` +
            `⌈/${head}best1(+)⌋ 获取文字版b19（或更多），最高b99\n` +
            `⌈/${head}score <曲名>⌋ 获取单曲成绩\n` +
            `⌈/${head}suggest⌋ 获取推分建议\n` +
            `⌈/${head}song <曲名>⌋ 获取曲目图鉴\n` +
            `⌈/${head}rand <条件>⌋ 随机曲目\n` +
            `⌈/${head}ill <曲名>⌋ 查看曲目曲绘\n` +
            `⌈/${head}data⌋ 查询data数量\n` +
            `⌈/${head}re8⌋ 重置第八章剧情，不会清除成绩\n` +
            `⌈/${head}search <条件 值>⌋ 检索曲目，支持BPM 定数(dif) 物量(cmb)\n` +
            `⌈/${head}letter⌋ 根据字母猜曲名，⌈#出...⌋ 开指定的字母，⌈#第n个...⌋ 进行回答，⌈#字母答案⌋ 获取答案\n` +
            `⌈/${head}guess⌋ 开始猜曲绘，回答直接发送，⌈#答案⌋ 结束\n` +
            `⌈/${head}tk help⌋ 获取有关sessionToken的帮助\n` +
            `---------------------\n` +
            `⌈sign/签到⌋ 每日签到获取Notes和任务\n` +
            `⌈task/我的任务⌋ 查看自己的任务\n` +
            `⌈${head}send/送 <目标> <数量>⌋ 给某人转账，支持QQ号或@，将扣除部分手续费（20%）\n` +
            `⌈retask/刷新任务⌋ 刷新任务，需要花费20Notes`

        )
        */
        return true
    }

    async tkhelp(e) {
        send.send_with_At(e, `sessionToken有关帮助：\nhttps://potent-cartwheel-e81.notion.site/Phigros-Bot-f154a4b0ea6446c28f62149587cd5f31\n绑定sessionToken指令：\n/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
    }
}
