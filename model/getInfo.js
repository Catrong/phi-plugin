import readFile from './getFile.js'
import { DlcInfoPath, configPath, imgPath, infoPath, originalIllPath, ortherIllPath, oldInfoPath } from './path.js'
import path from 'path'
import Config from '../components/Config.js'
import SongsInfo from './class/SongsInfo.js'
import fs from 'fs'
import { Level, MAX_DIFFICULTY } from './constNum.js'
import chokidar from 'chokidar'
import fCompute from './fCompute.js'

/**
 * @import * from '../model/type/type.js'
 */

export default new class getInfo {

    static initIng = false

    async init() {

        if (Config.getUserCfg('config', 'watchInfoPath')) {
            chokidar.watch(infoPath).on('change', () => {
                this.init()
            });
        }
        if (!fs.existsSync('./plugins/phi-plugin/resources/original_ill/.git')) {
            logger.error(`[phi-plugin] 未下载曲绘文件，建议使用 /phi downill 命令进行下载`)
        }

        if (this.initIng) return

        logger.info(`[phi-plugin]初始化曲目信息`)

        this.initIng = true

        /**之前改过一次名称，修正别名 */
        let nick = await readFile.FileReader(path.join(configPath, 'nickconfig.yaml'), "TXT")
        if (nick) {
            const waitToReplace = {
                "Winter↑cube↓": "Winter ↑cube↓",
                "Cipher: /2&//<|0": "Cipher : /2&//<|0",
                "NYA!!!(Phigros ver.)": "NYA!!! (Phigros ver.)",
                "JunXion Between Life And Death(VIP Mix)": "JunXion Between Life And Death(VIP Mix)",
                "Dash from SOUL NOTES": "Dash",
                "Drop It from SOUL NOTES": "Drop It",
                "Diamond Eyes from SOUL NOTES": "Diamond Eyes",
            }
            let flag = false
            for (let i in waitToReplace) {
                if (nick.includes(i)) {
                    flag = true
                    nick = nick.replace(i, waitToReplace[i])
                }
            }
            if (flag) {
                readFile.SetFile(path.join(configPath, 'nickconfig.yaml'), nick, "TXT")
                logger.mark('[phi-plugin]自动修正别名')
            }
        }



        /**
         * @type {{[key:string]:{[key:string]:string[]}}}
         * @description 扩增曲目信息
         */
        this.DLC_Info = {}
        let files = fs.readdirSync(DlcInfoPath).filter(file => file.endsWith('.json'))
        files.forEach(async (file) => {
            this.DLC_Info[path.basename(file, '.json')] = await readFile.FileReader(path.join(DlcInfoPath, file))
        })

        /**
         * @type {{[key:string]:string}}
         * @description 头像id
         */
        let csv_avatar = await readFile.FileReader(path.join(infoPath, 'avatar.csv'))
        this.avatarid = []
        for (let i in csv_avatar) {
            this.avatarid.push(csv_avatar[i].id)
        }

        /**
         * @type {string[]}
         * @description Tips
         */
        this.tips = await readFile.FileReader(path.join(infoPath, 'tips.yaml'))


        /**
         * @type {{[key:songString]:SongsInfo}}
         * @description 原版信息
         */
        this.ori_info = {}
        /**
         * @type {{[key:string]:string}}
         * @description 通过id获取曲名
         */
        this.songsid = {}
        /**
         * @type {{[key:string]:string}}
         * @description 原曲名称获取id
         */
        this.idssong = {}
        /**
         * @type {string[]}
         * @description 含有曲绘的曲目列表，原曲名称
         */
        this.illlist = []

        /**自定义信息 */
        let user_song = Config.getUserCfg('otherinfo')
        if (Config.getUserCfg('config', 'otherinfo')) {
            for (let i in user_song) {
                if (user_song[i]['illustration_big']) {
                    this.illlist.push(user_song[i].song)
                }
            }
        }

        /**
         * @type {{[key:string]:SongsInfo}}
         * @description SP信息
         */
        this.sp_info = await readFile.FileReader(path.join(infoPath, 'spinfo.json'))
        for (let i in this.sp_info) {
            this.sp_info[i].sp_vis = true
            if (this.sp_info[i]['illustration_big']) {
                this.illlist.push(this.sp_info[i].song)
            }
        }


        /**难度映射 */
        this.Level = Level

        /**最高定数 */
        this.MAX_DIFFICULTY = 0

        /**所有曲目曲名列表 */
        this.songlist = []

        /**
         * @typedef {Object} notesInfoObject
         * @property {number} m MaxTime
         * @property {[number,number,number,number][]} d note分布 [tap,drag,hold,flick,tot]
         * @property {[number,number,number,number]} t note统计 [tap,drag,hold,flick]
         */
        /**
         * note统计
         * @type {{[x:idString]:{[x:string]:notesInfoObject}}}
         */
        let notesInfo = await readFile.FileReader(path.join(infoPath, 'notesInfo.json'))

        /**
         * @typedef {Object} csvInfoObject
         * @property {idString} id 曲目id
         * @property {songString} song 曲目名称
         * @property {string} composer 作曲
         * @property {string} illustrator 插画师
         * @property {string} EZ EZ难度谱师
         * @property {string} HD HD难度谱师
         * @property {string} IN IN难度谱师
         * @property {string|null} AT AT难度谱师
         */
        /**
         * 信息文件
         * @type {csvInfoObject[]}
         */
        let CsvInfo = await readFile.FileReader(path.join(infoPath, 'info.csv'))
        let Csvdif = await readFile.FileReader(path.join(infoPath, 'difficulty.csv'))
        let Jsoninfo = await readFile.FileReader(path.join(infoPath, 'infolist.json'))

        let oldDif = await readFile.FileReader(path.join(oldInfoPath, 'difficulty.csv'))
        /**
         * note统计
         * @type {{[x:idString]:{[x:string]:notesInfoObject}}}
         */
        let oldNotes = await readFile.FileReader(path.join(oldInfoPath, 'notesInfo.json'))
        let OldDifList = []
        for (let i in oldDif) {
            OldDifList[oldDif[i].id] = oldDif[i]
        }
        this.updatedSong = []
        this.updatedChart = {}
        // console.info(CsvInfo, Csvdif, Jsoninfo)
        for (let i in CsvInfo) {

            /**比较新曲部分 */
            if (!OldDifList[CsvInfo[i].id]) {
                this.updatedSong.push(CsvInfo[i].song)
            }

            switch (CsvInfo[i].id) {
                case 'AnotherMe.DAAN': {
                    CsvInfo[i].song = 'Another Me (KALPA)';
                    break;
                }
                case 'AnotherMe.NeutralMoon': {
                    CsvInfo[i].song = 'Another Me (Rising Sun Traxx)';
                    break;
                }
                default: {
                    break;
                }
            }
            this.songsid[CsvInfo[i].id + '.0'] = CsvInfo[i].song
            this.idssong[CsvInfo[i].song] = CsvInfo[i].id + '.0'

            this.ori_info[CsvInfo[i].song] = { ...Jsoninfo[CsvInfo[i].id] }
            if (!this.ori_info[CsvInfo[i].song]) {
                this.ori_info[CsvInfo[i].song] = { song: CsvInfo[i].song, chapter: '', bpm: '', length: '', chart: {} }
                logger.mark(`[phi-plugin]曲目详情未更新：${CsvInfo[i].song}`)
            }
            this.ori_info[CsvInfo[i].song].song = CsvInfo[i].song
            this.ori_info[CsvInfo[i].song].id = CsvInfo[i].id + '.0'
            this.ori_info[CsvInfo[i].song].composer = CsvInfo[i].composer
            this.ori_info[CsvInfo[i].song].illustrator = CsvInfo[i].illustrator
            this.ori_info[CsvInfo[i].song].chart = {}
            for (let j in this.Level) {
                let level = this.Level[j]
                let id = CsvInfo[i].id
                if (CsvInfo[i][level]) {

                    /**比较新曲部分 */
                    if (OldDifList[id]) {
                        if (!OldDifList[id][level] || OldDifList[id][level] != Csvdif[i][level] || JSON.stringify(oldNotes[id][level].t) != JSON.stringify(notesInfo[id][level].t)) {
                            let tem = {}
                            if (!OldDifList[CsvInfo[i].id][level]) {
                                Object.assign(tem, {
                                    tap: notesInfo[id][level].t[0],
                                    drag: notesInfo[id][level].t[1],
                                    hold: notesInfo[id][level].t[2],
                                    flick: notesInfo[id][level].t[3],
                                    difficulty: Csvdif[i][level],
                                    isNew: true
                                })
                            } else {
                                if (OldDifList[id][level] != Csvdif[i][level]) {
                                    Object.assign(tem, { difficulty: [OldDifList[id][level], Csvdif[i][level]] })
                                }
                                if (oldNotes[id][level].t[0] != notesInfo[id][level].t[0]) {
                                    Object.assign(tem, { tap: [oldNotes[id][level].t[0], notesInfo[id][level].t[0]] })
                                }
                                if (oldNotes[id][level].t[1] != notesInfo[id][level].t[1]) {
                                    Object.assign(tem, { drag: [oldNotes[id][level].t[1], notesInfo[id][level].t[1]] })
                                }
                                if (oldNotes[id][level].t[2] != notesInfo[id][level].t[2]) {
                                    Object.assign(tem, { hold: [oldNotes[id][level].t[2], notesInfo[id][level].t[2]] })
                                }
                                if (oldNotes[id][level].t[3] != notesInfo[id][level].t[3]) {
                                    Object.assign(tem, { flick: [oldNotes[id][level].t[3], notesInfo[id][level].t[3]] })
                                }
                                let oldCombo = oldNotes[id][level].t[0] + oldNotes[id][level].t[1] + oldNotes[id][level].t[2] + oldNotes[id][level].t[3]
                                let newCombo = notesInfo[id][level].t[0] + notesInfo[id][level].t[1] + notesInfo[id][level].t[2] + notesInfo[id][level].t[3]
                                if (oldCombo != newCombo) {
                                    Object.assign(tem, { combo: [oldCombo, newCombo] })
                                }
                            }
                            if (!this.updatedChart[CsvInfo[i].song]) {
                                this.updatedChart[CsvInfo[i].song] = {}
                            }
                            this.updatedChart[CsvInfo[i].song][level] = tem
                        }
                    }

                    if (!this.ori_info[CsvInfo[i].song].chart[level]) {
                        this.ori_info[CsvInfo[i].song].chart[level] = {}
                    }
                    this.ori_info[CsvInfo[i].song].chart[level].charter = CsvInfo[i][level]
                    this.ori_info[CsvInfo[i].song].chart[level].difficulty = Number(Csvdif[i][level])
                    this.ori_info[CsvInfo[i].song].chart[level].tap = notesInfo[id][level].t[0]
                    this.ori_info[CsvInfo[i].song].chart[level].drag = notesInfo[id][level].t[1]
                    this.ori_info[CsvInfo[i].song].chart[level].hold = notesInfo[id][level].t[2]
                    this.ori_info[CsvInfo[i].song].chart[level].flick = notesInfo[id][level].t[3]
                    this.ori_info[CsvInfo[i].song].chart[level].combo = notesInfo[id][level].t[0] + notesInfo[id][level].t[1] + notesInfo[id][level].t[2] + notesInfo[id][level].t[3]
                    this.ori_info[CsvInfo[i].song].chart[level].maxTime = notesInfo[id][level].m
                    this.ori_info[CsvInfo[i].song].chart[level].distribution = notesInfo[id][level].d

                    /**最高定数 */
                    this.MAX_DIFFICULTY = Math.max(this.MAX_DIFFICULTY, Number(Csvdif[i][level]))
                }
            }
            if (Jsoninfo[CsvInfo[i].id]?.chart) {
                this.ori_info[CsvInfo[i].song].chart = { ...this.ori_info[CsvInfo[i].song].chart, ...Jsoninfo[CsvInfo[i].id].chart }
            }
            this.illlist.push(CsvInfo[i].song)
            this.songlist.push(CsvInfo[i].song)
        }


        if (this.MAX_DIFFICULTY != MAX_DIFFICULTY) {
            console.error('[phi-plugin] MAX_DIFFICULTY 常量未更新，请回报作者！', MAX_DIFFICULTY, this.MAX_DIFFICULTY)
        }


        let nicklistTemp = await readFile.FileReader(path.join(infoPath, 'nicklist.yaml'))
        /** @type {{[key:songString]: string[]}} 默认别名，以曲名为key */
        this.nicklist = {}
        /**以别名为key */
        this.songnick = {}
        for (let id in nicklistTemp) {
            let song = this.idgetsong(id + '.0') || id
            this.nicklist[song] = nicklistTemp[id]
            nicklistTemp[id].forEach((item) => {
                if (this.songnick[item]) {
                    this.songnick[item].push(song)
                } else {
                    this.songnick[item] = [song]
                }
            })
        }

        /**
         * @type {{[key:string]: string[]}}
         * @description 章节列表，以章节名为key
         */
        this.chapList = await readFile.FileReader(path.join(infoPath, 'chaplist.yaml'))
        /**
         * @type {{[key:string]: string[]}}
         * @description 章节别名，以别名为key
         */
        this.chapNick = {}
        for (let i in this.chapList) {
            this.chapList[i].forEach((item) => {
                if (this.chapNick[item]) {
                    this.chapNick[item].push(i)
                } else {
                    this.chapNick[item] = [i]
                }
            })
        }

        /**jrrp */
        this.word = await readFile.FileReader(path.join(infoPath, 'jrrp.json'))

        /**按dif分的info */
        this.info_by_difficulty = {}
        for (let song in this.ori_info) {
            for (let level in this.ori_info[song].chart) {
                let info = this.ori_info[song]
                if (this.info_by_difficulty[info.chart[level].difficulty]) {
                    this.info_by_difficulty[info.chart[level].difficulty].push({
                        id: info.id,
                        rank: level,
                        ...info.chart[level],
                    })
                } else {
                    this.info_by_difficulty[info.chart[level].difficulty] = [{
                        id: info.id,
                        rank: level,
                        ...info.chart[level],
                    }]
                }
            }
        }

        this.initIng = false
        logger.info(`[phi-plugin]初始化曲目信息完成`)
    }

    /**
     * 
     * @param {string} [song=undefined] 原曲曲名
     * @param {boolean} [original=false] 仅使用原版
     * @returns {SongsInfo}
     */
    info(song, original = false) {
        let result
        switch (original ? 0 : Config.getUserCfg('config', 'otherinfo')) {
            case 0: {
                result = { ...this.ori_info, ...this.sp_info }
                break;
            }
            case 1: {
                result = { ...this.ori_info, ...this.sp_info, ...Config.getUserCfg('otherinfo') }
                break;
            }
            case 2: {
                result = Config.getUserCfg('otherinfo')
                break;
            }
        }
        return result[song] ? new SongsInfo(result[song]) : null
    }

    /**
     * 
     * @param {boolean} [original=false] 仅使用原版
     * @returns 
     */
    all_info(original = false) {
        switch (original ? 0 : Config.getUserCfg('config', 'otherinfo')) {
            case 0: {
                return { ...this.ori_info, ...this.sp_info }
            }
            case 1: {
                return { ...this.ori_info, ...this.sp_info, ...Config.getUserCfg('otherinfo') }
            }
            case 2: {
                return Config.getUserCfg('otherinfo')
            }
        }
    }


    /**
     * 匹配歌曲名称，根据参数返回原曲名称
     * @param {string} mic 别名
     * @returns 原曲名称
     */
    songsnick(mic) {
        let nickconfig = Config.getUserCfg('nickconfig', mic)
        let all = []

        if (this.info(mic)) all.push(mic)

        if (this.songnick[mic]) {
            for (let i in this.songnick[mic]) {
                all.push(this.songnick[mic][i])
            }
        }
        if (nickconfig) {
            for (let i in nickconfig) {
                all.push(nickconfig[i])
            }
        }
        if (all.length) {
            all = Array.from(new Set(all)) //去重
            return all
        }
        return false
    }

    /**
    * 根据参数模糊匹配返回原曲名称
    * @param {string} mic 别名
    * @param {number} [Distance=0.85] 阈值 猜词0.95
    * @returns 原曲名称数组，按照匹配程度降序
    */
    fuzzysongsnick(mic, Distance = 0.85) {
        /**为空返回空 */
        if (!mic) return []
        /**按照匹配程度排序 */
        let result = []

        const usernick = Config.getUserCfg('nickconfig')
        const allinfo = this.all_info()

        for (let std in this.songnick) {
            let dis = fCompute.jaroWinklerDistance(mic, std)
            if (dis >= Distance) {
                for (let i in this.songnick[std]) {
                    result.push({ song: this.songnick[std][i], dis: dis })
                }
            }
        }

        for (let std in allinfo) {
            let dis = fCompute.jaroWinklerDistance(mic, std)
            if (dis >= Distance) {
                result.push({ song: allinfo[std].song, dis: dis })
            }
            if (!allinfo[std]?.id) continue
            dis = fCompute.jaroWinklerDistance(mic, allinfo[std].id)
            if (dis >= Distance) {
                result.push({ song: allinfo[std].song, dis: dis })
            }
        }



        for (let std in usernick) {
            let dis = fCompute.jaroWinklerDistance(mic, std)
            if (dis >= Distance) {
                for (let i in usernick[std]) {
                    result.push({ song: usernick[std][i], dis: dis })
                }
            }
        }


        result = result.sort((a, b) => b.dis - a.dis)

        let all = []
        for (let i of result) {

            if (all.includes(i.song)) continue //去重
            /**如果有完全匹配的曲目则放弃剩下的 */
            if (result[0].dis == 1 && i.dis < 1) break


            all.push(i.song)
        }

        return all
    }

    /**
     * 设置别名
     * @param {string} mic 原名
     * @param {string} nick 别名
     */
    async setnick(mic, nick) {
        if (!Config.getUserCfg('nickconfig', mic)) {
            Config.modify('nickconfig', nick, [mic])
        } else {
            Config.modifyarr('nickconfig', nick, mic, 'add')
        }
    }


    /**
     * 获取曲绘，返回地址，原名
     * @param {string} song 原名
     * @param {'common'|'blur'|'low'} [kind='common'] 清晰度
     * @return {string} 网址或文件地址
    */
    getill(song, kind = 'common') {
        const songsinfo = this.all_info()[song]
        let ans = songsinfo?.illustration_big
        let reg = /^(?:(http|https|ftp):\/\/)((?:[\w-]+\.)+[a-z0-9]+)((?:\/[^/?#]*)+)?(\?[^#]+)?(#.+)?$/i
        if (ans && !reg.test(ans)) {
            ans = path.join(ortherIllPath, ans)
        } else if (this.ori_info[song] || this.sp_info[song]) {
            if (this.ori_info[song]) {
                if (fs.existsSync(path.join(originalIllPath, this.SongGetId(song).replace(/.0$/, '.png')))) {
                    ans = path.join(originalIllPath, this.SongGetId(song).replace(/.0$/, '.png'))
                } else if (fs.existsSync(path.join(originalIllPath, "ill", this.SongGetId(song).replace(/.0$/, '.png')))) {
                    if (kind == 'common') {
                        ans = path.join(originalIllPath, "ill", this.SongGetId(song).replace(/.0$/, '.png'))
                    } else if (kind == 'blur') {
                        ans = path.join(originalIllPath, "illBlur", this.SongGetId(song).replace(/.0$/, '.png'))
                    } else if (kind == 'low') {
                        ans = path.join(originalIllPath, "illLow", this.SongGetId(song).replace(/.0$/, '.png'))
                    }
                } else {
                    if (kind == 'common') {
                        ans = `${Config.getUserCfg('config', 'onLinePhiIllUrl')}/ill/${this.SongGetId(song).replace(/.0$/, '.png')}`
                    } else if (kind == 'blur') {
                        ans = `${Config.getUserCfg('config', 'onLinePhiIllUrl')}/illBlur/${this.SongGetId(song).replace(/.0$/, '.png')}`
                    } else if (kind == 'low') {
                        ans = `${Config.getUserCfg('config', 'onLinePhiIllUrl')}/illLow/${this.SongGetId(song).replace(/.0$/, '.png')}`
                    }
                }
            } else {
                if (fs.existsSync(path.join(originalIllPath, "SP", song + '.png'))) {
                    ans = path.join(originalIllPath, "SP", song + '.png')
                } else {
                    ans = `${Config.getUserCfg('config', 'onLinePhiIllUrl')}/SP/${song}.png`
                }
            }
        }
        if (!ans) {
            logger.warn(song, '背景不存在')
            ans = path.join(imgPath, 'phigros.png')
        }
        return ans
    }

    /**
     * 
     * @param {idString} songId 
     * @param {levelKind} dif 
     */
    getChartImg(songId, dif) {
        songId = songId.replace(/.0$/, '');
        if (fs.existsSync(path.join(originalIllPath, "chartimg", dif, `${songId}.png`))) {
            return path.join(originalIllPath, "chartimg", dif, `${songId}.png`)
        } else {
            return `${Config.getUserCfg('config', 'onLinePhiIllUrl')}/chartimg/${dif}/${songId}.png`
        }
    }

    getTableImg(dif) {
        if (fs.existsSync(path.join(originalIllPath, "table", `${dif}.png`))) {
            return path.join(originalIllPath, "table", `${dif}.png`)
        } else {
            return `${Config.getUserCfg('config', 'onLinePhiIllUrl')}/table/${dif}.png`
        }
    }

    /**
     * 返回章节封面 url
     * @param {string} name 标准章节名
     */
    getChapIll(name) {
        if (fs.existsSync(path.join(originalIllPath, "chap", `${name}.png`))) {
            return path.join(originalIllPath, "chap", `${name}.png`)
        } else {
            return `${Config.getUserCfg('config', 'onLinePhiIllUrl')}/chap/${name}.png`
        }
    }

    /**
     * 通过id获得头像文件名称
     * @param {string} id 
     * @returns file name
     */
    idgetavatar(id) {
        if (this.avatarid.includes(id)) {
            return id
        } else {
            return 'Introduction'
        }
    }

    /**
     * 根据曲目id获取原名
     * @param {String} id 曲目id
     * @returns 原名
     */
    idgetsong(id) {
        return this.songsid[id]
    }

    /**
     * 通过原曲曲目获取曲目id
     * @param {String} song 原曲曲名
     * @returns {idString} 曲目id
     */
    SongGetId(song) {
        return this.idssong[song]
    }

    /**
     * 获取角色介绍背景曲绘
     * @param {string} save_background 
     * @returns 
     */
    getBackground(save_background) {
        try {
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
                case 'Le temps perdu-': {
                    save_background = 'Le temps perdu'
                    break
                }
                default: {
                    break
                }
            }
            return this.getill(this.idgetsong(save_background) || save_background)
        } catch (err) {
            logger.error(`获取背景曲绘错误`, err)
            return false
        }
    }

}()
