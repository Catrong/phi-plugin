import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'
import send from '../model/send.js'
import atlas from '../model/picmodle.js'


let tot = [0, 0, 0, 0] //'EZ', 'HD', 'IN', 'AT'
const Level = ['EZ', 'HD', 'IN', 'AT']
const illlist = []

for (let i in get.info()) {
    if (get.info()[i]['illustration_big']) {
        illlist.push(get.getill(i))
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
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(info)[1-2]?.*$`,
                    fnc: 'info'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)((lvsco(re)?)|scolv)(.*)$`,
                    fnc: 'lvscore'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)list(.*)$`,
                    fnc: 'list'
                }
            ]
        })

    }

    /**查询data */
    async data(e) {
        let User = await get.getsave(e.user_id)
        if (User) {
            if (User.gameProgress) {
                let data = User.gameProgress.money
                send.send_with_At(e, `您的data数为：${data[4] ? `${data[4]}PB ` : ''}${data[3] ? `${data[3]}TB ` : ''}${data[2] ? `${data[2]}GB ` : ''}${data[1] ? `${data[1]}MB ` : ''}${data[0] ? `${data[0]}KB ` : ''}`)
            } else {
                send.send_with_At(e, `请先更新数据哦！\n/${Config.getDefOrConfig('config', 'cmdhead')} update`)
            }
        } else {
            send.send_with_At(e, `请先绑定sessionToken哦！\n/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
        }
        return true
    }

    async info(e) {
        let bksong = e.msg.replace(/^.*(info)[1-2]?\s*/g, '')

        if (bksong) {
            let tem = get.fuzzysongsnick(bksong)[0]
            if (tem) {
                bksong = get.getill(tem)
            } else {
                bksong = undefined
            }
        }

        const save = await send.getsave_result(e, 1.0)

        if (!save) {
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

        let stats = [{ ...stats_ }, { ...stats_ }, { ...stats_ }, { ...stats_ }]

        stats[0].tot = tot[0]
        stats[0].tatle = Level[0]

        stats[1].tot = tot[1]
        stats[1].tatle = Level[1]

        stats[2].tot = tot[2]
        stats[2].tatle = Level[2]

        stats[3].tot = tot[3]
        stats[3].tatle = Level[3]

        for (let id in Record) {
            const info = get.init_info(get.idgetsong(id), true)
            const record = Record[id]
            for (let lv in [0, 1, 2, 3]) {
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

        for (let lv in [0, 1, 2, 3]) {
            stats[lv].Rating = Rate(stats[lv].real_score, stats[lv].tot_score, stats[lv].fc == stats[lv].unlock)
            if (stats[lv].lowest == 18) {
                stats[lv].lowest = 0
            }
        }

        const money = save.gameProgress.money
        let userbackground = getbackground(save.gameuser.background)

        if (!userbackground) {
            e.reply(`ERROR: 未找到[${save.gameuser.background}]的有关信息！`)
            logger.error(`未找到${save.gameuser.background}的曲绘！`)
        }

        const dan = await get.getDan(e.user_id)

        const gameuser = {
            avatar: get.idgetavatar(save.gameuser.avatar) || 'Introduction',
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save.saveInfo.summary.rankingScore,
            data: `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`,
            selfIntro: save.gameuser.selfIntro,
            backgroundurl: userbackground,
            PlayerId: save.saveInfo.PlayerId,
            CLGMOD: dan?.Dan,
            EX: dan?.EX,
        }

        const user_data = await get.getpluginData(e.user_id)

        let rks_history_ = []
        let data_history_ = []
        let user_rks_data = user_data.rks
        let user_data_data = user_data.data
        const rks_range = [17, 0]
        const data_range = [1e9, 0]
        const rks_date = [new Date(user_rks_data[0].date).getTime(), 0]
        const data_date = [new Date(user_data_data[0].date).getTime(), 0]

        for (let i in user_rks_data) {
            user_rks_data[i].date = new Date(user_rks_data[i].date)
            if (i <= 1 || user_rks_data[i].value != rks_history_[rks_history_.length - 2].value) {
                rks_history_.push(user_rks_data[i])
                rks_range[0] = Math.min(rks_range[0], user_rks_data[i].value)
                rks_range[1] = Math.max(rks_range[1], user_rks_data[i].value)
            } else {
                rks_history_[rks_history_.length - 1].date = user_rks_data[i].date
            }
            rks_date[1] = user_rks_data[i].date.getTime()
        }

        for (let i in user_data_data) {
            const value = user_data_data[i]['value']
            user_data_data[i].value = (((value[4] * 1024 + value[3]) * 1024 + value[2]) * 1024 + value[1]) * 1024 + value[0]
            user_data_data[i].date = new Date(user_data_data[i].date)
            if (i <= 1 || user_data_data[i].value != data_history_[data_history_.length - 2].value) {
                data_history_.push(user_data_data[i])
                data_range[0] = Math.min(data_range[0], user_data_data[i].value)
                data_range[1] = Math.max(data_range[1], user_data_data[i].value)
            } else {
                data_history_[data_history_.length - 1].date = user_data_data[i].date
            }
            data_date[1] = user_data_data[i].date.getTime()
        }

        let rks_history = []
        let data_history = []

        for (let i in rks_history_) {

            i = Number(i)

            if (!rks_history_[i + 1]) break
            const x1 = range(rks_history_[i].date, rks_date)
            const y1 = range(rks_history_[i].value, rks_range)
            const x2 = range(rks_history_[i + 1].date, rks_date)
            const y2 = range(rks_history_[i + 1].value, rks_range)
            rks_history.push([x1, y1, x2, y2])
        }

        for (let i in data_history_) {

            i = Number(i)

            if (!data_history_[i + 1]) break
            const x1 = range(data_history_[i].date, data_date)
            const y1 = range(data_history_[i].value, data_range)
            const x2 = range(data_history_[i + 1].date, data_date)
            const y2 = range(data_history_[i + 1].value, data_range)
            data_history.push([x1, y1, x2, y2])
        }


        const unit = ["KiB", "MiB", "GiB", "TiB", "Pib"]

        for (let i in [1, 2, 3, 4]) {
            if (Math.floor(data_range[0] / (Math.pow(1024, i))) < 1024) {
                data_range[0] = `${Math.floor(data_range[0] / (Math.pow(1024, i)))}${unit[i]}`
            }
        }

        for (let i in [1, 2, 3, 4]) {
            if (Math.floor(data_range[1] / (Math.pow(1024, i))) < 1024) {
                data_range[1] = `${Math.floor(data_range[1] / (Math.pow(1024, i)))}${unit[i]}`
            }
        }


        /**统计在要求acc>=i的前提下，玩家的rks为多少 */
        /**存档 */
        const acc_rksRecord = save.sortRecord()
        /**phi列表 */
        const acc_rks_phi = save.findRegRecord(100)
        /**所有rks节点 */
        const acc_rks_data = []
        /**转换成坐标的节点 */
        const acc_rks_data_ = []
        /**rks上下界 */
        const acc_rks_range = [100, 0]

        /**原本b19中最小acc 要展示的acc序列 */
        const acc_rks_AccRange = [100]

        for (let i = 0; i < Math.min(acc_rksRecord.length, 19); i++) {
            acc_rks_AccRange[0] = Math.min(acc_rks_AccRange[0], acc_rksRecord[i].acc)
        }

        for (let i = acc_rks_AccRange[0]; i <= 100; i += 0.01) {
            let sum_rks = 0
            if (!acc_rksRecord[0]) break
            for (let j = 0; j < acc_rksRecord.length; j++) {
                if (j >= 19) break
                if (acc_rksRecord[j]?.acc < i) {
                    /**预处理展示的acc数字 */
                    acc_rks_AccRange.push(i)
                }
                while (acc_rksRecord[j]?.acc < i) {
                    acc_rksRecord.splice(j, 1)
                }
                if (acc_rksRecord[j]) {
                    sum_rks += acc_rksRecord[j].rks
                } else {
                    break
                }
            }
            // console.info(acc_rksRecord[0])
            let tem_rks = (sum_rks + (acc_rks_phi[0]?.rks || 0)) / 20
            acc_rks_data.push([i, tem_rks])
            acc_rks_range[0] = Math.min(acc_rks_range[0], tem_rks)
            acc_rks_range[1] = Math.max(acc_rks_range[1], tem_rks)
        }
        // console.info(acc_rks_AccRange)

        for (let i = 1; i < acc_rks_data.length; ++i) {
            if (acc_rks_data_[0] && acc_rks_data[i - 1][1] == acc_rks_data[i][1]) {
                acc_rks_data_[acc_rks_data_.length - 1][2] = range(acc_rks_data[i][0], acc_rks_AccRange)
            } else {
                acc_rks_data_.push([range(acc_rks_data[i - 1][0], acc_rks_AccRange), range(acc_rks_data[i - 1][1], acc_rks_range), range(acc_rks_data[i][0], acc_rks_AccRange), range(acc_rks_data[i][1], acc_rks_range)])
            }
        }
        // console.info(acc_rks_data_)

        /**处理acc显示区间，防止横轴数字重叠 */
        if (acc_rks_AccRange[acc_rks_AccRange.length - 1] < 100) {
            acc_rks_AccRange.push(100)
        }
        if (acc_rks_AccRange[0] == 100) {
            acc_rks_AccRange[0] = 0
        }
        const acc_length = (100 - acc_rks_AccRange[0])
        const min_acc = acc_rks_AccRange[0]
        /**要传的数组 */
        const acc_rks_AccRange_position = []
        while (100 - acc_rks_AccRange[acc_rks_AccRange.length - 2] < acc_length / 10) {
            acc_rks_AccRange.splice(acc_rks_AccRange.length - 2, 1)
        }
        acc_rks_AccRange_position.push([acc_rks_AccRange[0], 0])
        for (let i = 1; i < acc_rks_AccRange.length; i++) {
            while (acc_rks_AccRange[i] - acc_rks_AccRange[i - 1] < acc_length / 10) {
                acc_rks_AccRange.splice(i, 1)
            }
            acc_rks_AccRange_position.push([acc_rks_AccRange[i], (acc_rks_AccRange[i] - min_acc) / acc_length * 100])
        }
        // console.info(acc_rks_AccRange_position)
        // console.info(acc_rks_data_)
        // console.info(acc_rks_range)

        let data = {
            gameuser: gameuser,
            userstats: stats,
            rks_history: rks_history,
            data_history: data_history,
            rks_range: rks_range,
            data_range: data_range,
            data_date: [date_to_string(data_date[0]), date_to_string(data_date[1])],
            rks_date: [date_to_string(rks_date[0]), date_to_string(rks_date[1])],
            acc_rks_data: acc_rks_data_,
            acc_rks_range: acc_rks_range,
            acc_rks_AccRange: acc_rks_AccRange_position,
            background: bksong || illlist[randint(0, illlist.length - 1)],
        }

        let kind = Number(e.msg.replace(/\/.*info/g, ''))
        send.send_with_At(e, await get.getuser_info(e, data, kind))
    }

    async lvscore(e) {

        const save = await send.getsave_result(e, 1.0)

        if (!save) {
            return true
        }

        let msg = e.msg.replace(/^[#/](.*)(lvsco(re)?)(\s*)/, "")

        let isask = [true, true, true, true]
        msg = msg.toUpperCase()
        if (msg.includes('AT') || msg.includes('IN') || msg.includes('HD') || msg.includes('EZ')) {
            isask = [false, false, false, false]
            if (msg.includes('EZ')) { isask[0] = true }
            if (msg.includes('HD')) { isask[1] = true }
            if (msg.includes('IN')) { isask[2] = true }
            if (msg.includes('AT')) { isask[3] = true }
        }
        msg = msg.replace(/((\s*)|AT|IN|HD|EZ)*/g, "")

        let range = [0, get.MAX_DIFFICULTY]



        // match_range(msg, range)

        if (msg.match(/[0-9]+(.[0-9]+)?(\s*[-～~]\s*[0-9]+(.[0-9]+)?)?/g)) {
            msg = msg.match(/[0-9]+(.[0-9]+)?(\s*[-～~]\s*[0-9]+(.[0-9]+)?)?/g)[0]
            if (msg.match(/[-～~]/g)) {

                range = msg.split(/\s*[-～~]\s*/g)
                range[0] = Number(range[0])
                range[1] = Number(range[1])
                if (range[0] > range[1]) {
                    let tem = range[1]
                    range[1] = range[0]
                    range[0] = tem
                }
            } else {
                range[0] = range[1] = Number(msg)
            }
            if (range[1] % 1 == 0 && !e.msg.includes(".0")) range[1] += 0.9
        }



        range[1] = Math.min(range[1], 16.9)
        range[0] = Math.max(range[0], 0)




        let unlockcharts = 0
        let totreal_score = 0
        let totacc = 0
        let totcharts = 0
        let totcleared = 0
        let totfc = 0
        let totphi = 0
        let tottot_score = 0
        let tothighest = 0
        let totlowest = 17
        let totsongs = 0
        let totRating = {
            F: 0,
            C: 0,
            B: 0,
            A: 0,
            S: 0,
            V: 0,
            FC: 0,
            phi: 0,
        }
        let totRank = {
            AT: 0,
            IN: 0,
            HD: 0,
            EZ: 0,
        }
        let unlockRank = {
            AT: 0,
            IN: 0,
            HD: 0,
            EZ: 0,
        }
        let unlocksongs = 0

        let Record = save.gameRecord

        for (let song in get.ori_info) {
            let info = get.ori_info[song]
            let vis = false
            for (let i in info.chart) {
                let difficulty = info['chart'][i].difficulty
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


        for (let id in Record) {
            const info = get.init_info(get.idgetsong(id), true)
            const record = Record[id]
            let vis = false
            for (let lv in [0, 1, 2, 3]) {
                if (!info.chart[Level[lv]]) continue
                let difficulty = info.chart[Level[lv]].difficulty
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

        let illustration = getbackground(save.gameuser.background)

        if (!illustration) {
            e.reply(`ERROR: 未找到[${save.gameuser.background}]的有关信息！`)
            logger.error(`未找到${save.gameuser.background}的曲绘！`)
        }

        let data = {
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
                tot: Rate(totreal_score, tottot_score, totfc == totcharts),
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
            tot_acc: (totacc / totcharts),
            date: date_to_string(save.saveInfo.modifiedAt.iso),
            progress_phi: Number((totphi / totcharts * 100).toFixed(2)),
            progress_fc: Number((totfc / totcharts * 100).toFixed(2)),
            avatar: get.idgetavatar(save.gameuser.avatar),
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save.saveInfo.summary.rankingScore,
            PlayerId: save.saveInfo.PlayerId,
        }

        // let remsg = ''
        // remsg += `\n${range[0]}-${range[1]} `
        // remsg += `clear:${totcleared} fc:${totfc} phi:${totphi}\n`
        // remsg += `${progress_bar(totphi / totcharts, 30)} ${totphi}/${totcharts}\n`
        // remsg += `Tot: ${unlockcharts}/${totcharts} acc: ${(totacc / totcharts).toFixed(4)}\n`
        // remsg += `score: ${totreal_score}/${tottot_score}\n`
        // remsg += `highest: ${tothighest.toFixed(4)} lowest:${totlowest.toFixed(4)}\n`
        // remsg += `φ:${totRating['phi']} FC:${totRating['FC']} V:${totRating['V']} S:${totRating['S']} A:${totRating['A']} B:${totRating['B']} C:${totRating['C']} F:${totRating['F']}`


        send.send_with_At(e, await get.getlvsco(e, data))
    }

    async list(e) {

        const save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        const range = [0, get.MAX_DIFFICULTY]

        let msg = e.msg.replace(/^[#/](.*)(lvsco(re)?)(\s*)/, "")

        /**EZ HD IN AT */
        let isask = [true, true, true, true]

        msg = msg.toUpperCase()

        if (msg.includes('EZ') || msg.includes('HD') || msg.includes('IN') || msg.includes('AT')) {
            isask = [false, false, false, false]
            if (msg.includes('EZ')) { isask[0] = true }
            if (msg.includes('HD')) { isask[1] = true }
            if (msg.includes('IN')) { isask[2] = true }
            if (msg.includes('AT')) { isask[3] = true }
        }
        msg = msg.replace(/(list|AT|IN|HD|EZ)*/g, "")

        let scoreAsk = { NEW: true, F: true, C: true, B: true, A: true, S: true, V: true, FC: true, PHI: true }

        if (msg.includes(' NEW') || msg.includes(' F') || msg.includes(' C') || msg.includes(' B') || msg.includes(' A') || msg.includes(' S') || msg.includes(' V') || msg.includes(' FC') || msg.includes(' PHI')) {
            scoreAsk = { NEW: false, F: false, C: false, B: false, A: false, S: false, V: false, FC: false, PHI: false }
            let rating = ['NEW', 'F', 'C', 'B', 'A', 'S', 'V', 'FC', 'PHI']
            for (let i in rating) {
                if (msg.includes(` ${rating[i]}`)) { scoreAsk[rating[i]] = true }
            }
        }
        msg = msg.replace(/(NEW|F|C|B|A|S|V|FC|PHI)*/g, "")

        match_range(e.msg, range)


        let Record = save.gameRecord

        let data = []

        for (let id in Record) {
            const info = get.init_info(get.idgetsong(id), true)
            const record = Record[id]
            for (let lv in [0, 1, 2, 3]) {
                if (!info.chart[Level[lv]]) continue
                let difficulty = info.chart[Level[lv]].difficulty
                if (range[0] <= difficulty && difficulty <= range[1] && isask[lv]) {
                    if ((!record[lv] && !scoreAsk.NEW)) continue
                    if (record[lv] && !scoreAsk[record[lv].Rating.toUpperCase()]) continue
                    data.push({ ...record[lv], ...info, illustration: get.getill(get.idgetsong(id)), difficulty: difficulty, rank: Level[lv] })
                }
            }
        }

        if (data.length > 180) {
            send.send_with_At(e, "谱面数量过多，请缩小搜索范围QAQ！")
            return true
        }

        data.sort((a, b) => {
            return (b.difficulty || 0) - (a.difficulty || 0)
        })

        let plugin_data = get.getpluginData(e.user_id)

        let request = []
        request.push(`${range[0]} - ${range[1]}`)

        for (let lv in isask) {

        }

        send.send_with_At(e, await atlas.list(e, {
            song: data,
            background: illlist[randint(0, illlist.length - 1)],
            theme: plugin_data?.plugin_data?.theme || 'star',
            PlayerId: save.saveInfo.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: save.saveInfo.updatedAt,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            dan: await get.getDan(e.user_id),
            request: request
        }))

    }

}

/**
 * 计算百分比
 * @param {Number} value 值
 * @param {Array} range 区间数组 (0,..,1)
 * @returns 百分数，单位%
 */
function range(value, range) {
    if (range[0] == range[range.length - 1]) {
        return 50
    } else {
        return (value - range[0]) / (range[range.length - 1] - range[0]) * 100
    }
}

/**进度条 */
function progress_bar(value, length) {
    let result = '['
    for (let i = 1; i <= Number((value * length).toFixed(0)); ++i) {
        result += '|'
    }
    for (let i = 1; i <= (length - Number((value * length).toFixed(0))); ++i) {
        result += ' '
    }
    result += `] ${(value * 100).toFixed(2)}%`
    return result
}

/**
 * 
 * @param {number} real_score 真实成绩
 * @param {number} tot_score 总成绩
 * @param {boolean} fc 是否fc
 * @returns 
 */
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

/**
 * 转换时间格式
 * @param {Date|string} date 时间
 * @returns 2020/10/8 10:08:08
 */
function date_to_string(date) {
    date = new Date(date)
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}`
}

function getbackground(name) {
    let save_background = name
    try {
        save_background = name
        switch (save_background) {
            case 'Another Me ': {
                save_background = 'Another Me (KALPA)'
                break
            }
            case 'Another Me': {
                save_background = 'Another Me (Rising Sun Traxx)'
                break
            }
            case 'Re_Nascence (Psystyle Ver.) ': {
                save_background = 'Re_Nascence (Psystyle Ver.)'
                break
            }
            case 'Energy Synergy Matrix': {
                save_background = 'ENERGY SYNERGY MATRIX'
                break
            }
            default: {
                save_background = name
                break
            }
        }
        return get.getill(save_background)
    } catch (err) {
        return false
    }
}

/**
 * 捕获消息中的范围
 * @param {string} msg 消息字符串
 * @param {Array} range 范围数组
 */
function match_range(msg, range) {
    range[0] = 0
    range[1] = get.MAX_DIFFICULTY
    if (msg.match(/[0-9]+(.[0-9]+)?\s*[-～~]\s*[0-9]+(.[0-9]+)?/g)) {
        /**0-16.9 */
        msg = msg.match(/[0-9]+(.[0-9]+)?\s*[-～~]\s*[0-9]+(.[0-9]+)?/g)[0]
        let result = msg.split(/\s*[-～~]\s*/g)
        range[0] = Number(result[0])
        range[1] = Number(result[1])
        if (range[0] > range[1]) {
            let tem = range[1]
            range[1] = range[0]
            range[0] = tem
        }
        if (range[1] % 1 == 0 && !result.includes(".0")) range[1] += 0.9
    } else if (msg.match(/[0-9]+(.[0-9]+)?\s*[-+]/g)) {
        /**16.9- 15+ */
        msg = msg.match(/[0-9]+(.[0-9]+)?\s*[-+]/g)[0]
        let result = msg.replace(/\s*[-+]/g, '')
        if (msg.includes('+')) {
            range[0] = result
        } else {
            range[1] = result
            if (range[1] % 1 == 0 && !result.includes(".0")) range[1] += 0.9
        }
    } else if (msg.match(/[0-9]+(.[0-9]+)?/g)) {
        /**15 */
        msg = msg.match(/[0-9]+(.[0-9]+)?/g)[0]
        range[0] = range[1] = Number(msg)
        if (!msg.includes('.')) {
            range[1] += 0.9
        }
    }
}

//定义生成指定区间整数随机数的函数
function randint(min, max) {
    const range = max - min + 1
    const randomOffset = Math.floor(Math.random() * range)
    return (randomOffset + min) % range + min
}
