import common from '../../../lib/common/common.js'
import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'
import send from '../model/send.js'
import Vika from '../model/Vika.js'

const illlist = []
const theme = [{ id: "default", src: "默认" }, { id: "snow", src: "寒冬" }, { id: "star", src: "使一颗心免于哀伤" }]

const sp_date = 'Jan 01 2024'
const sp_date_num = [2024]
const sp_date_tips = ["2！0！2！4！新！年！快！乐！"]

for (let i in get.ori_info) {
    if (get.ori_info[i]['illustration_big']) {
        illlist.push(get.getill(i))
    }
}

const Level = ['EZ', 'HD', 'IN', 'AT']

export class phimoney extends plugin {
    constructor() {
        super({
            name: 'phi-money',
            dsc: 'phi-plugin货币系统',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/]?(${Config.getDefOrConfig('config', 'cmdhead')})?(sign|sign in|签到|打卡)$`,
                    fnc: 'sign'
                },
                {
                    reg: `^[#/]?(${Config.getDefOrConfig('config', 'cmdhead')})?(task|我的任务)$`,
                    fnc: 'tasks'
                },
                {
                    reg: `^[#/]?(${Config.getDefOrConfig('config', 'cmdhead')})?(retask|刷新任务)$`,
                    fnc: 'gettask'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(send|送|转)(.*)$`,
                    fnc: 'send'
                },
                {
                    reg: `^[#/]?(${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(theme)(\\s*)[0-2]$`,
                    fnc: 'theme'
                },
            ]
        })

    }

    /**签到 */
    async sign(e) {
        let data = await get.getmoneydata(e.user_id, true)
        let last_sign = new Date(data.plugin_data.sign_in)
        let now_time = new Date().toString()
        let request_time = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '00:00:00')) //每天0点
        let is_sp_date = false
        if (now_time.includes(sp_date)) {
            is_sp_date = true
        }
        if (request_time > last_sign) {
            let getnum = randint(20, 5)

            if (is_sp_date) {
                getnum = sp_date_num[randint(sp_date_num.length - 1)]
            }

            data.plugin_data.money += getnum
            data.plugin_data.sign_in = now_time



            await get.putpluginData(e.user_id, data)
            /**判断时间段 */
            let time1 = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '06:00:00'))
            let time2 = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '11:30:00'))
            let time3 = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '13:00:00'))
            let time4 = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '18:30:00'))
            let time5 = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '23:00:00'))

            let Remsg = []

            now_time = new Date()
            if (now_time < time1) {
                Remsg.push(`签到成功！现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，夜深了，注意休息哦！(∪.∪ )...zzz\n`)
            } else if (now_time < time2) {
                Remsg.push(`签到成功！现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，早安呐！ヾ(≧▽≦*)o\n`)
            } else if (now_time < time3) {
                Remsg.push(`签到成功！现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，午好嗷！(╹ڡ╹ )\n`)
            } else if (now_time < time4) {
                Remsg.push(`签到成功！现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，下午好哇！(≧∀≦)ゞ\n`)
            } else if (now_time < time5) {
                Remsg.push(`签到成功！现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，晚上好！( •̀ ω •́ )✧\n`)
            } else {
                Remsg.push(`签到成功！现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，夜深了，注意休息哦！(∪.∪ )...zzz\n`)
            }


            if (is_sp_date) {
                Remsg.push(`${sp_date_tips[randint(sp_date_tips.length - 1)]}恭喜您获得了${getnum}个Note！当前您所拥有的 Note 数量为：${data.plugin_data.money}，祝您节日愉快！`)
            } else {
                Remsg.push(`恭喜您获得了${getnum}个Note！当前您所拥有的 Note 数量为：${data.plugin_data.money}\n`)

                Remsg.push(`祝您今日愉快呐！（￣︶￣）↗　`)
            }

            let save = await get.getsave(e.user_id)
            let last_task = new Date(data.plugin_data.task_time)

            if (save) {
                if (last_task < request_time) {
                    /**如果有存档并且没有刷新过任务自动刷新 */
                    this.gettask(e)
                    Remsg.push(`\n已自动为您刷新任务！您今日份的任务如下：`)
                } else {
                    this.tasks(e)
                    Remsg.push(`\n您今日已经领取过任务了哦！您今日份的任务如下：`)
                }
            } else {
                Remsg.push(`\n您当前没有绑定sessionToken呐！任务需要绑定sessionToken后才能获取哦！\n/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
            }
            send.send_with_At(e, Remsg)

        } else {
            get.delLock(e.user_id)
            if (is_sp_date) {
                send.send_with_At(e, `${sp_date_tips[randint(sp_date_tips.length - 1)]}你在今天${last_sign.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}的时候已经签过到了哦！\n你现在的Note数量: ${data.plugin_data.money}`)
            } else {
                send.send_with_At(e, `你在今天${last_sign.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}的时候已经签过到了哦！\n你现在的Note数量: ${data.plugin_data.money}`)
            }
        }
        return true
    }

    /**刷新任务并发送图片 */
    async gettask(e) {
        let save = await get.getsave(e.user_id)

        if (!save) {
            send.send_with_At(e, `该功能需要绑定后才能使用哦！\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
            return false
        }

        let data = await get.getmoneydata(e.user_id, true)
        let last_task = new Date(data.plugin_data.task_time)
        let now_time = new Date().toString()
        let request_time = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '00:00:00')) //每天0点
        let oldtask = []

        /**note变化 */
        let change_note = 0

        if (request_time > last_task) {
            /**每天一次免费刷新任务 */
        } else {
            /**花费20Notes刷新 */
            if (data.plugin_data.money >= 20) {
                data.plugin_data.money -= 20
                change_note -= 20
                oldtask = data.plugin_data.task
            } else {
                send.send_with_At(e, `刷新任务需要 20 Notes，咱没有那么多Note哇QAQ！\n你当前的 Note 数目为：${data.plugin_data.money}`)
                get.delLock(e.user_id)
                return false
            }
        }

        data.plugin_data.task_time = now_time
        data.plugin_data.task = randtask(save, oldtask)

        let vis = false
        for (let i in data.plugin_data.task) {
            if (data.plugin_data.task) {
                vis = true
                break
            }
        }

        if (!vis) {
            send.send_with_At(e, `哇塞，您已经把所有曲目全部满分了呢！没有办法为您布置任务了呢！敬请期待其他玩法哦！`)
            get.delLock(e.user_id)
            return true
        }

        get.putpluginData(e.user_id, data)

        now_time = new Date()
        /**判断时间段 */
        let time1 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '06:00:00'))
        let time2 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '11:30:00'))
        let time3 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '13:00:00'))
        let time4 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '18:30:00'))
        let time5 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '23:00:00'))

        let Remsg = ''
        let Remsg1 = ''

        if (now_time < time1) {
            Remsg = `现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，夜深了，注意休息哦！`
            Remsg1 = `(∪.∪ )...zzz`
        } else if (now_time < time2) {
            Remsg = `现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，早安呐！`
            Remsg1 = `ヾ(≧▽≦*)o`
        } else if (now_time < time3) {
            Remsg = `现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，午好嗷！`
            Remsg1 = `(╹ڡ╹ )`
        } else if (now_time < time4) {
            Remsg = `现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，下午好哇！`
            Remsg1 = `(≧∀≦)ゞ`
        } else if (now_time < time5) {
            Remsg = `现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，晚上好！`
            Remsg1 = `( •̀ ω •́ )✧`
        } else {
            Remsg = `现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，夜深了，注意休息哦！`
            Remsg1 = `(∪.∪ )...zzz`
        }


        let task_time = now_time.toString().split(' ')

        /**添加曲绘 */
        if (data.plugin_data.task) {
            for (let i in data.plugin_data.task) {
                data.plugin_data.task[i].illustration = get.getill(data.plugin_data.task[i].song)
            }
        }

        let picdata = {
            PlayerId: save.saveInfo.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: `${task_time[3]} ${task_time[1]}.${task_time[2]} ${task_time[4]}`,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            background: illlist[Number((Math.random() * (illlist.length - 1)).toFixed(0))],
            task: data.plugin_data.task,
            task_ans: Remsg,
            task_ans1: Remsg1,
            Notes: data.plugin_data.money,
            tips: get.tips[Math.floor((Math.random() * (get.tips.length - 1)) + 1)],
            change_notes: `${change_note ? change_note : ''}`,
            theme: data?.plugin_data?.theme || 'star',
        }

        let is_sp_date = false
        if (new Date().toString().includes(sp_date)) {
            is_sp_date = true
        }
        if (is_sp_date) {
            picdata.tips = sp_date_tips[randint(sp_date_tips.length - 1)]
        }

        send.send_with_At(e, await get.gettasks(e, picdata))

        return true


    }

    async tasks(e) {
        let now = await send.getsave_result(e)

        if (!now) {
            return false
        }
        let now_time = new Date()
        /**判断时间段 */
        let time1 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '06:00:00'))
        let time2 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '11:30:00'))
        let time3 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '13:00:00'))
        let time4 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '18:30:00'))
        let time5 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '23:00:00'))

        let Remsg = ''
        let Remsg1 = ''

        if (now_time < time1) {
            Remsg = `现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，夜深了，注意休息哦！`
            Remsg1 = `(∪.∪ )...zzz`
        } else if (now_time < time2) {
            Remsg = `现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，早安呐！`
            Remsg1 = `ヾ(≧▽≦*)o`
        } else if (now_time < time3) {
            Remsg = `现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，午好嗷！`
            Remsg1 = `(╹ڡ╹ )`
        } else if (now_time < time4) {
            Remsg = `现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，下午好哇！`
            Remsg1 = `(≧∀≦)ゞ`
        } else if (now_time < time5) {
            Remsg = `现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，晚上好！`
            Remsg1 = `( •̀ ω •́ )✧`
        } else {
            Remsg = `现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，夜深了，注意休息哦！`
            Remsg1 = `(∪.∪ )...zzz`
        }

        let data = await get.getmoneydata(e.user_id)
        let task_time = data.plugin_data.task_time.split(' ')

        /**添加曲绘 */
        if (data.plugin_data.task) {
            for (let i in data.plugin_data.task) {
                data.plugin_data.task[i].illustration = get.getill(data.plugin_data.task[i].song)
            }
        }

        let picdata = {
            PlayerId: now.saveInfo.PlayerId,
            Rks: Number(now.saveInfo.summary.rankingScore).toFixed(4),
            Date: `${task_time[3]} ${task_time[1]}.${task_time[2]} ${task_time[4]}`,
            ChallengeMode: (now.saveInfo.summary.challengeModeRank - (now.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: now.saveInfo.summary.challengeModeRank % 100,
            background: illlist[Number((Math.random() * (illlist.length - 1)).toFixed(0))],
            task: data.plugin_data.task,
            task_ans: Remsg,
            task_ans1: Remsg1,
            Notes: data.plugin_data.money,
            tips: get.tips[Math.floor((Math.random() * (get.tips.length - 1)) + 1)],
            dan: await get.getDan(e.user_id),
            theme: data?.plugin_data?.theme || 'star',
        }


        let is_sp_date = false
        if (new Date().toString().includes(sp_date)) {
            is_sp_date = true
        }
        if (is_sp_date) {
            picdata.tips = sp_date_tips[randint(sp_date_tips.length - 1)]
        }


        send.send_with_At(e, await get.gettasks(e, picdata))

        return true
    }

    /**转账 */
    async send(e) {
        let msg = e.msg.replace(/[#/](.*)(send|送|转)(\s*)/g, "")
        msg = msg.replace(/[\<\>]/g, "")
        let target = e.at
        let num
        if (!e.at) {
            if (msg.includes(' ')) {
                msg = msg.split(' ')
                target = msg[0]
                num = Number(msg[1])
            } else {
                send.send_with_At(e, `格式错误！请指定目标\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} send <@ or id> <数量>`, true)
                return true
            }
        } else {
            num = Number(msg)
        }
        if (num == NaN) {
            send.send_with_At(e, `非法数字：${msg}\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} send <@ or id> <数量>`, true)
            return true
        }

        try {
            await Bot.pickMember(e.group_id, target)
        } catch (err) {
            send.send_with_At(e, `这个QQ号……好像没有见过呢……`)
            return true
        }

        let sender_data = await get.getmoneydata(e.user_id, true)

        if (target == e.user_id) {
            await send.send_with_At(e, `转账成……唔？这个目标……在拿我寻开心嘛！`)
            await common.sleep(1000)
            await send.send_with_At(e, `转账失败！扣除 20 Notes！`)
            if (sender_data.plugin_data.money < 20) {
                await send.send_with_At(e, `唔，你怎么连20 Note都没有哇`)
                await send.send_with_At(e, `www，算了，我今天心情好，不和你计较了，哼！`)
            } else {
                sender_data.plugin_data.money -= 20
            }
            await get.putpluginData(e.user_id, sender_data)
            return true
        }


        if (sender_data.plugin_data.money < num) {
            send.send_with_At(e, `你当前的Note数量不够哦！\n当前Note: ${sender_data.plugin_data.money}`)
            get.delLock(e.user_id)
            return true
        }

        let sender_old = sender_data.plugin_data.money
        let target_old = target_data.plugin_data.money

        sender_data.plugin_data.money -= num
        await get.putpluginData(e.user_id, sender_data)

        let target_data = await get.getmoneydata(target, true)
        target_data.plugin_data.money += Math.ceil(num * 0.8)
        await get.putpluginData(target, target_data)
        let target_card = await Bot.pickMember(e.group_id, target)
        send.send_with_At(e, `转账成功！\n你当前的Note: ${sender_old} - ${num} = ${sender_data.plugin_data.money}\n${target_card.nickname || target_card.card}的Note: ${target_old} + ${Math.ceil(num * 0.8)} = ${target_data.plugin_data.money}`)
    }

    /**主题相关 */
    async theme(e) {
        let aim = e.msg.replace(/.*?theme\s*/g, '')
        aim = Number(aim)
        if (typeof aim != 'number' || aim < 0 || aim > 2) {
            send.send_with_At(e, `请输入主题数字嗷！\n格式/${Config.getDefOrConfig('config', 'cmdhead')} theme 0-2`)
            return false
        }
        await get.getmoneydata(e.user_id)
        const plugin_data = await get.getpluginData(e.user_id)
        plugin_data.plugin_data.theme = theme[aim].id

        await get.putpluginData(e.user_id, plugin_data)

        send.send_with_At(e, `设置成功！\n你当前的主题是：${theme[aim].src}`)
        return true
    }
}



function randtask(save, task = []) {
    let rks = save.saveInfo.summary.rankingScore
    let gameRecord = save.gameRecord
    for (let song in gameRecord) {
        gameRecord[get.idgetsong(song, false)] = gameRecord[song]
    }

    let info = get.ori_info
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
    for (let song in info) {
        for (let level in Level) {
            if (info[song]['chart'][Level[level]]) {
                if (!gameRecord[song] || !gameRecord[song][level] || gameRecord[song][level].acc != 100) {
                    let dif = info[song]['chart'][Level[level]]['difficulty']
                    for (let i in rank_line) {
                        if (dif < rank_line[i]) {
                            ranked_songs[i].push({ song, level })
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
        let song = aim.song
        let level = aim.level
        let type = randint(1) //0 acc, 1 score
        let value
        let old_acc = 0
        let old_score = 0
        if (gameRecord[song] && gameRecord[song][level]) {
            old_acc = gameRecord[song][level].acc
            old_score = gameRecord[song][level].score
        }
        if (type) {
            value = Math.min(Number(easeInSine(Math.random(), Math.min(old_score + 1, 1e6), 1e6 - Math.min(old_score + 1, 1e6), 1).toFixed(0)), 1e6)
        } else {
            value = Math.min(Number(easeInSine(Math.random(), Math.min(old_acc + 0.01, 100), 100 - Math.min(old_acc + 0.01, 100), 1).toFixed(2)), 100)
        }
        task[i] = {
            song: song,
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

//定义生成指定区间带有指定小数位数随机数的函数
function randfloat(min, max, precision = 0) {
    let range = max - min
    let randomOffset = Math.random() * range
    let randomNumber = randomOffset + min + range * 10 ** -precision

    return precision === 0 ? Math.floor(randomNumber) : Number(randomNumber.toFixed(precision))
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
