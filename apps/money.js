import common from '../../../lib/common/common.js'
import plugin from '../../../lib/plugins/plugin.js'
import path from 'path'
import Config from '../components/Config.js'
import send from '../model/send.js'
import getNotes from '../model/getNotes.js'
import getBanGroup from '../model/getBanGroup.js';
import getInfo from '../model/getInfo.js'
import readFile from '../model/getFile.js'
import { infoPath } from '../model/path.js'
import phiPluginBase from '../components/baseClass.js'
import fCompute from '../model/fCompute.js'
import picmodle from '../model/picmodle.js'
import Save from '../model/class/Save.js'
import { Level, LevelNum, redisPath } from '../model/constNum.js'
import PluginData, { themeList } from '../model/class/pluginData.js'
import makeRequest from '../model/makeRequest.js'
import logger from '../components/Logger.js'

/**@import {botEvent} from '../components/baseClass.js' */

const illlist = getInfo.illlist
const theme = themeList

// const sp_date = 'Apr 01 2025'
// const sp_date_num = [41]
// const sp_date_tips = ["渲...渲染失败QAQ！啊...什么！这里不是B30吗？！不...不管了！愚人节快乐！"]

const spData = [{
    sp_month: '01',
    sp_date: '01',
    sp_date_num: [2026],
    sp_date_tips: ["2！0！2！6！新！年！快！乐！o(≧v≦)o"]
}]

/**@type {any[] | null} */
let sentenceCache = null

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
                    reg: `^[#/]?(${Config.getUserCfg('config', 'cmdhead')})(\\s*)(theme)(\\s*)[0-3]$`,
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
        let todayKey = formatDateKey(now_time)

        // 特殊日期处理
        let spDateIndex = checkSpDateIndex(now_time);

        let signedJustNow = false
        let getnum = 0

        if (request_time > last_sign) {
            signedJustNow = true
            getnum = randint(20, 5)
            if (spDateIndex !== -1) {
                getnum = spData[spDateIndex].sp_date_num[randint(spData[spDateIndex].sp_date_num.length - 1)]
            }

            data.money += getnum
            data.sign_in = now_time.toISOString();

            if (!Array.isArray(data.sign_history)) data.sign_history = []
            if (!data.sign_history.includes(todayKey)) data.sign_history.push(todayKey)

            getNotes.putNotesData(e.user_id, data)
        } else {
            // 兼容旧数据：已签但历史缺失时补一条，保证日历正确
            if (!Array.isArray(data.sign_history)) data.sign_history = []
            if (!data.sign_history.includes(todayKey)) {
                data.sign_history.push(todayKey)
                getNotes.putNotesData(e.user_id, data)
            }
        }

        /** 尝试拿存档（无存档也照样渲染） */
        let save = await send.getsave_result(e, undefined, false)

        /** 今日任务：有存档且今日未刷新时，静默刷新一次并写回 */
        if (save) {
            let last_task = new Date(data.task_time)
            if (last_task < request_time) {
                data.task_time = now_time.toISOString()
                data.task = await randtask(save, [])
                getNotes.putNotesData(e.user_id, data)
            }
        }


        const img = await picmodle.common(e, 'sign', await picData(save, data, e.user_id));
        if (signedJustNow) {
            const tips = spDateIndex !== -1
                ? spData[spDateIndex].sp_date_tips[randint(spData[spDateIndex].sp_date_tips.length - 1)]
                : `签到成功！${helloMsg(now_time, 0)}`
            send.send_with_At(e, [img, `${tips}\n恭喜您获得了${getnum}个Note！当前 Note：${data.money}`])
        } else {
            send.send_with_At(e, [img, `你在今天${fCompute.formatDate(last_sign, false)}的时候已经签过到了哦！\n你现在的Note数量: ${data.money}`])
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
        /**@type {import('../model/class/pluginData.js').taskObj[]} */
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
        data.task = await randtask(save, oldtask)

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
        
        const img = await picmodle.common(e, 'sign', await picData(save, data, e.user_id));
        send.send_with_At(e, img);

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

        let save = await send.getsave_result(e)

        if (!save) {
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
                data.task[i].illustration = getInfo.getill(data.task[i].song)
                // @ts-ignore
                data.task[i].song = getInfo.idgetsong(data.task[i].song) || data.task[i].song
            }
        }

        const img = await picmodle.common(e, 'sign', await picData(save, data, e.user_id));
        let picdata = {
            PlayerId: save.saveInfo.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: fCompute.formatDate(task_time),
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            background: getInfo.getill(illlist[Math.floor(Math.random() * (illlist.length - 1))]),
            task: data.task,
            task_ans: Remsg[0],
            task_ans1: Remsg[1],
            Notes: data.money,
            tips: getInfo.tips[Math.floor((Math.random() * (getInfo.tips.length - 1)) + 1)],
            // dan: await get.getDan(e.user_id),
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
        const tmp = `\n格式：/${Config.getUserCfg('config', 'cmdhead')} send <@ or id> <数量>`;
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
                send.send_with_At(e, `格式错误！请指定目标${tmp}`, true)
                return true
            }
        } else {
            num = Number(msg)
        }
        if (isNaN(num)) {
            send.send_with_At(e, `非法数字：${msg}${tmp}`, true)
            return true
        }

        if (!target) {
            send.send_with_At(e, `格式错误！请指定目标${tmp}`, true);
        }

        try {
            // @ts-ignore
            const tar = await Bot.pickMember(e.group_id, target);
            if (!tar) throw new Error("not found");
        } catch (err) {
            send.send_with_At(e, `这个QQ号……好像没有见过呢……`);
            return true
        }


        let target_data = await getNotes.getNotesData(target)

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

        if (!isFinite(num) || num < 0) {
            send.send_with_At(e, "你看看你输入的是正常数字嘛！");
            return true;
        }

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
        if (typeof aim != 'number' || aim < 0 || aim > theme.length - 1) {
            send.send_with_At(e, `请输入主题数字嗷！\n格式/${Config.getUserCfg('config', 'cmdhead')} theme 0-${theme.length - 1}`)
            return false
        }

        const plugin_data = await getNotes.getNotesData(e.user_id)
        // @ts-ignore
        plugin_data.theme = theme[aim].id

        getNotes.putNotesData(e.user_id, plugin_data)

        send.send_with_At(e, `设置成功！\n你当前的主题是：${theme[aim].src}`)
        return true
    }
}


