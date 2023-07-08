
import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'

await get.init()

var songsname = []
for (let i in get.info) {
    songsname.push(i)
}

var gamelist = {}

export class phirks extends plugin {
    constructor() {
        super({
            name: 'phi-game',
            dsc: 'phi-plugin game',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(guess|猜曲目|猜曲绘)$`,
                    fnc: 'start'
                },
                {
                    reg: `^.*$`,
                    fnc: 'guess'
                },
                {
                    reg: `^[#/](答案|结束)$`,
                    fnc: 'ans'
                }

            ]
        })

    }

    /**猜曲绘 */
    async start(e) {
        if (gamelist[e.group_id]) {
            e.reply("请不要重复发起哦！", true)
            return true
        }
        var num = randbt(songsname.length - 2)
        var songs_info = get.info[songsname[num]]
        if (typeof songs_info.illustration_big == 'undefined') {
            logger.error(`[phi guess]抽取到无曲绘曲目 ${songs_info.song}`)
        }

        gamelist[e.group_id] = songs_info.song

        var data = {
            illustration: songs_info.illustration_big,
            width: 100,
            height: 100,
            x: randbt(2048 - 100),
            y: randbt(1080 - 100),
            blur: 10,
            style: 0,
        }

        var known_info = {}
        var remain_info = ['chapter', 'bpm', 'composer', 'length', 'illustrator', 'chart']
        /**
         * 随机给出提示
         * 0: 区域扩大
         * 1: 模糊度减小
         * 2: 给出一条文字信息
         * 3: 显示区域位置
         */
        var fnc = [0, 1, 2, 3]
        logger.info(data)

        e.reply(`下面开始进行猜曲绘哦！回答可以直接发送哦！每过${Config.getDefOrConfig('config', 'GuessTipCd')}秒后将会给出进一步提示。发送 #答案 结束游戏`)
        await e.reply(await get.getguess(e, data))

        for (var i = 0; i < 30; ++i) {

            await timeout(Config.getDefOrConfig('config', 'GuessTipCd') * 1000)

            if (gamelist[e.group_id]) {
                if (gamelist[e.group_id] != songs_info.song) {
                    return true
                }
            } else {
                return true
            }
            switch (fnc[randbt(fnc.length - 1)]) {
                case 0: {
                    area_increase(100, data, fnc)
                    break
                }
                case 1: {
                    blur_down(2, data, fnc)
                    break
                }
                case 2: {
                    gave_a_tip(known_info, remain_info, songs_info, fnc)
                    break
                }
                case 3: {
                    data.style = 1
                    fnc.splice(fnc.indexOf(3), 1)
                    break
                }
            }
            var remsg = [await get.getguess(e, data)]
            if (known_info.chapter) remsg.push(`\n该曲目隶属于 ${known_info.chapter}`)
            if (known_info.bpm) remsg.push(`\n该曲目的 BPM 值为 ${known_info.bpm}`)
            if (known_info.composer) remsg.push(`\n该曲目的作者为 ${known_info.composer}`)
            if (known_info.length) remsg.push(`\n该曲目的时长为 ${known_info.length}`)
            if (known_info.illustrator) remsg.push(`\n该曲目曲绘的作者为 ${known_info.illustrator}`)
            e.reply(remsg, false, { recallMsg: Config.getDefOrConfig('config', 'GuessTipCd') })
        }

        var t = gamelist[e.group_id]
        delete (gamelist[e.group_id])
        await e.reply("呜，怎么还没有人答对啊QAQ！只能说答案了喵……")

        await e.reply(await get.getsongsinfo(e, t))

        return true
    }

    /**玩家猜测 */
    async guess(e) {
        if (gamelist[e.group_id]) {
            var ans = e.msg.replace(/[#/](我)?猜(\s*)/g, '')
            var song = get.songsnick(ans)
            if (song[0]) {
                for (var i in song) {
                    if (gamelist[e.group_id] == song[i]) {
                        var t = gamelist[e.group_id]
                        delete (gamelist[e.group_id])
                        await e.reply('恭喜你，答对啦喵！ヾ(≧▽≦*)o', true)
                        await e.reply(await get.getsongsinfo(e, t))
                        return true
                    }
                }
                e.reply(`不是 ${ans} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
                return true
            }
        }
        return false
    }

    async ans(e) {
        if (gamelist[e.group_id]) {
            var t = gamelist[e.group_id]
            delete (gamelist[e.group_id])
            await e.reply('好吧，下面开始公布答案。', true)
            await e.reply(await get.getsongsinfo(e, t))
            return true
        }
        return false
    }

}

/**
 * RandBetween
 * @param {number} top 随机值上界
 */
function randbt(top, bottom = 0) {
    return Number((Math.random() * (top - bottom)).toFixed(0)) + bottom
}

/**
 * 区域扩增
 * @param {number} size 增大的像素值
 * @param {object} data 
 * @param {Array} fnc 
 */
function area_increase(size, data, fnc) {
    if (data.height < 1080) {
        if (data.height + size >= 1080) {
            data.height = 1080
            data.y = 0
        } else {
            data.height += size
            data.y = Math.max(0, data.y - size / 2)
        }
    }
    if (data.width < 2048) {
        if (data.width + size >= 2048) {
            data.width = 2048
            data.x = 0
            fnc.splice(fnc.indexOf(0), 1)
        } else {
            data.width += size
            data.x = Math.max(0, data.x - size / 2)
        }
    } else {
        console.error('err')
        return true
    }
    return false
}

/**
 * 降低模糊度
 * @param {number} size 降低值
 */
function blur_down(size, data, fnc) {
    if (data.blur) {
        data.blur = Math.max(0, data.blur - size)
        if (!data.blur) fnc.splice(fnc.indexOf(1), 1)
    } else {
        console.error('err')
        return true
    }
    return false
}

/**
 * 获得一个歌曲信息的提示
 * @param {object} known_info 
 * @param {Array} remain_info 
 * @param {object} songs_info 
 * @param {Array} fnc
 */
function gave_a_tip(known_info, remain_info, songs_info, fnc) {
    if (remain_info.length) {
        var t = randbt(remain_info.length - 1)
        var aim = remain_info[t]
        remain_info.splice(t, 1)
        known_info[aim] = songs_info[aim]
        if (!remain_info.length) fnc.splice(fnc.indexOf(2), 1)
    } else {
        console.error('err')
    }
    return false
}

function timeout(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms, 'done');
    });
}
