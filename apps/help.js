import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import get from '../model/getdata.js'
import atlas from '../model/picmodle.js'


const helpGroup = [
    {
        group: "绑定",
        list: [
            {
                title: "/bind",
                eg: "/bind <sessionToken>",
                desc: "绑定你的 sessionToken\neg: /bind abcdefghijklmnopqrstuvwxy"
            }, {
                title: "/unbind",
                eg: "/unbind",
                desc: "在 Bot 上删除储存的你的存档以及成绩记录，需要二次确认\neg: /unbind"
            }, {
                title: "/tk help",
                eg: "/tk help",
                desc: "获取 sessionToken 相关帮助文档\neg: /unbind"
            }
        ]
    }, {
        group: "查询 & 统计",
        list: [
            {
                title: "/update",
                eg: "/update",
                desc: "更新 Bot 端存储的成绩，/pgr 也可以自动更新\neg: /update"
            }, {
                title: "/pgr",
                eg: "/pgr [背景(可选)]",
                desc: "获取 B19 成绩图，在主题不为⌈使一颗心免于哀伤⌋时可以选择背景曲绘\neg1: /pgr    eg2: /pgr df"
            }, {
                title: "/info",
                eg: "/info [背景(可选)]",
                desc: "获取你的个人统计信息\neg1: /info    eg2: /info df"
            }, {
                title: "/score",
                eg: "/score <曲目>",
                desc: "获取单曲成绩\neg: /score df"
            }, {
                title: "/lvsco\n/scolv",
                eg: "/lvsco [定数] [难度]",
                desc: "获取指定范围内的成绩统计图\neg1: /lvsco 15+\neg2: /lvsco 14 IN HD\neg3: /lvsco 12-15 IN AT"
            }, {
                title: "/list",
                eg: "/list [定数] [难度] [评级]",
                desc: "列出所有匹配的成绩\neg: /list 15 F"
            }, {
                title: "/bN",
                eg: "/b<N>",
                desc: "B19 但是很长很长\neg: /b60"
            }, {
                title: "/bestN",
                eg: "/best <1-99>",
                desc: "获取文字版 B<N> 成绩，私聊获取完整版，建议私聊使用\neg: /best 19"
            }, {
                title: "/suggest",
                eg: "/suggest",
                desc: "获取推分（使游戏内显示数值+0.01）建议，私聊获取完整版，建议私聊使用\neg: /suggest"
            }, {
                title: "/data",
                eg: "/data",
                desc: "获取 data 数量\neg: /data"
            }
        ]
    }, {
        group: "图鉴 & 功能",
        list: [
            {
                title: "/song",
                eg: "/song <曲目>",
                desc: "查询曲目图鉴\neg: /song 996"
            }, {
                title: "/rand",
                eg: "/rand [定数] [难度]",
                desc: "随机谱面\neg1: /rand 13+\neg2: /rand 15-\neg3: /rand 14-16 AT"
            }, {
                title: "/search",
                eg: "/search [bpm N-N] [dif N-N] [cmb N-N]",
                desc: "查询符合条件的曲目，建议私聊使用\neg1: /search bpm 300\neg2: /search bpm 1-300 dif 15"
            }
        ]
    }, {
        group: "娱乐 & 设定",
        list: [
            {
                title: "/letter",
                eg: "/letter /第N个xx /ltr ans",
                desc: "开字母小游戏\neg1: /第一个996\neg2: /第一df"
            }, {
                title: "/guess",
                eg: "/guess (直接回答) /illans",
                desc: "猜曲绘，回答直接发曲目，识别后 Bot 会回复正确与否"
            }, {
                title: "/theme",
                eg: "/theme [0-2]",
                desc: "切换主题，作用于 pgr update list task\neg: /theme 1"
            }, {
                title: "/sign",
                eg: "/sign",
                desc: "签到打卡获取 Notes 和任务卡片\neg: /sign"
            }, {
                title: "/send",
                eg: "/send @ <N>",
                desc: "用于 Notes 转账，会从中扣除部分\neg: /send @xx 520"
            }, {
                title: "/task",
                eg: "/task",
                desc: "查看自己的任务\neg: /task"
            }, {
                title: "/retask",
                eg: "/retask",
                desc: "花费 20Notes 重置自己的任务，每日 /sgin 可视为一次 /retask ，每日第一次 reatask 免费\neg: /retask"
            }
        ]
    },
]


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
        head = head.match(RegExp(head))[0]
        let pluginData = await get.getpluginData(e.user_id)
        if (head) {
            e.reply(await atlas.help(e, {
                helpGroup: helpGroup,
                cmdHead: head,
                background: get.getill(get.illlist[Math.floor((Math.random() * (get.illlist.length - 1)))]),
                theme: pluginData?.plugin_data?.theme || 'star'
            }), true)
        } else {
            e.reply(await atlas.help(e, {
                helpGroup: helpGroup,
                background: get.getill(get.illlist[Math.floor((Math.random() * (get.illlist.length - 1)))]),
                theme: pluginData?.plugin_data?.theme || 'star'
            }), true)
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
        e.reply(segment.markdown([`猜字母小游戏正在火热进行中，可点击相应的 [蓝色文本] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('你点击了蓝色文本')}&reply=false&enter=false) 快速操作：\r`, `[【1】∗∗∗∗∗] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('#第1 ')}&reply=false&enter=false)\r[【2】∗∗∗∗∗∗∗∗] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('#第2 ')}&reply=false&enter=false)\r[【3】∗∗∗∗∗∗∗] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('#第3 ')}&reply=false&enter=false)\r[【4】∗∗∗∗∗∗∗∗∗] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('#第4 ')}&reply=false&enter=false)\r[【5】∗∗∗∗] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('#第5 ')}&reply=false&enter=false)\r[【6】∗∗∗∗∗∗∗∗∗∗∗] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('#第6 ')}&reply=false&enter=false)\r[【7】∗∗∗∗∗∗∗∗] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('#第7 ')}&reply=false&enter=false)\r[【8】∗∗∗∗∗] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('#第8 ')}&reply=false&enter=false)\r[【9】∗∗∗∗∗∗] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('#第9 ')}&reply=false&enter=false)\r[【10】∗∗∗∗∗∗∗∗∗∗] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('#第10 ')}&reply=false&enter=false)\r[【11】∗∗∗] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('#第11 ')}&reply=false&enter=false)\r[【12】∗∗∗∗∗∗∗∗∗] (mqqapi://aio/inlinecmd?command=${encodeURIComponent('#第12 ')}&reply=false&enter=false)`, segment.button(
            [{
                text: "猜测",
                input: "#第 "
            },
            {
                text: "提示",
                input: "tip",
                send: true
            },
            {
                text: "结束",
                input: "#字母答案",
                send: true
            },
            ]
        )]))
    }
}
