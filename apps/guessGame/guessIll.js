import common from '../../../../lib/common/common.js'
import Config from '../../components/Config.js'
import logger from '../../components/Logger.js'
import getInfo from '../../model/getInfo.js'
import send from '../../model/send.js'
import picmodle from "../../model/picmodle.js";
import SongsInfo from '../../model/class/SongsInfo.js'
import fCompute from '../../model/fCompute.js'
import getPic from '../../model/getPic.js'

let songIdList = getInfo.illlist || [] //所有有曲绘的曲目列表

/**
 * @type {Record<string, Record<idString, number>>}
 */
let songweights = {} //存储每首歌曲被抽取的权重

//曲目初始洗牌
songIdList = fCompute.randArray(songIdList)

/**
 * 答案列表
 * @type {Record<string, idString>}
 */
let ansList = {}
/**
 * @type {Record<string, any>}
 */
const eList = {}


/**
 * @typedef {import('../guessGame.js').GameList} GameList
 * @typedef {import('../../model/picmodle.js').guessIllData} guessIllData
 * @typedef {['chapter', 'bpm', 'composer', 'length', 'illustrator', 'chart']} remainInfoType
 */

export default new class guessIll {
    /**
     * 猜曲绘
     * @param {any} e
     * @param {GameList} gameList
     */
    async start(e, gameList) {
        const { group_id } = e
        if (ansList[group_id]) {
            e.reply("请不要重复发起哦！", true)
            return true
        }
        if (songIdList.length == 0) {
            e.reply('当前曲库暂无有曲绘的曲目哦！更改曲库后需要重启哦！')
            return true
        }

        if (!songweights[group_id]) {
            songweights[group_id] = {}

            //将每一首曲目的权重初始化为1
            songIdList.forEach(song => {
                songweights[group_id][song] = 1
            })
        }

        let songId = getRandomSong(e)
        let songs_info = getInfo.info(songId)

        let cnnt = 0
        while (!songs_info || songs_info.can_t_be_guessill) {
            ++cnnt
            if (cnnt >= 50) {
                logger.error(`[phi guess]抽取曲目失败，请检查曲库设置`)
                e.reply(`[phi guess]抽取曲目失败，请检查曲库设置`)
                return
            }
            songId = getRandomSong(e)
            songs_info = getInfo.info(songId)
        }

        ansList[group_id] = songs_info.id
        gameList[group_id] = { gameType: "guessIll" }
        eList[group_id] = e

        let w_ = fCompute.randBetween(100, 140)
        let h_ = fCompute.randBetween(100, 140)
        let x_ = fCompute.randBetween(0, 2048 - w_)
        let y_ = fCompute.randBetween(0, 1080 - h_)
        let blur_ = fCompute.randBetween(9, 14)

        let data = {
            illustration: getInfo.getill(songs_info.id),
            width: w_,
            height: h_,
            x: x_,
            y: y_,
            blur: blur_,
            style: 0,
        }
        /**
         * 已知信息
         * @type {Record<string, string>}
         */
        const known_info = {}
        /**
         * @type {Partial<remainInfoType>}
         */
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

        e.reply(`下面开始进行猜曲绘哦！回答可以直接发送哦！每过${Config.getUserCfg('config', 'GuessTipCd')}秒后将会给出进一步提示。发送 /${Config.getUserCfg('config', 'cmdhead')} ans 结束游戏`)
        if (Config.getUserCfg('config', 'GuessTipRecall'))
            await e.reply(await picmodle.guess(e, data), false, { recallMsg: Config.getUserCfg('config', 'GuessTipCd') })
        else
            await e.reply(await picmodle.guess(e, data))

        /**单局时间不超过4分半 */
        const time = Config.getUserCfg('config', 'GuessTipCd')
        for (let i = 0; i < Math.min(270 / time, 30); ++i) {


            for (let j = 0; j < time; ++j) {
                await common.sleep(1000)
                if (ansList[group_id]) {
                    if (ansList[group_id] != songs_info.id) {
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
            const index = fCompute.randBetween(0, fnc.length - 1)

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
            remsg.push(await picmodle.guess(e, data))

            e = eList[group_id]

            if (ansList[group_id]) {
                if (ansList[group_id] != songs_info.id) {
                    await gameover(e, data)
                    return true
                }
            } else {
                await gameover(e, data)
                return true
            }

            if (Config.getUserCfg('config', 'GuessTipRecall'))
                e.reply(remsg, false, { recallMsg: Config.getUserCfg('config', 'GuessTipCd') + 1 })
            else
                e.reply(remsg)

        }

        for (let j = 0; j < time; ++j) {
            await common.sleep(1000)
            if (ansList[group_id]) {
                if (ansList[group_id] != songs_info.id) {
                    await gameover(e, data)
                    return true
                }
            } else {
                await gameover(e, data)
                return true
            }
        }

        e = eList[group_id]

        const t = ansList[group_id]
        delete eList[group_id]
        delete ansList[group_id]
        delete gameList[group_id]
        await e.reply("呜，怎么还没有人答对啊QAQ！只能说答案了喵……")

        await e.reply(await getPic.GetSongsInfoAtlas(e, t))
        await gameover(e, data)

        return true
    }

    /**
     * 玩家猜测
     * @param {any} e
     * @param {GameList} gameList
     */
    async guess(e, gameList) {
        const { group_id, msg, user_id } = e
        if (ansList[group_id]) {
            eList[group_id] = e
            if (typeof msg === 'string') {
                const ans = msg.replace(/[#/](我)?猜(\s*)/g, '')
                const song = getInfo.fuzzysongsnick(ans, 0.95)
                if (song[0]) {
                    for (let i in song) {
                        if (ansList[group_id] == song[i]) {
                            const t = ansList[group_id]
                            delete ansList[group_id]
                            delete gameList[group_id]
                            send.send_with_At(e, '恭喜你，答对啦喵！ヾ(≧▽≦*)o', true)
                            await e.reply(await getPic.GetSongsInfoAtlas(e, t))
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

    /**
     * 获取答案
     * @param {any} e 
     * @param {GameList} gameList 
     * @returns 
     */
    async ans(e, gameList) {
        const { group_id } = e
        if (ansList[group_id]) {
            const t = ansList[group_id]
            delete ansList[group_id]
            delete gameList[group_id]
            await e.reply('好吧，下面开始公布答案。', true)
            await e.reply(await getPic.GetSongsInfoAtlas(e, t))
            return true
        }
        return false
    }

    /**
     * 洗牌
     * @param {any} e
     */
    async mix(e) {
        const { group_id } = e

        if (ansList[group_id]) {
            await e.reply(`当前有正在进行的游戏，请等待游戏结束再执行该指令`, true)
            return false
        }

        // 曲目初始洗牌
        songIdList = fCompute.randArray(songIdList)

        songweights[group_id] = songweights[group_id] || {}

        // 将权重归1
        songIdList.forEach(song => {
            songweights[group_id][song] = 1
        })

        await e.reply(`洗牌成功了www`, true)
        return true
    }
}()



/**
 * 游戏结束，发送相应位置
 * @param {any} e 
 * @param {any} data
 */
async function gameover(e, data) {
    data.ans = data.illustration
    data.style = 1
    await e.reply(await picmodle.guess(e, data))
}

/**
 * RandBetween
 * @param {number} top 随机值上界
 * @param {number} [bottom=0] 随机值下界
 * @returns {number} 随机整数
 */
function randbt(top, bottom = 0) {
    return Number((Math.random() * (top - bottom)).toFixed(0)) + bottom
}

/**
 * 区域扩增
 * @param {number} size 增大的像素值
 * @param {guessIllData} data 
 * @param {number[]} fnc 
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
 * @param {guessIllData} data 
 * @param {number[]} fnc
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
 * @param {Record<string, string>} known_info 
 * @param {Partial<remainInfoType>} remain_info 
 * @param {SongsInfo} songs_info 
 * @param {number[]} fnc
 */
function gave_a_tip(known_info, remain_info, songs_info, fnc) {
    if (remain_info.length) {
        const t = randbt(remain_info.length - 1)
        const aim = remain_info[t]
        if (!aim) {
            logger.error('Error: aim is undefined')
            return true
        }
        remain_info.splice(t, 1)

        if (!remain_info.length) fnc.splice(fnc.indexOf(2), 1)

        if (aim === 'chart') {
            /**
             * @type {levelKind[]}
             */
            let charts = /**@type {levelKind[]} */(Object.keys(songs_info.chart))

            let t1 = charts[fCompute.randBetween(0, charts.length - 1)]

            known_info[aim] = `\n该曲目的 ${t1} 谱面的`

            switch (fCompute.randBetween(0, 2)) {
                case 0: {
                    /**定数 */
                    known_info[aim] += `定数为 ${songs_info[aim][t1]?.['difficulty']}`
                    break
                }
                case 1: {
                    /**物量 */
                    known_info[aim] += `物量为 ${songs_info[aim][t1]?.['combo']}`
                    break
                }
                case 2: {
                    /**谱师 */
                    known_info[aim] += `谱师为 ${songs_info[aim][t1]?.['charter']}`
                    break
                }
            }
        } else {
            known_info[aim] = songs_info[aim]
        }
    } else {
        logger.error('Error: remaining info is empty')
        return true
    }
    return false
}

/**
 * 定义随机抽取曲目的函数
 * @param {any} e 
 * @returns 
 */
function getRandomSong(e) {
    //对象解构提取groupid
    const { group_id } = e

    //计算曲目的总权重
    const totalWeight = Object.values(songweights[group_id]).reduce((total, weight) => total + weight, 0)

    //生成一个0到总权重之间带有6位小数的随机数
    const randomWeight = fCompute.randFloatBetween(0, totalWeight, 6)

    let accumulatedWeight = 0
    const ids = /** @type {idString[]} */(Object.keys(songweights[group_id]))
    for (const id of ids) {
        const weight = songweights[group_id][id]
        accumulatedWeight += weight
        if (accumulatedWeight >= randomWeight) {
            songweights[group_id][id] *= 0.4 //权重每次衰减60%
            return id
        }
    }

    //如果由于浮点数精度问题未能正确选择歌曲，则随机返回一首
    return songIdList[fCompute.randBetween(0, songIdList.length - 1)]
}
