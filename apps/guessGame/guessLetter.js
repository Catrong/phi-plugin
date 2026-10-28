/**Phigros出字母猜曲名游戏
 * 会随机抽选 n 首歌曲
 * 每首曲目的名字只显示一部分，剩下的部分隐藏
 * 通过给出的字母猜出相应的歌曲
 * 玩家可以翻开所有曲目响应的字母获得更多线索
*/
import { pinyin } from 'pinyin-pro'

import Config from '../../components/Config.js'
import getInfo from '../../model/game/getInfo.js'
import getPic from '../../model/render/getPic.js'
import fCompute from '../../model/game/fCompute.js'
import picmodle from '../../model/render/picmodle.js'
import logger from '../../components/Logger.js'
import { getShortcutMode, sendMessage } from '../../model/render/message.js'
import { guessLetterMessages, guessLetterWords } from '../../model/render/messages.js'
import { isOfficialBot } from '../../model/game/markdown.js'
import {
    LETTER_HIDDEN_CHAR,
    allGuessed,
    encryptSongName,
    getRevealCandidates,
    hasHiddenCharacters,
    revealCharacter
} from './letterGameUtils.js'

/**
 * @type {idString[]}
 */
let songIdList = getInfo.all_idList || []
/**
 * 存储每首歌曲被抽取的权重
 * @type {Record<string, Record<idString, number>>}
 */
let songweights = {}

/** @type {Record<string, NodeJS.Timeout>} */
const songweightCleanupTimers = {}
const SONGWEIGHT_IDLE_TTL = 60 * 60 * 1000

/** @param {string} groupId */
function scheduleSongweightCleanup(groupId) {
    if (songweightCleanupTimers[groupId]) clearTimeout(songweightCleanupTimers[groupId])
    songweightCleanupTimers[groupId] = setTimeout(() => {
        delete songweights[groupId]
        delete songweightCleanupTimers[groupId]
    }, SONGWEIGHT_IDLE_TTL)
    songweightCleanupTimers[groupId].unref?.()
}

/**
 * @param {string} groupId
 * @param {GameList} gameList
 */
function cleanupGameState(groupId, gameList) {
    delete letterGameData[groupId]
    delete gameList[groupId]
    delete timeCount[groupId]
}

/**
 * @typedef {{ansList: string[], winnerlist: string[]}} LetterGameResult
 */

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

export default class guessLetter {
    /**
     * 发起出字母猜歌
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    static async start(e, gameList) {
        const { group_id } = e // 使用对象解构提取group_id

        if (letterGameData[group_id]) {
            sendMessage(e, guessLetterMessages.start.alreadyStarted(), { quote: true })
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
            sendMessage(e, guessLetterMessages.start.tooFewSongs)
            cleanupGameState(group_id, gameList)
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
        scheduleSongweightCleanup(group_id)

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
                    sendMessage(e, guessLetterMessages.start.drawFailed)
                    cleanupGameState(group_id, gameList)
                    return
                }
                randId = getRandomSong(e, allSelectSongId)
            }
            const songs_info = getInfo.info(randId)

            /**@type {songString} */
            const song_name = songs_info?.song ? songs_info.song :/**@type {any} */ (randId)

