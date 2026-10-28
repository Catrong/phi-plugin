// import get from '../model/getdata.js'
import Config from '../components/Config.js'
import send from '../model/render/send.js'
import getInfo from '../model/game/getInfo.js'
import getPic from '../model/render/getPic.js'
import picmodle from '../model/render/picmodle.js'
import fCompute from '../model/game/fCompute.js'
import getBanGroup from '../model/user/getBanGroup.js';
import { allLevel, Level, LevelNum } from '../model/game/constNum.js'
import getComment from '../model/game/getComment.js'
import getSave from '../model/save/getSave.js'
import { UserCredentials } from '../model/user/userCredentials.js'
import Version from '../components/Version.js'
import makeRequest from '../model/api/makeRequest.js'
import phiPluginBase from '../components/baseClass.js'
import logger from '../components/Logger.js'
import SongsInfo from '../model/game/SongsInfo.js'
import Chart from "../model/game/Chart.js"
import getNotes from "../model/user/getNotes.js"
import { buildSearchTable, searchSongs } from '../model/game/songSearch.js'
import { canUseApi } from '../model/user/apiPermission.js'
import TapInfo from "../model/integrations/getInfoFromTap.js"
import { sendMessage } from '../model/render/message.js'
import { phisongMessages } from '../model/render/messages.js'

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
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)newlog$`,
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
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(dif[Hh]is(tory)?|历史定数).*$`,
                    fnc: 'difHis'
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
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)newnotice$`,
                    fnc: 'newNotice'
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
            sendMessage(e, phisongMessages.song.banned, { at: true })
            return false
        }

        let msg = e.msg.replace(/[#/](.*?)(曲|song)(\s*)/, "")
        let addComment = msg.match(/\s+-comment/)?.[0] ? true : false;
        if (addComment) msg = msg.replace(/\s+-comment/, "")
        let page = msg.match(/\s+-p\s+([0-9]+)/)?.[1] ? Number(msg.match(/\s+-p\s+([0-9]+)/)?.[1]) : 0;
        msg = msg.replace(/\s+-p\s+([0-9]+)/, "")
        if (!msg) {
            sendMessage(e, phisongMessages.song.specifySong(), { at: true })
            return true
        }
        let ids = getInfo.fuzzysongsnick(msg)
        if (ids[0]) {
            if (!ids[1]) {
                sendMessage(e, phisongMessages.song.image(await songInfo(page, addComment, ids[0], e)), { at: true })
            } else {
                this.choseMutiNick(e, ids, { page, addComment }, async (e, id, options) => {
                    sendMessage(e, phisongMessages.song.image(await songInfo(options.page, options.addComment, id, e)), { at: true });
                })
            }
        } else {
            sendMessage(e, phisongMessages.song.notFound(msg), { at: true })
        }
        return true
    }

    /**
     * 曲目检索，结果以通用表格图片输出
     * @param {botEvent} e
     */
    async search(e) {

        if (await getBanGroup.get(e, 'search')) {
            sendMessage(e, phisongMessages.search.banned, { at: true })
            return false
        }

        const input = e.msg.replace(/[#/](.*?)(查找|检索|search)(\s*)/g, "")
        const { filters, hits } = searchSongs(input)
        const table = buildSearchTable(hits, filters, Config.getUserCfg('config', 'listScoreMaxNum'))
        const pluginData = await getNotes.getNotesData(e.user_id)

        sendMessage(e, phisongMessages.search.image(await picmodle.tableImage(e, {
            pageTitle: phisongMessages.search.title.text,
            pageDescription: phisongMessages.search.summary(filters).text,
            notice: table.truncated ? phisongMessages.search.truncated(table.total, table.shown).text : '',
            emptyText: phisongMessages.search.empty.text,
            footer: table.total ? phisongMessages.search.footer(table.total).text : '',
            columns: table.columns,
            rows: table.rows,
            background: getInfo.getill(getInfo.illlist[fCompute.randInt(0, getInfo.illlist.length - 1)], 'blur'),
            theme: pluginData?.theme || 'default'
        })), { at: true })
        return true
    }


    /**
     * 设置别名
     * @param {botEvent} e
     */
    async setnick(e) {
        if (!(e.is_admin || e.isMaster)) {
            sendMessage(e, phisongMessages.setnick.adminOnly)
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
                sendMessage(e, phisongMessages.setnick.songNotFound(msg[0]))
                return true
            }
            if (P0Id in getInfo.fuzzysongsnick(parts[1], 1)) {
                /**已经添加过该别名 */
                sendMessage(e, phisongMessages.setnick.aliasExists(P0Id, parts[1]))
                return true
            } else {
                getInfo.setnick(P0Id, parts[1])
                sendMessage(e, phisongMessages.setnick.done)
            }
        } else {
            sendMessage(e, phisongMessages.setnick.formatError)
        }
        return true
    }

    /**
     * 获取曲绘
     * @param {botEvent} e
     */
    async ill(e) {

        if (await getBanGroup.get(e, 'ill')) {
            sendMessage(e, phisongMessages.ill.banned, { at: true })
            return false
        }

        let msg = e.msg.replace(/[#/](.*?)(曲绘|ill|Ill)(\s*)/, "")
        if (!msg) {
            sendMessage(e, phisongMessages.ill.specifySong(), { at: true })
            return true
        }
        let ids = getInfo.fuzzysongsnick(msg)
        if (ids[0]) {
            let msgRes

            if (!ids[1]) {
                sendMessage(e, phisongMessages.ill.image(await getPic.GetSongsIllAtlas(e, ids[0])), { at: true })
            } else {
                this.choseMutiNick(e, ids, {}, async (e, id) => {
                    sendMessage(e, phisongMessages.ill.image(await getPic.GetSongsIllAtlas(e, id)), { at: true });
                })
            }
        } else {
            sendMessage(e, phisongMessages.ill.notFound(msg), { at: true })
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
            sendMessage(e, phisongMessages.randmic.banned, { at: true })
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
                    sendMessage(e, phisongMessages.randmic.plusRangeUnsupported(), { at: true, quote: true })
                    return true
                } else {
                    bottom = Number(rank[0].replace('+', ''))
                    top = 100
                }
            } else if (rank[0].includes('-') && !rank[1]) {
                const tb = Number(rank[0].replace('-', ''))
                if (isNaN(tb)) {
                    sendMessage(e, phisongMessages.randmic.invalidBelow(rank[0]), { at: true, quote: true })
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
                        sendMessage(e, phisongMessages.randmic.invalidRange(rank[0], rank[1]), { at: true, quote: true })
                        return true
                    }
                    top = Math.max(tb, tt)
                    bottom = Math.min(tb, tt)
                } else {
                    if (isNaN(tb)) {
                        sendMessage(e, phisongMessages.randmic.invalidValue(rank[0]), { at: true, quote: true })
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
                            illustration: getInfo.getill(id, 'common', level),
                            song: getInfo.ori_info[id].song,
                            illustrator: getInfo.ori_info[id].illustrator,
                            composer: getInfo.ori_info[id].composer,
                        })
                    }
                }
            }
        }

        if (!songsname[0]) {
            sendMessage(e, phisongMessages.randmic.notFound(bottom, top, `${isask[0] ? `${Level[0]} ` : ''}${isask[1] ? `${Level[1]} ` : ''}${isask[2] ? `${Level[2]} ` : ''}${isask[3] ? `${Level[3]} ` : ''}`), { at: true, quote: true })
            return true
        }

        let result = songsname[randbt(songsname.length - 1)]

        sendMessage(e, phisongMessages.randmic.image(await picmodle.rand(e, result)), { at: true })
        return true
    }

    /**
     * 查询歌曲别名
     * @param {botEvent} e
     */
    async alias(e) {

        if (await getBanGroup.get(e, 'alias')) {
            sendMessage(e, phisongMessages.alias.banned, { at: true })
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
            sendMessage(e, phisongMessages.alias.info(getPic.getIll(id), id, info?.song, nicks), { at: true })
        }

        if (ids[0]) {
            if (!ids[1]) {
                makeNickMsg(e, ids[0])
            } else {
                this.choseMutiNick(e, ids, {}, (e, id) => makeNickMsg(e, id));
            }
        } else {
            sendMessage(e, phisongMessages.alias.notFound(msg), { at: true, quote: true })
        }
    }

    /**
     * 计算等效rks
     * @param {botEvent} e
     */
    async comrks(e) {

        if (await getBanGroup.get(e, 'comrks')) {
            sendMessage(e, phisongMessages.comrks.banned, { at: true })
            return false
        }

        let msg = e.msg.replace(/^[#/].*(com|计算)\s*/, '')
        let data = msg.split(' ')
        let data0 = Number(data[0])
        let data1 = Number(data[1])
        if (data && data1 && data0 > 0 && data0 <= 18 && data1 > 0 && data1 <= 100) {
            sendMessage(e, phisongMessages.comrks.result(data0, data1, fCompute.rks(Number(data1), Number(data0))), { at: true, quote: true })
            return true
        } else {
            sendMessage(e, phisongMessages.comrks.formatError(), { at: true })
            return false
        }
    }

    /**
     * 随机tips
     * @param {botEvent} e
     */
    async tips(e) {

        if (await getBanGroup.get(e, 'tips')) {
            sendMessage(e, phisongMessages.tips.banned, { at: true })
            return false
        }

        sendMessage(e, phisongMessages.tips.text(getInfo.tips[fCompute.randInt(0, getInfo.tips.length - 1)]), { at: true })
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async randClg(e) {
        if (await getBanGroup.get(e, 'randClg')) {
            sendMessage(e, phisongMessages.randClg.banned, { at: true })
            return false
        }

        let songReg = /[\(（].*[\)）]/
        let arg = e.msg.replace(/^.*?randClg\s*/i, '')
        let songReq = arg.match(songReg)?.[0].replace(/[\(\)（）]/g, "") ?? ""
        arg = arg.replace(arg.match(songReg)?.[0] ?? "", "")

        let songAsk = fCompute.match_request(songReq)

        // console.info(songAsk, songReq)

        // 课题总值上限由当前定数表推算，不再写死旧版本的 51
        let { isask, range } = fCompute.match_request(arg, getInfo.getSongLimits().maxChallenge)

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
            sendMessage(e, phisongMessages.randClg.notFound, { at: true })
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
                    illustration: getInfo.getill(info.id, 'common', res[i].rank),
                    ...info.chart[res[i].rank]
                })
            }

            sendMessage(e, phisongMessages.randClg.image(await picmodle.common(e, 'clg', {
                songs,
                tot_clg: Math.floor(res[0].difficulty) + Math.floor(res[1].difficulty) + Math.floor(res[2].difficulty),
                background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
                theme: plugin_data?.theme || 'star',
            })), { at: true })

            // ans += `${getInfo.idgetsong(res[0].id)} ${res[0].rank} ${res[0].difficulty}\n`
            // ans += `${getInfo.idgetsong(res[1].id)} ${res[1].rank} ${res[1].difficulty}\n`
            // ans += `${getInfo.idgetsong(res[2].id)} ${res[2].rank} ${res[2].difficulty}\n`
            // ans += `difficulty: ${Math.floor(res[0].difficulty) + Math.floor(res[1].difficulty) + Math.floor(res[2].difficulty)}`
        } else {
            sendMessage(e, phisongMessages.randClg.notFound, { at: true })
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
            sendMessage(e, phisongMessages.newSong.banned, { at: true })
            return false
        }
        /**
         * @type {{ cnt: any; col?: number; row?: number; color?: string; bkg?: string; }[][]}
         */
        const ans = []
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
        /** @type {string | undefined} */
        let version;
        /** @type {string | undefined} */
        let updateInfo;
        try {
            const info = await TapInfo.PgrUpdateInfo();
            version = info?.[0]?.version
            updateInfo = info?.[0]?.rawHtml?.replace(/<\/?div>/g, '')?.replace(/<br\/>/g, '\n')
        } catch (error) {
            logger.warn('[phi-plugin] 获取新曲更新说明失败', error)
        }
        await sendMessage(e, phisongMessages.newSong.content(newSongImg, version, updateInfo, Version.phigros), { at: true });
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async table(e) {

        if (await getBanGroup.get(e, 'table')) {
            sendMessage(e, phisongMessages.table.banned, { at: true })
            return false
        }

        const difMatch = e.msg.match(/[0-9]+/)
        let dif = Number(difMatch?.[0])

        if (!difMatch) {
            sendMessage(e, phisongMessages.table.specifyDifficulty(), { at: true, quote: true })
            return false
        }

        if (dif > getInfo.MAX_DIFFICULTY) {
            sendMessage(e, phisongMessages.table.difficultyTooHigh(getInfo.MAX_DIFFICULTY), { at: true })
            return false
        }

        // 定数下限为 0（4.0.1 起存在 0.5 定数的谱面，向下取整为 0 级）

        let matchVersion = e.msg.match(/-v\s*(\S+)/i)?.[1];
        let matchVerCode = 0;
        if (matchVersion) {
            if (matchVersion.includes('.')) {
                if (!getInfo.versionInfoByLabel[matchVersion]) {
                    sendMessage(e, phisongMessages.table.versionNotFound(matchVersion), { at: true })
                    return true
                }
                matchVerCode = getInfo.versionInfoByLabel[matchVersion].version_code
            } else {
                let verCodeNum = Number(matchVersion)
                if (!getInfo.versionInfoByCode[verCodeNum]) {
                    sendMessage(e, phisongMessages.table.versionNotFound(matchVersion), { at: true })
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
            sendMessage(e, phisongMessages.table.unknownError, { at: true })
            return true
        }

        let pluginData = await getNotes.getNotesData(e.user_id)
        const data = {
            title: {
                difficulty: dif,
                total: 0,
                version: versionInfo.version_label
            },
            /**@type {{difficulty: string, songs: {rank: string, illustration: string}[]}[]} */
            table: [],
            background: getInfo.getill(getInfo.illlist[Math.floor((Math.random() * (getInfo.illlist.length - 1)))], 'blur'),
            theme: pluginData?.theme || 'star'
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
                    illustration: getInfo.getill(chart.id, 'low', chart.rank),
                })) || []
            })

        }

        sendMessage(e, phisongMessages.table.image(await picmodle.common(e, 'table', data)), { at: true });

    }

    /**
     * /difhis(tory) <song>
     * @param {botEvent} e 
     * @returns 
     */
    async difHis(e) {
        if (await getBanGroup.get(e, 'table')) {
            sendMessage(e, phisongMessages.difHis.banned, { at: true })
            return false
        }
        const songstr = e.msg.replace(fCompute.getRexWithCmdHead('difhis(tory)?'), '')
        this.choseMutiNick(e, getInfo.fuzzysongsnick(songstr), {}, async (e, id) => {
            const difhistory = getInfo.historyDifficultyBySongId[id];
            const verinfo = getInfo.versionInfoByCode;
            if (!difhistory) {
                sendMessage(e, phisongMessages.difHis.notFound(songstr), { at: true })
                return
            }

            let minDateNum = Infinity;
            let minDateInfo = null;

            /**@type {Record<levelKind, {version: string, date: string, dateNum: number, difficulty: number }[]>} */
            const hisData = { AT: [], IN: [], HD: [], EZ: [] };

            for (let v of fCompute.objectKeys(difhistory)) {
                const vinfo = verinfo[v];
                const vdata = difhistory[v];
                if (!vinfo || !vdata) continue;
                for (let l of fCompute.objectKeys(vdata)) {
                    hisData[l].push({
                        version: vinfo.version_label,
                        date: fCompute.formatDate(vinfo.update_date * 1000, 'YYYY-MM-DD'),
                        dateNum: vinfo.update_date,
                        difficulty: vdata[l],
                    })
                    if (vinfo.update_date < minDateNum) {
                        minDateNum = vinfo.update_date;
                        minDateInfo = vinfo;
                    }
                }
            }
            /**
             * 折线图数据
             * @type {{color: string, data: {x: number, y: number}[]}[]}
             */
            const lineData = []

            for (let l of Level) {
                if (!hisData[l].length) continue;
                hisData[l] = hisData[l].sort((a, b) => b.dateNum - a.dateNum);

                for (let i = hisData[l].length - 1; i > 0; --i) {
                    if (i < hisData[l].length - 1 && hisData[l][i].difficulty === hisData[l][i + 1].difficulty) {
                        hisData[l].splice(i, 1);
                        ++i;
                    }
                }
                lineData.push({
                    color: levelColor(l).replace('33', ''),
                    data: hisData[l].map(d => ({
                        x: d.dateNum,
                        y: d.difficulty,
                        xLabel: 'v' + d.version,
                        yLabel: d.difficulty.toFixed(1),
                        visX: true,
                        visY: true,
                    }))
                })
            }

            const picData = {
                illustration: getInfo.getill(id),
                song: getInfo.info(id)?.song || id,
                updateDate: fCompute.formatDate(minDateNum * 1000, 'YYYY-MM-DD'),
                updateLable: minDateInfo?.version_label || '',
                hisData,
                lineData: JSON.stringify(lineData),
                theme: (await getNotes.getNotesData(e.user_id))?.theme || 'star',
            }

            sendMessage(e, phisongMessages.difHis.image(await picmodle.common(e, 'difficultyHistory', picData)), { at: true });
        })
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async comment(e) {

        const credentials = UserCredentials.fromEvent(e)

        if (await getBanGroup.get(e, 'comment') || !(await Config.getUserCfg('config', 'allowComment'))) {
            sendMessage(e, phisongMessages.comment.banned, { at: true })
            return false
        }

        let save = await send.getsave_result(e);

        if (!save) {
            return true
        }

        const sessionToken = await credentials.getSessionToken()

        if (!sessionToken) {
            sendMessage(e, phisongMessages.comment.needToken, { at: true })
            return true
        }

        let msg = e.msg.replace(/[#/](.*?)(comment|cmt|评论|评价)(\s*)/, "");
        if (!msg) {
            sendMessage(e, phisongMessages.comment.specifySong(), { at: true })
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
            sendMessage(e, phisongMessages.comment.notFound(nickname), { at: true, quote: true })
            return true;
        }
        let songInfo = getInfo.info(id)
        if (!songInfo) {
            logger.error(`[phi-plugin] 评论时获取曲目信息失败，id: ${id}`);
            sendMessage(e, phisongMessages.comment.unknownError, { at: true })
            return true;
        }
        if (!songInfo.sp_vis) {
            if (!rankKind) {
                rankKind = 'IN';
                rankNum = 2;
            } else if (rankNum == -1) {
                sendMessage(e, phisongMessages.comment.invalidRank(rankKind), { at: true })
                return true;
            } else if (!songInfo.chart?.[allLevel[rankNum]]) {
                sendMessage(e, phisongMessages.comment.noDifficulty(id, allLevel[rankNum]), { at: true })
                return true;
            }
        } else {
            rankKind = 'IN';
        }
        /** @type {string | undefined} */
        let comment = msg.match(/\n([\s\S]*)/)?.[1];
        if (!comment) {
            sendMessage(e, phisongMessages.comment.empty, { at: true })
            return true
        }
        if (comment.length > 1000) {
            sendMessage(e, phisongMessages.comment.tooLong, { at: true })
            return true
        }

        let songId = songInfo.id;

        if (save.apiId && await canUseApi(e)) {
            const apiUserId = save.apiId
            /**@type {import("../model/api/makeRequest.js").APIUpdateCommentObject} */
            let cmtobj = {
                songId: songInfo.id,
                rank: rankKind,
                apiUserId,
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
                let { phi, b19_list } = await save.getB19(e, 27)
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
            const apiAddResult = await credentials.addComment(cmtobj)
            if (apiAddResult) {
                sendMessage(e, phisongMessages.comment.onlineSuccess, { at: true })
                return true;
            }
        }
        /**@type {import("../model/game/getComment.js").commentObject} */
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
            let { phi, b19_list } = await save.getB19(e, 27)
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
            sendMessage(e, phisongMessages.comment.success, { at: true })
        } else {
            sendMessage(e, phisongMessages.comment.failed, { at: true })
        }

        return true;
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async recallComment(e) {
        const credentials = UserCredentials.fromEvent(e)
        if (await getBanGroup.get(e, 'recallComment') || !(await Config.getUserCfg('config', 'allowComment'))) {
            sendMessage(e, phisongMessages.recallComment.banned, { at: true })
            return false
        }
        let save;
        const sessionToken = await credentials.getSessionToken()
        if (!e.isMaster) {
            save = await send.getsave_result(e);
            if (!save) {
                return true;
            }

            if (!sessionToken) {
                sendMessage(e, phisongMessages.comment.needToken, { at: true })
                return true
            }
        }

        let commentId = e.msg.match(/[0-9]+/)?.[0];

        if (!commentId) {
            sendMessage(e, phisongMessages.recallComment.specifyId(), { at: true })
            return true;
        }

        let comment = getComment.getByCommentId(commentId)
        if (!comment) {
            if (await canUseApi(e)) {
                const delResult = await credentials.deleteComment(commentId)
                if (delResult) {
                    sendMessage(e, phisongMessages.recallComment.onlineDeleted, { at: true })
                    return true;
                }
            }
            sendMessage(e, phisongMessages.recallComment.notFound(commentId), { at: true })
            return true;
        }

        if (!e.isMaster && !(comment.sessionToken == sessionToken || comment.userObjectId == save?.saveInfo.objectId)) {
            sendMessage(e, phisongMessages.recallComment.noPermission, { at: true })
            return true;
        }

        getComment.del(commentId) ?
            sendMessage(e, phisongMessages.recallComment.deleted, { at: true }) :
            sendMessage(e, phisongMessages.recallComment.deleteFailed, { at: true })
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async myComment(e) {
        const credentials = UserCredentials.fromEvent(e)
        if (await getBanGroup.get(e, 'myComment')) {
            sendMessage(e, phisongMessages.myComment.banned, { at: true })
            return false
        }

        let save = await send.getsave_result(e);

        if (!save) {
            return true
        }

        if ((save.session || save.apiId) && await canUseApi(e)) {
            const comments = await credentials.getCommentsByUserId()
            if (comments) {

                if (comments && comments.length > 0) {
                    sendMessage(e, phisongMessages.myComment.content(comments, fCompute.formatDate), { at: true });
                } else {
                    sendMessage(e, phisongMessages.myComment.empty, { at: true })
                }
                return true;
            }
        }
        return false;
    }

    /**
     * 获取Phigros最新公告
     * @param {*} e BotEvent
     */
    async newNotice(e) {
        const info = await TapInfo.PgrTapNotice(1);
        if (info) {
            const img = await picmodle.common(e, 'newnotice', info);
            sendMessage(e, phisongMessages.notice.image(img), { at: true });
        }
    }
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
        /** @type {any[]} */
        let commentData = [];
        if (await canUseApi(e)) {
            commentData = (await makeRequest.getCommentsBySongId(
                { song_id: infoData.id },
                { event: e },
            )) || [];
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
    /**
     * 候选难度的下界。
     * 4.0.1 起存在 0.5 定数的谱面（向下取整为难度 0），
     * 总评因此可以低到 0+1+1=2，不能再写死从 1 开始。
     */
    const difKeys = fCompute.objectKeys(chartList).map(Number).filter((n) => Number.isFinite(n))
    const minDif = difKeys.length ? Math.min(...difKeys) : 1
    // 上界：另两张都取最低难度时，最大的一张最多是 clgNum - 2 * minDif
    for (let i = minDif; i <= Math.min(getInfo.MAX_DIFFICULTY, clgNum - 2 * minDif); i++) {
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
        let tem = chartList[difList[i]].splice(fCompute.randInt(0, chartList[difList[i]].length - 1), 1)[0]
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
