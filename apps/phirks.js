
import plugin from '../../../lib/plugins/plugin.js'
import get from '../model/getdata.js'
import atlas from '../model/songatlas.js'

var infolist = [] //定级列表
var userdata = [] //当前用户的acc数据
var dftdata = [] //初始化的数据
var songlist = [] //曲名顺序的列表
var readlist = [[]] //待读入列表
var idlist = [] //待读入用户

infolist = get.getData('infolist')
songlist = get.getData('songlist')

//插件作者QQ号：1436375503
//曲绘资源来源于网络
//插件由个人独立编写，由于我没学过js，这个插件是一点一点照着其他大佬的插件抄的，如果有什么地方写的不对欢迎提出意见或做出修改
//如果有什么好的建议也欢迎提出


export class phirks extends plugin {
    constructor() {
        super({
            name: 'phigrosrks计算器',
            dsc: 'rks计算',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    /**正则匹配 */
                    reg: '^#rks$',
                    /**执行方法 */
                    fnc: 'comscore'
                },
                {
                    reg: '^#rksacc$',
                    fnc: 'inputacc'
                },
                {
                    reg: '^#rks修改(.*)$',
                    fnc: 'changerks'
                },
                {
                    reg: '^#rks数据删除$',
                    fnc: 'del'
                },
                {
                    reg: '^(.*)$',
                    fnc: 'inputing'
                }
            ]
        })

    }

    /**计算玩家rks */
    async comscore(e) {
        userdata = get.getData(`${e.user_id}`)
        if (userdata) {
            if (userdata["finish"]) {
                /**更新统计数据 */
                infolist = get.getData('infolist')
                songlist = get.getData('songlist')
                var b19 = []

                for (let i in songlist) {
                    savedata(e, songlist[i], b19)
                }

                /**根据数据计算rks */
                let ans = 0
                let score = []
                let data = {}
                let song = b19.phi
                data.other = []
                /**phi */
                if (b19.phi) {
                    score.push({
                        style: 'Phi',
                        song: song.song,
                        difficulty: song.difficulty,
                        acc: (song.acc*100).toFixed(2),
                        ranking: song.ranking,
                        score: (song.score).toFixed(2),
                        illustration: get.getill(song.song)
                    })
                    ans += song.score
                } else {
                    data.other.push(`您还没有任何一首歌达到满分呢！{{{(>_<)}}}`)
                    data.other.push(`要不要去试试收割一首谱面呢？任何难度的都可以哦！( •̀ ω •́ )✧`)
                }

                /**b21曲目（rks仅计算b19） */
                let i = 1
                for (i = 1; b19[i]; ++i) {
                    song = b19[i]
                    score.push({
                        style: i,
                        song: song.song,
                        difficulty: song.difficulty,
                        acc: (song.acc*100).toFixed(2),
                        ranking: song.ranking,
                        score: (song.score).toFixed(2),
                        illustration: get.getill(song.song)
                    })
                    if (i <= 19) {
                        ans += song.score
                    }
                }
                if(i < 19) {
                    data.other.push(`您计入rks的曲目数量还没有达到19首呢！有时间要去多尝试一下哦！（￣︶￣）↗　`)
                }
                let totnodata = Findnodata(e).length
                if (totnodata) {
                    data.other.push(`您还有${totnodata}首歌曲没有数据哦！快发送 #rksacc 去输入吧！`)
                }

                data.b19 = score
                data.player = e.user_id
                data.rks = (ans/20).toFixed(2)
                e.reply(await atlas.b19(e, data))

                /**数据分析 */
                // if (!cnt) { cnt = 22 }
                // if (cnt < 19) {
                    
                // }
                // msgRes[cnt++] = `您的理论rks值为： ${(ans / 20).toFixed(2)}\n如果得出结果与游戏内显示相差0.01的话是acc显示值的误差，还望理解\n(´。＿。｀)`

                // let totnodata = Findnodata(e).length
                // if (totnodata) {
                    
                // }

                // /**发送合并消息 */
                // e.reply(await common.makeForwardMsg(e, msgRes, ""), true)


            } else {
                e.reply(`您的分数信息不完全哦！请私聊完成录入进程吧！`)
            }
        } else {
            /**无数据的提示 */
            e.reply(`我不知道你的分数信息哦！请私聊 #rksacc 告诉我吧！`, true)
        }
        return true
    }

    /**开始输入acc */
    async inputacc(e) {

        /**更新yaml数据（支持热更新） */
        infolist = get.getData('infolist')
        songlist = get.getData('songlist')

        if (e.isGroup) {
            /**禁止在群聊输入 */
            e.reply('为了防止刷屏，请不要在群里输入成绩哦！', true)
            return true
        }
        userdata = get.getData(`${e.user_id}`)
        if (!userdata) {
            userdata = {}
        }
        userdata["finish"] = 0
        get.setData(`${e.user_id}`, userdata)
        FindtoRead(e)
        e.reply(`开始录入未读入的${readlist[idlist.indexOf(e.user_id)].length}首曲目成绩（按照曲名排序）……\n停止输入请发送 #rks结束 ，暂停请发 #rks暂停。\n发送acc请按照顺序同时发送每一等级的acc！\n读入时默认从高等级向低等级读取，如果没有数据将会自动补0\n例：对于一首没有AT的曲目仅发送 98.79 ，将会自动将 HD EZ acc设置为0`)
        let mic = readlist[idlist.indexOf(e.user_id)][0]
        ask(e, mic)
        return true
    }

    /**修改rks #rks修改 */
    async changerks(e) {
        let msg = e.msg.replace(/#rks修改(\s*)/g, "")
        let song = get.songsnick(msg)
        if (!song) {
            e.reply(`没有找到 ${msg} 有关的曲目信息QAQ！`)
            return true
        }
        if (song[1]) {
            e.reply(`${msg}含有多个对应曲目哦！请换一种名字吧！`)
            return true
        }
        song = song[0]
        userdata = get.getData(`${e.user_id}`)
        if (!userdata) {
            e.reply('没有检测到您的存档哦！将自动为您创建……')
            userdata = {}
        }
        FindtoRead(e, song)
        userdata["finish"] = 0
        mic = readlist[idlist.indexOf(e.user_id)][0]
        get.setData(`${e.user_id}`, userdata)
        ask(e, mic)
        return true
    }


    /**正在输入acc */
    async inputing(e) {
        userdata = get.getData(`${e.user_id}`)
        if (e.isGroup) {
            /**非群聊 */
            return false
        } else if (!userdata) {
            /**无数据 */
            return false
        } else if (userdata["finish"]) {
            /**或并非正在输入 */
            return false
        } else if (e.msg.includes('rks结束')) {
            /**结束输入，不允许从断点继续，但允许修改单曲 */
            /**打上标记 */
            userdata["finish"] = 1
            readlist[idlist.indexOf(e.user_id)] = []
            get.setData(`${e.user_id}`, userdata)
            e.reply(`录入工作已结束！现在可以发送 #rks 查询数据了！\n可以发送 #rksacc 更新单曲成绩！`)
        } else {
            /**正常读入acc */
            let mic = readlist[idlist.indexOf(e.user_id)][0]

            if (findacc(e)) {
                return true
            }
            readlist[idlist.indexOf(e.user_id)].shift()

            get.setData(`${e.user_id}`, userdata)
            mic = readlist[idlist.indexOf(e.user_id)][0]
            ask(e, mic)
        }
        return true
    }

    /**删除数据 */
    async del(e) {
        if (get.delData(`${e.user_id}`)) {
            e.reply(`数据删除成功`, true)
        } else {
            e.reply(`数据删除失败，未找到相关文件`, true)
        }
    }

}

