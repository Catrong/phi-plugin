import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'
import send from '../model/send.js'
import picmodle from '../model/picmodle.js'
import getInfo from '../model/getInfo.js'
import getSave from '../model/getSave.js'
import fCompute from '../model/fCompute.js'
import getBanGroup from '../model/getBanGroup.js';
import LevelRecordInfo from '../model/class/LevelRecordInfo.js'
import getSaveFromApi from '../model/getSaveFromApi.js'


let Level = ['EZ', 'HD', 'IN', 'AT']
let illlist = get.illlist

export class phiuser extends plugin {
    constructor() {
        super({
            name: 'phi-user',
            dsc: 'phi-plugin数据统计',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(data)$`,
                    fnc: 'data'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(info)[1-2]?.*$`,
                    fnc: 'info'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)((lvsco(re)?)|scolv)(.*)$`,
                    fnc: 'lvscore'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)list(.*)$`,
                    fnc: 'list'
                }
            ]
        })

    }

    /**查询data */
    async data(e) {

        if (await getBanGroup.get(e, 'data')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let User = await get.getsave(e.user_id)
        if (User) {
            if (User.gameProgress) {
                let data = User.gameProgress.money
                send.send_with_At(e, `您的data数为：${data[4] ? `${data[4]}PB ` : ''}${data[3] ? `${data[3]}TB ` : ''}${data[2] ? `${data[2]}GB ` : ''}${data[1] ? `${data[1]}MB ` : ''}${data[0] ? `${data[0]}KB ` : ''}`)
            } else {
                send.send_with_At(e, `请先更新数据哦！\n/${Config.getUserCfg('config', 'cmdhead')} update`)
            }
        } else {
            send.send_with_At(e, `请先绑定sessionToken哦！\n/${Config.getUserCfg('config', 'cmdhead')} bind <sessionToken>\n如果不知道自己的Token可以通过扫码绑定哦！\n如果不知道命令可以用/phihelp查看哦！`)
        }
        return true
    }

    async info(e) {

        if (await getBanGroup.get(e, 'info')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }
        /**背景 */
        let bksong = e.msg.replace(/^.*(info)[1-2]?\s*/g, '')
        if (bksong) {
            let tem = get.fuzzysongsnick(bksong)[0]
            if (tem) {
                bksong = get.getill(tem)
            } else {
                bksong = undefined
            }
        }
        if (!bksong) {
            bksong = get.getill(illlist[randint(0, illlist.length - 1)], 'blur')
        }

        let save = await send.getsave_result(e, 1.0)

        if (!save) {
            return true
        }

        let stats = await save.getStats()

        let money = save.gameProgress.money
        let userbackground = await fCompute.getBackground(save.gameuser.background)

        if (!userbackground) {
            e.reply(`ERROR: 未找到[${save.gameuser.background}]的有关信息！`)
            logger.error(`未找到${save.gameuser.background}对应的曲绘！`)
        }

        let dan = await get.getDan(e.user_id)

        let gameuser = {
            avatar: getInfo.idgetavatar(save.gameuser.avatar),
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save.saveInfo.summary.rankingScore,
            data: `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`,
            selfIntro: fCompute.convertRichText(save.gameuser.selfIntro),
            backgroundurl: userbackground,
            PlayerId: fCompute.convertRichText(save.saveInfo.PlayerId),
            CLGMOD: dan?.Dan,
            EX: dan?.EX,
        }

        let user_data;

        try {
            user_data = await getSaveFromApi.getHistory(e, ['data', 'rks', 'scoreHistory']);
        } catch (error) {
            user_data = await getSave.getHistory(e.user_id);
        }

        let { rks_history, data_history, rks_range, data_range, rks_date, data_date } = user_data.getRksAndDataLine()


        /**统计在要求acc>=i的前提下，玩家的rks为多少 */
        /**存档 */
        let acc_rksRecord = save.getRecord()
        /**phi列表 */
        let acc_rks_phi = save.findAccRecord(100)
        /**所有rks节点 */
        let acc_rks_data = []
        /**转换成坐标的节点 */
        let acc_rks_data_ = []
        /**rks上下界 */
        let acc_rks_range = [100, 0]

        /**预处理 */
        let phi_rks = 0;

        for (let i = 0; i < 3; ++i) {
            if (acc_rks_phi[i]) {
                phi_rks += acc_rks_phi[i].rks
            } else {
                break
            }
        }

        /**原本b19中最小acc 要展示的acc序列 */
        let acc_rks_AccRange = [100]

        for (let i = 0; i < Math.min(acc_rksRecord.length, 27); i++) {
            acc_rks_AccRange[0] = Math.min(acc_rks_AccRange[0], acc_rksRecord[i].acc)
        }

        for (let i = acc_rks_AccRange[0]; i <= 100; i += 0.01) {
            let sum_rks = 0
            if (!acc_rksRecord[0]) break
            for (let j = 0; j < acc_rksRecord.length; j++) {
                if (j >= 27) break
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
            let tem_rks = (sum_rks + phi_rks) / 30
            acc_rks_data.push([i, tem_rks])
            acc_rks_range[0] = Math.min(acc_rks_range[0], tem_rks)
            acc_rks_range[1] = Math.max(acc_rks_range[1], tem_rks)
        }

        if (acc_rks_AccRange[acc_rks_AccRange.length - 1] < 100) {
            acc_rks_AccRange.push(100)
        }
        // console.info(acc_rks_AccRange)

        for (let i = 1; i < acc_rks_data.length; ++i) {
            if (acc_rks_data_[0] && acc_rks_data[i - 1][1] == acc_rks_data[i][1]) {
                acc_rks_data_[acc_rks_data_.length - 1][2] = fCompute.range(acc_rks_data[i][0], acc_rks_AccRange)
            } else {
                acc_rks_data_.push([fCompute.range(acc_rks_data[i - 1][0], acc_rks_AccRange), fCompute.range(acc_rks_data[i - 1][1], acc_rks_range), fCompute.range(acc_rks_data[i][0], acc_rks_AccRange), fCompute.range(acc_rks_data[i][1], acc_rks_range)])
            }
        }
        // console.info(acc_rks_data_)

        /**处理acc显示区间，防止横轴数字重叠 */
        if (acc_rks_AccRange[0] == 100) {
            acc_rks_AccRange[0] = 0
        }
        let acc_length = (100 - acc_rks_AccRange[0])
        let min_acc = acc_rks_AccRange[0]
        /**要传的数组 */
        let acc_rks_AccRange_position = []
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
            data_date: [fCompute.date_to_string(data_date[0]), fCompute.date_to_string(data_date[1])],
            rks_date: [fCompute.date_to_string(rks_date[0]), fCompute.date_to_string(rks_date[1])],
            acc_rks_data: acc_rks_data_,
            acc_rks_range: acc_rks_range,
            acc_rks_AccRange: acc_rks_AccRange_position,
            background: bksong,
        }

        // console.info(acc_rks_AccRange_position)

        let kind = Number(e.msg.replace(/\/.*info/g, ''))
        send.send_with_At(e, await get.getuser_info(e, data, kind))
    }

    async lvscore(e) {

        if (await getBanGroup.get(e, 'lvscore')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }


        let save = await send.getsave_result(e, 1.0)

        if (!save) {
            return true
        }

        /**匹配定数区间 */
        let msg = e.msg.replace(/^[#/](.*?)(lvsco(re)?)(\s*)/, "")

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

        let range = [0, getInfo.MAX_DIFFICULTY]



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



        range[1] = Math.min(range[1], getInfo.MAX_DIFFICULTY)
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
            phi: 0,
            FC: 0,
            V: 0,
            S: 0,
            A: 0,
            B: 0,
            C: 0,
            F: 0,
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
            let info = get.info(get.idgetsong(id), true)
            let record = Record[id]
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
                    if (record[lv].fc || record[lv].score == 1000000) {
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

        let illustration = await fCompute.getBackground(save.gameuser.background)

        if (!illustration) {
            e.reply(`ERROR: 未找到[${save.gameuser.background}]背景的有关信息！`)
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
                ...totRating,
                tot: Rate(totreal_score, tottot_score, totfc == totcharts),
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
            date: fCompute.date_to_string(save.saveInfo.modifiedAt.iso),
            progress_phi: Number((totphi / totcharts * 100).toFixed(2)),
            progress_fc: Number((totfc / totcharts * 100).toFixed(2)),
            avatar: getInfo.idgetavatar(save.gameuser.avatar),
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            rks: save.saveInfo.summary.rankingScore,
            PlayerId: fCompute.convertRichText(save.saveInfo.PlayerId),
            background: get.getill(illlist[randint(0, illlist.length - 1)], 'blur'),
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

        if (await getBanGroup.get(e, 'list')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }


        let save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        const dif_range = [0, getInfo.MAX_DIFFICULTY];
        const acc_range = [0, 100];

        /** @type {string} */
        let msg = e.msg.replace(/^[#/](.*?)(lvsco(re)?)(\s*)/, "")

        /**EZ HD IN AT */
        let isask = [true, true, true, true]

        msg = msg.toUpperCase()

        const accStr = msg.match(/-ACC\s*\d+(\.\d+)?(\s*[-～~]\s*\d+(\.\d+)?|\s*[+-])?/)?.[0];
        if (accStr) {
            fCompute.match_range(accStr, acc_range);
            msg = msg.replace(accStr, '');
        }

        const difStr = msg.match(/(-DIF)?\s*\d+(\.\d+)?(\s*[-～~]\s*\d+(\.\d+)?|\s*[+-])?/)?.[0];
        if (difStr) {
            fCompute.match_range(difStr, dif_range);
            msg = msg.replace(difStr, '');
        }

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
        if (msg.includes(` AP`)) { scoreAsk.PHI = true }
        msg = msg.replace(/(NEW|F|C|B|A|S|V|FC|PHI|AP)*/g, "")


        let Record = save.gameRecord

        let data = []

        for (let id in Record) {
            let song = get.idgetsong(id)
            if (!song) {
                logger.warn('[phi-plugin]', id, '曲目无信息')
                continue
            }
            let info = get.info(song, true)

            /** @type {LevelRecordInfo[]} */
            let record = Record[id]

            for (let lv in [0, 1, 2, 3]) {
                if (!info.chart[Level[lv]]) continue
                let difficulty = info.chart[Level[lv]].difficulty
                if (!(dif_range[0] <= difficulty && difficulty <= dif_range[1] && isask[lv]))
                    continue;
                if (!record[lv]) {
                    if (!scoreAsk.NEW || acc_range[0] != 0)
                        continue;
                    else
                        record[lv] = {}
                } else {
                    if (record[lv] && !scoreAsk[record[lv].Rating.toUpperCase()])
                        continue;
                    if (!(acc_range[0] <= record[lv].acc && record[lv].acc <= acc_range[1]))
                        continue;
                }
                record[lv].suggest = save.getSuggest(id, lv, 4, difficulty);
                data.push({
                    ...record[lv],
                    ...info,
                    illustration: get.getill(get.idgetsong(id), 'low'),
                    difficulty: difficulty,
                    rank: Level[lv]
                });
            }
        }

        if (data.length > Config.getUserCfg('config', 'listScoreMaxNum')) {
            send.send_with_At(e, `谱面数量过多(${data.length})大于设置的最大值(${Config.getUserCfg('config', 'listScoreMaxNum')})，请缩小搜索范围QAQ！`)
            return true
        }

        data.sort((a, b) => {
            return (b.difficulty || 0) - (a.difficulty || 0)
        })

        let plugin_data = get.getpluginData(e.user_id)

        //逻辑暂未实现
        let request = []
        request.push(`定数 ${dif_range[0]}-${dif_range[1]}`);
        request.push(`ACC ${acc_range[0]}-${acc_range[1]}`);


        send.send_with_At(e, await picmodle.list(e, {
            head_title: "成绩筛选",
            song: data,
            background: get.getill(illlist[randint(0, illlist.length - 1)]),
            theme: plugin_data?.plugin_data?.theme || 'star',
            PlayerId: save.saveInfo.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: save.saveInfo.summary.updatedAt,
            ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            dan: await get.getDan(e.user_id),
            request: request
        }))

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

//定义生成指定区间整数随机数的函数
function randint(min, max) {
    let range = max - min + 1
    let randomOffset = Math.floor(Math.random() * range)
    return (randomOffset + min) % range + min
}
