import { segment } from 'oicq'
import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'
import send from '../model/send.js'

await get.init()

var tot = [0, 0, 0, 0] //'EZ', 'HD', 'IN', 'AT'
const Level = ['EZ', 'HD', 'IN', 'AT']

for (var song in get.ori_info) {
    var info = get.ori_info[song]
    if (info.chart['AT']) {
        ++tot[3]
    }
    if (info.chart['IN']) {
        ++tot[2]
    }
    if (info.chart['HD']) {
        ++tot[1]
    }
    if (info.chart['EZ']) {
        ++tot[0]
    }
}

export class phiuser extends plugin {
    constructor() {
        super({
            name: 'phi-user',
            dsc: 'phi-plugin数据统计',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(data)$`,
                    fnc: 'data'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(info)$`,
                    fnc: 'info'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)((lvsco(re)?)|scolv)(.*)$`,
                    fnc: 'lvscore'
                }
            ]
        })

    }

    /**查询data */
    async data(e) {
        var User = await get.getsave(e.user_id)
        if (User) {
            if (User.gameProgress) {
                var data = User.gameProgress.money
                e.reply([segment.at(e.user_id), `您的data数为：${data[4] ? `${data[4]}PiB ` : ''}${data[3] ? `${data[3]}TiB ` : ''}${data[2] ? `${data[2]}GiB ` : ''}${data[1] ? `${data[1]}MiB ` : ''}${data[0] ? `${data[0]}KiB ` : ''}`])
            } else {
                send.send_with_At(e, `请先更新数据哦！\n/${Config.getDefOrConfig('config', 'cmdhead')} update`)
            }
        } else {
            send.send_with_At(e, `请先绑定sessionToken哦！\n/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
        }
        return true
    }

