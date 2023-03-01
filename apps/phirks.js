
import plugin from '../../../lib/plugins/plugin.js'
import get from '../model/getdata.js'
import common from "../../../lib/common/common.js";

var infolist = [] //定级列表
var userdata = [] //当前用户的acc数据
var dftdata = [] //初始化的数据
var songlist = [] //曲名顺序的列表

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
            if (userdata["finish"] || userdata["sutdown"]) {
                /**更新统计数据 */
                infolist = get.getData('infolist')
                songlist = get.getData('songlist')
                userdata["phi"] = { 'name': 0, 'diffic': 0, 'acc': 0, 'rank': 0 }
                for (let i = 1; i <= 21; ++i) {
                    userdata[`b${i}`] = { 'name': 0, 'diffic': 0, 'acc': 0, 'rank': 0 }
                }
                for (let i = 0; ; ++i) {
                    let mic = songlist[i]
                    if (!mic) {
                        break
                    }
                    savedata(e, mic)
                }
                get.setData(`${e.user_id}`, userdata)
                /**根据数据计算rks */
                let cnt = 0
                let msgRes = []
                let name = userdata["phi"]["name"]
                let ans = 0

                /**phi1 曲目 */
                if (name) {

                    let img = get.getimg(name)
                    let diffic = userdata["phi"]["diffic"]
                    let rank = infolist[`${name}`][`${diffic.toLowerCase()}_level`]
                    let acc = userdata["phi"]["acc"] * 100
                    let rks = dxrks(acc, rank)
                    userdata[`phi`]["rank"] = rks
                    ans += rks
                    msgRes[0] = [`您的φ1曲目为：\n`, img, `\n曲名：${name}\n难度：${diffic}  定数：${rank}\nacc：${acc}  等效rks：${rks}`]
                } else {
                    msgRes[0] = `您还没有任何一首歌达到满分呢！\n{{{(>_<)}}}\n要不要去试试收割一首谱面呢？任何难度的都可以哦！\n( •̀ ω •́ )✧`
                }

                /**b21曲目（rks仅计算b19） */
                for (let i = 1; i <= 21; ++i) {
                    let name = userdata[`b${i}`]["name"]
                    if (!name) {
                        cnt = i
                        break
                    }
                    let img = get.getimg(name)
                    let diffic = userdata[`b${i}`]["diffic"]
                    let rank = infolist[`${name}`][`${diffic.toLowerCase()}_level`]
                    let acc = userdata[`b${i}`]["acc"] * 100
                    let rks = dxrks(acc, rank)
                    userdata[`b${i}`]["rank"] = rks
                    if (i <= 19) {
                        ans += rks
                    }
                    msgRes[i] = [`您的Best#${i}曲目为：\n`, img, `\n曲名：${name}\n难度：${diffic}  定数：${rank}\nacc：${acc.toFixed(2)}%  等效rks：${rks.toFixed(2)}`]
                }

                /**数据分析 */
                if (!cnt) { cnt = 22 }
                if (cnt < 19) {
                    msgRes[cnt++] = `您打过的曲目数量还没有达到19首呢！有时间要去多尝试一下哦！\n（￣︶￣）↗　`
                }
                msgRes[cnt++] = `您的理论rks值为： ${(ans / 20).toFixed(2)}\n如果得出结果与游戏内显示相差0.01的话是acc显示值的误差，还望理解\n(´。＿。｀)`

                /**发送合并消息 */
                e.reply(await common.makeForwardMsg(e, msgRes, ""), true)

                
                /**写入文件，更新rks信息 */
                get.setData(`${e.user_id}`, userdata)
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
            /**新用户 */
            dftdata = get.getData('dftdata')
            get.setData(`${e.user_id}`, dftdata)
            userdata = get.getData(`${e.user_id}`)
            userdata["puting"] = 0
            userdata["finish"] = 0
            userdata["sutdown"] = 0
            e.reply(`开始录入全部成绩（按照曲名排序）……\n停止输入请发送 #rks结束 ，暂停请发 #rks暂停。\n发送acc请按照顺序同时发送每一等级的acc！\n读入时默认从高等级向低等级读取，如果没有数据将会自动补0\n例：对于一首没有AT的曲目仅发送 98.79 ，将会自动将 HD EZ acc设置为0`)
            mic = songlist["0"]
            ask(e, mic)
        } else if (!userdata["finish"]) {
            /**断点续读 */
            e.reply(`检测到您有未完成的输入……即将从上一次的记录开始……\n如需修改请先 #rks结束 再 #rksacc，暂停请发 #rks暂停。\n如需删除原有数据请 #rks数据删除 。\n读入时默认从高等级向低等级读取，如果没有数据将会自动补0\n例：对于一首没有AT的曲目仅发送 98.79 ，将会自动将 HD EZ acc设置为0`)
            userdata["sutdown"] = 0
            userdata["finish"] = 0
            get.setData(`${e.user_id}`, userdata)
            mic = songlist[`${userdata["puting"]}`]
            ask(e, mic)
        } else {
            userdata = get.getData(`${e.user_id}`)
            /**旧用户修改成绩 */
            e.reply(`我在听，请告诉我需要修改的曲目名称哦`)
            userdata['updata'] = 1
            userdata['finish'] = 0
            userdata['sutdown'] = 0
            get.setData(`${e.user_id}`, userdata)
        }
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
        } else if (userdata["finish"] || userdata["sutdown"]) {
            /**或并非正在输入 */
            return false
        } else if (e.msg.includes('rks结束')) {
            /**结束输入，不允许从断点继续，但允许修改单曲 */
            /**打上标记 */
            userdata["sutdown"] = 0
            userdata["puting"] = 0
            userdata["finish"] = 1
            userdata["updata"] = 0

            get.setData(`${e.user_id}`, userdata)
            e.reply(`录入工作已结束！现在可以发送 #rks 查询数据了！\n可以发送 #rksacc 更新单曲成绩！`)
        } else if (userdata['updata']) {
            /**修改单曲部分 */
            if (userdata["puting"]) {
                /**获取到输入的acc */
                if (!findacc(e)) {
                    await e.reply(`设置成功！`)
                    /**结束输入状态 */
                    userdata["sutdown"] = 0
                    userdata["puting"] = 0
                    userdata["finish"] = 1
                    userdata["updata"] = 0
                    get.setData(`${e.user_id}`, userdata)
                }
            } else {
                /**获取到输入的曲名 */
                let mic = get.songsnick(e.msg)
                if (!mic) {
                    /**匹配失败 */
                    userdata["puting"] = 0
                    get.setData(`${e.user_id}`, userdata)
                    await e.reply(`没有找到${e.msg}的曲目信息！QAQ\n结束请发送 #rks结束 哦！`)
                } else {
                    /**匹配成功，打上标记，下次读入acc */
                    userdata["puting"] = get.getsongsxh(mic)
                    get.setData(`${e.user_id}`, userdata)
                    ask(e, mic)
                }
            }
            return true
        } else if (e.msg.includes('rks暂停')) {
            /**中断输入，不允许修改单曲，但允许从断点继续 */
            /**打上标记 */
            userdata["sutdown"] = 1
            userdata["finish"] = 0

            get.setData(`${e.user_id}`, userdata)
            e.reply(`录入工作已暂停！现在可以发送 #rks 查询数据了！\n可以发送 #rksacc 继续录入成绩！`)
        } else {
            /**正常读入acc */
            let now = userdata["puting"]
            let mic = songlist[`${now}`]
            
            if (findacc(e)) {
                return true
            }
            ++userdata['puting']
            get.setData(`${e.user_id}`, userdata)
            now = userdata["puting"]
            mic = songlist[`${now}`]
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
        if (infolist[`${mic}`]['at_level']) {
            e.reply(`提示，这一首是有AT等级的哦！`)
            msgRes = [`请发送\n`, get.getimg(mic), `\n${infolist[`${mic}`]['song']}的 AT IN HD EZ acc，例： 98.99 100 100 100`]
        } else {
            msgRes = [`请发送\n`, get.getimg(mic), `\n${infolist[`${mic}`]['song']}的 IN HD EZ acc，例： 98.99 100 100`]
        }
        e.reply(msgRes)
    }
    return true
}