/**
 * 
 * @param {Save} save 
 * @param {import('../model/class/pluginData.js').taskObj[]} task 
 * @returns 
 */
async function randtask(save, task = []) {
    let rks = save.saveInfo.summary.rankingScore
    let gameRecord = save.gameRecord
    for (let id of fCompute.objectKeys(gameRecord)) {
        gameRecord[id] = gameRecord[id]
    }

    let info = getInfo.ori_info

    const { com_rks } = await save.getB19(1000, { avgType: "none" });

    /**
     * @type {{ id: idString; level: allLevelKind; type: string; value: number; diff: number; oldAcc: number; }[]}
     */
    let allTaskList = [];

    if (Config.getUserCfg('config', 'openPhiPluginApi')) {

        try {
            const res = await makeRequest.getAllSongAccAvgB30({
                songIds: getInfo.idList,
                minRks: Math.floor((com_rks - 0.05) / 0.05) * 0.05,
                maxRks: Math.floor((com_rks + 0.05) / 0.05) * 0.05
            })
            const ids = fCompute.objectKeys(res)
            ids.forEach(id => {
                if (!getInfo.ori_info[id]) {
                    return;
                }
                Level.forEach(lv => {
                    if (!getInfo.ori_info[id]?.chart?.[lv]) {
                        return;
                    }
                    const avg = res[id][lv].accAvg || 0;
                    if (avg > (save.gameRecord?.[id]?.[LevelNum[lv]]?.acc || 0)) {
                        allTaskList.push({
                            id,
                            level: lv,
                            type: 'acc',
                            value: avg,
                            diff: getInfo.ori_info[id].chart[lv].difficulty,
                            oldAcc: save.gameRecord?.[id]?.[LevelNum[lv]]?.acc || 0
                        });
                    }
                })
            })
        } catch (err) {
            logger.error(`[phi-plugin][api-getAllSongAccAvgB30]`, err);
        }
    }

    allTaskList.sort((a, b) => b.value - a.value)

    for (let i = 0; i < allTaskList.length; i++) {
        if (allTaskList[i].value < 95) {
            allTaskList = allTaskList.slice(0, i);
            break;
        }
    }


    /**@type {{song: idString, level: number}[][]} */
    let ranked_songs = [[], [], [], [], []] //任务难度分级后的曲目列表

    if (allTaskList.length < 5) {
        const rank_line = [];
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
            if (!info[id]?.chart) continue
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

    }

    for (let i in ranked_songs) {
        if (task[i] && task[i].finished == true) {
            continue
        }
        if (allTaskList.length) {
            const randIndex = randint(allTaskList.length - 1);
            let aim = allTaskList.splice(randIndex, 1)[0];
            task[i] = {
                song: aim.id,
                reward: comReward(com_rks, aim.diff, aim.value, aim.oldAcc),
                finished: false,
                request: {
                    // @ts-ignore
                    rank: aim.level,
                    type: aim.type,
                    value: Number(aim.value.toFixed(2)),
                }
            }
        } else if (ranked_songs[i].length) {
            const randIndex = randint(ranked_songs[i].length - 1);
            let aim = ranked_songs[i][randIndex];
            if (!aim) {
                continue
            }
            let id = aim.song
            let level = aim.level
            let diff = info?.[id]?.chart?.[Level[level]]?.difficulty || 0
            let value
            let old_acc = 0
            let old_score = 0
            if (gameRecord[id] && gameRecord[id][level]) {
                old_acc = gameRecord[id][level].acc
                old_score = gameRecord[id][level].score
            }
            value = Math.min(Number(easeInSine(Math.random(), Math.min(old_acc + 0.01, 100), 100 - Math.min(old_acc + 0.01, 100), 1).toFixed(2)), 100)

            task[i] = {
                song: aim.song,
                reward: comReward(com_rks, diff, value, old_acc),
                finished: false,
                request: {
                    // @ts-ignore
                    rank: aim.level,
                    type: 'acc',
                    value,
                }
            }

        }

    }


    return task
}

