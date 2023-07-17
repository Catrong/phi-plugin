/**Phigros出字母猜曲名游戏
 * 会随机抽选8首歌曲
 * 每首曲目的名字只显示一部分，剩下的部分隐藏
 * 通过给出的字母猜出响应的歌曲
 * 玩家可以翻开所有曲目响应的字母获得更多线索
*/
import { segment } from 'oicq'
import { pinyin } from 'pinyin-pro'

import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'

await get.init()
var songsname = []
for (let i in get.info) {
    songsname.push(i)
}

var gamelist = {}//存储标准答案曲名
var blurlist = {}//存储模糊后的曲名
var alphalist = {}//存储翻开的字母
var winnerlist = {} //存储猜对者
var lastGuessedTime = {} //存储群聊猜字母全局冷却时间
var lastRevealedTime = {} //存储群聊翻字母全局冷却时间
var lastTipTime = {} //存储群聊提示全局冷却时间
var isfuzzymatch = true

export class philetter extends plugin {
    constructor() {
        super({
            name: 'phi-lettergame',
            dsc: 'phi-plugin出你字母',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(letter|出你字母|猜曲名|开字母|猜字母)$`,
                    fnc: 'start'
                },
                {
                    reg: `^[#/](出|开|翻|揭|看|翻开|打开|揭开)(\\s*)[a-zA-Z\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\d\S]$`,
                    fnc: 'reveal'
                },
                {
                    reg: `^[#/](\\s*)第(\\s*)[1-8一二三四五六七八](\\s*)(个|首)?.*$`,
                    fnc: 'guess'
                },
                {
                    reg: `^[#/]((字母)?答案|结束)$`,
                    fnc: 'ans'
                },
                {
                    reg: `^[#/](提示|tip)$`,
                    fnc: 'tip'
                }

            ]
        })

    }
    /**发起出字母猜歌 */
    async start(e) {
        if (gamelist[e.group_id]) {
            e.reply("喂喂喂，已经有群友发起出字母猜歌啦，不要再重复发起了，赶快输入'#第X个XXXX'来猜曲名或者'#出X'来揭开字母吧！", true)
            return true
        }

        //对曲目进行洗牌
        songsname = shuffleArray(songsname)

        alphalist[e.group_id] = alphalist[e.group_id] || {}
        alphalist[e.group_id] = ''

        lastGuessedTime[e.group_id] = lastGuessedTime[e.group_id] || {}
        lastGuessedTime[e.group_id] = 0

        lastRevealedTime[e.group_id] = lastRevealedTime[e.group_id] || {}
        lastRevealedTime[e.group_id] = 0


        //预开猜对者数组
        winnerlist[e.group_id] = {}

        //存储单局抽到的曲目下标
        var chose = []

        for (var i = 1; i <= 8; i++) {
            var num = rand(0, songsname.length - 1)
            //防止抽到重复的曲目
            while (chose.includes(num)) {
                num = rand(0, songsname.length - 1)
            }
            var songName = songsname[num]
            var songs_info = get.info[songName]
            chose.push(num)

            gamelist[e.group_id] = gamelist[e.group_id] || {}
            gamelist[e.group_id][i] = songs_info.song

            blurlist[e.group_id] = blurlist[e.group_id] || {}
            blurlist[e.group_id][i] = encrypt_song_name(songs_info.song)//模糊歌名
        }
        e.reply(`出你字母开启成功！回复'#第X个XXXX'命令猜歌，例如：#第1个Reimei;发送'#出X'来揭开字母(不区分大小写)，如'#出A';发送'#字母答案'结束并查看答案`)

        //延时1s
        await timeout(1 * 1000)

        var output = '出你字母进行中：\n'
        for (var i in blurlist[e.group_id]) {
            var blur_name = blurlist[e.group_id][i]
            output += '【' + i + '】' + blur_name + '\n'
        }
        await e.reply(output, true)

        return true
    }

    async reveal(e) {
        if (!gamelist[e.group_id]) {
            e.reply(`现在还没有进行的出你字母捏，赶快输入'#${Config.getDefOrConfig('config', 'cmdhead')} letter' 或 '#${Config.getDefOrConfig('config', 'cmdhead')} 出你字母' 开始新的一局吧！`, true)
            return true
        }

        var time = Config.getDefOrConfig('config', 'LetterRevealCd')
        var currentTime = Date.now()
        var timetik = currentTime - lastRevealedTime[e.group_id]
        var timeleft = Math.floor((1000 * time - timetik)/1000)
        //上一轮翻开的Cd没结束
        if(timetik < 1000 * time) {
            e.reply(`翻字符的全局冷却时间还有${timeleft}s呐，先耐心等下哇QAQ`, true) 
            return true
        }
        //上一轮Cd结束，更新新一轮的时间戳
        lastRevealedTime[e.group_id] = currentTime

        var msg = e.msg.replace(/[#/](出|开|翻|揭|看|翻开|打开|揭开)(\s*)/g, '')

        if (msg) {
            //匹配成功
            var letter = msg
            var output = []
            var included = false
            for (var i in gamelist[e.group_id]) {
                var songname = gamelist[e.group_id][i]
                var blurname = blurlist[e.group_id][i]
                var winnerid = winnerlist[e.group_id][i]
                var characters = ''
                var letters = ''

                if(alphalist[e.group_id].includes(letter.toUpperCase())){
                    e.reply(`字符[ ${letter} ]已经被打开过了ww,不用需要再重复开啦！\n`, true)
                    return true
                }

                if(/[\u4e00-\u9fa5]/.test(songname)) {
                    characters = (songname.match(/[\u4e00-\u9fa5]/g) || []).join("")
                    letters = pinyin(characters, { pattern: 'first', toneType: 'none', type: 'string' })
                }
                //曲名是否包含这个字母，或者如果为中文则首字母是否包含这个字母，不包含就不做额外修改操作，直接遍历输出
                if (!(songname.toLowerCase().includes(letter.toLowerCase())) && !letters.includes(letter.toLowerCase())) {
                    //blurlist不存在gamelist里的曲名，说明已经被猜出来然后删除了，直接输出标准答案即可，否则输出加密曲名
                    if (!(blurlist[e.group_id][i])) {
                        output.push(`【${i}】 ${songname} `) //标准答案
                        if (Config.getDefOrConfig('config', 'LetterWinner') && winnerid) {
                            output.push(segment.at(winnerid)) //猜对者
                        }
                        output.push('\n')
                    } else {
                        output.push(`【${i}】 ${blurname}\n`)
                    }
                    continue
                }
                //包含字母
                included = true

                //就算包含，但是被猜出来了也是直接输出标准曲名
                if (!(blurlist[e.group_id][i])) {
                    output.push(`【${i}】 ${songname} `) //标准答案
                    if (Config.getDefOrConfig('config', 'LetterWinner') && winnerid) {
                        output.push(segment.at(winnerid)) //猜对者
                    }
                    output.push('\n')
                    continue
                }

                //将加密符号是该字母的显示出来，因为每一个字符是只读的，所以不能对单个字符进行修改
                var newBlurname = ''
                for (var ii = 0; ii < songname.length; ii++) {
                    //如果字符是中文，将其首字母与翻开的字母进行匹配
                    if(/^[\u4E00-\u9FFF]$/.test(songname[ii])){
                        //若匹配就将该汉字显示出来
                        if(pinyin(songname[ii], { pattern: 'first', toneType: 'none', type: 'string' }) == letter.toLowerCase()){
                            newBlurname += songname[ii]
                            continue
                        }
                    }

                    if (songname[ii].toLowerCase() == letter.toLowerCase()) {
                        newBlurname += songname[ii]
                    } else {
                        newBlurname += blurname[ii]
                    }
                }
                blurlist[e.group_id][i] = newBlurname
                output.push(`【${i}】 ${newBlurname}\n`) //标准答案
            }

            //包含该字母，就把该字母拼到alphalist后面去
            if (included) {
                alphalist[e.group_id] = alphalist[e.group_id] || {}
                alphalist[e.group_id] = alphalist[e.group_id] + letter.toUpperCase() + ' '

                var opened = '当前所有翻开的字母[ ' + alphalist[e.group_id].replace(/\[object Object\]/g, '') + ']\n'

                output.unshift(opened)

                output.unshift(`成功翻开字母[ ${letter} ]\n`)
                e.reply(output, true)
            }
            else {
                var opened = '当前所有翻开的字母[ ' + alphalist[e.group_id].replace(/\[object Object\]/g, '') + ']\n'

                output.unshift(opened)

                output.unshift(`这几首曲目中不包含字母[ ${letter} ]\n`)
                e.reply(output, true)
            }
        }
        return true
    }

    async guess(e) {
        //必须已经开始了一局
        if (gamelist[e.group_id]) {
            var time = Config.getDefOrConfig('config', 'LetterGuessCd')
            var currentTime = Date.now()
            var timetik = currentTime - lastGuessedTime[e.group_id]
            var timeleft = Math.floor((1000 * time - timetik)/1000)
            //上一轮猜测的Cd还没过
            if(timetik < 1000*time) {
                e.reply(`猜测的冷却时间还有${timeleft}s呐，先耐心等下哇QAQ`, true) 
                return true
            }
            //上一轮Cd结束，更新新一轮的时间戳
            lastGuessedTime[e.group_id] = currentTime

            var msg = e.msg
            var opened = '所有翻开的字母[ ' + alphalist[e.group_id].replace(/\[object Object\]/g, '') + ']\n'
            var regex = /^[#/](\s*)第(\s*)([1-8一二三四五六七八])(\s*)(个|首)?(\s*)/
            var result = msg.match(regex)
            if (result) {
                var output = []
                var num = 0
                if (isNaN(result[3])) {
                    num = NumberToArabic(result[3])
                } else {
                    num = Number(result[3])
                }
                var content = msg.replace(regex, '')

                var songs
                if (!isfuzzymatch) {
                    var songs = get.songsnick(content)//通过别名匹配全名
                } else {
                    var songs = get.fuzzysongsnick(content)//通过别名模糊匹配全名
                }
                var standard_song = gamelist[e.group_id][num]//标准答案


                if (songs[0]) {
                    for (var i in songs) {
                        if (standard_song == songs[i]) {
                            //已经猜完移除掉的曲目不能再猜
                            if (!blurlist[e.group_id][num]) {
                                e.reply('曲目[' + standard_song + ']已经猜过了，要不咱们换一个吧uwu')
                                return true
                            }

                            e.reply([segment.at(e.user_id), `恭喜你ww，答对啦喵,第${num}首答案是[${standard_song}]!ヾ(≧▽≦*)o \n`], true)
                            await e.reply(await get.getsongsinfo(e, standard_song))//发送曲绘
                            delete (blurlist[e.group_id][num])
                            winnerlist[e.group_id][num] = e.user_id //记录猜对者
                            var isEmpty = Object.getOwnPropertyNames(blurlist[e.group_id]).length === 0//是否全部猜完
                            if (!isEmpty) {

                                output.push('出你字母进行中：\n')
                                output.push(opened)
                                for (var m in gamelist[e.group_id]) {
                                    if (blurlist[e.group_id][m]) {
                                        output.push(`【${m}】${blurlist[e.group_id][m]}\n`)
                                    } else {
                                        output.push(`【${m}】${gamelist[e.group_id][m]}`)
                                        if (Config.getDefOrConfig('config', 'LetterWinner') && winnerlist[e.group_id][m]) {
                                            output.push(segment.at(winnerlist[e.group_id][m]))
                                        }
                                        output.push('\n')
                                    }
                                }
                                e.reply(output, true)
                                return true
                            } else {
                                output.push('出你字母已结束，答案如下：\n')
                                for (var m in gamelist[e.group_id]) {
                                    output.push(`【${m}】${gamelist[e.group_id][m]}`)
                                    if (Config.getDefOrConfig('config', 'LetterWinner') && winnerlist[e.group_id][m]) {
                                        output.push(segment.at(winnerlist[e.group_id][m]))
                                    }
                                    output.push('\n')
                                }
                                output.push(opened)

                                delete (alphalist[e.group_id])
                                delete (gamelist[e.group_id])
                                delete (blurlist[e.group_id])
                                delete (winnerlist[e.group_id])

                                e.reply(output)
                                return true
                            }

                        }
                    }
                    if (songs[1]) {
                        e.reply('第' + num + '首不是[' + content + ']www，要不再想想捏？如果实在不会可以悄悄发个[#提示]呐≧ ﹏ ≦', true)
                    } else {
                        e.reply('第' + num + '首不是[' + songs[0] + ']www，要不再想想捏？如果实在不会可以悄悄发个[#提示]呐≧ ﹏ ≦', true)
                    }
                    return true
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

    async ans(e) {
        if (gamelist[e.group_id]) {
            var t = gamelist[e.group_id]
            var winner = winnerlist[e.group_id]
            delete (alphalist[e.group_id])
            delete (gamelist[e.group_id])
            delete (blurlist[e.group_id])
            delete (winnerlist[e.group_id])
            await e.reply('好吧好吧，既然你执着要放弃，那就公布答案好啦。', true)
            var output = ['出你字母已结束，答案如下：\n']
            for (var m in t) {
                var correct_name = t[m]
                var winner_id = winner[m]
                output.push(`【${m}】${correct_name}`)
                if (Config.getDefOrConfig('config', 'LetterWinner') && winner_id) {
                    output.push(segment.at(winner_id))
                }
                output.push('\n')
            }
            await e.reply(output)
            return true
        }
        await e.reply(`现在还没有进行的出你字母捏，赶快输入'#${Config.getDefOrConfig('config', 'cmdhead')} letter' 或 '#${Config.getDefOrConfig('config', 'cmdhead')} 出你字母' 开始新的一局吧！`, true)
        return false
    }

    async tip(e){
        if (!gamelist[e.group_id]) {
            e.reply(`现在还没有进行的出你字母捏，赶快输入'#${Config.getDefOrConfig('config', 'cmdhead')} letter' 或 '#${Config.getDefOrConfig('config', 'cmdhead')} 出你字母' 开始新的一局吧！`, true)
            return true
        }

        var time = Config.getDefOrConfig('config', 'LetterTipCd')
        var currentTime = Date.now()
        var timetik = currentTime - lastTipTime[e.group_id]
        var timeleft = Math.floor((1000 * time - timetik)/1000)
        //上一轮翻开的Cd没结束
        if(timetik < 1000 * time) {
            e.reply(`使用提示的全局冷却时间还有${timeleft}s呐，还请先耐心等下哇QAQ`, true) 
            return true
        }
        //上一轮Cd结束，更新新一轮的时间戳
        lastTipTime[e.group_id] = currentTime

        var commonKeys = []
        for(var key in gamelist[e.group_id]){
            // 检查该键是否也存在于blurlist中
            if(key in blurlist[e.group_id]){
                //如果键在两个对象中都存在,将该键值对添加到commonKeys数组中
                commonKeys.push(key)
            }
        }

        var randsymbol //存储随机抽出的字符
        while(typeof randsymbol === 'undefined' || randsymbol === '*'){
            var key = commonKeys[rand(0,commonKeys.length - 1)] //随机从通键值数组里取一个键值
            var songname = gamelist[e.group_id][key] //获取该下标存储的曲名
            randsymbol = getRandCharacter(songname) //随机从曲名中取一个非空白字符
        }

        var output = []

        for (var i in gamelist[e.group_id]) {
            var songname = gamelist[e.group_id][i]
            var blurname = blurlist[e.group_id][i]
            var winnerid = winnerlist[e.group_id][i]
            var characters = ''
            var letters = ''

            //被猜出来了的直接输出标准曲名
            if (!(blurlist[e.group_id][i])) {
                output.push(`【${i}】 ${songname} `) //标准答案
                if (Config.getDefOrConfig('config', 'LetterWinner') && winnerid) {
                    output.push(segment.at(winnerid)) //猜对者
                }
                output.push('\n')
                continue
            }

            //将加密符号是该字符的未猜曲名显示出来
            var newBlurname = ''
            for (var ii = 0; ii < songname.length; ii++) {
                //如果字符是中文，将其首字母与随机字符进行匹配
                if(/^[\u4E00-\u9FFF]$/.test(songname[ii])){
                    //若匹配就将该汉字显示出来
                    if(pinyin(songname[ii], { pattern: 'first', toneType: 'none', type: 'string' }) == randsymbol.toLowerCase()){
                        newBlurname += songname[ii]
                        continue
                    }
                }

                if (songname[ii].toLowerCase() == randsymbol.toLowerCase()) {
                    newBlurname += songname[ii]
                } else {
                    newBlurname += blurname[ii]
                }
            }
            blurlist[e.group_id][i] = newBlurname
            output.push(`【${i}】 ${newBlurname}\n`) //标准答案
        }

        //将该随机拼到alphalist后面去
        alphalist[e.group_id] = alphalist[e.group_id] || {}
        alphalist[e.group_id] = alphalist[e.group_id] + randsymbol.toUpperCase() + ' '

        var opened = '当前所有翻开的字母[ ' + alphalist[e.group_id].replace(/\[object Object\]/g, '') + ']\n'

        output.unshift(opened)

        output.unshift(`已经帮你随机翻开一个字符[ ${randsymbol} ]了捏 ♪（＾∀＾●）ﾉ\n`)
        e.reply(output, true)
        return true

    }

}

/**
 * RandBetween
 * @param {number} top 随机值上界
 */
function randbt(top, bottom = 0) {
    return Number((Math.random() * (top - bottom)).toFixed(0)) + bottom
}

function timeout(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms, 'done');
    });
}

function encrypt_song_name(name) {
    var encryptedName = ''
    //var num = rand(0,Math.min(2, name.length - 2)) + 1//显示多少位
    var num = 0//将原来的随机位数改为强制不显示
    var numset = []
    for (var i = 0; i < num; i++) {
        var numToShow = rand(0, name.length - 1)
        while (name[numToShow] == ' ') {
            numToShow = rand(0, name.length - 1)
        }
        numset[i] = numToShow
    }

    for (var i = 0; i < name.length; i++) {
        if (numset.includes(i)) {
            encryptedName += name[i]
            continue
        } else if (name[i] == ' ') {
            encryptedName += ' '
            continue
        } else {
            ////////////为了美观现全部隐藏字符都用'*'号表示
            // //判断这个字符是什么格式，中文就用'*'，英文就用'#'，其他就用'@'
            // if(/^[\u4e00-\u9fa5]+$/.test(name[i])){
            //     //中文
            //     encryptedName+='*'
            // }else if(/^[a-zA-Z]+$/.test(name[i])){
            //     //English
            //     encryptedName+='#'
            // }else{
            //     //others
            //     encryptedName+='@'
            // }
            encryptedName += '*'
        }
    }
    return encryptedName
}

//将中文数字转为阿拉伯数字
function NumberToArabic(digit) {
    //只处理到千，再高也根本用不上啊(十位数都用不上的说)
    const numberMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
    const unitMap = { 十: 10, 百: 100, 千: 1000 }

    var total = 0;
    var currentUnit = 1;

    for (let i = 0; i < digit.length; i++) {
        const character = digit[i];
        if (numberMap[character] !== undefined) {
            currentUnit = numberMap[character];
        } else if (unitMap[character] !== undefined) {
            currentUnit *= unitMap[character];
            total += currentUnit;
            currentUnit = 0;
        }
    }
    total += currentUnit;
    return total;
}

//将数组顺序打乱
function shuffleArray(des) {
    var len = des.length;
    for (var i = 0; i < len - 1; i++) {
        var index = parseInt(Math.random() * (len - i))
        var temp = des[index]
        des[index] = des[len - i - 1]
        des[len - i - 1] = temp
    }
    return des
}

function rand(min, max) {
    var range = max - min + 1
    var randomOffset = Math.floor(Math.random() * range)
    return (randomOffset + min) % range + min
}

function getRandCharacter(str) {
    // 去除空白字符
    var trimmedStr = str.replace(/\s/g, '')
  
    // 获取字符串长度
    var length = trimmedStr.length
  
    // 生成随机索引
    var randomIndex = rand(0,length.length - 1)
  
    // 返回随机字符
    return trimmedStr.charAt(randomIndex)
}