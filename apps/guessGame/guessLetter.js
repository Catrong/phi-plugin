/**Phigros出字母猜曲名游戏
 * 会随机抽选 n 首歌曲
 * 每首曲目的名字只显示一部分，剩下的部分隐藏
 * 通过给出的字母猜出相应的歌曲
 * 玩家可以翻开所有曲目响应的字母获得更多线索
*/
import { pinyin } from 'pinyin-pro'

import Config from '../../components/Config.js'
import send from '../../model/send.js'
import getInfo from '../../model/getInfo.js'
import getPic from '../../model/getPic.js'
import fCompute from '../../model/fCompute.js'
import picmodle from '../../model/picmodle.js'
import logger from '../../components/Logger.js'

/**
 * @type {idString[]}
 */
let songIdList = getInfo.idList || []
/**
 * 存储每首歌曲被抽取的权重
 * @type {Record<string, Record<idString, number>>}
 */
let songweights = {}

// let gamelist = {}//存储标准答案曲名
// let blurlist = {}//存储模糊后的曲名
// let alphalist = {}//存储翻开的字母
// let winnerlist = {} //存储猜对者的群名称
// let lastGuessedTime = {} //存储群聊猜字母全局冷却时间
// let lastRevealedTime = {} //存储群聊翻字母全局冷却时间
// let lastTipTime = {} //存储群聊提示全局冷却时间
// let gameSelectList = {} //群聊游戏选择的游戏范围


class letterGameDataObject {
    /**
     * 单个群聊开字母游戏数据对象
     * @param {number} letterNum 曲目数量
     */
    constructor(letterNum = 8) {
        /** 
         * 曲目数量
         * @type {number}
         */
        this.letterNum = letterNum
        /**
         * 答案曲名列表
         * @type {songString[]}
         **/
        this.ansList = new Array(letterNum).fill('')
        /**
         * 曲目ID列表
         * @type {idString[]}
         */
        this.ansIdList = new Array(letterNum).fill('')
        /**
         * 模糊后的曲名列表
         * @type {(string|null)[]}
         */
        this.blurlist = new Array(letterNum).fill('')
        /**
         * 猜对者列表
         * @type {string[]}
         */
        this.winnerlist = new Array(letterNum).fill('')
        /**
         * 翻开的字母列表
         * @type {string[]}
         */
        this.alphalist = []
        /**
         * 上次猜测时间
         * @type {number}
         */
        this.lastGuessedTime = 0
        /**
         * 上次翻开时间
         * @type {number}
         */
        this.lastRevealedTime = 0
        /**
         * 上次提示时间
         * @type {number}
         */
        this.lastTipTime = 0
        /**
         * 游戏选择的范围
         * @type {string[]}
         */
        this.gameSelectList = []
    }
}


/**@type {Record<string, letterGameDataObject>} */
const letterGameData = {}

/**
 * 存储群聊游戏计时器
 * @type {Object.<string, {startTime: number, newTime: number}>}
 */
let timeCount = {}


/**
 * @import {GameList} from '../guessGame.js'
 */