/**
 * 
 * @param {Save | false} save 
 * @param {PluginData} plugin_data 
 * @param {any} user_id 
 */
async function picData(save, plugin_data, user_id) {
    let now_time = new Date()
    let todayKey = formatDateKey(now_time)

    /** 今日人品（复用 jrrp 的 redis 数据，保证一致） */
    let fortune = await getOrCreateFortune(user_id)

    /** 进度条（解锁/FC/PHI 三层叠加） */
    let edgeRate = {
        EZ: { unlock: '0%', fc: '0%', phi: '0%' },
        HD: { unlock: '0%', fc: '0%', phi: '0%' },
        IN: { unlock: '0%', fc: '0%', phi: '0%' },
        AT: { unlock: '0%', fc: '0%', phi: '0%' },
    }
    if (save) {
        try {
            let stats = await save.getStats()
            edgeRate.EZ.unlock = percent(stats?.[0]?.unlock, stats?.[0]?.tot)
            edgeRate.EZ.fc = percent(stats?.[0]?.fc, stats?.[0]?.tot)
            edgeRate.EZ.phi = percent(stats?.[0]?.phi, stats?.[0]?.tot)

            edgeRate.HD.unlock = percent(stats?.[1]?.unlock, stats?.[1]?.tot)
            edgeRate.HD.fc = percent(stats?.[1]?.fc, stats?.[1]?.tot)
            edgeRate.HD.phi = percent(stats?.[1]?.phi, stats?.[1]?.tot)

            edgeRate.IN.unlock = percent(stats?.[2]?.unlock, stats?.[2]?.tot)
            edgeRate.IN.fc = percent(stats?.[2]?.fc, stats?.[2]?.tot)
            edgeRate.IN.phi = percent(stats?.[2]?.phi, stats?.[2]?.tot)

            edgeRate.AT.unlock = percent(stats?.[3]?.unlock, stats?.[3]?.tot)
            edgeRate.AT.fc = percent(stats?.[3]?.fc, stats?.[3]?.tot)
            edgeRate.AT.phi = percent(stats?.[3]?.phi, stats?.[3]?.tot)
        } catch { }
    }

    /** 日历（当月） */
    let calendar = buildCalendar(now_time.getFullYear(), now_time.getMonth() + 1, new Set(plugin_data.sign_history || []), todayKey)

    /** 公告 */
    let notice = null;

    if (plugin_data.noticeCode < getInfo.noticeJson.code) {
        notice = getInfo.noticeJson
        plugin_data.noticeCode = getInfo.noticeJson.code
        getNotes.putNotesData(user_id, plugin_data)
    }

    /** 任务列表（展示前 5 条） */
    /**@type {{index: string, song: string, illustration: string, meta: string, finished: boolean}[]} */
    let dailyTasks = []
    if (save && Array.isArray(plugin_data.task)) {
        for (let i = 0; i < Math.min(5, plugin_data.task.length); i++) {
            // @ts-ignore
            let t = plugin_data.task[i]
            if (!t) continue
            const songInfo = getInfo.ori_info?.[t.song];
            // @ts-ignore
            let ill = getInfo.getill(t.song)
            // @ts-ignore
            let songName = songInfo?.song || t.song
            // @ts-ignore
            let meta = `${t.request?.rank || ''} ${songInfo?.chart[t.request.rank]?.difficulty || ''} · ${(t.request?.type || '').toUpperCase()} ${t.request?.value ?? ''} · +${t.reward || 0} Notes`
            dailyTasks.push({
                index: fCompute.ped(i + 1, 2),
                song: songName,
                illustration: ill,
                meta,
                finished: Boolean(t.finished),
            })
        }
    }

    return {
        PlayerId: save ? save.saveInfo.PlayerId : '游客玩家',
        Rks: save ? Number(save.saveInfo.summary.rankingScore).toFixed(4) : '0.0000',
        Date: fCompute.formatDate(now_time),
        ChallengeMode: save ? Math.floor(save.saveInfo.summary.challengeModeRank / 100) : 0,
        ChallengeModeRank: save ? (save.saveInfo.summary.challengeModeRank % 100) : 0,
        avatar: save ? getInfo.idgetavatar(save.gameuser.avatar) : 'Introduction',
        background: getInfo.getill(illlist[Math.floor(Math.random() * (illlist.length - 1))]),
        Notes: plugin_data.money,
        signDays: Array.isArray(plugin_data.sign_history) ? plugin_data.sign_history.length : 0,
        lucky: fortune.lucky,
        good: fortune.good,
        bad: fortune.bad,
        quote: fortune.quote,
        edgeRate,
        dailyTasks,
        calendar,
        notice,
        theme: plugin_data?.theme || 'default',
    }
}