/**获取信息中的acc 失败返回true */
function findacc(e) {
    let now = userdata["puting"]  /**当前读取的曲目 */
    let mic = songlist[`${now}`]  /**获取曲目名称 */
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
    if (infolist[`${mic}`]['at_level']) {
        acc[3] = Number(acc[3])
        if (!acc[3]) acc[3] = 0
        if (typeof acc[3] != 'number' || acc[3] < 0 || acc[3] > 100) {
            e.reply(`错误读入：${acc[3]}，请输入正确的0-100数字……结束请发 #rks结束 \n暂停请发 #rks暂停。`)
            return true
        }
        acc[3] /= 100
        logger.info(`${acc[0]}  ${acc[1]}  ${acc[2]}  ${acc[3]}`)
        userdata[`${mic}`]['AT'] = acc[0]
        userdata[`${mic}`]['IN'] = acc[1]
        userdata[`${mic}`]['HD'] = acc[2]
        userdata[`${mic}`]['EZ'] = acc[3]
    } else {
        logger.info(`${acc[0]}  ${acc[1]}  ${acc[2]}`)
        userdata[`${mic}`]['IN'] = acc[0]
        userdata[`${mic}`]['HD'] = acc[1]
        userdata[`${mic}`]['EZ'] = acc[2]
    }
    /**写入到文件 */
    get.setData(`${e.user_id}`, userdata)
    return false
}

