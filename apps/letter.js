/**Phigros出字母猜曲名游戏
 * 会随机抽选 n 首歌曲
 * 每首曲目的名字只显示一部分，剩下的部分隐藏
 * 通过给出的字母猜出相应的歌曲
 * 玩家可以翻开所有曲目响应的字母获得更多线索
*/
import { pinyin } from 'pinyin-pro'

import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'
import send from '../model/send.js'

let songsname = []
let songweights = {} //存储每首歌曲被抽取的权重
for (let i in get.info()) {
    songsname.push(i)
}

//曲目初始洗牌
shuffleArray(songsname)

let gamelist = {}//存储标准答案曲名
let blurlist = {}//存储模糊后的曲名
let alphalist = {}//存储翻开的字母
let winnerlist = {} //存储猜对者的群名称
let lastGuessedTime = {} //存储群聊猜字母全局冷却时间
let lastRevealedTime = {} //存储群聊翻字母全局冷却时间
let lastTipTime = {} //存储群聊提示全局冷却时间
let isfuzzymatch = true

export class philetter extends plugin {
    constructor() {
        super({
            name: 'phi-lettergame',
            dsc: 'phi-plugin出你字母',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(letter|出你字母|猜曲名|开字母|猜字母)[\\s(arc)(pgr)(orz)]*$`,
                    fnc: 'start'
                },
                {
                    reg: `^[#/](出|开|翻|揭|看|翻开|打开|揭开)(\\s*)[a-zA-Z\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\d\S]$`,
                    fnc: 'reveal'
                },
                {
                    reg: `^[#/]${Config.getDefOrConfig('config', 'isGuild') ? '?' : ''}(\\s*)第(\\s*)[1-9一二三四五六七八九十百千万](\\s*)(个|首)?.*$`,
                    fnc: 'guess'
                },
                {
                    reg: `^[#/](字母|letter|ltr)(ans|答案|结束)$`,
                    fnc: 'ans'
                },
                {
                    reg: `^[#/](提示|tip)$`,
                    fnc: 'tip'
                },
                {
                    reg: `^[#/](字母洗牌|lettermix)$`,
                    fnc: 'mix'
                },
            ]
        })

    }
    /**发起出字母猜歌 **/
    async start(e) {
        const { group_id } = e // 使用对象解构提取group_id
        let { msg } = e // 提取消息
        msg = msg.replace(/[#/](.*)(letter|出你字母|猜曲名|开字母|猜字母)(\s*)/, "")

        /**处理其他游戏曲库 */
        let totNameList = []
        if (msg.includes("pgr") || !msg) {
            totNameList = [...songsname]
        }
        if (msg.includes("arc") && get.arcName) {
            totNameList = [...totNameList, ...get.arcName]
        }
        if (msg.includes("orz") && get.orzName) {
            totNameList = [...totNameList, ...get.orzName]
        }

        if (gamelist[group_id]) {
            e.reply("喂喂喂，已经有群友发起出字母猜歌啦，不要再重复发起了，赶快输入'/第X个XXXX'来猜曲名或者'/出X'来揭开字母吧！", true)
            return true
        }

        if (songsname.length < Config.getDefOrConfig('config', 'LetterNum')) {
            e.reply("曲库中曲目的数量小于开字母的条数哦！更改曲库后需要重启哦！")
            return true
        }

        alphalist[group_id] = alphalist[group_id] || {}
        lastGuessedTime[group_id] = lastGuessedTime[group_id] || {}
        lastRevealedTime[group_id] = lastRevealedTime[group_id] || {}

        alphalist[group_id] = ''
        lastGuessedTime[group_id] = 0
        lastRevealedTime[group_id] = 0

        if (!songweights[group_id]) {
            songweights[group_id] = {}

            // 将每一首曲目的权重初始化为1
            songsname.forEach(song => {
                songweights[group_id][song] = 1
            })
        }


        // 预开猜对者数组
        winnerlist[group_id] = {}

        // 存储单局抽到的曲目下标
        let chose = []

        for (let i = 1; i <= Config.getDefOrConfig('config', 'LetterNum'); i++) {
            // 根据曲目权重随机返回一首曲目名称
            let randsong = getRandomSong(e)

            // 防止抽到重复的曲目
            let cnnt = 0
            while (chose.includes(randsong) || get.info(randsong).can_t_be_letter) {
                ++cnnt
                if (cnnt >= 50) {
                    logger.error(`[phi letter]抽取曲目失败，请检查曲库设置`)
                    e.reply(`[phi letter]抽取曲目失败，请检查曲库设置`)
                    return
                }
                randsong = getRandomSong(e)
            }

            const songs_info = get.info()[randsong]
            chose.push(randsong)

            gamelist[group_id] = gamelist[group_id] || {}
            blurlist[group_id] = blurlist[group_id] || {}

            gamelist[group_id][i] = songs_info.song
            blurlist[group_id][i] = encrypt_song_name(songs_info.song)

        }

        // 输出提示信息
        e.reply(`出你字母开启成功！回复'/X个XXXX'命令猜歌，例如：/第1个Reimei;发送'/出X'来揭开字母(不区分大小写)，如'/出A';发送'/ltrans'结束并查看答案`)

        // 延时1s
        await timeout(1 * 1000)

        let output = '出你字母进行中：\n'
        for (const i of Object.keys(blurlist[group_id])) {
            const blur_name = blurlist[group_id][i]
            output += `【${i}】${blur_name}\n`
        }
        await e.reply(output, true)

        /**单局游戏不超过设定 */
        for (let j = 0; j < Config.getDefOrConfig('config', 'LetterTimeLength'); ++j) {
            await timeout(1000)
            if (!gamelist[group_id]) {
                return false
            }
        }

        if (gamelist[group_id]) {
            await e.reply('呜，怎么还没有人答对啊QAQ！只能说答案了喵……')

            e.reply(gameover(group_id))
            return true
        }
        return true
    }

    /** 翻开字母 **/
    async reveal(e) {
        const { group_id: groupId, msg } = e

        if (!gamelist[groupId]) {
            e.reply(`现在还没有进行的出你字母捏，赶快输入'/${Config.getDefOrConfig('config', 'cmdhead')} letter' 或 '/${Config.getDefOrConfig('config', 'cmdhead')} 出你字母' 开始新的一局吧！`, true)
            return false
        }

        const time = Config.getDefOrConfig('config', 'LetterRevealCd')
        const currentTime = Date.now()
        const timetik = currentTime - lastRevealedTime[groupId]
        const timeleft = Math.floor((1000 * time - timetik) / 1000)

        if (timetik < 1000 * time) {
            e.reply(`翻字符的全局冷却时间还有${timeleft}s呐，先耐心等下哇QAQ`, true)
            return true
        }

        lastRevealedTime[groupId] = currentTime

        const newMsg = msg.replace(/[#/](出|开|翻|揭|看|翻开|打开|揭开)(\s*)/g, '')

        if (newMsg) {
            const letter = newMsg.toLowerCase()
            let output = []
            let included = false

            if (alphalist[groupId].replace(/\[object Object\]/g, '').includes(letter.toUpperCase())) {
                e.reply(`字符[ ${letter} ]已经被打开过了ww,不用需要再重复开啦！`, true)
                return true
            }

            for (let i in gamelist[groupId]) {
                const songname = gamelist[groupId][i]
                const blurname = blurlist[groupId][i]
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

                if (!blurlist[groupId][i]) {
                    continue
                }

                let newBlurname = [...songname].map((char, index) => {
                    if (/^[\u4E00-\u9FFF]$/.test(char)) {
                        return pinyin(char, { pattern: 'first', toneType: 'none', type: 'string' }) === letter ? char : blurname[index]
                    }

                    return char.toLowerCase() === letter ? char : blurname[index]
                }).join('');

                blurlist[groupId][i] = newBlurname

                if (!newBlurname.includes('*')) {
                    delete blurlist[groupId][i]
                }
            }

            if (included) {
                alphalist[groupId] = alphalist[groupId] || ''
                alphalist[groupId] += /^[A-Za-z]+$/g.test(letter) ? letter.toUpperCase() + ' ' : letter + ' '
                output.push(`成功翻开字母[ ${letter} ]\n`)
            } else {
                output.push(`这几首曲目中不包含字母[ ${letter} ]\n`)
            }

            output.push(`当前所有翻开的字母[ ${alphalist[groupId].replace(/\[object Object\]/g, '')}]`)

            let isEmpty = Object.getOwnPropertyNames(blurlist[groupId]).length === 0

            output = output.concat(Object.keys(gamelist[groupId]).map(m => {
                if (!isEmpty && blurlist[groupId][m]) {
                    return `\n【${m}】${blurlist[groupId][m]}`
                } else {
                    let result = `\n【${m}】${gamelist[groupId][m]}`

                    if (winnerlist[groupId][m]) {
                        result += ` @${winnerlist[groupId][m]}`
                    }

                    return result
                }
            }));

            if (isEmpty) {
                output.unshift('\n所有字母已翻开，答案如下：\n')
                delete alphalist[groupId]
                delete blurlist[groupId]
                delete gamelist[groupId]
                delete winnerlist[groupId]
            }

            e.reply(output, true)

            return true
        }
        return false
    }

    /** 猜测 **/
    async guess(e) {
        const { group_id, msg, user_id, sender } = e //使用对象解构提取group_id,msg,user_id和sender

        //必须已经开始了一局
        if (gamelist[group_id]) {
            const time = Config.getDefOrConfig('config', 'LetterGuessCd')
            const currentTime = Date.now()
            const timetik = currentTime - lastGuessedTime[group_id]
            const timeleft = Math.floor((1000 * time - timetik) / 1000)

            //上一轮猜测的Cd还没过
            if (timetik < 1000 * time) {
                e.reply(`猜测的冷却时间还有${timeleft}s呐，先耐心等下哇QAQ`, true)
                return true
            }

            //上一轮Cd结束，更新新一轮的时间戳
            lastGuessedTime[group_id] = currentTime

            const opened = `\n所有翻开的字母[ ${alphalist[group_id].replace(/\[object Object\]/g, '')}]\n`
            const regex = /^[#/]\s*第\s*(\d+|[一二三四五六七八九十百]+)\s*(个|首)?(.*)$/
            const result = msg.match(regex)

            if (result) {
                const output = []
                let num = 0

                if (isNaN(result[1])) {
                    num = NumberToArabic(result[1])
                } else {
                    num = Number(result[1])
                }

                const content = result[3]

                if (num > Config.getDefOrConfig('config', 'LetterNum')) {
                    e.reply(`没有第${num}个啦！看清楚再回答啊喂！￣へ￣`)
                    return true
                }

                const songs = !isfuzzymatch ? get.songsnick(content) : get.fuzzysongsnick(content, 0.95)
                const standard_song = gamelist[group_id][num] // 标准答案

                if (songs[0]) {
                    for (const song of songs) {
                        if (standard_song === song) {
                            //已经猜完移除掉的曲目不能再猜
                            if (!blurlist[group_id][num]) {
                                e.reply(`曲目[${standard_song}]已经猜过了，要不咱们换一个吧uwu`)
                                return true
                            }

                            delete blurlist[group_id][num]
                            send.send_with_At(e, `恭喜你ww，答对啦喵，第${num}首答案是[${standard_song}]!ヾ(≧▽≦*)o `, true)

                            if (get.info()[standard_song].illustration) { //如果有曲绘文件
                                e.reply(await get.getillatlas(e, { illustration: get.getill(standard_song), illustrator: get.info()[standard_song]["illustrator"] }))
                            }

                            winnerlist[group_id][num] = sender.card //记录猜对者
                            const isEmpty = Object.getOwnPropertyNames(blurlist[group_id]).length === 0 //是否全部猜完

                            if (!isEmpty) {
                                output.push('出你字母进行中：')
                                output.push(opened)

                                for (const m of Object.keys(gamelist[group_id])) {
                                    if (blurlist[group_id][m]) {
                                        output.push(`\n【${m}】${blurlist[group_id][m]}`)
                                    } else {
                                        output.push(`\n【${m}】${gamelist[group_id][m]}`)

                                        if (winnerlist[group_id][m]) {
                                            output.push(` @${winnerlist[group_id][m]}`)
                                        }
                                    }
                                }

                                e.reply(output, true)
                                return true
                            } else {
                                delete alphalist[group_id]
                                delete blurlist[group_id]

                                output.push('出你字母已结束，答案如下：\n')

                                for (const m of Object.keys(gamelist[group_id])) {
                                    output.push(`\n【${m}】${gamelist[group_id][m]}`)

                                    if (winnerlist[group_id][m]) {
                                        output.push(` @${winnerlist[group_id][m]}`)
                                    }
                                }

                                output.push(opened)
                                delete gamelist[group_id]
                                delete winnerlist[group_id]

                                e.reply(output)
                                return true
                            }
                        }
                    }

                    if (songs[1]) {
                        e.reply(`第${num}首不是[${content}]www，要不再想想捏？如果实在不会可以悄悄发个[/提示]呐≧ ﹏ ≦`, true)
                    } else {
                        e.reply(`第${num}首不是[${songs[0]}]www，要不再想想捏？如果实在不会可以悄悄发个[/提示]呐≧ ﹏ ≦`, true)
                    }

                    return false
                }

                e.reply(`没有找到[${content}]的曲目信息呐QAQ`, true)
                return true
            }

            /**格式匹配错误放过命令 */
            return false
        }

        /**未进行游戏放过命令 */
        return false
    }

    /** 答案 **/
    async ans(e) {
        const { group_id } = e//使用对象解构提取group_id

        if (gamelist[group_id]) {
            await e.reply('好吧好吧，既然你执着要放弃，那就公布答案好啦。', true)

            e.reply(gameover(group_id))
            return true
        }

        e.reply(`现在还没有进行的出你字母捏，赶快输入'/${Config.getDefOrConfig('config', 'cmdhead')} letter' 或 '/${Config.getDefOrConfig('config', 'cmdhead')} 出你字母' 开始新的一局吧！`, true)
        return false
    }

    /** 提示 **/
    async tip(e) {
        const { group_id } = e

        if (!gamelist[group_id]) {
            e.reply(`现在还没有进行的出你字母捏，赶快输入'/${Config.getDefOrConfig('config', 'cmdhead')} letter' 或 '/${Config.getDefOrConfig('config', 'cmdhead')} 出你字母' 开始新的一局吧！`, true)
            return true
        }

        const time = Config.getDefOrConfig('config', 'LetterTipCd')
        const currentTime = Date.now()
        const timetik = currentTime - lastTipTime[group_id]
        const timeleft = Math.floor((1000 * time - timetik) / 1000)

        if (timetik < 1000 * time) {
            e.reply(`使用提示的全局冷却时间还有${timeleft}s呐，还请先耐心等下哇QAQ`, true)
            return true
        }

        lastTipTime[group_id] = currentTime

        const commonKeys = Object.keys(gamelist[group_id]).filter(key => key in blurlist[group_id])

        let randsymbol
        while (typeof randsymbol === 'undefined' || randsymbol === '*') {
            const key = commonKeys[randint(0, commonKeys.length - 1)]
            const songname = gamelist[group_id][key]
            randsymbol = getRandCharacter(songname, blurlist[group_id][key])
        }

        const output = []

        for (const key of Object.keys(gamelist[group_id])) {
            const songname = gamelist[group_id][key]
            let blurname = blurlist[group_id][key]

            if (!blurname) {
                continue
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

            blurlist[group_id][key] = newBlurname
            if (!newBlurname.includes('*')) {
                delete blurlist[group_id][key]
            }
        }

        alphalist[group_id] = alphalist[group_id] || {}

        const reg = /^[A-Za-z]+$/g
        if (reg.test(randsymbol)) {
            alphalist[group_id] += randsymbol.toUpperCase() + ' '
        } else {
            alphalist[group_id] += randsymbol + ' '
        }

        output.push(`已经帮你随机翻开一个字符[ ${randsymbol} ]了捏 ♪（＾∀＾●）ﾉ\n`)

        const opened = '当前所有翻开的字符[ ' + alphalist[group_id].replace(/\[object Object\]/g, '') + ']'

        output.push(opened)

        const isEmpty = Object.getOwnPropertyNames(blurlist[group_id]).length === 0
        if (!isEmpty) {
            for (const key of Object.keys(gamelist[group_id])) {
                if (blurlist[group_id][key]) {
                    output.push(`\n【${key}】${blurlist[group_id][key]}`)
                } else {
                    output.push(`\n【${key}】${gamelist[group_id][key]}`)
                    if (winnerlist[group_id][key]) {
                        output.push(` @${winnerlist[group_id][key]}`)
                    }
                }
            }
        } else {
            delete (alphalist[group_id])
            delete (blurlist[group_id])
            output.push('\n字母已被全部翻开，答案如下：')
            output.push(`\n【${key}】${gamelist[group_id][key]}`)
            if (winnerlist[group_id][key]) {
                output.push(` @${winnerlist[group_id][key]}`)
            }

            delete (gamelist[e.group_id])
            delete (winnerlist[e.group_id])
        }

        e.reply(output, true)
        return true
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

    // 检查字母是否包含在曲目中
    checkLetterInSongs(group_id, letter) {
        const songs_info = get.info()

        for (const i of Object.keys(gamelist[group_id])) {
            const songname = gamelist[group_id][i]
            const blurname = blurlist[group_id][i]
            const characters = (songname.match(/[\u4e00-\u9fa5]/g) || []).join("")
            const letters = pinyin(characters, { pattern: 'first', toneType: 'none', type: 'string' })

            if (!(songname.toLowerCase().includes(letter.toLowerCase())) && !letters.includes(letter.toLowerCase())) {
                continue
            }

            if (!(blurname)) {
                continue
            }

            let newBlurname = ''
            for (let ii = 0; ii < songname.length; ii++) {
                if (/^[\u4E00-\u9FFF]$/.test(songname[ii])) {
                    if (pinyin(songname[ii], { pattern: 'first', toneType: 'none', type: 'string' }) === letter.toLowerCase()) {
                        newBlurname += songname[ii]
                        continue
                    }
                }

                if (songname[ii].toLowerCase() === letter.toLowerCase()) {
                    newBlurname += songname[ii]
                } else {
                    newBlurname += blurname[ii]
                }
            }
            blurlist[group_id][i] = newBlurname
            if (!newBlurname.includes('*')) {
                delete blurlist[group_id][i]
            }
        }

        return Object.keys(blurlist[group_id]).length > 0
    }

}

/**
 * RandBetween
 * @param {number} top 随机值上界
 */
function randbt(top, bottom = 0) {
    return Number((Math.random() * (top - bottom)).toFixed(0)) + bottom
}

//定义生成指定区间整数随机数的函数
function randint(min, max) {
    const range = max - min + 1
    const randomOffset = Math.floor(Math.random() * range)
    return (randomOffset + min) % range + min
}

//定义生成指定区间带有指定小数位数随机数的函数
function randfloat(min, max, precision = 0) {
    let range = max - min
    let randomOffset = Math.random() * range
    let randomNumber = randomOffset + min + range * 10 ** -precision

    return precision === 0 ? Math.floor(randomNumber) : randomNumber.toFixed(precision)
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
            songweights[group_id][song] *= 0.7 //权重每次衰减30%
            return song
        }
    }

    //如果由于浮点数精度问题未能正确选择歌曲，则随机返回一首
    return songsname[randint(0, songsname.length - 1)]
}

function timeout(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms, 'done');
    });
}

// 定义加密曲目名称滴函数
function encrypt_song_name(name) {
    const num = 0
    const numset = Array.from({ length: num }, () => {
        let numToShow = randint(0, name.length - 1)
        while (name[numToShow] == ' ') {
            numToShow = randint(0, name.length - 1)
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

//将中文数字转为阿拉伯数字
function NumberToArabic(digit) {
    //只处理到千，再高也根本用不上的www(十位数都用不上的说)
    const numberMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
    const unitMap = { 十: 10, 百: 100, 千: 1000 }

    const total = digit.split('').reduce((acc, character) => {
        const { [character]: numberValue } = numberMap
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

//随机取字符
function getRandCharacter(str, blur) {
    // 寻找未打开的位置
    const temlist = [] // 存放*的下标
    for (let i = 0; i < blur.length; i++) {
        if (blur[i] === '*') {
            temlist.push(i)
        }
    }

    // 生成随机索引
    const randomIndex = randint(0, temlist.length - 1)

    // 返回随机字符
    return str.charAt(temlist[randomIndex]);
}

/**结束本群游戏，返回答案 */
function gameover(group_id) {

    const t = gamelist[group_id]
    const winner = winnerlist[group_id]

    delete alphalist[group_id]
    delete gamelist[group_id]
    delete blurlist[group_id]
    delete winnerlist[group_id]

    const output = ['出你字母已结束，答案如下：']


    for (const m of Object.keys(t)) {
        const correct_name = t[m]
        const winner_card = winner[m]
        output.push(`\n【${m}】${correct_name}`)

        if (winner_card) {
            output.push(` @${winner_card}`)
        }
    }
    return output
}