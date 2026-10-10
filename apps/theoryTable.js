import Config from '../components/Config.js'
import Version from '../components/Version.js'
import phiPluginBase from '../components/baseClass.js'
import send from '../model/render/send.js'
import picmodle from '../model/render/picmodle.js'
import fCompute from '../model/game/fCompute.js'
import getInfo from '../model/game/getInfo.js'
import getNotes from '../model/user/getNotes.js'
import getBanGroup from '../model/user/getBanGroup.js'
import { Level } from '../model/game/constNum.js'
import { computeSongLimits } from '../model/game/songLimits.js'

/**@import {botEvent} from '../components/baseClass.js' */

/**现行rks算法（P3+B27/30）自3.11.0（version_code 122）起启用，之前为(P1+B19)/20 */
const NEW_RKS_ALGORITHM_VERSION = 122

export class phiTheoryTable extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-theory-table',
            dsc: 'phigros理论rks分表查询',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)理论(分表|rks|RKS).*$`,
                    fnc: 'theoryTable'
                }
            ]
        })
    }

    /**
     * 理论rks分表：取目标版本定数最高的谱面按满分成绩模拟b19分表
     * @param {botEvent} e
     * @returns
     */
    async theoryTable(e) {
        if (await getBanGroup.get(e, 'b19')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        /**版本参数，与table(achievement)功能一致：支持版本标签或版本数 */
        const matchVersion = e.msg.match(/-v\s*(\S+)/i)?.[1]
        let verCode = 0
        if (matchVersion) {
            if (matchVersion.includes('.')) {
                verCode = getInfo.versionInfoByLabel[matchVersion]?.version_code || 0
            } else {
                verCode = Number(matchVersion)
            }
            if (!verCode || !getInfo.versionInfoByCode[`${verCode}`]) {
                send.send_with_At(e, `未找到版本 ${matchVersion} 的相关信息QAQ！`)
                return true
            }
        } else {
            verCode = Version.phigrosVerNum
        }

        const versionInfo = getInfo.versionInfoByCode[`${verCode}`]
        if (!versionInfo) {
            console.error(`[phi-plugin] 版本信息获取失败，versionCode: ${verCode}`)
            send.send_with_At(e, `发生未知错误QAQ！请回报管理员！`)
            return true
        }

        const charts = getVersionCharts(verCode)
        if (!charts.length) {
            send.send_with_At(e, `未能获取版本 ${versionInfo.version_label} 的定数表QAQ！`)
            return true
        }

        const isNewAlgo = verCode >= NEW_RKS_ALGORITHM_VERSION
        const phiCount = isNewAlgo ? 3 : 1
        const bestCount = isNewAlgo ? 27 : 19

        /**
         * 满分成绩下rks即定数。与Save.getB19/computeSongLimits一致：
         * B27为全部成绩前27条（含满分谱面），P3为其中的AP加成，满分谱面同时计入两侧
         */
        const phiCharts = charts.slice(0, phiCount).map((chart, i) => theoryEntry(chart, i + 1))
        const b19_list = charts.slice(0, bestCount).map((chart, i) => theoryEntry(chart, i + 1))

        const phi = isNewAlgo ? phiCharts : [phiCharts[0], undefined, undefined]
        const com_rks = (
            phiCharts.reduce((sum, x) => sum + x.rks, 0)
            + b19_list.reduce((sum, x) => sum + x.rks, 0)
        ) / (phiCount + bestCount)

        const plugin_data = await getNotes.getNotesData(e.user_id)

        if (!Config.getUserCfg('config', 'isGuild'))
            send.reply(e, "正在生成图片，请稍等一下哦！\n//·/w\\·\\\\", false, { recallMsg: 5 })

        /**各难度谱面数量，满分模拟下C/FC/Phi与总数一致 */
        const stats = Level.map(lv => {
            const count = charts.filter(chart => chart.rank == lv).length
            return { title: lv, cleared: count, fc: count, phi: count }
        })

        /**课题占位：白(0) + 目标版本理论最高课题分（三张谱floor定数之和上限） */
        const maxChallenge = computeSongLimits(charts).maxChallenge || 0

        const spInfo = [
            `模拟分表：理论模拟，非真实存档`,
            `理论rks = ${isNewAlgo ? '(P1-3+B1-27)/30' : '(P1+B1-19)/20'}（${versionInfo.version_label}${isNewAlgo ? '' : '旧版'}算法）`,
        ]

        const background = getInfo.getill(/**@type {idString} */(phiCharts[0]?.id), 'blur')
            || getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur')

        const data = {
            phi,
            b19_list,
            PlayerId: `v${versionInfo.version_label}理论分表`,
            Rks: com_rks.toFixed(4),
            Date: fCompute.formatDate(versionInfo.update_date * 1000),
            ChallengeMode: 0,
            ChallengeModeRank: maxChallenge,
            background,
            theme: plugin_data?.theme || 'star',
            gameuser: {
                avatar: 'Introduction',
                ChallengeMode: 0,
                ChallengeModeRank: maxChallenge,
                rks: com_rks,
                data: '',
                selfIntro: '',
                backgroundUrl: '',
                PlayerId: `v${versionInfo.version_label}理论分表`,
            },
            nnum: bestCount,
            stats,
            spInfo,
        }

        send.send_with_At(e, await picmodle.b19(e, data))
        return true
    }
}

/**
 * 获取指定版本的谱面定数列表（仅正式谱面，不含SP/特邀），按定数降序
 * @param {number} verCode 版本号（整数）
 * @returns {{ id: idString, rank: levelKind, difficulty: number }[]}
 */
function getVersionCharts(verCode) {
    /**@type {{ id: idString, rank: levelKind, difficulty: number }[]} */
    const charts = []

    const difTable = getInfo.historyDifficultyByVersion[`${verCode}`]
    if (difTable) {
        const ids = fCompute.objectKeys(difTable)
        for (const id of ids) {
            for (const lv of Level) {
                const difficulty = Number(difTable[id]?.[lv])
                if (difficulty > 0) {
                    charts.push({ id, rank: lv, difficulty })
                }
            }
        }
    } else if (verCode == Number(Version.phigrosVerNum)) {
        // oldInfo尚未收录当前版本时，退回当前定数表
        const ids = fCompute.objectKeys(getInfo.ori_info)
        for (const id of ids) {
            for (const lv of Level) {
                const difficulty = Number(getInfo.ori_info[id]?.chart?.[lv]?.difficulty)
                if (difficulty > 0) {
                    charts.push({ id, rank: lv, difficulty })
                }
            }
        }
    }

    charts.sort((a, b) => b.difficulty - a.difficulty)
    return charts
}

/**
 * 将谱面转为满分模拟成绩条目
 * @param {{ id: idString, rank: levelKind, difficulty: number }} chart
 * @param {number} num 第几条
 */
function theoryEntry(chart, num) {
    return {
        num,
        id: chart.id,
        song: getInfo.idgetsong(chart.id) || chart.id,
        illustration: getInfo.getill(chart.id, 'common', chart.rank),
        rank: chart.rank,
        difficulty: chart.difficulty,
        /**满分成绩的等效rks即定数 */
        rks: chart.difficulty,
        acc: 100,
        score: 1000000,
        fc: true,
        Rating: 'phi',
        suggest: '无法推分',
    }
}
