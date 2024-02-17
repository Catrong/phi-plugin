import common from '../../../lib/common/common.js'
import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'
import send from '../model/send.js'

let songsname = get.illlist
let songweights = {} //存储每首歌曲被抽取的权重
let info = get.info()

//曲目初始洗牌
shuffleArray(songsname)

let gamelist = {}
const eList = {}

export class phiguess extends plugin {
    constructor() {
        super({
            name: 'phi-game 猜曲绘',
            dsc: 'phi-plugin 猜曲绘',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(guess|猜曲目|猜曲绘)$`,
                    fnc: 'start'
                },
                {
                    reg: `^.*$`,
                    fnc: 'guess',
                    log: false
                },
                {
                    reg: `^[#/](曲绘|ill)(\\s*)(ans|答案|结束)$`,
                    fnc: 'ans'
                },
                {
                    reg: `^[#/](曲绘洗牌|illmix)$`,
                    fnc: 'mix'
                },
            ]
        })

    }

    /**猜曲绘 */
    async start(e) {
        const { group_id } = e
        if (gamelist[group_id]) {
            e.reply("请不要重复发起哦！", true)
            return true
        }
        if (songsname.length == 0) {
            e.reply('当前曲库暂无有曲绘的曲目哦！更改曲库后需要重启哦！')
            return true
        }

        if (!songweights[group_id]) {
            songweights[group_id] = {}

            //将每一首曲目的权重初始化为1
            songsname.forEach(song => {
                songweights[group_id][song] = 1
            })
        }

        let song = getRandomSong(e)
        let songs_info = get.info()[song]

        let cnnt = 0
        while (typeof songs_info.illustration_big == 'undefined' || songs_info.can_t_be_guessill) {
            ++cnnt
            if (cnnt >= 50) {
                logger.error(`[phi guess]抽取曲目失败，请检查曲库设置`)
                e.reply(`[phi guess]抽取曲目失败，请检查曲库设置`)
                return
            }
            song = getRandomSong(e)
            songs_info = get.info()[song]
        }

        gamelist[group_id] = songs_info.song
        eList[group_id] = e

        const w_ = randint(100, 140)
        const h_ = randint(100, 140)
        const x_ = randint(0, 2048 - w_)
        const y_ = randint(0, 1080 - h_)
        const blur_ = randint(9, 14)

        let data = {
            illustration: get.getill(songs_info.song),
            width: w_,
            height: h_,
            x: x_,
            y: y_,
            blur: blur_,
            style: 0,
        }

        const known_info = {}
        const remain_info = ['chapter', 'bpm', 'composer', 'length', 'illustrator', 'chart']
        /**
         * 随机给出提示
         * 0: 区域扩大
         * 1: 模糊度减小
         * 2: 给出一条文字信息
         * 3: 显示区域位置
         */
        let fnc = [0, 1, 2, 3]
        logger.info(data)

        e.reply(`下面开始进行猜曲绘哦！回答可以直接发送哦！每过${Config.getDefOrConfig('config', 'GuessTipCd')}秒后将会给出进一步提示。发送 /illans 结束游戏`)
        if (Config.getDefOrConfig('config', 'GuessTipRecall'))
            await e.reply(await get.getguess(e, data), false, { recallMsg: Config.getDefOrConfig('config', 'GuessTipCd') })
        else
            await e.reply(await get.getguess(e, data))

        /**单局时间不超过4分半 */
        const time = Config.getDefOrConfig('config', 'GuessTipCd')
        for (let i = 0; i < Math.min(270 / time, 30); ++i) {


            for (let j = 0; j < time; ++j) {
                await common.sleep(1000)
                if (gamelist[group_id]) {
                    if (gamelist[group_id] != songs_info.song) {
                        await gameover(e, data)
                        return true
                    }
                } else {
                    await gameover(e, data)
                    return true
                }
            }
            let remsg = [] //回复内容
            let tipmsg = '' //这次干了什么
            const index = randint(0, fnc.length - 1)

            switch (fnc[index]) {
                case 0: {
                    area_increase(100, data, fnc)
                    tipmsg = `[区域扩增!]`
                    break
                }
                case 1: {
                    blur_down(2, data, fnc)
                    tipmsg = `[清晰度上升!]`
                    break
                }
                case 2: {
                    gave_a_tip(known_info, remain_info, songs_info, fnc)
                    tipmsg = `[追加提示!]`
                    break
                }
                case 3: {
                    data.style = 1
                    fnc.splice(fnc.indexOf(3), 1)
                    tipmsg = `[全局视野!]`
                    break
                }
            }
            if (known_info.chapter) tipmsg += `\n该曲目隶属于 ${known_info.chapter}`
            if (known_info.bpm) tipmsg += `\n该曲目的 BPM 值为 ${known_info.bpm}`
            if (known_info.composer) tipmsg += `\n该曲目的作者为 ${known_info.composer}`
            if (known_info.length) tipmsg += `\n该曲目的时长为 ${known_info.length}`
            if (known_info.illustrator) tipmsg += `\n该曲目曲绘的作者为 ${known_info.illustrator}`
            if (known_info.chart) tipmsg += known_info.chart
            remsg = [tipmsg]
            remsg.push(await get.getguess(e, data))

            e = eList[group_id]

            if (gamelist[group_id]) {
                if (gamelist[group_id] != songs_info.song) {
                    await gameover(e, data)
                    return true
                }
            } else {
                await gameover(e, data)
                return true
            }

            if (Config.getDefOrConfig('config', 'GuessTipRecall'))
                e.reply(remsg, false, { recallMsg: Config.getDefOrConfig('config', 'GuessTipCd') + 1 })
            else
                e.reply(remsg)

        }

        for (let j = 0; j < time; ++j) {
            await common.sleep(1000)
            if (gamelist[group_id]) {
                if (gamelist[group_id] != songs_info.song) {
                    await gameover(e, data)
                    return true
                }
            } else {
                await gameover(e, data)
                return true
            }
        }

        e = eList[group_id]

        const t = gamelist[group_id]
        delete eList[group_id]
        delete (gamelist[group_id])
        await e.reply("呜，怎么还没有人答对啊QAQ！只能说答案了喵……")

        await e.reply(await get.GetSongsInfoAtlas(e, t))
        await gameover(e, data)

        return true
    }

    /**玩家猜测 */
    async guess(e) {
        const { group_id, msg, user_id } = e
        if (gamelist[group_id]) {
            eList[group_id] = e
            if (typeof msg === 'string') {
                const ans = msg.replace(/[#/](我)?猜(\s*)/g, '')
                const song = get.fuzzysongsnick(ans, 0.95)
                if (song[0]) {
                    for (let i in song) {
                        if (gamelist[group_id] == song[i]) {
                            const t = gamelist[group_id]
                            delete (gamelist[group_id])
                            send.send_with_At(e, '恭喜你，答对啦喵！ヾ(≧▽≦*)o', true)
                            await e.reply(await get.GetSongsInfoAtlas(e, t))
                            return true
                        }
                    }
                    if (song[1]) {
                        send.send_with_At(e, `不是 ${ans} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
                    } else {
                        send.send_with_At(e, `不是 ${song[0]} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
                    }
                    return false
                }
            }
        }
        return false
    }

    async ans(e) {
        const { group_id } = e
        if (gamelist[group_id]) {
            eList[group_id] = e
            const t = gamelist[group_id]
            delete gamelist[group_id]
            delete eList[group_id]
            await e.reply('好吧，下面开始公布答案。', true)
            await e.reply(await get.GetSongsInfoAtlas(e, t))
            return true
        }
        return false
    }

    /** 洗牌 **/
    async mix(e) {
        const { group_id } = e

        if (gamelist[group_id]) {
            await e.reply(`当前有正在进行的游戏，请等待游戏结束再执行该指令`, true)
            return false
        }

        // 曲目初始洗牌
        shuffleArray(songsname)

        songweights[group_id] = songweights[group_id] || {}

        // 将权重归1
        songsname.forEach(song => {
            songweights[group_id][song] = 1
        })

        await e.reply(`洗牌成功了www`, true)
        return true
    }
}



/**游戏结束，发送相应位置 */
async function gameover(e, data) {
    data.ans = data.illustration
    data.style = 1
    await e.reply(await get.getguess(e, data))
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
            data.y = Math.min(data.y, 1080 - data.height)
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
            data.x = Math.min(data.x, 2048 - data.width)
        }
    } else {
        logger.error('err')
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
        logger.error('err')
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
        const t = randbt(remain_info.length - 1)
        const aim = remain_info[t]
        remain_info.splice(t, 1)
        known_info[aim] = songs_info[aim]

        if (!remain_info.length) fnc.splice(fnc.indexOf(2), 1)

        if (aim === 'chart') {
            let charts = []
            for (let i in songs_info[aim]) {
                charts.push(i)
            }
            let t1 = charts[randint(0, charts.length - 1)]

            known_info[aim] = `\n该曲目的 ${t1} 谱面的`

            switch (randint(0, 2)) {
                case 0: {
                    /**定数 */
                    known_info[aim] += `定数为 ${songs_info[aim][t1]['difficulty']}`
                    break
                }
                case 1: {
                    /**物量 */
                    known_info[aim] += `物量为 ${songs_info[aim][t1]['combo']}`
                    break
                }
                case 2: {
                    /**谱师 */
                    known_info[aim] += `谱师为 ${songs_info[aim][t1]['charter']}`
                    break
                }
            }
        }
    } else {
        logger.error('Error: remaining info is empty')
        return true
    }
    return false
}