/**保存数据 */
function savedata(e, mic) {
    /**有效rks的前提为 acc >= 70% */
    if (!userdata[`${mic}`]) {
        
        if (mic.includes("Another Me")) {
            /**兼容旧名称  */
            if （mic == "Another Me (KALPA)") {
                mic = "Another Me by D_AAN"
            } else if (mic == "Another Me (Rising Sun Traxx)") {
                mic = "Another Me by Neutral Moon"
            }
            if (!userdata[`${mic}`]) {
                logger.info(`[phi插件] 更新rks时未找到${mic}`)
                return true
            }
        } else {
            logger.info(`[phi插件] 更新rks时未找到${mic}`)
            return true
        }
    }
    if (userdata[`${mic}`]['AT'] >= 0.7) {
        insrt(mic, 'AT')
    }
    if (userdata[`${mic}`]['IN'] >= 0.7) {
        insrt(mic, 'IN')
    }
    if (userdata[`${mic}`]['HD'] >= 0.7) {
        insrt(mic, 'HD')
    }
    if (userdata[`${mic}`]['EZ'] >= 0.7) {
        insrt(mic, 'EZ')
    }
    /**写入文件 */
    get.setData(`${e.user_id}`, userdata)
    return true
}


/**将结果插入rks计算排序（插排） */
function insrt(mic, diffic) {
    let fnal = 0
    let acc = userdata[`${mic}`][diffic]
    let score = dxrks(acc * 100, infolist[`${mic}`][`${diffic.toLowerCase()}_level`])
    /**更新phi1 */
    if (acc === 1) {
        if (score > userdata['phi']['rank']) {
            userdata['phi'] = { 'name': infolist[`${mic}`]['song'], 'diffic': diffic, 'acc': acc, 'rank': score }
        }
    }
    /**查找需要插入的位置（fnal） */
    for (let i = 1; i <= 21; ++i) {
        if (userdata[`b${i}`]['rank'] < score) {
            fnal = i
            break
        }
    }
    /**不会对b21产生影响直接返回 */
    if (!fnal) return true  
    /**更新b21 */
    for (let i = 21; i > fnal; --i) {
        userdata[`b${i}`] = userdata[`b${i - 1}`]
    }
    //                        曲名                                 难度            acc        有效rks
    userdata[`b${fnal}`] = { 'name': infolist[`${mic}`]['song'], 'diffic': diffic, 'acc': acc, 'rank': score }
    return true
}


/**rks计算方式 */
function dxrks(acc, rank) {
    if (acc == 100) {
        /**满分原曲定数即为有效rks */
        return Number(rank)
    } else if(acc < 55) {
        /**无效acc */
        return 0
    } else {
        /**非满分计算公式 [(((acc - 55) / 45) ^ 2) * 原曲定数] */
        return rank * (((acc - 55) / 45) * ((acc - 55) / 45))
    }
}

