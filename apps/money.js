import common from '../../../lib/common/common.js'
import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'
import send from '../model/send.js'
import getNotes from '../model/getNotes.js'
import getBanGroup from '../model/getBanGroup.js';
import getInfo from '../model/getInfo.js'
import phiPluginBase from '../components/baseClass.js'
import fCompute from '../model/fCompute.js'
import picmodle from '../model/picmodle.js'
import Save from '../model/class/Save.js'
import { Level, LevelNum } from '../model/constNum.js'

/**@import {botEvent} from '../components/baseClass.js' */

const illlist = getInfo.illlist
const theme = [{ id: "default", src: "默认" }, { id: "snow", src: "寒冬" }, { id: "star", src: "使一颗心免于哀伤" }]

// const sp_date = 'Apr 01 2025'
// const sp_date_num = [41]
// const sp_date_tips = ["渲...渲染失败QAQ！啊...什么！这里不是B30吗？！不...不管了！愚人节快乐！"]

const spData = [{
    sp_month: '01',
    sp_date: '01',
    sp_date_num: [2026],
    sp_date_tips: ["2！0！2！6！新！年！快！乐！o(≧v≦)o"]
}]

export class phimoney extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-money',
            dsc: 'phi-plugin货币系统',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/]?(${Config.getUserCfg('config', 'cmdhead')})(\\s*)(sign|sign in|签到|打卡)$`,
                    fnc: 'sign'
                },
                {
                    reg: `^[#/]?(${Config.getUserCfg('config', 'cmdhead')})(\\s*)(task|我的任务)$`,
                    fnc: 'tasks'
                },
                {
                    reg: `^[#/]?(${Config.getUserCfg('config', 'cmdhead')})(\\s*)(retask|刷新任务)$`,
                    fnc: 'retask'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(send|送|转)(.*)$`,
                    fnc: 'send'
                },
                {
                    reg: `^[#/]?(${Config.getUserCfg('config', 'cmdhead')})(\\s*)(theme)(\\s*)[0-2]$`,
                    fnc: 'theme'
                },
            ]
        })

    }

    /**
     * 签到
     * @param {botEvent} e
     */
    async sign(e) {

        if (await getBanGroup.get(e, 'sign')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let data = await getNotes.getNotesData(e.user_id)
        let last_sign = new Date(data.sign_in)
        let now_time = new Date()
        let request_time = getDayZeroTimestamp(now_time) //每天0点

        // 特殊日期处理
        let spDateIndex = checkSpDateIndex(now_time);

        if (request_time > last_sign) {
            let getnum = randint(20, 5)

            if (spDateIndex !== -1) {
                getnum = spData[spDateIndex].sp_date_num[randint(spData[spDateIndex].sp_date_num.length - 1)]
            }

            data.money += getnum
            data.sign_in = now_time.toISOString();


            getNotes.putNotesData(e.user_id, data)
            /**判断时间段 */
            let Remsg = ['签到成功！' + helloMsg(now_time, 0)]



            if (spDateIndex !== -1) {
                Remsg.push(`${spData[spDateIndex].sp_date_tips[randint(spData[spDateIndex].sp_date_tips.length - 1)]}恭喜您获得了${getnum}个Note！当前您所拥有的 Note 数量为：${data.money}`)
            } else {
                Remsg.push(`恭喜您获得了${getnum}个Note！当前您所拥有的 Note 数量为：${data.money}`)
                Remsg.push(`祝您今日愉快呐！（￣︶￣）↗　`)
            }

            let save = await send.getsave_result(e, undefined, false)
            let last_task = new Date(data.task_time)

            if (save) {
                if (last_task < request_time) {
                    /**如果有存档并且没有刷新过任务自动刷新 */
                    this.retask(e)
                    Remsg.push(`已自动为您刷新任务！您今日份的任务如下：`)
                } else {
                    this.tasks(e)
                    Remsg.push(`您今日已经领取过任务了哦！您今日份的任务如下：`)
                }
            } else {
                Remsg.push(`您当前没有绑定sessionToken呐！任务需要绑定sessionToken后才能获取哦！\n/${Config.getUserCfg('config', 'cmdhead')} bind <sessionToken>`)
            }
            send.send_with_At(e, Remsg.join('\n'))

        } else {
            if (spDateIndex !== -1) {
                send.send_with_At(e, `${spData[spDateIndex].sp_date_tips[randint(spData[spDateIndex].sp_date_tips.length - 1)]}你在今天${fCompute.formatDate(last_sign, false)}的时候已经签过到了哦！\n你现在的Note数量: ${data.money}`)
            } else {
                send.send_with_At(e, `你在今天${fCompute.formatDate(last_sign, false)}的时候已经签过到了哦！\n你现在的Note数量: ${data.money}`)
            }
        }
        return true
    }

    /**
     * 刷新任务并发送图片
     * @param {botEvent} e
     */
    async retask(e) {

        if (await getBanGroup.get(e, 'retask')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let save = await send.getsave_result(e)

        if (!save) {
            return false
        }

        let data = await getNotes.getNotesData(e.user_id)
        let last_task = new Date(data.task_time)
        let now_time = new Date()
        let request_time = getDayZeroTimestamp(now_time) //每天0点
        /**@type {import('../model/getNotes.js').taskObj[]} */
        let oldtask = []

        /**note变化 */
        let change_note = 0

        if (request_time > last_task) {
            /**每天一次免费刷新任务 */
        } else {
            /**花费20Notes刷新 */
            if (data.money >= 20) {
                data.money -= 20
                change_note -= 20
                oldtask = data.task
            } else {
                send.send_with_At(e, `刷新任务需要 20 Notes，咱没有那么多Note哇QAQ！\n你当前的 Note 数目为：${data.money}`)
                return false
            }
        }

        data.task_time = now_time.toISOString();
        data.task = randtask(save, oldtask)

        let vis = false
        for (let i in data.task) {
            if (data.task) {
                vis = true
                break
            }
        }

        if (!vis) {
            send.send_with_At(e, `哇塞，您已经把所有曲目全部满分了呢！没有办法为您布置任务了呢！敬请期待其他玩法哦！`)
            return true
        }

        getNotes.putNotesData(e.user_id, data)

        /**判断时间段 */
        const Remsg = helloMsg(now_time, 1)

        /**添加曲绘 */
        if (data.task) {
            for (let i in data.task) {
                // @ts-ignore
                data.task[i].illustration = get.getill(data.task[i].song)
            }
        }

        let picdata = {
            PlayerId: save.saveInfo.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: fCompute.formatDate(now_time),
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            background: getInfo.getill(illlist[Math.floor(Math.random() * (illlist.length - 1))]),
            task: data.task,
            task_ans: Remsg[0],
            task_ans1: Remsg[1],
            Notes: data.money,
            tips: get.tips[Math.floor((Math.random() * (get.tips.length - 1)) + 1)],
            change_notes: `${change_note ? change_note : ''}`,
            theme: data?.theme || 'star',
        }

        const spDateIndex = checkSpDateIndex(now_time);
        if (spDateIndex !== -1) {
            picdata.tips = spData[spDateIndex].sp_date_tips[randint(spData[spDateIndex].sp_date_tips.length - 1)]
        }
        send.send_with_At(e, await get.gettasks(e, picdata))

        return true


    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async tasks(e) {

        if (await getBanGroup.get(e, 'tasks')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let now = await send.getsave_result(e)

        if (!now) {
            return false
        }
        let now_time = new Date()
        /**判断时间段 */
        const Remsg = helloMsg(now_time, 1)

        let data = await getNotes.getNotesData(e.user_id)
        let task_time = new Date(data.task_time)

        /**添加曲绘 */
        if (data.task) {
            for (let i in data.task) {
                // @ts-ignore
                data.task[i].illustration = get.getill(data.task[i].song)
            }
        }

        let picdata = {
            PlayerId: now.saveInfo.PlayerId,
            Rks: Number(now.saveInfo.summary.rankingScore).toFixed(4),
            Date: fCompute.formatDate(task_time),
            ChallengeMode: (now.saveInfo.summary.challengeModeRank - (now.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: now.saveInfo.summary.challengeModeRank % 100,
            background: getInfo.getill(illlist[Math.floor(Math.random() * (illlist.length - 1))]),
            task: data.task,
            task_ans: Remsg[0],
            task_ans1: Remsg[1],
            Notes: data.money,
            tips: get.tips[Math.floor((Math.random() * (get.tips.length - 1)) + 1)],
            dan: await get.getDan(e.user_id),
            theme: data?.theme || 'star',
        }

        const spDateIndex = checkSpDateIndex(now_time);
        if (spDateIndex !== -1) {
            picdata.tips = spData[spDateIndex].sp_date_tips[randint(spData[spDateIndex].sp_date_tips.length - 1)]
        }


        send.send_with_At(e, await picmodle.tasks(e, picdata))

        return true
    }

    /**
     * 转账
     * @param {botEvent} e
     */
    async send(e) {

        if (await getBanGroup.get(e, 'send')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }
        let msg = e.msg.replace(/[#/](.*?)(send|送|转)(\s*)/g, "")
        msg = msg.replace(/[\<\>]/g, "")
        let target = e.at
        let num
        if (!e.at) {
            if (msg.includes(' ')) {
                const parts = msg.split(' ')
                target = parts[0]
                num = Number(parts[1])
            } else {
                send.send_with_At(e, `格式错误！请指定目标\n格式：/${Config.getUserCfg('config', 'cmdhead')} send <@ or id> <数量>`, true)
                return true
            }
        } else {
            num = Number(msg)
        }
        if (isNaN(num)) {
            send.send_with_At(e, `非法数字：${msg}\n格式：/${Config.getUserCfg('config', 'cmdhead')} send <@ or id> <数量>`, true)
            return true
        }

        try {
            // @ts-ignore
            await Bot.pickMember(e.group_id, target)
        } catch (err) {
            send.send_with_At(e, `这个QQ号……好像没有见过呢……`)
            return true
        }

        let sender_data = await getNotes.getNotesData(e.user_id)

        if (target == e.user_id) {
            await send.send_with_At(e, `转账成……欸？这个目标……在拿我寻开心嘛！`)
            await common.sleep(1000)
            await send.send_with_At(e, `转账失败！扣除 20 Notes！`)
            if (sender_data.money < 20) {
                await send.send_with_At(e, `a，你怎么连20 Note都没有哇`)
                await send.send_with_At(e, `www，算了，我今天心情好，不和你计较了，哼！`)
            } else {
                sender_data.money -= 20
            }
            getNotes.putNotesData(e.user_id, sender_data)
            return true
        }


        if (sender_data.money < num) {
            send.send_with_At(e, `你当前的Note数量不够哦！\n当前Note: ${sender_data.money}`)
            return true
        }

        let target_data = await getNotes.getNotesData(target)
        target_data.money += Math.ceil(num * 0.8)

        let sender_old = sender_data.money
        let target_old = target_data.money

        sender_data.money -= num
        getNotes.putNotesData(e.user_id, sender_data)

        getNotes.putNotesData(target, target_data)
        // @ts-ignore
        let target_card = await Bot.pickMember(e.group_id, target)
        send.send_with_At(e, `转账成功！\n你当前的Note: ${sender_old} - ${num} = ${sender_data.money}\n${target_card.nickname || target_card.card}的Note: ${target_old} + ${Math.ceil(num * 0.8)} = ${target_data.money}`)
    }

    /**
     * 主题相关
     * @param {botEvent} e
     */
    async theme(e) {

        if (await getBanGroup.get(e, 'theme')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let msg = e.msg.replace(/.*?theme\s*/g, '')
        let aim = Number(msg)
        if (typeof aim != 'number' || aim < 0 || aim > 2) {
            send.send_with_At(e, `请输入主题数字嗷！\n格式/${Config.getUserCfg('config', 'cmdhead')} theme 0-2`)
            return false
        }

        const plugin_data = await getNotes.getNotesData(e.user_id)
        plugin_data.theme = theme[aim].id

        getNotes.putNotesData(e.user_id, plugin_data)

        send.send_with_At(e, `设置成功！\n你当前的主题是：${theme[aim].src}`)
        return true
    }
}


/**
 * 
 * @param {Save} save 
 * @param {import('../model/getNotes.js').taskObj[]} task 
 * @returns 
 */
function randtask(save, task = []) {
    let rks = save.saveInfo.summary.rankingScore
    let gameRecord = save.gameRecord
    for (let id of fCompute.objectKeys(gameRecord)) {
        gameRecord[id] = gameRecord[id]
    }

    let info = getInfo.ori_info
    /**@type {{song: idString, level: number}[][]} */
    let ranked_songs = [[], [], [], [], []] //任务难度分级后的曲目列表

    let rank_line = [] //割分歌曲的临界定数


    if (rks < 15) {
        rank_line.push(rks - 1)
        rank_line.push(rks - 0.5)
        rank_line.push(rks + 0)
        rank_line.push(rks + 1)
    } else if (rks < 16) {
        rank_line.push(rks - 1.5)
        rank_line.push(rks - 0.3)
        rank_line.push(rks + 0)
        rank_line.push(rks + 0.5)
    } else {
        rank_line.push(rks - 2)
        rank_line.push(rks - 1)
        rank_line.push(rks - 0.5)
        rank_line.push(rks + 0)
    }

    rank_line.push(18)

    /**将曲目分级并处理 */
    for (let id of fCompute.objectKeys(info)) {
        if (id == 'テリトリーバトル.ツユ') continue
        if (!info[id].chart) continue
        for (let level of Level) {
            if (info[id].chart[level]) {
                if (!gameRecord[id] || !gameRecord[id][LevelNum[level]] || gameRecord[id][LevelNum[level]]?.acc != 100) {
                    let dif = info[id].chart[level].difficulty
                    for (let i in rank_line) {
                        if (dif < rank_line[i]) {
                            ranked_songs[i].push({ song: id, level: LevelNum[level] })
                            break
                        }
                    }
                }
            }
        }
    }

    let reward = [10, 15, 30, 60, 80, 100]

    for (let i in ranked_songs) {
        if (task[i] && task[i].finished == true) {
            continue
        }
        let aim = ranked_songs[i][randint(ranked_songs[i].length - 1)]
        if (!aim) {
            continue
        }
        let id = aim.song
        let level = aim.level
        let type = randint(1) //0 acc, 1 score
        let value
        let old_acc = 0
        let old_score = 0
        if (gameRecord[id] && gameRecord[id][level]) {
            old_acc = gameRecord[id][level].acc
            old_score = gameRecord[id][level].score
        }
        if (type) {
            value = Math.min(Number(easeInSine(Math.random(), Math.min(old_score + 1, 1e6), 1e6 - Math.min(old_score + 1, 1e6), 1).toFixed(0)), 1e6)
        } else {
            value = Math.min(Number(easeInSine(Math.random(), Math.min(old_acc + 0.01, 100), 100 - Math.min(old_acc + 0.01, 100), 1).toFixed(2)), 100)
        }
        task[i] = {
            song: id,
            reward: randint(reward[Number(i) + 1], reward[i]),
            finished: false,
            request: {
                rank: Level[level],
                type: type ? 'score' : 'acc',
                value: value,
            }
        }
    }

    return task
}


/**
 * 定义生成指定区间整数随机数的函数
 * @param {Number} max 
 * @param {Number} min 默认为0
 * @returns 
 */
function randint(max, min = 0) {
    const range = max - min + 1
    const randomOffset = Math.floor(Math.random() * range)
    return (randomOffset + min) % range + min
}

/**
 * 
 * @param {Number} t 时间
 * @param {Number} b 最小值
 * @param {Number} c 跨度
 * @param {Number} d 总时间长度
 * @returns Number
 */
function easeInSine(t, b, c, d) {
    return -c * Math.cos(t / d * (Math.PI / 2)) + c + b;
}

/**
 * 
 * @param {Date|string|number} t 
 * @returns {Date} 当天零点时间
 */
function getDayZeroTimestamp(t) {
    const date = new Date(t);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const zeroDate = new Date(year, month, day, 0, 0, 0);
    return zeroDate;
}

/**
 * @overload
 * @param {Date} now_time 
 * @param {0} type 是否分开
 * @returns {string}
 */
/**
 * @overload
 * @param {Date} now_time 
 * @param {1} type 是否分开
 * @returns {string[]}
 */
/**
 * @param {Date} now_time 
 * @param {number} [type=0] 是否分开
 * @returns {string|string[]}
 */
function helloMsg(now_time, type = 0) {

    /**判断时间段 */
    const now_time_str = now_time.toString();
    let time1 = new Date(now_time_str.replace(/([0-9])+:([0-9])+:([0-9])+/, '06:00:00')).getTime()
    let time2 = new Date(now_time_str.replace(/([0-9])+:([0-9])+:([0-9])+/, '11:30:00')).getTime()
    let time3 = new Date(now_time_str.replace(/([0-9])+:([0-9])+:([0-9])+/, '13:00:00')).getTime()
    let time4 = new Date(now_time_str.replace(/([0-9])+:([0-9])+:([0-9])+/, '18:30:00')).getTime()
    let time5 = new Date(now_time_str.replace(/([0-9])+:([0-9])+:([0-9])+/, '23:00:00')).getTime()
    let Remsg = []

    const now_time_ms = new Date().getTime()

    const h_m_s = fCompute.formatDate(now_time, false)
    let ans = []
    if (now_time_ms < time1) {
        ans = [`现在是${h_m_s}，夜深了，注意休息哦！`, `(∪.∪ )...zzz`]
    } else if (now_time_ms < time2) {
        ans = [`现在是${h_m_s}，早安呐！`, `ヾ(≧▽≦*)o`]
    } else if (now_time_ms < time3) {
        ans = [`现在是${h_m_s}，午好嗷！`, `(╹ڡ╹ )`]
    } else if (now_time_ms < time4) {
        ans = [`现在是${h_m_s}，下午好哇！`, `(≧∀≦)ゞ`]
    } else if (now_time_ms < time5) {
        ans = [`现在是${h_m_s}，晚上好！`, `( •̀ ω •́ )✧`]
    } else {
        ans = [`现在是${h_m_s}，夜深了，注意休息哦！`, `(∪.∪ )...zzz`]
    }

    return type ? ans : ans.join('');
}


/**
 * 特殊日期处理
 * @param {Date} now_time 
 */
function checkSpDateIndex(now_time) {
    // 特殊日期处理
    let spDateIndex = -1;
    for (let i = 0; i < spData.length; i++) {
        const spDate = new Date(`${now_time.getFullYear()}/${spData[i].sp_month}/${spData[i].sp_date}`);
        if (now_time.getMonth() === spDate.getMonth() && now_time.getDate() === spDate.getDate()) {
            spDateIndex = i;
            break;
        }
    }
    return spDateIndex;
}