/**
 * 计算任务奖励
 * @param {number} rks 
 * @param {number} diff 
 * @param {number} value 
 * @param {number} oldAcc 
 * @returns 
 */
function comReward(rks, diff, value, oldAcc) {
    const p1 = pCeil(pmax(diff - rks, 0) * 4)
    const p2 = pCeil(pmin(pmax(value - oldAcc, 0) * 10, 50))
    const p3 = pCeil((pmax(value - 95, 0) / 5) ** 3 * 20)
    // console.log(`reward debug: rks=${rks} diff=${diff} value=${value} oldAcc=${oldAcc} => p1=${p1} p2=${p2} p3=${p3}`)
    return p1 + p2 + p3;
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

/**
 * 生成 YYYY-MM-DD（按本地日期）
 * @param {Date} date
 */
function formatDateKey(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/**
 * @param {number} a
 * @param {number} b
 */
function percent(a, b) {
    const aa = Number(a) || 0
    const bb = Number(b) || 0
    if (!bb) return '0%'
    return `${Math.max(0, Math.min(100, Math.round((aa / bb) * 100)))}%`
}

/**
 * 构建当月日历（周一为起始）
 * @param {number} year
 * @param {number} month 1-12
 * @param {Set<string>} signHistory YYYY-MM-DD
 * @param {string} todayKey YYYY-MM-DD
 */
function buildCalendar(year, month, signHistory, todayKey) {
    const weekdays = ['一', '二', '三', '四', '五', '六', '日']
    const daysInMonth = new Date(year, month, 0).getDate()
    const first = new Date(year, month - 1, 1)
    const firstIndex = (first.getDay() + 6) % 7 // Monday=0 ... Sunday=6

    /**@type {Array<Array<{empty: boolean, day?: number, signed?: boolean, today?: boolean}>>} */
    const weeks = []
    let day = 1

    for (let w = 0; w < 6; w++) {
        /**@type {Array<{empty: boolean, day?: number, signed?: boolean, today?: boolean}>} */
        const week = []
        for (let i = 0; i < 7; i++) {
            if ((w === 0 && i < firstIndex) || day > daysInMonth) {
                week.push({ empty: true })
                continue
            }
            const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            week.push({
                empty: false,
                day,
                signed: signHistory.has(key),
                today: key === todayKey,
            })
            day++
        }
        weeks.push(week)
    }

    return {
        title: `${year} 年 ${month} 月`,
        weekdays,
        weeks,
    }
}

/**
 * 复用 jrrp 的 redis 数据，保证同一用户同一天 fortune 一致
 * @param {string|number} userId
 */
async function getOrCreateFortune(userId) {
    try {
        // @ts-ignore
        let jrrp = await redis.get(`${redisPath}:jrrp:${userId}`)
        if (jrrp) {
            try {
                const arr = JSON.parse(jrrp)
                const quote = await pickSentenceText(arr?.[1])
                return {
                    lucky: Number(arr?.[0]) || 0,
                    good: Array.isArray(arr) ? arr.slice(2, 6) : [],
                    bad: Array.isArray(arr) ? arr.slice(6, 10) : [],
                    quote,
                }
            } catch { }
        }

        if (!getInfo.word) {
            return { lucky: 0, good: [], bad: [], quote: '' }
        }

        const sentenceList = await getSentenceList()
        const lucky = Math.round(easeOutCubic(Math.random()) * 100)
        const sentenceIndex = sentenceList.length ? Math.floor(Math.random() * sentenceList.length) : 0

        let good = [...getInfo.word.good]
        let bad = [...getInfo.word.bad]
        let common = [...getInfo.word.common]

        /**@type {any[]} */
        const data = [lucky, sentenceIndex]

        for (let i = 0; i < 4; i++) {
            let id = Math.floor(Math.random() * (good.length + common.length))
            if (id < good.length) {
                data.push(good[id])
                good.splice(id, 1)
            } else {
                data.push(common[id - good.length])
                common.splice(id - good.length, 1)
            }
        }
        for (let i = 0; i < 4; i++) {
            let id = Math.floor(Math.random() * (bad.length + common.length))
            if (id < bad.length) {
                data.push(bad[id])
                bad.splice(id, 1)
            } else {
                data.push(common[id - bad.length])
                common.splice(id - bad.length, 1)
            }
        }

        // @ts-ignore 有效期到第二天 8 点
        redis.set(`${redisPath}:jrrp:${userId}`, JSON.stringify(data), {
            PX: 86400000 - ((new Date().valueOf() + 28800000) % 86400000)
        })

        const quote = await pickSentenceText(sentenceIndex)
        return {
            lucky,
            good: data.slice(2, 6),
            bad: data.slice(6, 10),
            quote,
        }
    } catch {
        return { lucky: 0, good: [], bad: [], quote: '' }
    }
}

/**
 * @param {number} x
 */
function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3)
}

async function getSentenceList() {
    if (Array.isArray(sentenceCache)) return sentenceCache
    const list = await readFile.FileReader(path.join(infoPath, 'sentences.json'))
    sentenceCache = Array.isArray(list) ? list : []
    return sentenceCache
}

/**
 * @param {number} idx
 */
async function pickSentenceText(idx) {
    const list = await getSentenceList()
    const item = list?.[idx]
    if (!item) return ''
    if (typeof item === 'string') return item
    return item.hitokoto || item.text || ''
}

/**
 * max
 * @param {number} a 
 * @param {number} b 
 * @returns {number}
 */
function pmax(a, b) {
    if (a === undefined) return b
    if (b === undefined) return a
    return Math.max(a, b)
}

/** min
 * @param {number} a 
 * @param {number} b
 * @returns {number}
 */
function pmin(a, b) {
    if (a === undefined) return b
    if (b === undefined) return a
    return Math.min(a, b)
}

/**
 * ceil
 * @param {number} num
 * @return {number}
 */
function pCeil(num) {
    if (num === undefined) return 0
    return Math.ceil(num)
}