/**发出询问 */
function ask(e, mic) {
    if (!mic) {
        /**所有曲目录入完毕 */
        e.reply('幸苦了！读入完毕！输入 #rks 查询你的rks数据吧！')
        userdata['finish'] = 1
        userdata['sutdown'] = 0
        userdata['puting'] = 0
        get.setData(`${e.user_id}`, userdata)
    } else {
        /**发送正在设置的曲目，序号存储在 userdata['puting'] 中 */
        let msgRes = []
        if (infolist[mic]["chart"]["AT"]) {
            e.reply(`提示，这一首是有AT等级的哦！`)
            msgRes = [`请发送\n`, get.getimg(mic), `\n${infolist[mic]['song']}的 AT IN HD EZ acc，例： 98.99 100 100 100`]
        } else {
            msgRes = [`请发送\n`, get.getimg(mic), `\n${infolist[mic]['song']}的 IN HD EZ acc，例： 98.99 100 100`]
        }
        e.reply(msgRes)
    }
    return true
}

/**获取信息中的acc 失败返回true */
function findacc(e) {
    let mic = readlist[idlist.indexOf(e.user_id)][0]  /**获取读取的曲目名称 */
    let acc = e.msg.split(/\s+/)  /**处理得出输入 acc */
    for (let i = 0; i <= 2; ++i) {  /**检测输入是否合法 */
        acc[i] = Number(acc[i])
        if (!acc[i]) acc[i] = 0
        if (typeof acc[i] != 'number' || acc[i] < 0 || acc[i] > 100) {
            e.reply(`错误读入：${acc[i]}，请输入正确的0-100数字……结束请发 #rks结束 \n暂停请发 #rks暂停`)
            return true
        }
        acc[i] /= 100  /**实际存储为0-1的浮点数 */
    }
    /**写入到数组 */
    if (infolist[mic]["chart"]["AT"]) {
        acc[3] = Number(acc[3])
        if (!acc[3]) acc[3] = 0
        if (typeof acc[3] != 'number' || acc[3] < 0 || acc[3] > 100) {
            e.reply(`错误读入：${acc[3]}，请输入正确的0-100数字……结束请发 #rks结束 \n暂停请发 #rks暂停。`)
            return true
        }
        acc[3] /= 100
        logger.info(`${acc[0]}  ${acc[1]}  ${acc[2]}  ${acc[3]}`)
        if (!userdata[mic]) {
            userdata[mic] = { 'AT': 0, 'IN': 0, 'HD': 0, 'EZ': 0 }
        }
        userdata[`${mic}`]['AT'] = acc[0]
        userdata[`${mic}`]['IN'] = acc[1]
        userdata[`${mic}`]['HD'] = acc[2]
        userdata[`${mic}`]['EZ'] = acc[3]
    } else {
        logger.info(`${acc[0]}  ${acc[1]}  ${acc[2]}`)
        if (!userdata[mic]) {
            userdata[mic] = { 'IN': 0, 'HD': 0, 'EZ': 0 }
        }
        userdata[`${mic}`]['IN'] = acc[0]
        userdata[`${mic}`]['HD'] = acc[1]
        userdata[`${mic}`]['EZ'] = acc[2]
    }
    /**写入到文件 */
    get.setData(`${e.user_id}`, userdata)
    return false
}