export default new class guessLetter {
    /**
     * 发起出字母猜歌
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    async start(e, gameList) {
        const { group_id } = e // 使用对象解构提取group_id

        if (letterGameData[group_id]) {
            e.reply(`喂喂喂，已经有群友发起出字母猜歌啦，不要再重复发起了，赶快输入'/第X个XXXX'来猜曲名或者'/出X'来揭开字母吧！结束请发 /${Config.getUserCfg('config', 'cmdhead')} ans 嗷！`, true)
            return true
        }

        let { msg } = e // 提取消息
        msg = msg.replace(/[#/](.*?)(ltr|letter|开字母)(\s*)/, "")

        /**
         * 其他游戏的曲目
         * @type {idString[]}
         */
        let allSelectSongId = []
        // console.info(getInfo.DLC_Info)

        // 初始化游戏数据对象
        letterGameData[group_id] = new letterGameDataObject(Config.getUserCfg('config', 'LetterNum'));

        const currentGame = letterGameData[group_id];

        for (let i in getInfo.DLC_Info) {
            if (msg.includes(i)) {
                letterGameData[group_id].gameSelectList.push(i)
                allSelectSongId = allSelectSongId.concat(/**@type {idString[]} */(getInfo.DLC_Info[i]))
            }
        }

        if (letterGameData[group_id].gameSelectList.length == 0) {
            letterGameData[group_id].gameSelectList = ['pgr']
            allSelectSongId = [...songIdList]
        }

        if (allSelectSongId.length < Config.getUserCfg('config', 'LetterNum')) {
            e.reply("曲库中曲目的数量小于开字母的条数哦！更改曲库后需要重启哦！")
            return true
        }


        if (!songweights[group_id]) {
            songweights[group_id] = {}
        }

        // 将每一首曲目的权重初始化为1
        allSelectSongId.forEach(id => {
            if (!songweights[group_id][id]) {
                songweights[group_id][id] = 1
            } else {
                songweights[group_id][id] *= 1.1 // 每次游戏权重增加10%，防止浮点数过小
                songweights[group_id][id] = Math.min(songweights[group_id][id], 5) // 权重上限5
            }
        })

        let nowTime = Date.now()

        for (let i = 0; i < currentGame.letterNum; i++) {
            // 根据曲目权重随机返回一首曲目名称
            let randId = getRandomSong(e, allSelectSongId)

            // 防止抽到重复的曲目
            let cnnt = 0
            while (currentGame.ansIdList.includes(randId) || getInfo.info(randId)?.can_t_be_letter) {
                ++cnnt
                if (cnnt >= 50) {
                    logger.error(`[phi-plugin][letter]抽取曲目失败，请检查曲库设置`)
                    e.reply(`抽取曲目失败，请检查曲库设置`)
                    return
                }
                randId = getRandomSong(e, allSelectSongId)
            }
            const songs_info = getInfo.info(randId)

            /**@type {songString} */
            const song_name = songs_info?.song ? songs_info.song :/**@type {any} */ (randId)

            currentGame.ansIdList[i] = randId
            currentGame.ansList[i] = song_name
            currentGame.blurlist[i] = encrypt_song_name(song_name)
            gameList[group_id] = { gameType: "guessLetter" }
            timeCount[group_id] = {
                startTime: nowTime,
                newTime: Date.now() + (1000 * Config.getUserCfg('config', 'LetterTimeLength'))
            }

        }

        // 输出提示信息
        e.reply(`开字母开启成功！回复'/nX. XXXX'命令猜歌，例如：/n1. Reimei;发送'/open X'来揭开字母(不区分大小写，不需要指令头)，如'/open A';发送'/${Config.getUserCfg('config', 'cmdhead')} ans'结束并查看答案哦！`)

        // 延时1s
        await timeout(1 * 1000)

        let output = '开字母进行中：\n'
        output += getPuzzle(currentGame);
        await e.reply(output, true)

        /**如果过长时间没人回答则结束 */
        while (timeCount[group_id]?.startTime == nowTime && Date.now() < timeCount[group_id].newTime) {
            await timeout(1000)
        }

        if (!letterGameData[group_id] || nowTime != timeCount[group_id].startTime) {
            return false
        }

        if (letterGameData[group_id]) {
            await e.reply('呜，怎么还没有人答对啊QAQ！只能说答案了喵……')

            e.reply(gameover(group_id, gameList))
            return true
        }
        return true
    }

    /**
     * 翻开字母
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    async reveal(e, gameList) {
        const { group_id, msg } = e
        timeCount[group_id].newTime = Date.now() + (1000 * Config.getUserCfg('config', 'LetterTimeLength'))

        if (!letterGameData[group_id]) {
            e.reply(`现在还没有进行的开字母捏，赶快输入'/${Config.getUserCfg('config', 'cmdhead')} ltr'开始新的一局吧！`, true)
            return false
        }

        const currentGame = letterGameData[group_id];

        const time = Config.getUserCfg('config', 'LetterRevealCd')
        const currentTime = Date.now()
        const timetik = currentTime - currentGame.lastRevealedTime
        const timeleft = Math.floor((1000 * time - timetik) / 1000)

        if (timetik < 1000 * time) {
            e.reply(`翻字符的全局冷却时间还有${timeleft}s呐，先耐心等下哇QAQ`, true)
            return true
        }

        currentGame.lastRevealedTime = currentTime
        /**@type {string} */
        const newMsg = msg.replace(/([#/](出|开|翻|揭|看|翻开|打开|揭开|open)|\s*)/g, '').match(/./)?.[0]

        if (newMsg) {
            const letter = newMsg.toLowerCase()
            let output = []
            let included = false

            if (currentGame.alphalist.includes(letter.toUpperCase())) {
                e.reply(`字符[ ${letter} ]已经被打开过了ww,不用需要再重复开啦！`, true)
                return true
            }

            for (let i in currentGame.ansList) {
                const songname = currentGame.ansList[i]
                const blurname = currentGame.blurlist[i]
                let characters = ''
                let letters = ''

                if (/[\u4e00-\u9fa5]/.test(songname)) {
                    characters = [...songname].filter(char => /[\u4e00-\u9fa5]/.test(char)).join("")
                    letters = pinyin(characters, { pattern: 'first', toneType: 'none', type: 'string' })
                }

                if (!songname.toLowerCase().includes(letter) && !letters.includes(letter)) {
                    continue
                }

                included = true

                if (!blurname) {
                    continue
                }

                let newBlurname = [...songname].map((char, index) => {
                    if (/^[\u4E00-\u9FFF]$/.test(char)) {
                        return pinyin(char, { pattern: 'first', toneType: 'none', type: 'string' }) === letter ? char : blurname[index]
                    }

                    return char.toLowerCase() === letter ? char : blurname[index]
                }).join('');

                currentGame.blurlist[i] = newBlurname

                if (!newBlurname.includes('*')) {
                    currentGame.blurlist[i] = null;
                }
            }

            if (included) {
                currentGame.alphalist = currentGame.alphalist || []
                currentGame.alphalist.push(/^[A-Za-z]+$/g.test(letter) ? letter.toUpperCase() : letter)
                output.push(`成功翻开字母[ ${letter} ]`)
            } else {
                output.push(`这几首曲目中不包含字母[ ${letter} ]`)
            }

            const opened = '当前所有翻开的字符[' + currentGame.alphalist.join(' ') + ']'

            output.push(opened)

            const isEmpty = allGuessed(currentGame);
            if (!isEmpty) {
                output.push('开字母进行中：');
                output.push(getPuzzle(currentGame));
            } else {
                output.unshift('所有字母已翻开，答案如下：');
                output.push(gameover(group_id, gameList));
            }
            e.reply(output.join('\n'), true)

            return true
        }
        return false
    }

    /**
     * 猜测
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    async guess(e, gameList) {
        const { group_id, msg, user_id, sender } = e //使用对象解构提取group_id,msg,user_id和sender
        const currentGame = letterGameData[group_id];
        //必须已经开始了一局
        if (!currentGame) {
            /**未进行游戏放过命令 */
            return false
        }

        timeCount[group_id].newTime = Date.now() + (1000 * Config.getUserCfg('config', 'LetterTimeLength'))

        const time = Config.getUserCfg('config', 'LetterGuessCd')
        const currentTime = Date.now()
        const timetik = currentTime - currentGame.lastGuessedTime
        const timeleft = Math.floor((1000 * time - timetik) / 1000)

        //上一轮猜测的Cd还没过
        if (timetik < 1000 * time) {
            e.reply(`猜测的冷却时间还有${timeleft}s呐，先耐心等下哇QAQ`, true)
            return true
        }

        //上一轮Cd结束，更新新一轮的时间戳
        currentGame.lastGuessedTime = currentTime

        const opened = `\n所有翻开的字母[ ${currentGame.alphalist.join(' ')}]\n`
        const regex = /^[#/]\s*[第n]\s*(\d+|[一二三四五六七八九十百]+)\s*[个首\.]?(.*)$/
        /**
         * [0] 完整匹配
         * [1] Num
         * [2] ans
         * [3] index
         * [4] input
         * [5] groups
         */
        const result = msg.match(regex)

        if (!result) {
            /**格式匹配错误放过命令 */
            return false
        }

        const output = []
        let num = 0

        if (isNaN(result[1])) {
            num = NumberToArabic(result[1])
        } else {
            num = Number(result[1])
        }

        const content = result[2]

        if (num > Config.getUserCfg('config', 'LetterNum')) {
            e.reply(`没有第${num}个啦！看清楚再回答啊喂！￣へ￣`)
            return true
        }

        const ids = getInfo.fuzzysongsnick(content, 0.95)
        const standard_id = currentGame.ansIdList[num] // 标准答案
        const standard_name = currentGame.ansList[num] // 标准答案名称

        if (!ids[0]) {
            e.reply(`没有找到[${content}]的曲目信息呐QAQ`, true)
            return true
        }
        for (const id of ids) {
            if (standard_id === id) {
                //已经猜完移除掉的曲目不能再猜
                if (!currentGame.blurlist[num]) {
                    e.reply(`曲目[${standard_name}]已经猜过了，要不咱们换一个吧uwu`)
                    return true
                }

                currentGame.blurlist[num] = null //移除模糊曲目

                send.send_with_At(e, `恭喜你ww，答对啦喵，第${num}首答案是[${standard_name}]!ヾ(≧▽≦*)o `, true)

                /**发送曲绘 */
                const info = getInfo.info(standard_id)
                if (info?.illustration) { //如果有曲绘文件
                    switch (Config.getUserCfg('config', 'LetterIllustration')) {
                        case "水印版": {
                            e.reply(await picmodle.ill(e, { illustration: info.illustration, illustrator: info.illustrator }))
                            break;
                        }
                        case "原版": {
                            e.reply(getPic.getIll(standard_id))
                        }
                        default:
                            break;
                    }
                }

                currentGame.winnerlist[num] = sender.card //记录猜对者
                const isEmpty = allGuessed(currentGame) //是否全部猜完

                if (!isEmpty) {
                    output.push('开字母进行中：')
                    output.push(opened)

                    output.push(getPuzzle(currentGame));

                    e.reply(output.join('\n'), true)
                    return true
                } else {

                    output.push('所有曲目均已被猜出，答案如下：');
                    output.push(gameover(group_id, gameList));
                    e.reply(output.join('\n'), true)
                    return true
                }
            }
        }

        if (ids[1]) {
            e.reply(`第${num}首不是[${content}]www，要不再想想捏？如果实在不会可以悄悄发个[/${Config.getUserCfg('config', 'cmdhead')} tip]哦≧ ﹏ ≦`, true)
        } else {
            e.reply(`第${num}首不是[${getInfo.info(ids[0])?.song ?? ids[0]}]www，要不再想想捏？如果实在不会可以悄悄发个[/${Config.getUserCfg('config', 'cmdhead')} tip]哦≧ ﹏ ≦`, true)
        }

        return false

    }

    /**
     * 答案
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    async ans(e, gameList) {
        const { group_id } = e//使用对象解构提取group_id

        const currentGame = letterGameData[group_id];
        //必须已经开始了一局
        if (!currentGame) {
            /**未进行游戏放过命令 */
            e.reply(`现在还没有进行的开字母捏，赶快输入'/${Config.getUserCfg('config', 'cmdhead')} letter'开始新的一局吧！`, true)
            return false
        }


        await e.reply('好吧好吧，既然你执着要放弃，那就公布答案好啦。', true)

        e.reply(gameover(group_id, gameList))
        return true
    }

    /**
     * 提示
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    async getTip(e, gameList) {
        const { group_id } = e


        const currentGame = letterGameData[group_id];

        if (!currentGame) {
            e.reply(`现在还没有进行的开字母捏，赶快输入'/${Config.getUserCfg('config', 'cmdhead')} letter'开始新的一局吧！`, true)
            return false
        }

        timeCount[group_id].newTime = Date.now() + (1000 * Config.getUserCfg('config', 'LetterTimeLength'))

        const time = Config.getUserCfg('config', 'LetterTipCd')
        const currentTime = Date.now()
        const timetik = currentTime - currentGame.lastTipTime
        const timeleft = Math.floor((1000 * time - timetik) / 1000)

        if (timetik < 1000 * time) {
            e.reply(`使用提示的全局冷却时间还有${timeleft}s呐，还请先耐心等下哇QAQ`, true)
            return false
        }

        currentGame.lastTipTime = currentTime

        /**@type {number[]} */
        const commonKeys = []

        currentGame.blurlist.forEach((value, index) => {
            if (value) {
                commonKeys.push(index)
            }
        })

        let randsymbol
        while (typeof randsymbol === 'undefined' || randsymbol === '*') {
            const key = commonKeys[fCompute.randBetween(0, commonKeys.length - 1)]
            const songname = currentGame.ansList[key]
            if (!currentGame.blurlist[key]) continue;
            randsymbol = getRandCharacter(songname, currentGame.blurlist[key])
        }

        const output = []

        currentGame.ansList.forEach((value, index) => {
            const songname = value
            let blurname = currentGame.blurlist[index]

            if (!blurname) {
                return;
            }

            let newBlurname = ''
            for (let i = 0; i < songname.length; i++) {
                if (/^[\u4E00-\u9FFF]$/.test(songname[i]) && pinyin(songname[i], { pattern: 'first', toneType: 'none', type: 'string' }) == randsymbol.toLowerCase()) {
                    newBlurname += songname[i]
                    continue
                }

                if (songname[i].toLowerCase() == randsymbol.toLowerCase()) {
                    newBlurname += songname[i]
                } else {
                    newBlurname += blurname[i]
                }
            }

            currentGame.blurlist[index] = newBlurname
            if (!newBlurname.includes('*')) {
                delete currentGame.blurlist[index]
            }
        })

        const reg = /^[A-Za-z]+$/g
        if (reg.test(randsymbol)) {
            currentGame.alphalist.push(randsymbol.toUpperCase())
        } else {
            currentGame.alphalist.push(randsymbol)
        }

        output.push(`已经帮你随机翻开一个字符[ ${randsymbol} ]了捏 ♪（＾∀＾●）ﾉ\n`)

        const opened = '当前所有翻开的字符[' + currentGame.alphalist.join(' ') + ']'

        output.push(opened)

        const isEmpty = allGuessed(currentGame)
        if (!isEmpty) {
            output.push('开字母进行中：')
            output.push(getPuzzle(currentGame));
        } else {
            output.unshift('所有字母已翻开，答案如下：');
            output.push(gameover(group_id, gameList));
        }
        e.reply(output.join('\n'), true)
        return true
    }

    /**
     * 洗牌
     * @param {any} e 事件对象
     */
    async mix(e) {
        const { group_id } = e

        const currentGame = letterGameData[group_id];

        if (currentGame) {
            await e.reply(`当前有正在进行的游戏，请等待游戏结束再执行该指令`, true)
            return false
        }

        songweights[group_id] = {}

        await e.reply(`洗牌成功了www`, true)
        return true
    }
}()