//将数组顺序打乱
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randint(0, i)
        const temp = arr[i]
        arr[i] = arr[j]
        arr[j] = temp //交换位置
    }
    return arr
}

//定义生成指定区间带有指定小数位数随机数的函数
function randfloat(min, max, precision = 0) {
    let range = max - min
    let randomOffset = Math.random() * range
    let randomNumber = randomOffset + min + range * 10 ** -precision

    return precision === 0 ? Math.floor(randomNumber) : randomNumber.toFixed(precision)
}

//定义生成指定区间整数随机数的函数
function randint(min, max) {
    const range = max - min + 1
    const randomOffset = Math.floor(Math.random() * range)
    return (randomOffset + min) % range + min
}

//定义随机抽取曲目的函数
function getRandomSong(e) {
    //对象解构提取groupid
    const { group_id } = e

    //计算曲目的总权重
    const totalWeight = Object.values(songweights[group_id]).reduce((total, weight) => total + weight, 0)

    //生成一个0到总权重之间带有16位小数的随机数
    const randomWeight = randfloat(0, totalWeight, 16)

    let accumulatedWeight = 0
    for (const [song, weight] of Object.entries(songweights[group_id])) {
        accumulatedWeight += weight
        if (accumulatedWeight >= randomWeight) {
            songweights[group_id][song] *= 0.4 //权重每次衰减60%
            return song
        }
    }

    //如果由于浮点数精度问题未能正确选择歌曲，则随机返回一首
    return songsname[randint(0, songsname.length - 1)]
}