            currentGame.ansIdList[i] = randId
            currentGame.ansList[i] = song_name
            currentGame.blurlist[i] = encryptSongName(song_name)
            gameList[group_id] = { gameType: "guessLetter" }
            timeCount[group_id] = {
                startTime: nowTime,
                newTime: Date.now() + (1000 * Config.getUserCfg('config', 'LetterTimeLength'))
            }

        }

        // 输出提示信息
        sendMessage(e, guessLetterMessages.start.intro())

        // 延时1s
        await timeout(1 * 1000)

        await tryToSendMd(e, (t) => ['开字母进行中：', getPuzzle(currentGame, t)].join('\n'));

        /**如果过长时间没人回答则结束 */
        while (timeCount[group_id]?.startTime == nowTime && Date.now() < timeCount[group_id].newTime) {
            await timeout(1000)
        }

        if (!letterGameData[group_id] || nowTime !== timeCount[group_id]?.startTime) {
            return false
        }

        if (letterGameData[group_id]) {
            await sendMessage(e, guessLetterMessages.timeout.nobodyCorrect)
            const result = finishGame(group_id, gameList)
            if (result) {
                await tryToSendMd(e, (t) => formatGameover(result, t));
            }

            return true
        }
        return true
    }

    /**
     * 翻开字母
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    static async reveal(e, gameList) {
        const { group_id, msg } = e

        const currentGame = letterGameData[group_id];
        if (!currentGame) {
            sendMessage(e, guessLetterMessages.ans.notRunning(), { quote: true })
            return false
        }

        if (timeCount[group_id]) {
            timeCount[group_id].newTime = Date.now() + (1000 * Config.getUserCfg('config', 'LetterTimeLength'))
        }

        const time = Config.getUserCfg('config', 'LetterRevealCd')
        const currentTime = Date.now()
        const timetik = currentTime - currentGame.lastRevealedTime
        const timeleft = Math.floor((1000 * time - timetik) / 1000)

        if (timetik < 1000 * time) {
            sendMessage(e, guessLetterMessages.reveal.cooldown(timeleft), { quote: true })
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
                sendMessage(e, guessLetterMessages.reveal.letterOpened(letter), { quote: true })
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

                const newBlurname = revealCharacter(songname, blurname, letter)

                currentGame.blurlist[i] = newBlurname

                if (!hasHiddenCharacters(newBlurname)) {
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
                await tryToSendMd(e, (t) => [...output, '开字母进行中：', getPuzzle(currentGame, t)].join('\n'));
            } else {
                const result = finishGame(group_id, gameList)
                if (result) {
                    await tryToSendMd(e, (t) => ['所有字母已翻开，答案如下：', ...output, formatGameover(result, t)].join('\n'));
                }
            }

            return true
        }
        return false
    }

    /**
     * 猜测
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    static async guess(e, gameList) {
        const { group_id, msg, user_id, sender } = e //使用对象解构提取group_id,msg,user_id和sender
        const currentGame = letterGameData[group_id];
        //必须已经开始了一局
        if (!currentGame) {
            /**未进行游戏放过命令 */
            return false
        }

        if (timeCount[group_id]) {
            timeCount[group_id].newTime = Date.now() + (1000 * Config.getUserCfg('config', 'LetterTimeLength'))
        }

        const time = Config.getUserCfg('config', 'LetterGuessCd')
        const currentTime = Date.now()
        const timetik = currentTime - currentGame.lastGuessedTime
        const timeleft = Math.floor((1000 * time - timetik) / 1000)

        //上一轮猜测的Cd还没过
        if (timetik < 1000 * time) {
            sendMessage(e, guessLetterMessages.guess.cooldown(timeleft), { quote: true })
            return true
        }

        //上一轮Cd结束，更新新一轮的时间戳
        currentGame.lastGuessedTime = currentTime

        const opened = guessLetterWords.guess.openedList(currentGame.alphalist.join(' '))
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

        /**
         * @type {string[]}
         */
        const output = []
        let num = 0

        if (isNaN(result[1])) {
            num = NumberToArabic(result[1])
        } else {
            num = Number(result[1])
        }

        const content = result[2]

        if (num > Config.getUserCfg('config', 'LetterNum') || num <= 0) {
            sendMessage(e, guessLetterMessages.guess.invalidIndex(num))
            return true
        }

        --num;

        const ids = getInfo.fuzzysongsnick(content, 0.95)
        const standard_id = currentGame.ansIdList[num] // 标准答案
        const standard_name = currentGame.ansList[num] // 标准答案名称

        if (!ids[0]) {
            sendMessage(e, guessLetterMessages.guess.songNotFound(content), { quote: true })
            return true
        }
        for (const id of ids) {
            if (standard_id === id) {
                //已经猜完移除掉的曲目不能再猜
                if (!currentGame.blurlist[num]) {
                    sendMessage(e, guessLetterMessages.guess.alreadyGuessed(standard_name))
                    return true
                }

                currentGame.blurlist[num] = null //移除模糊曲目

                sendMessage(e, guessLetterMessages.guess.correct(num + 1, standard_name), { at: true, quote: true })

                /**发送曲绘 */
                const info = getInfo.info(standard_id)
                if (info?.illustration) { //如果有曲绘文件
                    switch (Config.getUserCfg('config', 'LetterIllustration')) {
                        case "水印版": {
                            sendMessage(e, guessLetterMessages.puzzle.image(await picmodle.ill(e, { illustration: info.illustration, illustrator: info.illustrator })))
                            break;
                        }
                        case "原版": {
                            sendMessage(e, guessLetterMessages.puzzle.image(getPic.getIll(standard_id)))
                        }
                        default:
                            break;
                    }
                }

                currentGame.winnerlist[num] = sender.card //记录猜对者
                const isEmpty = allGuessed(currentGame) //是否全部猜完

                if (!isEmpty) {
                    output.push(guessLetterWords.puzzle.puzzleHeader)
                    output.push(opened)
                    await tryToSendMd(e, (t) => [...output, getPuzzle(currentGame, t)].join('\n'));
                    return true
                } else {
                    output.push(guessLetterWords.puzzle.allGuessedHeader);
                    const result = finishGame(group_id, gameList)
                    if (result) {
                        await tryToSendMd(e, (t) => [...output, formatGameover(result, t)].join('\n'));
                    }
                    return true
                }
            }
        }

        if (ids[1]) {
            sendMessage(e, guessLetterMessages.guess.wrongRaw(num + 1, content), { quote: true })
        } else {
            sendMessage(e, guessLetterMessages.guess.wrongSong(num + 1, getInfo.info(ids[0])?.song ?? ids[0]), { quote: true })
        }

        return false

    }

    /**
     * 答案
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    static async ans(e, gameList) {
        const { group_id } = e//使用对象解构提取group_id

        const currentGame = letterGameData[group_id];
        //必须已经开始了一局
        if (!currentGame) {
            /**未进行游戏放过命令 */
            sendMessage(e, guessLetterMessages.ans.notRunning(), { quote: true })
            return false
        }


        await sendMessage(e, guessLetterMessages.ans.reveal, { quote: true })
        const result = finishGame(group_id, gameList)
        if (result) {
            await tryToSendMd(e, (t) => formatGameover(result, t));
        }
        return true
    }

    /**
     * 提示
     * @param {any} e 事件对象
     * @param {GameList} gameList 进行中的游戏列表
     */
    static async getTip(e, gameList) {
        const { group_id } = e


        const currentGame = letterGameData[group_id];

        if (!currentGame) {
            sendMessage(e, guessLetterMessages.ans.notRunning(), { quote: true })
            return false
        }

        if (timeCount[group_id]) {
            timeCount[group_id].newTime = Date.now() + (1000 * Config.getUserCfg('config', 'LetterTimeLength'))
        }

        const time = Config.getUserCfg('config', 'LetterTipCd')
        const currentTime = Date.now()
        const timetik = currentTime - currentGame.lastTipTime
        const timeleft = Math.floor((1000 * time - timetik) / 1000)

        if (timetik < 1000 * time) {
            sendMessage(e, guessLetterMessages.getTip.cooldown(timeleft), { quote: true })
            return false
        }

        currentGame.lastTipTime = currentTime

        const candidates = getRevealCandidates(currentGame)
        if (candidates.length === 0) {
            logger.warn(`[phi-plugin][letter]群${group_id}的提示没有可翻开的字符`)
            sendMessage(e, guessLetterMessages.getTip.noCandidates, { quote: true })
            return true
        }
        const randsymbol = candidates[fCompute.randInt(0, candidates.length - 1)]

        /**
         * @type {string[]}
         */
        const output = []

        currentGame.ansList.forEach((value, index) => {
            const songname = value
            let blurname = currentGame.blurlist[index]

            if (!blurname) {
                return;
            }

            const newBlurname = revealCharacter(songname, blurname, randsymbol)

            currentGame.blurlist[index] = newBlurname
            if (!hasHiddenCharacters(newBlurname)) {
                currentGame.blurlist[index] = null
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
            await tryToSendMd(e, (t) => [...output, getPuzzle(currentGame, t)].join('\n'));
        } else {
            output.unshift('所有字母已翻开，答案如下：');
            const result = finishGame(group_id, gameList)
            if (result) {
                await tryToSendMd(e, (t) => [...output, formatGameover(result, t)].join('\n'));
            }
        }
        return true
    }

    /**
     * 洗牌
     * @param {any} e 事件对象
     */
    static async mix(e) {
        const { group_id } = e

        const currentGame = letterGameData[group_id];

        if (currentGame) {
            await sendMessage(e, guessLetterMessages.mix.running, { quote: true })
            return false
        }

        songweights[group_id] = {}
        scheduleSongweightCleanup(group_id)

        await sendMessage(e, guessLetterMessages.mix.shuffled, { quote: true })
        return true
    }
}


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
        return allSelectSongId[fCompute.randInt(0, allSelectSongId.length - 1)]
    }
    return songIdList[fCompute.randInt(0, songIdList.length - 1)]
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
 * 结束本群游戏并返回结算快照。重复调用不会再次结算。
 * @param {string} group_id
 * @param {GameList} gameList
 * @returns {LetterGameResult|null}
 */