    async info(e) {
        const save = await get.getsave(e.user_id)

        if (!save) {
            send.send_with_At(e, `请先绑定sessionToken哦！\n/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
            return true
        }

        if (!save.Recordver || save.Recordver < 1.0) {
            send.send_with_At(e, `请先更新数据哦！\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} update`)
            return true
        }

        const Record = save.gameRecord

        const stats_ = {
            tatle: '',
            Rating: '',
            unlock: 0,
            tot: 0,
            cleared: 0,
            fc: 0,
            phi: 0,
            real_score: 0,
            tot_score: 0,
            highest: 0,
            lowest: 18,
        }

        var stats = [{ ...stats_ }, { ...stats_ }, { ...stats_ }, { ...stats_ }]

        stats[0].tot = tot[0]
        stats[0].tatle = Level[0]

        stats[1].tot = tot[1]
        stats[1].tatle = Level[1]

        stats[2].tot = tot[2]
        stats[2].tatle = Level[2]

        stats[3].tot = tot[3]
        stats[3].tatle = Level[3]

        for (var id in Record) {
            const info = get.idgetsong(id, true)
            const record = Record[id]
            for (var lv in [0, 1, 2, 3]) {
                if (!record[lv]) continue

                ++stats[lv].unlock

                if (record[lv].score >= 700000) {
                    ++stats[lv].cleared
                }
                if (record[lv].fc) {
                    ++stats[lv].fc
                }
                if (record[lv].score == 1000000) {
                    ++stats[lv].phi
                }


                stats[lv].real_score += record[lv].score
                stats[lv].tot_score += 1000000

                stats[lv].highest = Math.max(record[lv].rks, stats[lv].highest)
                stats[lv].lowest = Math.min(record[lv].rks, stats[lv].lowest)
            }
        }

        for (var lv in [0, 1, 2, 3]) {
            stats[lv].Rating = Rate(stats[lv].real_score, stats[lv].tot_score, stats[lv].fc == stats[lv].unlock)
            if (stats[lv].lowest == 18) {
                stats[lv].lowest = 0
            }
        }

        const money = save.gameProgress.money
        var userbackground = ''
        try {
            userbackground = get.getill(save.gameuser.background)
        } catch (err) {
            e.reply(`ERROR: 未找到[${save.gameuser.background}]的有关信息！`)
            console.error(`未找到${save.gameuser.background}的曲绘！`)
        }

        const gameuser = {
            avatar: get.idgetavatar(save.gameuser.avatar),
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save.saveInfo.summary.rankingScore,
            data: `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`,
            selfIntro: save.gameuser.selfIntro,
            backgroundurl: userbackground,
            PlayerId: save.saveInfo.PlayerId,
        }

        const user_data = await get.getpluginData(e.user_id)

        var rks_history_ = []
        var data_history_ = []
        const user_rks_data = user_data.rks
        var user_data_data = user_data.data
        const rks_range = [17, 0]
        const data_range = [1e9, 0]

        for (var i in user_rks_data) {
            if (i == 0 || user_rks_data[i].value != rks_history_[rks_history_.length - 1].value) {
                rks_history_.push(user_rks_data[i])
                rks_range[0] = Math.min(rks_range[0], user_rks_data[i].value)
                rks_range[1] = Math.max(rks_range[1], user_rks_data[i].value)
            } else {
                rks_history_[rks_history_.length - 1].date = user_rks_data[i].date
            }
        }

        for (var i in user_data_data) {
            const value = user_data_data[i]['value']
            user_data_data[i].value = (((value[4] * 1024 + value[3]) * 1024 + value[2]) * 1024 + value[1]) * 1024 + value[0]
            if (i == 0 || user_data_data[i].value != data_history_[data_history_.length - 1].value) {
                data_history_.push(user_data_data[i])
                data_range[0] = Math.min(data_range[0], user_data_data[i].value)
                data_range[1] = Math.max(data_range[1], user_data_data[i].value)
            } else {
                data_history_[data_history_.length - 1].date = user_data_data[i].date
            }
        }


        var rks_history = []
        var data_history = []

        for (var i in rks_history_) {

            i = Number(i)

            if (!rks_history_[i + 1]) break
            const x1 = 100 / (rks_history_.length + 1) * (i + 1)
            const y1 = range(rks_history_[i].value, rks_range)
            const x2 = 100 / (rks_history_.length + 1) * (i + 2)
            const y2 = range(rks_history_[i + 1].value, rks_range)
            rks_history.push([x1, y1, x2, y2])
        }

        for (var i in data_history_) {

            i = Number(i)

            if (!data_history_[i + 1]) break
            const x1 = 100 / (data_history_.length + 1) * (i + 1)
            const y1 = range(data_history_[i].value, data_range)
            const x2 = 100 / (data_history_.length + 1) * (i + 2)
            const y2 = range(data_history_[i + 1].value, data_range)
            data_history.push([x1, y1, x2, y2])
        }

        var data = {
            gameuser: gameuser,
            userstats: stats,
            rks_history: rks_history,
            data_history: data_history,
        }

        send.send_with_At(e, await get.getuser_info(e, data))
    }

    async lvscore(e) {

        const save = await send.getsave_result(e, 1.0)

        if (!save) {
            return true
        }

        let msg = e.msg.replace(/^[#/](.*)(lvsco(re)?)(\s*)/, "")

        var isask = [true, true, true, true]
        msg = msg.toUpperCase()
        if (msg.includes('AT') || msg.includes('IN') || msg.includes('HD') || msg.includes('EZ')) {
            isask = [0, 0, 0, 0]
            if (msg.includes('EZ')) { isask[0] = 1 }
            if (msg.includes('HD')) { isask[1] = 1 }
            if (msg.includes('IN')) { isask[2] = 1 }
            if (msg.includes('AT')) { isask[3] = 1 }
        }
        msg = msg.replace(/((\s*)|AT|IN|HD|EZ)*/g, "")

        var range = [0, 0]




        if (!msg || msg == 'ALL') {
            range[0] = 0
            range[1] = 16.9
        } else {

            if (msg.includes(/[-~到至]/g)) {
                msg = msg.match(/[0-9]+(.[0-9]+)?(\s*[-~到至]\s*[0-9]+(.[0-9]+)?)?/g)[0]
                range = msg.split(/\s*-\s*/g)
                range[0] = Number(range[0])
                range[1] = Number(range[1])
                if (range[0] > range[1]) {
                    var tem = range[1]
                    range[1] = range[0]
                    range[0] = tem
                }
            } else {
                range[0] = range[1] = Number(msg)
            }

            if (range[1] % 1 == 0 && !msg.includes(".0")) range[1] += 0.9

        }

        range[1] = Math.min(range[1], 16.9)
        range[0] = Math.max(range[0], 0)

        var illustration = ''
        try {
            illustration = get.getill(save.gameuser.background)
        } catch (err) {
            e.reply(`ERROR: 未找到[${save.gameuser.background}]的有关信息！`)
            console.error(`未找到${save.gameuser.background}的曲绘！`)
        }


        var unlockcharts = 0
        var totreal_score = 0
        var totacc = 0
        var totcharts = 0
        var totcleared = 0
        var totfc = 0
        var totphi = 0
        var tottot_score = 0
        var tothighest = 0
        var totlowest = 17
        var totsongs = 0
        var totRating = {
            F: 0,
            C: 0,
            B: 0,
            A: 0,
            S: 0,
            V: 0,
            FC: 0,
            phi: 0,
        }
        var totRank = {
            AT: 0,
            IN: 0,
            HD: 0,
            EZ: 0,
        }
        var unlockRank = {
            AT: 0,
            IN: 0,
            HD: 0,
            EZ: 0,
        }
        var unlocksongs = 0

        var Record = save.gameRecord

        for (var song in get.ori_info) {
            var info = get.ori_info[song]
            var vis = false
            for (var i in info.chart) {
                var difficulty = info['chart'][i].difficulty
                if (range[0] <= difficulty && difficulty <= range[1] && isask[Level.indexOf(i)]) {
                    ++totcharts
                    ++totRank[i]
                    if (!vis) {
                        ++totsongs
                        vis = true
                    }
                }
            }
        }


        for (var id in Record) {
            const info = get.idgetsong(id, true)
            const record = Record[id]
            var vis = false
            for (var lv in [0, 1, 2, 3]) {
                // console.info(info)
                if (!info.chart[Level[lv]]) continue
                var difficulty = info.chart[Level[lv]].difficulty
                if (range[0] <= difficulty && difficulty <= range[1] && isask[lv]) {

                    if (!record[lv]) continue

                    ++unlockcharts
                    ++unlockRank[Level[lv]]

                    if (!vis) {
                        ++unlocksongs
                        vis = true
                    }
                    if (record[lv].score >= 700000) {
                        ++totcleared
                    }
                    if (record[lv].fc) {
                        ++totfc
                    }
                    if (record[lv].score == 1000000) {
                        ++totphi
                    }
                    ++totRating[record[lv].Rating]
                    totacc += record[lv].acc
                    totreal_score += record[lv].score
                    tottot_score += 1000000

                    tothighest = Math.max(record[lv].rks, tothighest)
                    totlowest = Math.min(record[lv].rks, totlowest)
                }
            }
        }

        var date = new Date(save.saveInfo.modifiedAt.iso)

        var data = {
            tot: {
                at: totRank.AT,
                in: totRank.IN,
                hd: totRank.HD,
                ez: totRank.EZ,
                songs: totsongs,
                charts: totcharts,
                score: tottot_score,
            },
            real: {
                at: unlockRank.AT,
                in: unlockRank.IN,
                hd: unlockRank.HD,
                ez: unlockRank.EZ,
                songs: unlocksongs,
                charts: unlockcharts,
                score: totreal_score,
            },
            rating: {
                tot: Rate(tottot_score, totreal_score, totfc == totcharts),
                ...totRating,
            },
            range: {
                bottom: range[0],
                top: range[1],
                left: range[0] / 16.9 * 100,
                length: (range[1] - range[0]) / 16.9 * 100
            },
            illustration: illustration,
            highest: tothighest,
            lowest: totlowest,
            tot_cleared: totcleared,
            tot_fc: totfc,
            tot_phi: totphi,
            date: `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${(save.saveInfo.updatedAt).match(/([0-9])+:([0-9])+:([0-9])+/)[0]}`,
            progress_phi: Number((totphi / totcharts * 100).toFixed(2)),
            progress_fc: Number((totfc / totcharts * 100).toFixed(2)),
            avatar: get.idgetavatar(save.gameuser.avatar),
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save.saveInfo.summary.rankingScore,
            PlayerId: save.saveInfo.PlayerId,
        }

        // var remsg = ''
        // remsg += `\n${range[0]}-${range[1]} `
        // remsg += `clear:${totcleared} fc:${totfc} phi:${totphi}\n`
        // remsg += `${progress_bar(totphi / totcharts, 30)} ${totphi}/${totcharts}\n`
        // remsg += `Tot: ${unlockcharts}/${totcharts} acc: ${(totacc / totcharts).toFixed(4)}\n`
        // remsg += `score: ${totreal_score}/${tottot_score}\n`
        // remsg += `highest: ${tothighest.toFixed(4)} lowest:${totlowest.toFixed(4)}\n`
        // remsg += `φ:${totRating['phi']} FC:${totRating['FC']} V:${totRating['V']} S:${totRating['S']} A:${totRating['A']} B:${totRating['B']} C:${totRating['C']} F:${totRating['F']}`


        send.send_with_At(e, await get.getlvsco(e, data))
    }
}

/**
 * 计算百分比
 * @param {Number} value 值
 * @param {Array} range 区间数组
 * @returns 百分数，单位%
 */
function range(value, range) {
    return (value - range[0]) / (range[1] - range[0]) * 100
}

/**进度条 */
function progress_bar(value, length) {
    var result = '['
    for (var i = 1; i <= Number((value * length).toFixed(0)); ++i) {
        result += '|'
    }
    for (var i = 1; i <= (length - Number((value * length).toFixed(0))); ++i) {
        result += ' '
    }
    result += `] ${(value * 100).toFixed(2)}%`
    return result
}


function Rate(real_score, tot_score, fc) {

    if (!real_score) {
        return 'F'
    } else if (real_score == tot_score) {
        return 'phi'
    } else if (fc) {
        return 'FC'
    } else if (real_score >= tot_score * 0.96) {
        return 'V'
    } else if (real_score >= tot_score * 0.92) {
        return 'S'
    } else if (real_score >= tot_score * 0.88) {
        return 'A'
    } else if (real_score >= tot_score * 0.82) {
        return 'B'
    } else if (real_score >= tot_score * 0.70) {
        return 'C'
    } else {
        return 'F'
    }
}
