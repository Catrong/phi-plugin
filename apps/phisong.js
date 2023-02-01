
import plugin from '../../../lib/plugins/plugin.js'
import get from '../model/getdata.js'
import common from "../../../lib/common/common.js";
import { segment } from 'oicq';

var ranklist = [] //定级数据
var userdata = []
var dftdata = []
var songlist = [] //曲名排序的歌曲列表
let showinfo = get.getData('showconfig')
let infolist = get.getData('infolist')
ranklist = get.getData('ranklist')
songlist = get.getData('songlist')


export class phirks extends plugin {
    constructor() {
        super({
            name: 'phigrosrks计算器',
            dsc: 'rks计算',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: '^#phi曲.*$',
                    fnc: 'serch'
                },
                {
                    reg: '^#phi设置别名.*$',
                    fnc: 'setnick'
                },
                {
                    reg: '^#phi申请.*$',
                    fnc: 'sendnick'
                },
                {
                    reg: '^#phi查询.*$',
                    fnc: 'find'
                },
                {
                    reg: '^#phi随机.*',
                    fnc: 'randmic'
                }
            ]
        })

    }


    /**歌曲图鉴 */
    async serch(e) {
        ranklist = get.getData('ranklist')
        songlist = get.getData('songlist')
        let msg = e.msg.replace(/#phi曲(\s*)/g, "")
        let name = get.songsnick(msg)
        if (name) {
            let msgRes = get.getsongsinfo(name)
            e.reply(msgRes, true)
        } else {
            await e.reply(`未找到${msg}的相关曲目信息QAQ`, true)
            await e.reply(get.getimg('对不起.gif'))
            await e.reply(`可以输入 #phi申请 原曲名称 ---> 别名 来向主人提出命名申请哦！`)
        }
    }

    /**设置别名 */
    async setnick(e) {
        if (!e.isMaster) {
            e.reply("只有主人可以设置别名哦！")
        }
        let msg = e.msg.replace(/#phi设置别名(\s*)/g, "")
        msg = msg.split(/(\s*)--->(\s*)/g)
        if (msg[1]) {
            msg[0] = get.songsnick(msg[0])
            if (ranklist[`${msg[0]}`]) {
                get.setnick(`${msg[0]}`, `${msg[1]}`)
                e.reply("设置完成！")
            } else {
                e.reply(`输入有误哦！没有找到“${msg[0]}”这首曲子呢！`)
            }
        } else {
            e.reply(`输入有误哦！请先输入本名在输入别名并且以--->分割哦！`)
        }
        return true
    }

    /**申请设置别名 */
    async sendnick(e) {
        let tododata = get.getData('tododata')
        tododata[`${tododata['tot']++}`] = [e.msg.replace(/#phi申请(\s*)/g, ""), e.user_id]
        get.setData('tododata', tododata)
        e.reply("申请成功！", true)
    }

    /**phi曲目查询 */
    async find(e) {
        showinfo = await get.getData('showconfig')
        infolist = await get.getData('infolist')
        ranklist = await get.getData('ranklist')
        songlist = await get.getData('songlist')
        let msg = e.msg.replace(/#phi查询(\s*)/g, "")
        if (msg.includes("章节")) {
            let chaplist = []
            let added = 1
            let msgRes = []
            let msgcnt = 0
            while (added) {
                added = 0
                let nowchap = 0
                let cnt = 0
                let info = []
                for (let i = 0; songlist[i]; ++i) {
                    let mic = songlist[i]
                    let chap = infolist[`${mic}`]['chap']
                    if (chaplist[`${chap}`]) {
                        continue
                    } else if (chap == nowchap) {
                        info[cnt++] = getsongsinfo(mic)
                        ++added
                    } else if (!cnt) {
                        nowchap = chap
                        info[cnt++] = `vis`
                        info[cnt++] = getsongsinfo(mic)
                        ++added
                    }
                }
                if (added) {
                    info[0] = `当前章节：${nowchap}\n共含${cnt - 1}首歌`
                    chaplist[`${nowchap}`] = 1
                    let temp = await common.makeForwardMsg(e, info, "")
                    msgRes[msgcnt++] = temp
                }
            }
            let res = await common.makeForwardMsg(e, msgRes, "")
            logger.info(res)
            e.reply(res)
        }
        return true
    }

    /**随机定级范围内曲 */
    async randmic(e) {
        let msg = e.msg.replace(/#phi随机(\s*)/g, "")
        let isask = [1,1,1,1]
        if(e.msg.includes('AT')||e.msg.includes('IN')||e.msg.includes('HD')||e.msg.includes('EZ')) {
            isask = [0,0,0,0]
            if(e.msg.includes('AT')) {isask[0] = 1}
            if(e.msg.includes('IN')) {isask[1] = 1}
            if(e.msg.includes('HD')) {isask[2] = 1}
            if(e.msg.includes('EZ')) {isask[3] = 1}
        }
        msg = msg.replace(/\s*|AT|IN|HD|EZ/g,"")
        msg = msg.replace(/AT/g,"")
        msg = msg.replace(/IN/g,"")
        msg = msg.replace(/EZ/g,"")
        let rank = msg.split('-')
        let randm1 = Math.floor(Math.random() * 165)
        let mic = songlist[randm1]
        if (rank[0]) {
            if (!rank[1] || rank[0] < 0 || rank[1] < 0 || (rank[0] > 16 && rank[1] > 16)) {
                e.reply(`${msg}是哪门子的定级范围呀！请用 - 作为分隔符！`)
                return true
            } else {
                if (rank[0] > rank[1]) {
                    let tem = rank[0]
                    rank[0] = rank[1]
                    rank[1] = tem
                }
                logger.info(`${rank[0]}   ${rank[1]}`)
                let cnt = 0
                while (++cnt) {
                    if(cnt > 10000) {
                        e.reply(`没有找到符合要求的曲目！QAQ`,true)
                        return true
                    }
                    let torank = ranklist[`${mic}`]['AT']
                    if (isask[0]&&torank >= rank[0] && torank <= rank[1]) {
                        break
                    }
                    torank = ranklist[`${mic}`]['IN']
                    if (isask[1]&&torank >= rank[0] && torank <= rank[1]) {
                        break
                    }
                    torank = ranklist[`${mic}`]['HD']
                    if (isask[2]&&torank >= rank[0] && torank <= rank[1]) {
                        break
                    }
                    torank = ranklist[`${mic}`]['EZ']
                    if (isask[3]&&torank >= rank[0] && torank <= rank[1]) {
                        break
                    }
                    randm1 = Math.floor(Math.random() * 165)
                    mic = songlist[randm1]
                }
            }
        }
        e.reply(get.getsongsinfo(`${mic}`),true)
    }
}


/**快速获取歌曲信息 */
function getsongsinfo(mic) {
    let name = mic
    if (name) {
        let msgRes = []
        let cnt = 0
        for (let i = 1; ; ++i) {
            if (showinfo[`${i}`]['vis'] == 'done') {
                break
            }
            switch (showinfo[`${i}`]['vis']) {
                case 'img': {
                    // msgRes[cnt++] = get.getimg(name)
                    break
                } case 'msg': {
                    msgRes[cnt++] = showinfo[`${i}`]['val']
                    break
                } case 'rank': {
                    if (ranklist[`${name}`]['SP']) {
                        msgRes[cnt++] = `SP: ${ranklist[`${name}`]['SP']}    物量: ${infolist[`${name}`]['SP']}\n`
                    }
                    if (ranklist[`${name}`]['AT']) {
                        msgRes[cnt++] = `AT: ${ranklist[`${name}`]['AT']}    物量: ${infolist[`${name}`]['AT']}\n`
                    }
                    if (ranklist[`${name}`]['IN']) {
                        msgRes[cnt++] = `IN: ${ranklist[`${name}`]['IN']}    物量: ${infolist[`${name}`]['IN']}\n`
                    }
                    if (ranklist[`${name}`]['HD']) {
                        msgRes[cnt++] = `HD: ${ranklist[`${name}`]['HD']}    物量: ${infolist[`${name}`]['HD']}\n`
                    }
                    if (ranklist[`${name}`]['EZ']) {
                        msgRes[cnt++] = `EZ: ${ranklist[`${name}`]['EZ']}    物量: ${infolist[`${name}`]['EZ']}\n`
                    }
                    break
                } default: {
                    msgRes[cnt++] = infolist[`${name}`][`${showinfo[`${i}`]['vis']}`]
                }
            }
        }
        return msgRes
    } else {
        return `未找到${mic}的相关曲目信息QAQ`
    }
}