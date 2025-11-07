import fs from 'node:fs'
import Chart from '../model/class/chart_g/Chart.js'
import { judgeLineMoveEvent } from '../model/class/chart_g/base/JudgeLineEvent.js'
import Note from '../model/class/chart_g/base/Note.js'
import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import getInfo from "../model/getInfo.js";
import send from "../model/send.js";
import picmodle from '../model/picmodle.js'
import getChartTag from '../model/getChartTag.js'
import getBanGroup from '../model/getBanGroup.js'

export class phihelp extends plugin {
    constructor() {
        super({
            name: 'phi-chart',
            dsc: 'phigros谱面图片生成',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/]((${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(chart).*$`,
                    fnc: 'chart'
                }

            ]
        })

    }
    async chart(e) {

        if (await getBanGroup.get(e, 'chart')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }
        let chartPath = Config.getUserCfg('config', 'chartPath')
        if (!chartPath) {
            e.reply('请先在配置文件中设置谱面路径哦QAQ')
            return true
        }
        if (!fs.existsSync(chartPath)) {
            e.reply('配置文件中设置的谱面路径不存在哦QAQ，请检查后重新设置')
            return true
        }

        let msg = e.msg.replace(/[#/](.*?)(chart)(\s*)/, "")

        /** @type {levelKind} */
        let rank = msg.match(/\s+(EZ|HD|IN|AT)/i)?.[1] || 'IN'
        rank = rank.toUpperCase()
        msg = msg.replace(/\s+(EZ|HD|IN|AT)/i, '')

        let song = getInfo.fuzzysongsnick(msg)?.[0]
        if (!song) {
            send.send_with_At(e, `未找到${msg}的相关曲目信息QAQ！如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！`, true)
            return true
        }
        let info = getInfo.info(song, true)
        if (!info.chart[rank]) {
            send.send_with_At(e, `${song} 没有 ${rank} 这个难度QAQ！`)
            return true
        }

        let chart = info.chart[rank]

        let allowChartTag = await Config.getUserCfg('config', 'allowChartTag')

        let chartInfo = {
            illustration: info.illustration,
            song: info.song,
            length: info.length,
            rank: rank,
            difficulty: chart.difficulty,
            charter: chart.charter,
            tap: chart.tap,
            drag: chart.drag,
            hold: chart.hold,
            flick: chart.flick,
            combo: chart.combo,
            distribution: chart.distribution,
            tip: allowChartTag ? `发送 /${Config.getUserCfg('config', 'cmdhead')} addtag <曲名> <难度> <tag> 来添加标签哦！` : `标签词云功能暂时被管理员禁用了哦！快去联系BOT主开启吧！`,
            chartLength: `${Math.floor(chart.maxTime / 60)}:${Math.floor(chart.maxTime % 60).toString().padStart(2, '0')}`,
            words: allowChartTag ? getChartTag.get(info.id, rank) : '',
        }

        const img = await picmodle.common(e, 'chartImg', {
            ...chartInfo,
            chartImg: getInfo.getChartImg(info.id, rank),
        });

        send.send_with_At(e, [`${info.song} - ${rank}\n谱师：${info.chart[rank].charter}`,img])

        return true

    }
}
