import { segment } from 'oicq'
import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'

await get.init()

const illlist = []

for (var i in get.ori_info) {
    if (get.ori_info[i]['illustration_big']) {
        illlist.push(get.ori_info[i]['illustration_big'])
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

            ]
        })

    }

    /**签到 */
    async sign(e) {
        var data = await get.getmoneydata(e.user_id)
        var last_sign = new Date(data.sign_in)
        var now_time = new Date().toString()
        var request_time = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '00:00:00')) //每天0点
        if (request_time > last_sign) {
            var getnum = randint(20, 5)
            data.money += getnum
            data.sign_in = now_time



            get.putmoneydata(e.user_id, data)
            /**判断时间段 */
            var time1 = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '04:00:00'))
            var time2 = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '10:00:00'))
            var time3 = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '14:00:00'))
            var time4 = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '18:00:00'))
            var time5 = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '23:00:00'))

            var Remsg = [segment.at(e.user_id)]

            now_time = new Date()
            if (now_time < time1) {
                Remsg.push(`，签到成功！现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，夜深了，注意休息哦！(∪.∪ )...zzz\n`)
            } else if (now_time < time2) {
                Remsg.push(`，签到成功！现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，早安呐！ヾ(≧▽≦*)o\n`)
            } else if (now_time < time3) {
                Remsg.push(`，签到成功！现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，午好嗷！(╹ڡ╹ )\n`)
            } else if (now_time < time4) {
                Remsg.push(`，签到成功！现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，下午好哇！(≧∀≦)ゞ\n`)
            } else if (now_time < time5) {
                Remsg.push(`，签到成功！现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，晚上好！( •̀ ω •́ )✧\n`)
            } else {
                Remsg.push(`，签到成功！现在是${now_time.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}，夜深了，注意休息哦！(∪.∪ )...zzz\n`)
            }

            Remsg.push(`恭喜您获得了${getnum}个Note！当前您所拥有的 Note 数量为：${data.money}\n`)
            Remsg.push(`祝您今日愉快呐！（￣︶￣）↗　`)

            var save = await get.getsave(e.user_id)
            var last_task = new Date(data.task_time)

            if (save && last_task < request_time) {
                /**如果有存档并且没有刷新过任务自动刷新 */
                this.gettask(e)
                Remsg.push(`您今日份的任务如下：（update自动检测哦！）`)
            } else {
                Remsg.push(`您当前没有绑定sessionToken呐！任务需要绑定sessionToken后才能获取哦！\n/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
            }
            await e.reply(Remsg)

        } else {
            e.reply(`您在今天${last_sign.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}的时候已经签过到了哦！\n您现在的Note数量: ${data.money}`)
        }
        return true
    }

    /**刷新任务并发送图片 */
    async gettask(e) {
        var save = await get.getsave(e.user_id)

        if (!save) {
            e.reply([segment.at(e.user_id), `该功能需要绑定后才能使用哦！\n/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`])
            return false
        }

        var data = await get.getmoneydata(e.user_id)
        var last_task = new Date(data.task_time)
        var now_time = new Date().toString()
        var request_time = new Date(now_time.replace(/([0-9])+:([0-9])+:([0-9])+/g, '00:00:00')) //每天0点
        var oldtask = []
        if (request_time > last_task) {
            /**每天一次免费刷新任务 */
        } else {
            /**花费20Notes刷新 */
            if (data.money >= 20) {
                data.money -= 20
                oldtask = data.task
            } else {
                e.reply([segment.at(e.user_id), ` 刷新任务需要 20 Notes，咱没有那么多Note哇QAQ！\n你当前的 Note 数目为：${data.money}`])
                return false
            }
        }

        data.task_time = now_time
        data.task = randtask(save, oldtask)
        get.putmoneydata(e.user_id, data)

        now_time = new Date()
        /**判断时间段 */
        var time1 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '04:00:00'))
        var time2 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '10:00:00'))
        var time3 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '14:00:00'))
        var time4 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '18:00:00'))
        var time5 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '23:00:00'))

        var Remsg = ''
        var Remsg1 = ''

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


        var picdata = {
            PlayerId: save.saveInfo.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: save.saveInfo.updatedAt,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            background: illlist[Number((Math.random() * (illlist.length - 1)).toFixed(0))],
            task: data.task,
            task_ans: Remsg,
            task_ans1: Remsg1,
            Notes: data.money,
        }



        await e.reply([segment.at(e.user_id), await get.gettasks(e, picdata)])

        return true


    }

    async tasks(e) {
        var now = await get.getsave(e.user_id)

        if (!now) {
            e.reply([segment.at(e.user_id), `该功能需要绑定后才能使用哦！\n/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`])
            return false
        }
        var data = await get.getmoneydata(e.user_id)
        var now_time = new Date()
        /**判断时间段 */
        var time1 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '04:00:00'))
        var time2 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '10:00:00'))
        var time3 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '14:00:00'))
        var time4 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '18:00:00'))
        var time5 = new Date(now_time.toString().replace(/([0-9])+:([0-9])+:([0-9])+/g, '23:00:00'))

        var Remsg = ''
        var Remsg1 = ''

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


        var picdata = {
            PlayerId: now.saveInfo.PlayerId,
            Rks: Number(now.saveInfo.summary.rankingScore).toFixed(4),
            Date: now.saveInfo.updatedAt,
            ChallengeMode: (now.saveInfo.summary.challengeModeRank - (now.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: now.saveInfo.summary.challengeModeRank % 100,
            background: illlist[Number((Math.random() * (illlist.length - 1)).toFixed(0))],
            task: data.task,
            task_ans: Remsg,
            task_ans1: Remsg1,
            Notes: data.money,
        }



        await e.reply([segment.at(e.user_id), await get.gettasks(e, picdata)])

        return true
    }

}



function randtask(save, task = []) {
    var rks = save.saveInfo.summary.rankingScore
    var gameRecord = save.gameRecord
    for (var song in gameRecord) {
        gameRecord[get.idgetsong(song, false)] = gameRecord[song]
    }

    var info = get.ori_info
    var ranked_songs = [[], [], [], [], []] //任务难度分级后的曲目列表

    var rank_line = [] //割分歌曲的临界定数


    if (rks < 15) {
        rank_line.push(rks)
        rank_line.push(rks + 0.7)
        rank_line.push(rks + 1)
        rank_line.push(rks + 1.2)
    } else if (rks < 16) {
        rank_line.push(rks)
        rank_line.push(rks + 0.3)
        rank_line.push(rks + 0.5)
        rank_line.push(rks + 0.6)
    } else {
        rank_line.push(rks - 0.5)
        rank_line.push(rks - 0.2)
        rank_line.push(rks)
        rank_line.push(rks + 0.1)
    }

    rank_line.push(17)

    /**将曲目分级并处理 */
    for (var song in info) {
        for (var level in Level) {
            if (info[song]['chart'][Level[level]]) {
                if (!gameRecord[song] || !gameRecord[song][level] || gameRecord[song][level].acc != 100) {
                    var dif = info[song]['chart'][Level[level]]['difficulty']
                    for (var i in rank_line) {
                        if (dif < rank_line[i]) {
                            ranked_songs[i].push({ song, level })
                            break
                        }
                    }
                }
            }
        }
    }

    var reward = [10, 15, 30, 60, 80, 100]

    for (var i in ranked_songs) {
        if (task[i] && task[i].finished == true) {
            continue
        }
        var aim = ranked_songs[i][randint(ranked_songs[i].length - 1)]
        var song = aim.song
        var level = aim.level
        var type = randint(1) //0 acc, 1 score
        var value
        var old_acc = 0
        var old_score = 0
        if (gameRecord[song] && gameRecord[song][level]) {
            old_acc = gameRecord[song][level].acc
            old_score = gameRecord[song][level].score
        }
        if (type) {
            value = Math.min(Number(easeInSine(Math.random(), Math.min(old_score + level * 1000, 1e6), 1e6 - Math.min(old_score + level * 1000, 1e6), 1).toFixed(0)), 1e6)
        } else {
            value = Math.min(Number(easeInSine(Math.random(), Math.min(old_acc + level * 0.05, 100), 100 - Math.min(old_acc + level * 0.05, 100), 1).toFixed(2)), 100)
        }
        task[i] = {
            song: song,
            reward: randint(reward[Number(i) + 1], reward[i]),
            illustration: info[song]['illustration'],
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
    var range = max - min
    var randomOffset = Math.random() * range
    var randomNumber = randomOffset + min + range * 10 ** -precision

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