/**
 * 定义随机抽取曲目的函数
 * @param {any} e 
 * @param {idString[]} allSelectSongId 
 * @returns 
 */
function getRandomSong(e, allSelectSongId) {
    //对象解构提取groupid
    const { group_id } = e

    //计算曲目的总权重
    const totalWeight = Object.values(songweights[group_id]).reduce((total, weight) => total + weight, 0)

    //生成一个0到总权重之间带有6位小数的随机数
    const randomWeight = fCompute.randFloatBetween(0, totalWeight, 6)

    let accumulatedWeight = 0
    const ids = /** @type {idString[]} */ (Object.keys(songweights[group_id]))
    for (const id of ids) {
        const weight = songweights[group_id][id]
        accumulatedWeight += weight
        if (accumulatedWeight >= randomWeight) {
            songweights[group_id][id] *= 0.5 //权重每次衰减50%
            return id
        }
    }

    //如果由于浮点数精度问题未能正确选择歌曲，则随机返回一首
    if (allSelectSongId) {
        return allSelectSongId[fCompute.randBetween(0, allSelectSongId.length - 1)]
    }
    return songIdList[fCompute.randBetween(0, songIdList.length - 1)]
}

/**
 * 
 * @param {number} ms 
 * @returns 
 */
function timeout(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms, 'done');
    });
}

