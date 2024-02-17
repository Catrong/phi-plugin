import get from '../model/getdata.js';
import send from '../model/send.js';
import Config from '../components/Config.js';
import { segment } from 'oicq';

const gamelist = {}

export class phiGuessMic extends plugin {
    constructor() {
        super({
            name: 'phi-guessMic',
            dsc: 'phigros猜曲目片段',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)mic$`,
                    fnc: 'start'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)mic(提示|tip)$`,
                    fnc: 'tip'
                },
                {
                    reg: `^[#/]${Config.getDefOrConfig('config', 'isGuild') ? '?' : ''}(\\s*)gu.*$`,
                    fnc: 'guess'
                },
                {
                    reg: `^[#/]${Config.getDefOrConfig('config', 'isGuild') ? '?' : ''}(\\s*)micans$`,
                    fnc: 'ans'
                }
            ]
        })

    }

    async start(e) {

        if (e.isGuild) {
            e.reply('暂时无法在频道中使用哦QAQ！')
        }

        const { group_id } = e
        if (gamelist[group_id]) {
            send.send_with_At(e, "请不要重复发起哦！")
            return true
        }

        gamelist[group_id] = {}
        gamelist[group_id].songId = get.idssong[get.songlist[randint(0, get.songlist.length - 1)]].replace('.0', '')
        gamelist[group_id].unsend = []
        gamelist[group_id].tip = new Date()
        gamelist[group_id].tot = (await get.getData('splicetot.json', get.infoPath))[gamelist[group_id].songId]

        for (let i = 1; i <= gamelist[group_id].tot; i++) {
            gamelist[group_id].unsend.push(i)
        }
        logger.info(gamelist)

        e.reply(`游戏开始！。发送 /gu 进行猜测，发送 /mic提示 获取更多提示，发送/micans 查看答案哦！`)

        let rand = randint(0, gamelist[group_id].unsend.length - 1)

        let url = `https://qxsky.top:833/data/other_data/web/splited_music/${gamelist[group_id].songId}/${gamelist[group_id].unsend[rand]}.wav`


        // e.reply(segment.share(url, `发送 /mic 猜歌哦！/micans可以结束哦！`, get.getimg('Phigros_Icon_3.0.0.png')))

        e.reply(segment.record(`https://qxsky.top:833/data/other_data/web/splited_music/${gamelist[group_id].songId}/${gamelist[group_id].unsend[rand]}.wav`))

        gamelist[group_id].unsend.splice(rand, 1)

    }

    async tip(e) {
        const { group_id } = e
        if (!gamelist[group_id]) {
            return false
        }
        if (gamelist[group_id].unsend.length == 0) {
            e.reply(`提示已经发完了呐QAQ！如果还是猜不出来也可以发送 /micans 查看答案哦！`)
            return true
        }
        let now = new Date()
        if (now - gamelist[group_id].tip <= Config.getDefOrConfig('config', 'MicTipCd') * 1000) {
            send.send_with_At(e, `距离提示的冷却时间还有${(Config.getDefOrConfig('config', 'MicTipCd') * 1000 - now + gamelist[group_id].tip).toFixed(1)}s呐！先仔细想一想吧！`)
            return true
        }
        gamelist[group_id].tip = now
        let rand = randint(0, gamelist[group_id].unsend.length - 1)

        e.reply(segment.record(`https://qxsky.top:833/data/other_data/web/splited_music/${gamelist[group_id].songId}/${gamelist[group_id].unsend[rand]}.wav`))

        gamelist[group_id].unsend.splice(rand, 1)

    }

    async guess(e) {
        const { group_id, msg } = e
        if (!gamelist[group_id]) {
            return false
        }
        const ans = msg.replace(/^[#/]?gu\s*/g, '')
        if (!ans) {
            return false
        }
        const result = get.fuzzysongsnick(ans, 0.95)
        const real = get.idgetsong(gamelist[group_id].songId + '.0')

        logger.info(result)
        logger.info(real)

        for (let i = 0; i < result.length; ++i) {
            if (result[i] == real) {
                send.send_with_At(e, `恭喜你，答对啦喵！ヾ(≧▽≦*)o\n答案是${real}！`)
                delete gamelist[group_id]
                return true
            }
        }

        if (result[1]) {
            send.send_with_At(e, `不是 ${ans} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
        } else {
            send.send_with_At(e, `不是 ${result[0]} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
        }
    }

    async ans(e) {
        const { group_id } = e
        if (!gamelist[group_id]) {
            return false
        }
        await e.reply('好吧，下面开始公布答案。', true)
        e.reply(await get.GetSongsInfoAtlas(e, get.idgetsong(gamelist[group_id].songId + '.0')))
        delete gamelist[group_id]

    }

}


//定义生成指定区间整数随机数的函数
function randint(min, max) {
    const range = max - min + 1
    const randomOffset = Math.floor(Math.random() * range)
    return (randomOffset + min) % range + min
}

