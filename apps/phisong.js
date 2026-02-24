// import get from '../model/getdata.js'
import common from "../../../lib/common/common.js"
import Config from '../components/Config.js'
import send from '../model/send.js'
import getInfo from '../model/getInfo.js'
import getPic from '../model/getPic.js'
import picmodle from '../model/picmodle.js'
import fCompute from '../model/fCompute.js'
import getBanGroup from '../model/getBanGroup.js';
import { allLevel, Level, LevelNum } from '../model/constNum.js'
import { segment } from 'oicq'
import getComment from '../model/getComment.js'
import getSave from '../model/getSave.js'
import getChartTag from '../model/getChartTag.js'
import Version from '../components/Version.js'
import makeRequest from '../model/makeRequest.js'
import makeRequestFnc from '../model/makeRequestFnc.js'
import phiPluginBase from '../components/baseClass.js'
import logger from '../components/Logger.js'
import SongsInfo from '../model/class/SongsInfo.js'
import Chart from "../model/class/Chart.js"
import getNotes from "../model/getNotes.js"

/**@import {botEvent} from '../components/baseClass.js' */

/**
 * @type {{ [x: string]: string | number; }}
 */
let wait_to_del_list
/**
 * @type {string | number}
 */
let wait_to_del_nick

export class phisong extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-图鉴',
            dsc: 'phigros图鉴',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(曲|song).*$`,
                    fnc: 'song'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(查找|检索|search).*$`,
                    fnc: 'search'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(设置别名|setnic(k?)).*$`,
                    fnc: 'setnick'
                },
                // {
                //     reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(删除别名|delnic(k?)).*$`,
                //     fnc: 'delnick'
                // },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(曲绘|ill|Ill).*$`,
                    fnc: 'ill'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)randclg.*$`,
                    fnc: 'randClg'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(随机|rand(om)?).*$`,
                    fnc: 'randmic'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)alias.*$`,
                    fnc: 'alias'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(com|计算).*$`,
                    fnc: 'comrks'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)tips$`,
                    fnc: 'tips'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)new$`,
                    fnc: 'newSong'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)live$`,
                    fnc: 'live'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(table|定数表)\\s*[0-9]+\\s*(-v\\s*\\S*)?$`,
                    fnc: 'table'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(comment|cmt|评论|评价)[\\s\\S]*$`,
                    fnc: 'comment'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(recmt).*$`,
                    fnc: 'recallComment'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(mycmt).*$`,
                    fnc: 'myComment'
                },
                // {
                //     reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(chart).*$`,
                //     fnc: 'chart'
                // },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(addtag|subtag|retag).*$`,
                    fnc: 'addtag'
                }
            ]
        })

    }


    /**
     * 歌曲图鉴
     * @param {botEvent} e
     */
    async song(e) {

        if (await getBanGroup.get(e, 'song')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let msg = e.msg.replace(/[#/](.*?)(曲|song)(\s*)/, "")
        let addComment = msg.match(/\s+-comment/)?.[0] ? true : false;
        if (addComment) msg = msg.replace(/\s+-comment/, "")
        let page = msg.match(/\s+-p\s+([0-9]+)/)?.[1] ? Number(msg.match(/\s+-p\s+([0-9]+)/)?.[1]) : 0;
        msg = msg.replace(/\s+-p\s+([0-9]+)/, "")
        if (!msg) {
            send.send_with_At(e, `请指定曲名哦！\n格式：/${Config.getUserCfg('config', 'cmdhead')} song <曲名>`)
            return true
        }
        let ids = getInfo.fuzzysongsnick(msg)
        if (ids[0]) {
            if (!ids[1]) {
                send.send_with_At(e, await songInfo(page, addComment, ids[0], e))
            } else {
                this.choseMutiNick(e, ids, { page, addComment }, async (e, id, options) => {
                    send.send_with_At(e, await songInfo(options.page, options.addComment, id, e));
                })
            }
        } else {
            send.send_with_At(e, `未找到${msg}的相关曲目信息QAQ\n如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！`)
        }
        return true
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async search(e) {

        if (await getBanGroup.get(e, 'search')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let msg = e.msg.replace(/[#/](.*?)(查找|检索|search)(\s*)/g, "").toLowerCase()

        /**
         * @type {Record<string, {regex: RegExp, predicate: (item: any, bottom: number, top: number) => boolean}>}
         */
        const patterns = {
            'bpm': {
                'regex': /bpm([\s:：,，/|~是为]*)([0-9]+(\s*-\s*[0-9]+)?)/,
                'predicate': (item, bottom, top) => (item?.['bpm'] ? bottom <= item['bpm'] && item['bpm'] <= top : false)
            },
            'difficulty': {
                'regex': /(difficulty|dif|定数|难度|定级)([\s:：,，/|~是为]*)([0-9.]+(\s*-\s*[0-9.]+)?)/,
                'predicate': (item, bottom, top) => (item?.['chart'] ? Object.values(item['chart']).some(level => bottom <= level['difficulty'] && level['difficulty'] <= top) : false)
            },
            'combo': {
                'regex': /(combo|cmb|物量|连击)([\s:：,，/|~是为]*)([0-9]+(\s*-\s*[0-9]+)?)/,
                'predicate': (item, bottom, top) => (item?.['chart'] ? Object.values(item['chart']).some(level => bottom <= level['combo'] && level['combo'] <= top) : false)
            }
        }

        /**@type {Partial<Record<idString, SongsInfo>>} */
        let remain = getInfo.all_info()
        /**@type {Partial<Record<idString, SongsInfo>>} */
        let result = {}
        /**
         * @type {{ [x: string]: [number, number]; }} filters
         */
        let filters = {}

        for (let key in patterns) {
            let { regex, predicate } = patterns[key]
            let match = msg.match(regex)
            if (match) {
                let matchStr = match[0].replace(/((bpm|difficulty|dif|难度|定级|定数|combo|cmb|物量|连击)([\s:：,，/|~是为]*))(\d)/g, '$1 $4')
                matchStr = matchStr.replace(/((bpm|difficulty|dif|难度|定级|定数|combo|cmb|物量|连击)([\s:：,，/|~是为]*))|\s/g, '')
                let [bottom, top] = matchStr.includes('-') ? matchStr.split('-').sort((a, b) => Number(a) - Number(b)) : [matchStr, matchStr]
                let bottomNum = Number(bottom)
                let topNum = Number(top)
                if (key === 'difficulty' && !matchStr.includes('.0') && topNum % 1 === 0) {
                    topNum += 0.9
                }
                filters[key] = [bottomNum, topNum]
                for (let id of fCompute.objectKeys(remain)) {
                    if (predicate(remain[id], bottomNum, topNum)) {
                        result[id] = remain[id]
                    }
                }
                remain = result
                result = {}
            }
        }

        if (Config.getUserCfg('config', 'isGuild')) {
            let Resmsg = []
            let tot = 0
            let count = 1
            let single = `当前筛选：${filters.bpm ? `BPM:${filters.bpm[0]}${filters.bpm[1] ? `-${filters.bpm[1]}` : ''}` : ''}${filters.difficulty ? `定级:${filters.difficulty[0]}${filters.difficulty[1] ? `-${filters.difficulty[1]}` : ''} ` : ''}${filters.combo ? ` 物量:${filters.combo[0]}${filters.combo[1] ? `-${filters.combo[1]}` : ''} ` : ''}`
            for (let id of fCompute.objectKeys(remain)) {
                let songInfo = remain[id]
                if (!songInfo) continue;
                let msg
                if (count) {
                    msg = `\n${id} BPM:${songInfo.bpm}`
                } else {
                    msg = `${id} BPM:${songInfo.bpm}`
                }
                for (let level of fCompute.objectKeys(songInfo.chart)) {
                    msg += `<${level}> ${songInfo.chart[level]?.difficulty} ${songInfo.chart[level]?.combo}`
                }
                single += msg
                ++tot
                ++count
                /**每条消息10行 */
                if (count == 10) {
                    Resmsg.push(single)
                    single = ''
                    count = 0
                }
            }
            if (count) {
                Resmsg.push(single)
                count = 0
            }
            if (e.isGroup) {
                send.send_with_At(e, `找到了${tot}个结果，自动转为私聊发送喵～`, true)
                send.pick_send(e, await common.makeForwardMsg(e, Resmsg, `找到了${tot}个结果喵！`))

            } else {
                e.reply(await common.makeForwardMsg(e, Resmsg, `找到了${tot}个结果喵！`))
            }
        } else {
            let Resmsg = [`当前筛选：${filters.bpm ? `\nBPM:${filters.bpm[0]}${filters.bpm[1] ? `-${filters.bpm[1]}` : ''}` : ''}${filters.difficulty ? `\n定级:${filters.difficulty[0]}${filters.difficulty[1] ? `-${filters.difficulty[1]}` : ''} ` : ''}${filters.combo ? `\n物量:${filters.combo[0]}${filters.combo[1] ? `-${filters.combo[1]}` : ''} ` : ''}`]
            for (let id of fCompute.objectKeys(remain)) {
                let songInfo = remain[id]
                if (!songInfo) continue;
                let msg = `${id}\nBPM:${songInfo.bpm}`
                for (let level of fCompute.objectKeys(songInfo.chart)) {
                    msg += `\n${level} ${songInfo.chart[level]?.difficulty} ${songInfo.chart[level]?.combo}`
                }
                Resmsg.push(msg)
            }
            e.reply(await common.makeForwardMsg(e, Resmsg, `找到了${Resmsg.length - 1}首曲目喵！`))
        }

    }


    /**
     * 设置别名
     * @param {botEvent} e
     */
    async setnick(e) {
        if (!(e.is_admin || e.isMaster)) {
            e.reply("只有管理员可以设置别名哦！")
            return true
        }
        let msg = e.msg.replace(/[#/](.*?)(设置别名|setnic(k?))(\s*)/g, "")
        /**@type {string[]} */
        let parts = []
        if (msg.includes("--->")) {
            msg = msg.replace(/(\s*)--->(\s*)/g, " ---> ")
            parts = msg.split(" ---> ")
        } else if (msg.includes("\n")) {
            parts = msg.split("\n")
        }
        if (parts[1]) {
            let P0Ids = getInfo.fuzzysongsnick(parts[0], 1)
            let P0Id = ''
            if (P0Ids[0]) {
                P0Id = P0Ids[0]
            } else {
                e.reply(`输入有误哦！没有找到“${msg[0]}”这首曲子呢！`)
                return true
            }
            if (P0Id in getInfo.fuzzysongsnick(parts[1], 1)) {
                /**已经添加过该别名 */
                e.reply(`${P0Id} 已经有 ${parts[1]} 这个别名了哦！`)
                return true
            } else {
                getInfo.setnick(P0Id, parts[1])
                e.reply("设置完成！")
            }
        } else {
            e.reply(`输入有误哦！请按照\n原名（或已有别名） ---> 别名\n的格式发送哦！`)
        }
        return true
    }

    /**
     * 获取曲绘
     * @param {botEvent} e
     */
    async ill(e) {

        if (await getBanGroup.get(e, 'ill')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let msg = e.msg.replace(/[#/](.*?)(曲绘|ill|Ill)(\s*)/, "")
        if (!msg) {
            send.send_with_At(e, `请指定曲名哦！\n格式：/${Config.getUserCfg('config', 'cmdhead')} ill <曲名>`)
            return true
        }
        let ids = getInfo.fuzzysongsnick(msg)
        if (ids[0]) {
            let msgRes

            if (!ids[1]) {
                send.send_with_At(e, await getPic.GetSongsIllAtlas(e, ids[0]))
            } else {
                this.choseMutiNick(e, ids, {}, async (e, id) => {
                    send.send_with_At(e, await getPic.GetSongsIllAtlas(e, id));
                })
            }
        } else {
            send.send_with_At(e, `未找到${msg}的相关曲目信息QAQ`)
            return false
        }
        return true

    }

    /**
     * 随机定级范围内曲目
     * @param {botEvent} e
     */
    async randmic(e) {

        if (await getBanGroup.get(e, 'randmic')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let msg = e.msg.replace(/^[#/](.*?)(随机|rand)(\s*)/, "")
        let isask = [1, 1, 1, 1]

        msg = msg.toUpperCase()
        if (msg.includes('AT') || msg.includes('IN') || msg.includes('HD') || msg.includes('EZ')) {
            isask = [0, 0, 0, 0]
            if (msg.includes('EZ')) { isask[0] = 1 }
            if (msg.includes('HD')) { isask[1] = 1 }
            if (msg.includes('IN')) { isask[2] = 1 }
            if (msg.includes('AT')) { isask[3] = 1 }
        }
        msg = msg.replace(/((\s*)|AT|IN|HD|EZ)*/g, "")
        let rank = msg.split('-')
        let top
        let bottom

        /**是否指定范围 */
        if (rank[0]) {
            if (rank[0].includes('+')) {
                if (rank[1]) {
                    send.send_with_At(e, `含有 '+' 的难度不支持指定范围哦！\n/${Config.getUserCfg('config', 'cmdhead')} rand <定数>+ <难度(可多选)>`, true)
                    return true
                } else {
                    bottom = Number(rank[0].replace('+', ''))
                    top = 100
                }
            } else if (rank[0].includes('-') && !rank[1]) {
                const tb = Number(rank[0].replace('-', ''))
                if (isNaN(tb)) {
                    send.send_with_At(e, `${rank[0]} 不是一个定级哦\n#/${Config.getUserCfg('config', 'cmdhead')} rand <定数>- <难度(可多选)>`, true)
                    return true
                } else {
                    bottom = 0
                    top = tb
                }
            } else {
                const tb = Number(rank[0])
                if (rank[1]) {
                    const tt = Number(rank[1])
                    if (isNaN(tb) || isNaN(tt)) {
                        send.send_with_At(e, `${rank[0]} - ${rank[1]} 不是一个定级范围哦\n/${Config.getUserCfg('config', 'cmdhead')} rand <定数1> - <定数2> <难度(可多选)>`, true)
                        return true
                    }
                    top = Math.max(tb, tt)
                    bottom = Math.min(tb, tt)
                } else {
                    if (isNaN(tb)) {
                        send.send_with_At(e, `${rank[0]} 不是一个定级哦\n#/${Config.getUserCfg('config', 'cmdhead')} rand <定数> <难度(可多选)>`, true)
                        return true
                    } else {
                        top = bottom = tb
                    }
                }
            }
        } else {
            top = 100
            bottom = 0
        }

        if (top % 1 == 0 && !msg.includes(".0")) top += 0.9

        let songsname = []
        for (let id of fCompute.objectKeys(getInfo.ori_info)) {
            if (!getInfo.ori_info[id]?.chart) continue;
            for (let level of Level) {
                if (isask[LevelNum[level]] && getInfo.ori_info[id].chart[level]) {
                    let difficulty = getInfo.ori_info[id].chart[level].difficulty
                    if (difficulty >= bottom && difficulty <= top) {
                        songsname.push({
                            ...getInfo.ori_info[id].chart[level],
                            rank: level,
                            illustration: getInfo.getill(id),
                            song: getInfo.ori_info[id].song,
                            illustrator: getInfo.ori_info[id].illustrator,
                            composer: getInfo.ori_info[id].composer,
                        })
                    }
                }
            }
        }

        if (!songsname[0]) {
            send.send_with_At(e, `未找到 ${bottom} - ${top} 的 ${isask[0] ? `${Level[0]} ` : ''}${isask[1] ? `${Level[1]} ` : ''}${isask[2] ? `${Level[2]} ` : ''}${isask[3] ? `${Level[3]} ` : ''}谱面QAQ!`)
            return true
        }

        let result = songsname[randbt(songsname.length - 1)]

        send.send_with_At(e, await picmodle.rand(e, result))
        return true
    }

    /**
     * 查询歌曲别名
     * @param {botEvent} e
     */
    async alias(e) {

        if (await getBanGroup.get(e, 'alias')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let msg = e.msg.replace(/[#/](.*?)alias(\s*)/, "")
        let id = getInfo.info(/**@type {idString} */(msg))?.id;
        let ids = id ? [id] : getInfo.fuzzysongsnick(msg);

        /**
         * @param {botEvent} e 
         * @param {idString} id 
         */
        function makeNickMsg(e, id) {
            let info = getInfo.info(id)
            let nicks = ['======================\n已有别名：']
            const usernick = Config.getUserCfg('nickconfig')
            for (let nick of fCompute.objectKeys(usernick)) {
                if (usernick[nick].includes(id)) {
                    nicks.push(`${nick}`)
                }
            }
            if (getInfo?.nicklist?.[id]) {
                nicks = nicks.concat(getInfo.nicklist[id])
            }
            // console.info(getInfo.nicklist)
            // console.info(info.song)
            send.send_with_At(e, [getPic.getIll(id), `\nname: ${info?.song}\nid: ${id}\n` + nicks.join('\n')])
        }

        if (ids[0]) {
            if (!ids[1]) {
                makeNickMsg(e, ids[0])
            } else {
                this.choseMutiNick(e, ids, {}, (e, id) => makeNickMsg(e, id));
            }
        } else {
            send.send_with_At(e, `未找到${msg}的相关曲目信息QAQ！如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！`, true)
        }
    }

    /**
     * 计算等效rks
     * @param {botEvent} e
     */
    async comrks(e) {

        if (await getBanGroup.get(e, 'comrks')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let msg = e.msg.replace(/^[#/].*(com|计算)\s*/, '')
        let data = msg.split(' ')
        let data0 = Number(data[0])
        let data1 = Number(data[1])
        if (data && data1 && data0 > 0 && data0 <= 18 && data1 > 0 && data1 <= 100) {
            send.send_with_At(e, `dif: ${data0} acc: ${data1}\n计算结果：${fCompute.rks(Number(data1), Number(data0))}`, true)
            return true
        } else {
            send.send_with_At(e, `格式错误QAQ！\n格式：${Config.getUserCfg('config', 'cmdhead')} com <定数> <acc>`)
            return false
        }
    }

    /**
     * 随机tips
     * @param {botEvent} e
     */
    async tips(e) {

        if (await getBanGroup.get(e, 'tips')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        send.send_with_At(e, getInfo.tips[fCompute.randBetween(0, getInfo.tips.length - 1)])
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async randClg(e) {
        if (await getBanGroup.get(e, 'randClg')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let songReg = /[\(（].*[\)）]/
        let arg = e.msg.replace(/^.*?randClg\s*/i, '')
        let songReq = arg.match(songReg)?.[0].replace(/[\(\)（）]/g, "") ?? ""
        arg = arg.replace(arg.match(songReg)?.[0] ?? "", "")

        let songAsk = fCompute.match_request(songReq)

        // console.info(songAsk, songReq)

        let { isask, range } = fCompute.match_request(arg, 51)

        let NumList = []
        for (let i = range[0]; i <= range[1]; i++) {
            NumList.push(i)
        }

        /**@type {Record<number, Chart[]>} */
        let chartList = {}
        for (let dif of fCompute.objectKeys(getInfo.info_by_difficulty)) {
            if (Number(dif) < range[1]) {
                for (let i in getInfo.info_by_difficulty[dif]) {
                    let chart = getInfo.info_by_difficulty[dif][i]
                    if (!chart) continue;
                    let difficulty = Math.floor(chart.difficulty)
                    if (isask[LevelNum[chart.rank]] && chartMatchReq(songAsk, chart)) {
                        if (chartList[difficulty]) {
                            chartList[difficulty].push(chart)
                        } else {
                            chartList[difficulty] = [chart]
                        }
                    }
                }
            }
        }

        NumList = fCompute.randArray(NumList)

        let shiftNum = NumList.shift()
        if (!shiftNum) {
            send.send_with_At(e, `未找到符合条件的谱面QAQ！`)
            return true;
        }
        let res = undefined;
        while (!res && shiftNum) {
            res = randClg(shiftNum, { ...chartList })
            shiftNum = NumList.shift()
        }
        // console.info(res)
        if (res) {

            let songs = []

            let plugin_data = await getNotes.getNotesData(e.user_id)

            for (let i in res) {
                let info = getInfo.info(res[i].id)
                if (!info) continue;
                songs.push({
                    id: info.id,
                    song: info.song,
                    rank: res[i].rank,
                    difficulty: res[i].difficulty,
                    illustration: getInfo.getill(info.id),
                    ...info.chart[res[i].rank]
                })
            }

            send.send_with_At(e, await picmodle.common(e, 'clg', {
                songs,
                tot_clg: Math.floor(res[0].difficulty) + Math.floor(res[1].difficulty) + Math.floor(res[2].difficulty),
                background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
                theme: plugin_data?.theme || 'star',
            }))

            // ans += `${getInfo.idgetsong(res[0].id)} ${res[0].rank} ${res[0].difficulty}\n`
            // ans += `${getInfo.idgetsong(res[1].id)} ${res[1].rank} ${res[1].difficulty}\n`
            // ans += `${getInfo.idgetsong(res[2].id)} ${res[2].rank} ${res[2].difficulty}\n`
            // ans += `difficulty: ${Math.floor(res[0].difficulty) + Math.floor(res[1].difficulty) + Math.floor(res[2].difficulty)}`
        } else {
            send.send_with_At(e, `未找到符合条件的谱面QAQ！`)
        }

        return true;
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async newSong(e) {

        if (await getBanGroup.get(e, 'newSong')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }
        /**
         * @type {{ cnt: any; col?: number; row?: number; color?: string; bkg?: string; }[][]}
         */
        const ans = []
        let msg = ''
        try {
            /**@type {any} */
            let info = await (await fetch(Config.getUserCfg('config', 'phigrousUpdateUrl'))).json()
            msg += `最新版本：${info?.data?.list?.[0]?.version_label}\n更新信息：\n${info?.data?.list?.[0]?.whatsnew?.text?.replace(/<\/?div>/g, '')?.replace(/<br\/>/g, '\n')}\n`
        } catch (e) { }
        msg += `信息文件版本：${Version.phigros}\n`
        ans.push([{ cnt: '新曲速递', col: 4 }]);
        ans.push([{ cnt: '曲名' }, { cnt: '难度' }, { cnt: '定数' }, { cnt: '物量' }])
        for (let id of getInfo.updatedSong) {
            let info = getInfo.info(id)
            if (!info) continue;
            for (let j of Level) {
                if (Level.indexOf(j) === -1) continue;
                if (!info.chart[j]) continue;
                const bkg = levelColor(j)
                ans.push([{ cnt: info.song }, { cnt: j, bkg }, { cnt: info.chart[j].difficulty, bkg }, { cnt: info.chart[j].combo, bkg }])
            }
        }

        ans.push([{ cnt: '定数&谱面修改', col: 4 }])
        ans.push([{ cnt: '曲名' }, { cnt: '难度' }, { cnt: '条目' }, { cnt: '情况' }])
        for (let id of fCompute.objectKeys(getInfo.updatedChart)) {
            let tem = getInfo.updatedChart[id]
            for (let level of Level) {
                if (!tem[level]) continue;
                if (tem[level].isNew) {
                    delete tem[level].isNew
                    for (let objKey of fCompute.objectKeys(tem[level])) {
                        const bkg = levelColor(level)
                        ans.push([{ cnt: id }, { cnt: level, bkg }, { cnt: objKey.replace('difficulty', '定数'), bkg }, { cnt: tem[level][objKey], bkg }])
                    }
                } else {
                    for (let objKey of fCompute.objectKeys(tem[level])) {
                        if (!Array.isArray(tem[level][objKey])) continue;
                        const incr = tem[level][objKey][0] < tem[level][objKey][1]
                        const bkg = levelColor(level)
                        ans.push([
                            { cnt: id },
                            { cnt: level, bkg },
                            { cnt: objKey.replace('difficulty', '定数'), bkg },
                            {
                                cnt: `${tem[level][objKey][0]} (${incr ? '+' : '-'}) ${tem[level][objKey][1]}`,
                                color: incr ? 'red' : 'green',
                                bkg
                            }
                        ])
                    }
                }
            }
        }

        for (let i = 0; i < ans.length; ++i) {
            for (let j = 0; j <= 0 && j < ans[i].length; ++j) {

                if (ans[i][j].cnt == ans[i + 1]?.[j]?.cnt && ans[i][j].row !== 0) {
                    let k = i;
                    while (ans[i][j].cnt == ans[k]?.[j]?.cnt) {
                        ans[k][j].row = 0;
                        ++k;
                    }
                    ans[i][j].row = k - i;
                }
            }
        }

        const newSongImg = await picmodle.common(e, 'newSong', {
            ans,
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur')
        });
        send.send_with_At(e, newSongImg);
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async live(e) {

        if (await getBanGroup.get(e, 'newSong')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }
        let ans = '直播速递：\n'
        try {
            let info = await makeRequest.liveInfo();
            ans += info;
        } catch (e) { ans += '发生错误，请稍后再试。' }

        send.send_with_At(e, ans)
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async table(e) {

        if (await getBanGroup.get(e, 'table')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let dif = Number(e.msg.match(/[0-9]+/)?.[0])

        if (!dif) {
            send.send_with_At(e, `请输入定数嗷！\n/格式：${Config.getUserCfg('config', 'cmdhead')} table <定数>`, true)
            return false
        }

        if (dif > getInfo.MAX_DIFFICULTY) {
            send.send_with_At(e, `定数已经超过最高的定数${getInfo.MAX_DIFFICULTY}了QAQ！`)
            return false
        }

        if (dif < 1) {
            send.send_with_At(e, `定数不能小于 1 QAQ！`)
            return false
        }

        let matchVersion = e.msg.match(/-v\s*(\S+)/i)?.[1];
        let matchVerCode = 0;
        if (matchVersion) {
            if (matchVersion.includes('.')) {
                if (!getInfo.versionInfoByLabel[matchVersion]) {
                    send.send_with_At(e, `未找到版本 ${matchVersion} 的相关信息QAQ！`)
                    return true
                }
                matchVerCode = getInfo.versionInfoByLabel[matchVersion].version_code
            } else {
                let verCodeNum = Number(matchVersion)
                if (!getInfo.versionInfoByCode[verCodeNum]) {
                    send.send_with_At(e, `未找到版本 ${matchVersion} 的相关信息QAQ！`)
                    return true
                }
                matchVerCode = verCodeNum
            }
        } else {
            matchVerCode = Version.phigrosVerNum
        }

        const versionInfo = getInfo.versionInfoByCode[matchVerCode]
        if (!versionInfo) {
            console.error(`[phi-plugin] 版本信息获取失败，versionCode: ${matchVerCode}`);
            send.send_with_At(e, `发生未知错误QAQ！请回报管理员！`)
            return true
        }

        const data = {
            title: {
                difficulty: dif,
                total: 0,
                version: versionInfo.version_label
            },
            /**@type {{difficulty: string, songs: {rank: string, illustration: string}[]}[]} */
            table: [],
            background: getInfo.getill(/**@type {any} */("ShineAfter.ADeanJocularACE.0"), 'blur')
        }

        const info_by_difficulty = getInfo.historyDifficultyByVerDifficulty[versionInfo.version_code];
        for (let i = 0; i < 10; ++i) {
            const difStr = Math.round((dif + i * 0.1) * 10) / 10;
            if (!info_by_difficulty[difStr.toFixed(1)]) continue;
            data.title.total += info_by_difficulty[difStr.toFixed(1)].length;
            data.table.push({
                difficulty: difStr.toFixed(1),
                songs: info_by_difficulty[difStr.toFixed(1)]?.map(chart => ({
                    rank: chart.rank,
                    illustration: getInfo.getill(chart.id, 'low'),
                })) || []
            })

        }

        send.send_with_At(e, await picmodle.common(e, 'table', data));

    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async comment(e) {

        if (await getBanGroup.get(e, 'comment') || !(await Config.getUserCfg('config', 'allowComment'))) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let save = await send.getsave_result(e);

        if (!save) {
            return true
        }

        const sessionToken = await getSave.get_user_token(e.user_id);

        if (!sessionToken) {
            send.send_with_At(e, `请先绑定sessionToken哦！`)
            return true
        }

        let msg = e.msg.replace(/[#/](.*?)(comment|cmt|评论|评价)(\s*)/, "");
        if (!msg) {
            send.send_with_At(e, `请指定曲名哦！\n格式：\n/${Config.getUserCfg('config', 'cmdhead')} cmt <曲名> <难度?>(换行)\n<内容>`)
            return true
        }


        let rankKind =/**@type {any} */(msg.match(/ (EZ|HD|IN|AT|LEGACY)\s*\n/i)?.[1] || '')
        rankKind = rankKind.toUpperCase()
        let rankNum = 0;
        switch (rankKind) {
            case 'EZ':
                rankNum = 0;
                break;
            case 'HD':
                rankNum = 1;
                break;
            case 'IN':
                rankNum = 2;
                break;
            case 'AT':
                rankNum = 3;
                break;
            case 'LGC':
            case 'LEGACY':
                rankNum = 4;
                break;
            default:
                rankNum = -1;
        }

        let nickname = msg.replace(/( (EZ|HD|IN|AT|LEGACY))?\s*\n[\s\S]*?$/i, '')

        let id = getInfo.fuzzysongsnick(nickname)?.[0]

        if (!id) {
            send.send_with_At(e, `未找到${nickname}的相关曲目信息QAQ\n如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！`, true)
            return true;
        }
        let songInfo = getInfo.info(id)
        if (!songInfo) {
            logger.error(`[phi-plugin] 评论时获取曲目信息失败，id: ${id}`);
            send.send_with_At(e, `发生未知错误QAQ！请回报管理员`);
            return true;
        }
        if (!songInfo.sp_vis) {
            if (!rankKind) {
                rankKind = 'IN';
                rankNum = 2;
            } else if (rankNum == -1) {
                send.send_with_At(e, `${rankKind} 不是一个难度QAQ！`);
                return true;
            } else if (!songInfo.chart?.[allLevel[rankNum]]) {
                send.send_with_At(e, `${id} 没有 ${allLevel[rankNum]} 这个难度QAQ！`);
                return true;
            }
        } else {
            rankKind = 'IN';
        }
        /** @type {string | undefined} */
        let comment = msg.match(/\n([\s\S]*)/)?.[1];
        if (!comment) {
            send.send_with_At(e, `不可发送空白内容w(ﾟДﾟ)w！`)
            return true
        }
        if (comment.length > 1000) {
            send.send_with_At(e, `太长了吧！你想干嘛w(ﾟДﾟ)w！`)
            return true
        }

        let songId = songInfo.id;

        if (Config.getUserCfg('config', 'openPhiPluginApi') && save.apiId) {
            try {
                /**@type {import("../model/makeRequest.js").APIUpdateCommentObject} */
                let cmtobj = {
                    songId: songInfo.id,
                    rank: rankKind,
                    apiUserId: save.apiId,
                    rks: save.saveInfo.summary.rankingScore,
                    score: 0,
                    acc: 0,
                    fc: false,
                    challenge: save.saveInfo.summary.challengeModeRank,
                    time: new Date().toISOString(),
                    comment: comment
                };
                let songRecord = save.getSongsRecord(songId);
                const record = songRecord?.[rankNum];
                if (!songInfo.sp_vis && record?.score) {
                    let { phi, b19_list } = await save.getB19(27)
                    let spInfo = '';

                    for (let i = 0; i < phi.length; ++i) {
                        const x = phi[i];
                        if (!x) continue;
                        if (x.id == songId && x.rank == rankKind) {
                            spInfo = `Perfect ${i + 1}`;
                            break;
                        }
                    }
                    if (!spInfo && record.score == 1000000) {
                        spInfo = 'All Perfect';
                    }
                    for (let i = 0; i < b19_list.length; ++i) {
                        if (b19_list[i].id == songId && b19_list[i].rank == rankKind) {
                            spInfo = spInfo ? spInfo + ` & Best ${i + 1}` : `Best ${i + 1}`;
                            break;
                        }
                    }
                    cmtobj = {
                        ...cmtobj,
                        score: record.score,
                        acc: record.acc,
                        fc: record.fc,
                        spInfo,
                    }
                };
                await makeRequest.addComment({
                    token: sessionToken,
                    data: { comment: cmtobj }
                });
                send.send_with_At(e, `在线评论成功！φ(゜▽゜*)♪`);
                return true;
            } catch (error) {
                logger.warn(`[phi-plugin] API评论失败`, error)
            }
        }
        /**@type {import("../model/getComment.js").commentObject} */
        let cmtobj = {
            sessionToken: save.session,
            userObjectId: save.saveInfo.objectId,
            rks: save.saveInfo.summary.rankingScore,
            rank: rankKind,
            score: 0,
            acc: 0,
            fc: false,
            challenge: save.saveInfo.summary.challengeModeRank,
            time: new Date(),
            comment: comment,
            spInfo: '',
        };
        let songRecord = save.getSongsRecord(songId);
        const record = songRecord?.[rankNum];
        if (!songInfo.sp_vis && record?.score) {
            let { phi, b19_list } = await save.getB19(27)
            let spInfo = '';

            for (let i = 0; i < phi.length; ++i) {
                const x = phi[i];
                if (!x) continue;
                if (x.id == songId && x.rank == rankKind) {
                    spInfo = `Perfect ${i + 1}`;
                    break;
                }
            }
            if (!spInfo && record.score == 1000000) {
                spInfo = 'All Perfect';
            }
            for (let i = 0; i < b19_list.length; ++i) {
                if (b19_list[i].id == songId && b19_list[i].rank == rankKind) {
                    spInfo = spInfo ? spInfo + ` & Best ${i + 1}` : `Best ${i + 1}`;
                    break;
                }
            }
            cmtobj = {
                ...cmtobj,
                score: record.score,
                acc: record.acc,
                fc: record.fc,
                spInfo,
            }
        };
        if (getComment.add(songId, cmtobj)) {
            send.send_with_At(e, `评论成功！φ(゜▽゜*)♪`);
        } else {
            send.send_with_At(e, `遇到未知错误QAQ！`);
        }

        return true;
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async recallComment(e) {
        if (await getBanGroup.get(e, 'recallComment') || !(await Config.getUserCfg('config', 'allowComment'))) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }
        let save;
        const sessionToken = await getSave.get_user_token(e.user_id);
        if (!e.isMaster) {
            save = await send.getsave_result(e);
            if (!save) {
                return true;
            }

            if (!sessionToken) {
                send.send_with_At(e, `请先绑定sessionToken哦！`)
                return true
            }
        }

        let commentId = e.msg.match(/[0-9]+/)?.[0];

        if (!commentId) {
            send.send_with_At(e, `请输入评论ID嗷！\n格式：/${Config.getUserCfg('config', 'cmdhead')} recmt <评论ID>`);
            return true;
        }

        let comment = getComment.getByCommentId(commentId)
        if (!comment) {
            if (Config.getUserCfg('config', 'openPhiPluginApi')) {
                try {
                    await makeRequest.delComment({ token: sessionToken, comment_id: commentId });
                    send.send_with_At(e, `删除在线评论成功！φ(゜▽゜*)♪`);
                    return true;
                } catch (error) {
                    logger.warn(`[phi-plugin] API删除评论失败`, error)
                }
            }
            send.send_with_At(e, `没有找到ID为${commentId}的评论QAQ！`);
            return true;
        }

        if (!e.isMaster && !(comment.sessionToken == sessionToken || comment.userObjectId == save?.saveInfo.objectId)) {
            send.send_with_At(e, `您没有权限操作这条评论捏(。﹏。)`);
            return true;
        }

        getComment.del(commentId) ?
            send.send_with_At(e, `删除成功！`) :
            send.send_with_At(e, `删除失败QAQ！`);
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async myComment(e) {
        if (await getBanGroup.get(e, 'myComment')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let save = await send.getsave_result(e);

        if (!save) {
            return true
        }

        if (Config.getUserCfg('config', 'openPhiPluginApi') && (save.session || save.apiId)) {
            try {
                const comments = await makeRequest.getCommentsByUserId(makeRequestFnc.makePlatform(e));

                if (comments && comments.length > 0) {
                    let msg = `您的评论列表：\nID | 曲目 | 难度 | 内容 | 时间\n`;
                    for (let comment of comments) {
                        msg += `${comment.id} | ${comment.songId} | ${comment.rank} | ${comment.comment} | ${fCompute.formatDate(comment.time)}\n`
                    }
                    send.send_with_At(e, msg);
                } else {
                    send.send_with_At(e, `您还没有评论哦！`);
                }
                return true;
            } catch (error) {
                logger.warn(`[phi-plugin] 获取用户评论失败`, error)
            }
        }
        return false;
    }

    // /**
    //  * 
    //  * @param {botEvent} e 
    //  * @returns 
    //  */
    // async chart(e) {
    //     if (await getBanGroup.get(e, 'chart')) {
    //         send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
    //         return false
    //     }

    //     let msg = e.msg.replace(/[#/](.*?)(chart)(\s*)/, "")

    //     /** @type {levelKind} */
    //     let rank = /** @type {levelKind} */(msg.match(/\s+(EZ|HD|IN|AT)/i)?.[1] || 'IN')
    //     rank = /** @type {levelKind} */(rank.toUpperCase())
    //     msg = msg.replace(/\s+(EZ|HD|IN|AT)/i, '')

    //     let ids = getInfo.fuzzysongsnick(msg)
    //     if (!ids) {
    //         send.send_with_At(e, `未找到${msg}的相关曲目信息QAQ！如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！`, true)
    //         return true
    //     }
    //     let info = getInfo.info(ids, true)
    //     if (!info) {
    //         send.send_with_At(e, `未找到${ids}的相关曲目信息QAQ！如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！`, true)
    //         return true
    //     }
    //     if (!info.chart[rank]) {
    //         send.send_with_At(e, `${ids} 没有 ${rank} 这个难度QAQ！`)
    //         return true
    //     }

    //     let chart = info.chart[rank]

    //     let allowChartTag = await Config.getUserCfg('config', 'allowChartTag')

    //     let data = {
    //         illustration: info.illustration,
    //         song: info.song,
    //         length: info.length,
    //         rank: rank,
    //         difficulty: chart.difficulty,
    //         charter: chart.charter,
    //         tap: chart.tap,
    //         drag: chart.drag,
    //         hold: chart.hold,
    //         flick: chart.flick,
    //         combo: chart.combo,
    //         distribution: chart.distribution,
    //         tip: allowChartTag ? `发送 /${Config.getUserCfg('config', 'cmdhead')} addtag <曲名> <难度> <tag> 来添加标签哦！` : `标签词云功能暂时被管理员禁用了哦！快去联系BOT主开启吧！`,
    //         chartLength: `${Math.floor(chart.maxTime / 60)}:${Math.floor(chart.maxTime % 60).toString().padStart(2, '0')}`,
    //         words: allowChartTag ? getChartTag.get(info.id, rank) : '',
    //     }
    //     e.reply(await picmodle.common(e, 'chartInfo', data))
    // }

    // /**
    //  * 
    //  * @param {botEvent} e 
    //  * @returns 
    //  */
    // async addtag(e) {
    //     if (await getBanGroup.get(e, 'addtag') || !(await Config.getUserCfg('config', 'allowChartTag'))) {
    //         send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
    //         return false
    //     }

    //     /** @type {'addtag'|'subtag'|'retag'} */
    //     let op = /** @type {'addtag'|'subtag'|'retag'} */(e.msg.match(/(addtag|subtag|retag)/i)?.[1])

    //     let msg = e.msg.replace(/[#/](.*?)(addtag|subtag|retag)(\s*)/, "")

    //     /** @type {levelKind} */
    //     let rank = msg.match(/\s+(EZ|HD|IN|AT)\s+/i)?.[1] || 'IN'
    //     rank = rank.toUpperCase()
    //     msg = msg.replace(/\s+(EZ|HD|IN|AT)/i, '')

    //     let tag = msg.match(/(?<=\s)[^\s]+$/)?.[0]
    //     if (!tag) {
    //         send.send_with_At(e, `请输入标签哦！\n格式：/${Config.getUserCfg('config', 'cmdhead')} ${op} <曲名> <rank> <tag>`)
    //         return true
    //     }
    //     if (tag.length > 6) {
    //         send.send_with_At(e, `${tag} 太长了呐QAQ！请限制在6个字符以内嗷！`)
    //         return true
    //     }
    //     msg = msg.replace(tag, '')
    //     let song = getInfo.fuzzysongsnick(msg)?.[0]
    //     if (!song) {
    //         send.send_with_At(e, `未找到${msg}的相关曲目信息QAQ！如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！`, true)
    //         return true
    //     }
    //     let info = getInfo.info(song, true)
    //     if (!info.chart[rank]) {
    //         send.send_with_At(e, `${song} 没有 ${rank} 这个难度QAQ！`)
    //         return true
    //     }
    //     if (!tag) {
    //         send.send_with_At(e, `请输入标签哦！\n格式：/${Config.getUserCfg('config', 'cmdhead')} ${op} <曲名> <rank> <tag>`)
    //         return true
    //     }
    //     let callback = false;
    //     switch (op) {
    //         case 'addtag':
    //             callback = getChartTag.add(info.id, tag, rank, true, e.user_id)
    //             break;
    //         case 'subtag':
    //             callback = getChartTag.add(info.id, tag, rank, false, e.user_id)
    //             break;
    //         case 'retag':
    //             callback = getChartTag.cancel(info.id, tag, rank, e.user_id)
    //             break;
    //     }
    //     if (callback) {
    //         send.send_with_At(e, `操作成功！`)
    //     } else {
    //         send.send_with_At(e, `操作失败QAQ！`)
    //     }
    // }

}

/**
 * 获取歌曲信息图片
 * @param {number} page 
 * @param {boolean} addComment 
 * @param {idString} id 
 * @param {botEvent} e
 * @returns 
 */
async function songInfo(page, addComment, id, e) {
    let infoData = getInfo.info(id);
    /**@type {any} */
    let data = {
        ...infoData,
        comment: undefined,
    };
    if (!infoData) {
        logger.error(`[phi-plugin] songInfo: 未找到id为${id}的歌曲信息`);
        return `发生未知错误QAQ！请回报管理员！`;
    }
    if (await Config.getUserCfg('config', 'allowComment') && (addComment || page)) {
        let commentData;
        if (Config.getUserCfg('config', 'openPhiPluginApi')) {
            commentData = await makeRequest.getCommentsBySongId({ song_id: infoData.id });
            for (const item of commentData) {
                item.PlayerId = (item.PlayerId && item.PlayerId.length > 15) ? item.PlayerId.slice(0, 12) + '...' : item.PlayerId;
                item.avatar = getInfo.idgetavatar(item.avatar || '');
                item.comment = fCompute.convertRichText(item.comment);
                item.time = fCompute.formatDate(item.time);
                // @ts-ignore
                item.thisId = item.thisId || item.id;
            }
        } else {
            commentData = getComment.get(infoData.id);
            for (let item of commentData) {
                let save = item.sessionToken ? await getSave.getSaveBySessionToken(item.sessionToken) : null;
                if (!save) {
                    item.thisId && getComment.del(`${item.thisId}`);
                    commentData.splice(commentData.indexOf(item), 1);
                    continue;
                }
                item.PlayerId = save.saveInfo.PlayerId.length > 15 ? save.saveInfo.PlayerId.slice(0, 12) + '...' : save.saveInfo.PlayerId;
                item.avatar = getInfo.idgetavatar(save.gameuser.avatar);
                item.comment = fCompute.convertRichText(item.comment);
                // @ts-ignore
                item.time = fCompute.formatDate(item.time);
            }
        }
        commentData.sort((a, b) => {
            return new Date(b.time).getTime() - new Date(a.time).getTime();
        });
        if (!page) page = 1
        let commentsAPage = Config.getUserCfg('config', 'commentsAPage') || 1
        let maxPage = Math.ceil(commentData.length / commentsAPage)
        page = Math.max(Math.min(page, maxPage), 1)
        data = {
            ...infoData,
            comment: {
                command: `当前共有${commentData.length}条评论，第${Math.min(page, maxPage)}页，共${maxPage}页，发送/${Config.getUserCfg('config', 'cmdhead')} cmt <曲名> <定级?>(换行)<内容> 进行评论，-p <页码> 选择页数`,
                // @ts-ignore
                list: commentData.slice((commentsAPage * (page - 1)), commentsAPage * page - 1)
            }
        };
    }
    return await picmodle.common(e, 'atlas', data);
}

/**
 * RandBetween
 * @param {number} top 随机值上界
 */
function randbt(top, bottom = 0) {
    return Math.floor((Math.random() * (top - bottom + 1))) + bottom
}

/**
 * 
 * @param {number} clgNum 
 * @param {Record<number, Chart[]>} chartList 
 * @returns 
 */
function randClg(clgNum, chartList) {
    let difList = null;
    let rand1 = [], rand2 = []
    // console.info(getInfo.MAX_DIFFICULTY)
    for (let i = 1; i <= Math.min(getInfo.MAX_DIFFICULTY, clgNum - 2); i++) {
        // console.info(i, chartList[i])
        if (chartList[i]) {
            rand1.push(i)
            rand2.push(i)
        }
    }
    rand1 = fCompute.randArray(rand1);
    rand2 = fCompute.randArray(rand2);
    // console.info(clgNum, rand1, rand2)
    for (let i in rand1) {
        // console.info(rand1[i])
        for (let j in rand2) {
            let a = rand1[i]
            let b = rand2[j]
            if (a + b >= clgNum) continue
            let c = clgNum - a - b
            /** @type {Record<number, number>} */
            let tem = {}
            tem[a] = 1
            tem[b] ? ++tem[b] : tem[b] = 1
            tem[c] ? ++tem[c] : tem[c] = 1
            let flag = false
            for (let i in tem) {
                if (!chartList[i] || tem[i] > chartList[i].length) {
                    flag = true
                    break
                }
            }
            if (flag) continue
            difList = [a, b, c]
            break;
        }
        if (difList) break;
    }
    if (!difList) {
        return;
    }
    // console.info(difList)
    let ans = []
    for (let i in difList) {
        if (!chartList[difList[i]]) {
            logger.error(difList[i], chartList)
        }
        let tem = chartList[difList[i]].splice(fCompute.randBetween(0, chartList[difList[i]].length - 1), 1)[0]
        ans.push(tem)
    }
    // console.info(clgNum, ans)
    return ans;
}

/**
 * 
 * @param {any} ask 
 * @param {Chart} chart 
 * @returns 
 */
function chartMatchReq(ask, chart) {
    if (ask.isask[LevelNum[chart.rank]]) {
        if (chart.difficulty >= ask.range[0] && chart.difficulty <= ask.range[1]) {
            return true
        }
    }
    // console.info(ask, chart)
    return false
}

/**
 * 
 * @param {levelKind} level 
 * @returns 
 */
function levelColor(level) {
    switch (level) {
        case 'EZ': {
            return '#57a80033'
        }
        case 'HD': {
            return '#007fad33'
        }
        case 'IN': {
            return '#ff000033'
        }
        case 'AT': {
            return '#45454533'
        }
    }
}