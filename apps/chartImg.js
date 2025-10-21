import fs from 'node:fs'
import Chart from '../model/class/chart_g/Chart.js'
import { judgeLineMoveEvent } from '../model/class/chart_g/base/JudgeLineEvent.js'
import Note from '../model/class/chart_g/base/Note.js'
import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import getInfo from "../model/getInfo.js";
import send from "../model/send.js";
import picmodle from '../model/picmodle.js'
import getBanGroup from '../model/getBanGroup.js'

export class phihelp extends plugin {
    constructor() {
        super({
            name: 'phi-chartImg',
            dsc: 'phigros谱面图片生成',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/]((${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(chartimg).*$`,
                    fnc: 'chartImg'
                }

            ]
        })

    }
    async chartImg(e) {
        let chartPath = Config.getUserCfg('config', 'chartPath')
        if (!chartPath) {
            e.reply('请先在配置文件中设置谱面路径哦QAQ')
            return true
        }
        if (!fs.existsSync(chartPath)) {
            e.reply('配置文件中设置的谱面路径不存在哦QAQ，请检查后重新设置')
            return true
        }

        if (await getBanGroup.get(e, 'chart')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let msg = e.msg.replace(/[#/](.*?)(chartimg)(\s*)/, "")

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

        const pathStr = `${chartPath}/Chart_${rank}/${info.id}.json`

        if (!fs.existsSync(pathStr)) {
            console.log(pathStr)
            send.send_with_At(e, `未找到 ${song} 的 ${rank} 难度谱面文件QAQ！请确认谱面路径是否正确，或是否缺少该谱面文件嗷！`)
            return true
        }

        const chartJson = JSON.parse(fs.readFileSync(pathStr, 'utf-8'))

        // const data = work(JSON.parse(fs.readFileSync('../../../../../tools/wen_jiang/Chart_AT/DistortedFate.Sakuzyo.0.json')));
        const data = work(chartJson);
        const img = await picmodle.common(e, 'chartImg', {
            chartData: JSON.stringify(data),

            illustration: info.illustration,
        });

        send.send_with_At(e, [`${info.song} - ${rank}\n谱师：${info.chart[rank].charter}`,img])

        return true

    }
}



/**
 * 
 * @param {Partial<judgeLineMoveEvent>} event 
 * @param {number} time 
 * @param {boolean} [Y=false] 
 * @returns 
 */
function com(event, time, Y = false) {
    const { startTime, endTime } = event
    const start = Y ? event.start2 : event.start
    const end = Y ? event.end2 : event.end
    if (time <= startTime) return start
    if (time >= endTime) return end
    return start + (end - start) * (time - startTime) / (endTime - startTime)
}

function work(json) {
    const cntBpm = {}
    const chart = new Chart(json);
    const notesList = [];
    for (let i = 0; i < chart.judgeLineList.length; ++i) {
        const line = chart.judgeLineList[i];
        let time = 0;
        let x = 0;
        let y = 0;
        let r = 0;
        let s = 1;
        let bpm = line.bpm;
        let mvIndex = 0; const mvEvents = line.judgeLineMoveEvents;
        let rIndex = 0; const rEvents = line.judgeLineRotateEvents;
        let sIndex = 0; const sEvents = line.speedEvents;
        const notes = [
            ...line.notesAbove.map(e => {
                return {
                    ...e, below: false, line: i, sXc: 1
                }
            }),
            ...line.notesBelow.map(e => {
                return {
                    ...e, below: true, line: i, sXc: 1
                }
            })
        ];
        notes.sort((a, b) => a.time - b.time)
        let nIndex = 0;
        while (nIndex < notes.length) {
            /** 
             * @type {Note & {
             * below: boolean, 
             * realX: number, 
             * realY: number, 
             * realSpeed: number, 
             * line: number, 
             * HL: boolean, 
             * sXc: number, 
             * r2row:boolean,
             * ror: number,
             * bpm: number}
             * } 
             */
            const note = notes[nIndex];

            time = note.time;
            while (mvIndex < mvEvents.length - 1 && mvEvents[mvIndex].endTime < time) {
                mvIndex++;
            }
            while (rIndex < rEvents.length - 1 && rEvents[rIndex].endTime < time) {
                rIndex++;
            }
            while (sIndex < sEvents.length - 1 && sEvents[sIndex].endTime < time) {
                sIndex++;
            }
            x = com(mvEvents[mvIndex], time);
            y = com(mvEvents[mvIndex], time, true);
            r = com(rEvents[rIndex], time);
            s = sEvents[sIndex].value;
            note.realX = Math.round((x + note.positionX * Math.cos((r % 360) * Math.PI / 180) * 0.05625) * 1e5) / 1e5;
            note.realY = Math.round((y + note.positionX * Math.sin((r % 360) * Math.PI / 180) * 0.05625 * 108 / 192) * 1e5) / 1e5;
            note.realSpeed = Math.round(s * note.speed * 1e5) / 1e5;
            note.ror = Math.round((r % 360) * 1e5) / 1e5;
            note.bpm = bpm;
            notesList.push(note);
            cntBpm[bpm] = (cntBpm[bpm] || 0) + 1;
            nIndex++;
        }
    }
    notesList.sort(
        (a, b) => {
            if (a.time != b.time) return a.time * a.bpm - b.time * b.bpm;
            if (a.realX != b.realX) return a.realX - b.realX;
            if (a.realY != b.realY) return a.realY - b.realY;
            return (a.type % 2) - (b.type % 2);
        }
    );
    notesList.forEach((e, i, arr) => {
        if (i == 0) return;
        if (e.time * e.bpm == arr[i - 1].time * arr[i - 1].bpm) {
            e.HL = true;
            arr[i - 1].HL = true;
            if (e.realX == arr[i - 1].realX && arr[i - 1].type % 2) {
                e.sXc = arr[i - 1].sXc + 1;
                arr[i - 1].sXc = 1;
            }
        }
        if (e.ror % 90 == 0 && (e.ror / 90 % 2)) {
            e.r2row = true;
        }
    })
    for (let i = 0, j = 1; i < notesList.length; i = j, ++j) {
        const e = notesList[i];
        let maxY = -99999;
        let minY = 99999;
        while (j < notesList.length && notesList[j].realX == e.realX && notesList[j].time * notesList[j].bpm < notesList[j - 1].time * notesList[j - 1].bpm + 64) {
            maxY = Math.max(maxY, notesList[j].realY);
            minY = Math.min(minY, notesList[j].realY);
            ++j;
        }

        if (j - 1 > i && maxY != minY) {
            for (let k = i; k < j; ++k) {
                notesList[k].r2row = true;
            }
        }
    }
    return {
        list: notesList,
        mainBpm: Object.keys(cntBpm).sort((a, b) => cntBpm[b] - cntBpm[a])[0]
    }
}
