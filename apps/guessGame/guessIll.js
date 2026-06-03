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
 * @typedef {Object} guessIllData
 * @property {string} illustration 曲绘路径
 * @property {number} width 展示的宽度
 * @property {number} height 展示的高度
 * @property {number} x 展示的X位置
 * @property {number} y 展示的Y位置
 * @property {number} blur 模糊度
 * @property {number} saturate 饱和度 (0=灰度, 1=正常, >1=过饱和)
 * @property {boolean} invert 反相度 (0=正常, 1=完全反相)
 * @property {number} hueRotate 色相旋转角度 (deg)
 * @property {boolean} lineMode 是否线稿模式
 * @property {number|boolean} style 是否全局视野 (0/1 or false/true)
 * @property {string} filterStyle 用于模板的CSS filter字符串
 * @property {string[]} chosenInterferences 记录选择的干扰类型
 * @property {string} [ans] 答案图片路径(游戏结束时)
 */

/**
 * @typedef {Object} interferenceConfig
 * @property {string[]} chosen 当前选择的干扰类型列表
 * @property {number[]} fncModifier fnc类型修正 (要在fnc中添加或删除的类型)
 */
/**
 * @typedef {import('../guessGame.js').GameList} GameList
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

        let w_ = fCompute.randInt(100, 140)
        let h_ = fCompute.randInt(100, 140)
        let x_ = fCompute.randInt(0, 2048 - w_)
        let y_ = fCompute.randInt(0, 1080 - h_)

        // 根据难度等级生成干扰组合
        const level = fCompute.randFromArray([[1, 5], [2, 3], [3, 2]]);
        const interference = generateInterference(level);

        let data = {
            illustration: getInfo.getill(songs_info.id),
            width: w_,
            height: h_,
            x: x_,
            y: y_,
            blur: interference.blur,
            saturate: interference.saturate,
            invert: interference.invert,
            hueRotate: interference.hueRotate,
            lineMode: interference.lineMode,
            chosenInterferences: interference.chosenInterferences,
            style: 0,
            filterStyle: buildFilterStyle(interference),
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
         * 4: 干扰减弱(非模糊类干扰减弱)
         */
        let fnc = [0, 1, 2, 3]

        /**
         * 返回带有权重的随机干扰操作列表
         * @param {number[]} fnc 
         * @param {guessIllData} data 
         */
        function genRandFncArr(fnc, data) {
            /**
             * @type {[number, number][]}
             */
            const res = []
            fnc.forEach(f => {
                switch (f) {
                    case 0:
                        res.push([0, Math.floor((1 - (data.width * data.height) / (1080 * 2048)) * 100)]);
                        break;
                    case 1:
                        res.push([1, Math.floor((data.blur / 16) * 30)]);
                        break;
                    case 2:
                        res.push([2, Math.floor(remain_info.length / 6 * 50)]);
                        break;
                    case 3:
                        res.push([3, fCompute.randInt(10, 50)]);
                        break;
                    case 4:
                        let interferenceCount = 0
                        if (data.saturate !== 1) interferenceCount += 15
                        if (data.invert) interferenceCount += 5
                        if (data.hueRotate !== 0) interferenceCount += 20
                        if (data.lineMode) interferenceCount += 5
                        res.push([4, interferenceCount]);
                }
            })
            return res;
        }

        // 如果初始没有模糊干扰，移除类型1
        if (!interference.blur && fnc.indexOf(1) !== -1) {
            fnc.splice(fnc.indexOf(1), 1)
        }
        // 如果存在非模糊类干扰，加入类型4
        if (interference.lineMode || interference.saturate !== 1 || interference.invert !== false || interference.hueRotate !== 0) {
            fnc.push(4)
        }
        logger.info(data)

        e.reply(
            [`下面开始进行猜曲绘哦！回答可以直接发送哦！每过${Config.getUserCfg('config', 'GuessTipCd')}秒后将会给出进一步提示。`,
            `发送 /${Config.getUserCfg('config', 'cmdhead')} ans 结束游戏`,
            `本局难度：${level}，当前干扰类型：${data.chosenInterferences.join('、')}`].join('\n')
        )
        if (Config.getUserCfg('config', 'GuessTipRecall'))
            await e.reply(await picmodle.guess(e, data), false, { recallMsg: Config.getUserCfg('config', 'GuessTipCd') })
        else
            await e.reply(await picmodle.guess(e, data))

        /**单局时间不超过4分半 */
        const time = Config.getUserCfg('config', 'GuessTipCd')
        for (let i = 0; i < Math.min(270 / time, 30); ++i) {


            for (let j = 0; j < time; ++j) {
                await common.sleep(1000)

                e = eList[group_id]
                if (ansList[group_id]) {
                    if (ansList[group_id] != songs_info.id) {
                        await gameover(e, data)
                        delete eList[group_id]
                        return true
                    }
                } else {
                    await gameover(e, data)
                    delete eList[group_id]
                    return true
                }
            }
            let remsg = [] //回复内容
            let tipmsg = '' //这次干了什么
            const select = fCompute.randFromArray(genRandFncArr(fnc, data));

            switch (select) {
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
                case 4: {
                    const reduced = interference_reduce(data, fnc)
                    tipmsg = `[${reduced}干扰减弱!]`
                    break
                }
            }
            if (known_info.chapter) tipmsg += `\n该曲目隶属于 ${known_info.chapter}`
            if (known_info.bpm) tipmsg += `\n该曲目的 BPM 值为 ${known_info.bpm}`
            if (known_info.composer) tipmsg += `\n该曲目的作者为 ${known_info.composer}`
            if (known_info.length) tipmsg += `\n该曲目的时长为 ${known_info.length}`
            if (known_info.illustrator) tipmsg += `\n该曲目曲绘的作者为 ${known_info.illustrator}`
            if (known_info.chart) tipmsg += known_info.chart
            remsg = []
            remsg.push(await picmodle.guess(e, data))
            remsg.push(tipmsg)

            e = eList[group_id]

            if (ansList[group_id]) {
                if (ansList[group_id] != songs_info.id) {
                    await gameover(e, data)
                    delete eList[group_id]
                    return true
                }
            } else {
                await gameover(e, data)
                delete eList[group_id]
                return true
            }

            if (Config.getUserCfg('config', 'GuessTipRecall'))
                e.reply(remsg, false, { recallMsg: Config.getUserCfg('config', 'GuessTipCd') + 1 })
            else
                e.reply(remsg)

        }

        for (let j = 0; j < time; ++j) {
            await common.sleep(1000)

            e = eList[group_id]

            if (ansList[group_id]) {
                if (ansList[group_id] != songs_info.id) {
                    await gameover(e, data)
                    delete eList[group_id]
                    return true
                }
            } else {
                await gameover(e, data)
                delete eList[group_id]
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
                const ids = getInfo.fuzzysongsnick(ans, 0.95)
                if (ids[0]) {
                    for (let i in ids) {
                        if (ansList[group_id] == ids[i]) {
                            const t = ansList[group_id]
                            delete ansList[group_id]
                            delete gameList[group_id]
                            send.send_with_At(e, '恭喜你，答对啦喵！ヾ(≧▽≦*)o', true)
                            await e.reply(await getPic.GetSongsInfoAtlas(e, t))
                            return true
                        }
                    }
                    if (ids[1]) {
                        send.send_with_At(e, `不是 ${ans} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
                    } else {
                        send.send_with_At(e, `不是 ${getInfo.info(ids[0])?.song ?? ids[0]} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
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
    data.filterStyle = buildFilterStyle(data)
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
        data.filterStyle = buildFilterStyle(data)
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

            let t1 = charts[fCompute.randInt(0, charts.length - 1)]

            known_info[aim] = `\n该曲目的 ${t1} 谱面的`

            switch (fCompute.randInt(0, 2)) {
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
 * 根据干扰数据构建 CSS filter 字符串
 * @param {guessIllData} data 
 * @returns {string}
 */
function buildFilterStyle(data) {
    let filters = []
    if (data.lineMode) {
        // 线稿模式：使用 SVG 边缘检测滤镜 (#phiLineArt)
        filters.push('url(#phiLineArt)')
    } else {
        // 非线稿模式下才应用颜色类干扰
        if (data.saturate !== 1 && typeof data.saturate === 'number') filters.push(`saturate(${data.saturate})`)
        if (data.invert !== false) filters.push(`invert(${data.invert ? 1 : 0})`)
        if (data.hueRotate !== 0) filters.push(`hue-rotate(${data.hueRotate}deg)`)
    }
    if (data.blur > 0) filters.push(`blur(${data.blur}px)`)
    return `filter: ${filters.join(' ')};`
}

/**
 * 难度等级干扰定义
 * Level 1: 单一干扰 (blur/saturate/invert/hueRotate/lineMode 中随机一种)
 * Level 2: blur + 任一其他干扰
 * Level 3: blur + 两种颜色干扰, 或 blur + lineMode
 * 规则: lineMode 与颜色类干扰(saturate/invert/hueRotate)不可共存
 * 
 * @param {number} level 难度等级 1-3
 * @returns {guessIllData} 干扰数据
 */
function generateInterference(level) {
    /** 颜色类干扰 */
    const colorTypes = ['saturate', 'invert', 'hueRotate']
    /** 所有干扰类型 */
    const allTypes = ['blur', 'saturate', 'invert', 'hueRotate', 'lineMode']

    const commonTypes = ['blur', 'saturate', 'invert', 'hueRotate']

    const chineseMap = {
        'blur': '模糊',
        'saturate': '饱和',
        'invert': '反相',
        'hueRotate': '色相',
        'lineMode': '线稿'
    }

    /** @type {string[]} */
    let chosen = []

    switch (level) {
        case 1: {
            // 单一干扰：从除线稿类型中随机选1个
            chosen = [commonTypes[fCompute.randInt(0, commonTypes.length - 1)]]
            break
        }
        case 2: {
            // blur + 任一颜色干扰 或 仅线稿（线稿本身就很有干扰性，所以有一定概率单独出现）
            if (Math.random() < 0.6) {
                chosen = ['blur', colorTypes[fCompute.randInt(0, colorTypes.length - 1)]]
            } else {
                chosen = ['lineMode']
            }
            break
        }
        case 3:
        default: {
            // 70%概率: blur + 两种颜色干扰
            // 30%概率: blur + lineMode (线稿本身就很有干扰性)
            if (Math.random() < 0.7) {
                const shuffled = fCompute.randArray([...colorTypes])
                chosen = ['blur', shuffled[0], shuffled[1]]
            } else {
                chosen = ['blur', 'lineMode']
            }
            break
        }
    }

    /** @type {guessIllData} */
    let result = {
        illustration: '',
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        blur: 0,
        saturate: 1,
        invert: false,
        hueRotate: 0,
        lineMode: false,
        style: 0,
        filterStyle: '',
        chosenInterferences: [], // 记录选择的干扰类型
    }

    for (const type of chosen) {
        switch (type) {
            case 'blur':
                result.blur = fCompute.randInt(8, 16)
                break
            case 'saturate':
                // 0(灰度) ~ 0.3(低饱和) 或 2.5~4(过饱和)，避免接近正常值1
                result.saturate = Math.random() < 0.5
                    ? fCompute.randFloatBetween(0, 0.3, 2)
                    : fCompute.randFloatBetween(2.5, 4, 2)
                break
            case 'invert':
                result.invert = true;
                break
            case 'hueRotate':
                result.hueRotate = fCompute.randInt(60, 300)
                // 避开接近0/360的区域（太接近原色）
                if (result.hueRotate > 330 && result.hueRotate <= 360) result.hueRotate = 330
                break
            case 'lineMode':
                result.lineMode = true
                break
        }
        // @ts-ignore
        result.chosenInterferences.push(chineseMap[type] || type)
    }

    return result
}

/**
 * 减弱非模糊类干扰
 * @param {guessIllData} data 
 * @param {number[]} fnc
 * @returns {string} 被减弱的干扰名称
 */
function interference_reduce(data, fnc) {
    /**
     * 当前可减弱的非模糊干扰
     * @type {[string, number][]}
     */
    const reducible = []
    if (data.saturate !== 1) reducible.push(['saturate', 30])
    if (data.invert) reducible.push(['invert', 25])
    if (data.hueRotate !== 0) reducible.push(['hueRotate', 50])
    if (data.lineMode) reducible.push(['lineMode', 5])

    if (reducible.length === 0) {
        fnc.splice(fnc.indexOf(4), 1)
        return ''
    }

    const target = fCompute.randFromArray(reducible)
    /** @type {Record<string, string>} */
    const nameMap = { saturate: '饱和度', invert: '反相', hueRotate: '色相', lineMode: '线稿' }

    switch (target) {
        case 'saturate': {
            // 向正常值1靠近
            const step = fCompute.randFloatBetween(0.2, 0.5, 2)
            if (data.saturate < 1) {
                data.saturate = Math.min(1, data.saturate + step)
            } else {
                data.saturate = Math.max(1, data.saturate - step)
            }
            if (data.saturate === 1) {
                checkRemainingInterferences(data, fnc)
            }
            break
        }
        case 'invert': {
            data.invert = false
            checkRemainingInterferences(data, fnc)
            break
        }
        case 'hueRotate': {
            // 向0靠近
            const step = fCompute.randInt(20, 40)
            if (data.hueRotate > 180) {
                data.hueRotate = Math.min(360, data.hueRotate + step)
                if (data.hueRotate >= 360) data.hueRotate = 0
            } else {
                data.hueRotate = Math.max(0, data.hueRotate - step)
            }
            if (data.hueRotate === 0) {
                checkRemainingInterferences(data, fnc)
            }
            break
        }
        case 'lineMode': {
            data.lineMode = false
            checkRemainingInterferences(data, fnc)
            break
        }
    }

    data.filterStyle = buildFilterStyle(data)
    return nameMap[target] || target
}

/**
 * 检查是否还有非模糊类干扰，没有则从fnc中移除类型4
 * @param {guessIllData} data 
 * @param {number[]} fnc 
 */
function checkRemainingInterferences(data, fnc) {
    const hasOtherInterference = data.lineMode
        || (data.saturate !== 1)
        || (data.invert)
        || (data.hueRotate !== 0)
    if (!hasOtherInterference) {
        const idx = fnc.indexOf(4)
        if (idx !== -1) fnc.splice(idx, 1)
    }
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
    return songIdList[fCompute.randInt(0, songIdList.length - 1)]
}