/**
 * 定义加密曲目名称滴函数
 * @param {string} name 
 * @returns 
 */
function encrypt_song_name(name) {
    const num = 0
    const numset = Array.from({ length: num }, () => {
        let numToShow = fCompute.randBetween(0, name.length - 1)
        while (name[numToShow] == ' ') {
            numToShow = fCompute.randBetween(0, name.length - 1)
        }
        return numToShow
    })

    let encryptedName = Array.from(name, (char, index) => {
        if (numset.includes(index)) {
            return char
        } else if (char === ' ' || char === ' ') {
            return ' '
        } else {
            return '*'
        }
    }).join('')

    return encryptedName
}

/**
 * 将中文数字转为阿拉伯数字
 * @param {string} digit 
 * @returns 
 */
function NumberToArabic(digit) {
    //只处理到千，再高也根本用不上的www(十位数都用不上的说)
    const numberMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
    const unitMap = { 十: 10, 百: 100, 千: 1000 }

    const total = digit.split('').reduce((acc, character) => {
        // @ts-ignore
        const { [character]: numberValue } = numberMap
        // @ts-ignore
        const { [character]: unitValue } = unitMap

        if (numberValue !== undefined) {
            acc.currentUnit = numberValue
        } else if (unitValue !== undefined) {
            acc.currentUnit *= unitValue
            acc.total += acc.currentUnit
            acc.currentUnit = 0
        }

        return acc
    }, { total: 0, currentUnit: 1 })

    return total.total + total.currentUnit
}