function finishGame(group_id, gameList) {
    const currentGame = letterGameData[group_id]
    if (!currentGame) return null

    const result = {
        ansList: [...currentGame.ansList],
        winnerlist: [...currentGame.winnerlist]
    }

    cleanupGameState(group_id, gameList)
    return result
}

/**
 * @param {LetterGameResult} result
 * @param {boolean} letterMarkdown
 */
function formatGameover(result, letterMarkdown) {
    /**@type {string[]} */
    const output = ['***\n']

    result.ansList.forEach((value, index) => {
        const correct_name = value
        const winner_card = result.winnerlist[index]
        output.push(guessLetterWords.puzzle.songLine(index, correct_name) + (winner_card ? guessLetterWords.puzzle.winner(winner_card) : ''))
    });
    if (letterMarkdown) {
        const cmdhead = Config.getUserCfg('config', 'cmdhead')
        output.push(`\n***\n\n` +
            // '| - | - | - |\n' +
            `| ${cmdInpt(`/${cmdhead} letter `, guessLetterWords.puzzle.restart)} | ${cmdInpt(`/${cmdhead} guess`, guessLetterWords.puzzle.guess)} | ${cmdInpt(`/${cmdhead} tipgame`, guessLetterWords.puzzle.tipGame)} |` +
            '\n| :---: | :---: | :---: |\n');
    }

    return output.join('\n');
}