/**保存数据 */
function savedata(e, mic, b19) {
    /**有效rks的前提为 acc >= 70% */
    if (!userdata[`${mic}`]) {
        return true
    }
    if (userdata[`${mic}`]['AT'] >= 0.7) {
        insrt(mic, 'AT', b19)
    }
    if (userdata[`${mic}`]['IN'] >= 0.7) {
        insrt(mic, 'IN', b19)
    }
    if (userdata[`${mic}`]['HD'] >= 0.7) {
        insrt(mic, 'HD', b19)
    }
    if (userdata[`${mic}`]['EZ'] >= 0.7) {
        insrt(mic, 'EZ', b19)
    }
    return true
}


/**将结果插入rks计算排序（插排） */
function insrt(mic, difficulty, b19) {
    let fnal = 0
    let acc = userdata[`${mic}`][difficulty]
    let song = infolist[mic]
    let ranking = song["chart"][difficulty]["difficulty"]
    let score = dxrks(acc * 100, ranking)


    /**更新phi1 */
    if (acc === 1) {
        if (!b19.phi || score > b19.phi.score) {
            b19.phi = {
                song: infolist[mic]['song'],
                difficulty: difficulty,
                acc: acc,
                score: score,
                ranking: ranking,
                illustration: song.illustration_big
            }
        }
    }
    /**查找需要插入的位置（fnal） */
    for (let i = 1; i <= 21; ++i) {
        if (!b19[i] || b19[i].score < score) {
            fnal = i
            break
        }
    }
    /**不会对b21产生影响直接返回 */
    if (!fnal) return true
    /**更新b21 */
    for (let i = 21; i > fnal; --i) {
        if (!b19[i - 1]) {
            continue
        }
        b19[i] = b19[i - 1]
    }

    b19[fnal] = {
        song: infolist[mic]['song'],
        difficulty: difficulty,
        acc: acc,
        score: score,
        ranking: ranking,
        illustration: song.illustration_big
    }

    return true
}


/**rks计算方式 */
function dxrks(acc, rank) {
    if (acc == 100) {
        /**满分原曲定数即为有效rks */
        return Number(rank)
    } else if (acc < 55) {
        /**无效acc */
        return 0
    } else {
        /**非满分计算公式 [(((acc - 55) / 45) ^ 2) * 原曲定数] */
        return rank * (((acc - 55) / 45) * ((acc - 55) / 45))
    }
}

/**寻找需要读取的曲目 */
function FindtoRead(e, mic) {
    userdata = get.getData(`${e.user_id}`)
    songlist = get.getData('songlist')

    let num = idlist.indexOf(e.user_id)
    if (num == -1) {
        num = idlist.length
        idlist.push(e.user_id)
    }
    readlist[num] = []
    if (mic) {
        let song = get.songsnick(mic)
        if (!song) {
            return true
        }
        song = song[0]
        readlist[num].push(song)
        return true
    }
    readlist[num] = Findnodata(e)
    return true
}


/**遍历没有数据的歌曲，返回数组 */
function Findnodata(e) {
    userdata = get.getData(`${e.user_id}`)
    songlist = get.getData('songlist')
    var nodata = []
    for (let i in songlist) {
        if (!userdata[songlist[i]]) {
            nodata.push(songlist[i])
        }
    }
    return nodata
}