/**
 * 随机取字符
 * @param {string} str 
 * @param {string} blur 
 * @returns 
 */
function getRandCharacter(str, blur) {
    // 寻找未打开的位置
    const temlist = [] // 存放*的下标
    for (let i = 0; i < blur.length; i++) {
        if (blur[i] === '*') {
            temlist.push(i)
        }
    }

    // 生成随机索引
    const randomIndex = fCompute.randBetween(0, temlist.length - 1)

    // 返回随机字符
    return str.charAt(temlist[randomIndex]);
}

/**
 * 结束本群游戏，返回答案
 * @param {string} group_id 
 * @param {GameList} gameList
 */
function gameover(group_id, gameList) {

    const currentGame = letterGameData[group_id]
    const t = [...currentGame.ansList]
    const winner = [...currentGame.winnerlist]

    delete letterGameData[group_id]
    delete gameList[group_id]
    delete timeCount[group_id]

    /**@type {string[]} */
    const output = []


    t.forEach((value, index) => {
        const correct_name = value
        const winner_card = winner[index]
        output.push(`【${index}】${correct_name}` + (winner_card ? ` @${winner_card}` : ''))
    });
    return output.join('\n');
}

/**
 * 
 * @param {letterGameDataObject} currentGame 
 * @returns {boolean}
 */
function allGuessed(currentGame) {
    return currentGame.blurlist.reduce((acc, cur) => acc && (cur === null), true) //是否全部猜完
}

/**
 * 生成谜面
 * @param {letterGameDataObject} currentGame 
 */
function getPuzzle(currentGame) {
    /**@type {string[]} */
    const output = [];
    output.push(`曲库范围：${currentGame.gameSelectList.join('、')}`);
    currentGame.ansList.forEach((song, index) => {
        if (currentGame.blurlist[index]) {
            output.push(`【${index}】${currentGame.blurlist[index]}`)
        } else {
            output.push(`【${index}】${song}`)
            if (currentGame.winnerlist[index]) {
                output.push(` @${currentGame.winnerlist[index]}`)
            }
        }
    })
    return output.join('\n');
}