/**
 * 生成谜面
 * @param {letterGameDataObject} currentGame 
 * @param {boolean} letterMarkdown 是否使用markdown格式的字母谜面
 */
function getPuzzle(currentGame, letterMarkdown) {
    /**@type {string[]} */
    const output = [];
    letterMarkdown && output.push('***');
    output.push(guessLetterWords.puzzle.range(currentGame.gameSelectList));
    currentGame.ansList.forEach((song, index) => {
        if (currentGame.blurlist[index]) {
            const visibleBlurName = currentGame.blurlist[index].replaceAll(LETTER_HIDDEN_CHAR, '*')
            const str = letterMarkdown
                ? cmdInpt(`/n${index + 1}. `, visibleBlurName.replace(/\*/g, '\\*'))
                : visibleBlurName
            output.push(`${index + 1}. ${str}`);
        } else {
            output.push(guessLetterWords.puzzle.songLine(index, song) + guessLetterWords.puzzle.guessedMark)
            if (currentGame.winnerlist[index]) {
                output.push(guessLetterWords.puzzle.winner(currentGame.winnerlist[index]))
            }
        }
    })
    if (letterMarkdown) {
        const cmdhead = Config.getUserCfg('config', 'cmdhead')
        output.push(`\n***\n` +
            // '| - | - | - |\n' +
            `| ${cmdInpt(`/开 `, guessLetterWords.puzzle.open)} | ${cmdInpt(`/${cmdhead} tip`, guessLetterWords.puzzle.tip)} | ${cmdInpt(`/${cmdhead} ans`, guessLetterWords.puzzle.answer)} |` +
            '\n| :---: | :---: | :---: |\n');
        output.push(guessLetterWords.puzzle.clickTip)
    }
    return output.join('\n');
}

/**
 * @param {string} text 指令内容
 * @param {string} show
 * @param {boolean} reference
 */
function cmdInpt(text, show, reference = false) {
    return `<qqbot-cmd-input text="${text}" show="${show}" reference="${reference}" />`
}

/**@import {botEvent} from '../../components/baseClass.js' */

/**
 * @param {botEvent} e
 * @param {(arg0: boolean) => string} fnc
 */
async function tryToSendMd(e, fnc) {
    const useMarkdown = Config.getUserCfg('config', 'LetterMessageMode') === 'markdown'
    if (!useMarkdown || getShortcutMode() === 'off' || ((e?.bot || e?.platform) && !isOfficialBot(e))) {
        await sendMessage(e, guessLetterMessages.puzzle.plain(fnc(false)))
        return;
    }

    let sent
    try {
        sent = /** @type {{error?: unknown[]}|undefined} */ (await sendMessage(e, guessLetterMessages.puzzle.markdown(fnc(true))))
    } catch (error) {
        logger.warn(`[phi-plugin][letter]Markdown发送失败，改用普通消息`, error)
        await sendMessage(e, guessLetterMessages.puzzle.plain(fnc(false)))
        return
    }

    if (sent?.error?.length) {
        await sendMessage(e, guessLetterMessages.puzzle.plain(fnc(false)))
    }
}
