import readFile from './getFile.js'
import { DlcInfoPath, configPath, imgPath, infoPath, originalIllPath, ortherIllPath, oldInfoPath } from './path.js'
import path from 'path'
import Config from '../components/Config.js'
import SongsInfo from './class/SongsInfo.js'
import fs from 'fs'
import { Level, MAX_DIFFICULTY } from './constNum.js'
import chokidar from 'chokidar'


export default new class getInfo {

    static initIng = false

    constructor() {
        this.init()
        chokidar.watch(infoPath).on('change', () => {
            this.init()
        })
    }

    async init() {

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



        /**扩增曲目信息 */
        this.DLC_Info = {}
        let files = fs.readdirSync(DlcInfoPath).filter(file => file.endsWith('.json'))
        files.forEach(async (file) => {
            this.DLC_Info[path.basename(file, '.json')] = await readFile.FileReader(path.join(DlcInfoPath, file))
        })

        /**头像id */
        let csv_avatar = await readFile.FileReader(path.join(infoPath, 'avatar.csv'))
        this.avatarid = {}
        for (let i in csv_avatar) {
            this.avatarid[csv_avatar[i].id] = csv_avatar[i].name
        }

        /**
         * Tips []
         */
        this.tips = await readFile.FileReader(path.join(infoPath, 'tips.yaml'))


        /**原版信息 */
        this.ori_info = {}
        /**通过id获取曲名 */
        this.songsid = {}
        /**原曲名称获取id */
        this.idssong = {}
        /**含有曲绘的曲目列表，原曲名称 */
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

        /**SP信息 */
        this.sp_info = await readFile.FileReader(path.join(infoPath, 'spinfo.json'))
        for (let i in this.sp_info) {
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

        /**note统计 */
        let notesInfo = await readFile.FileReader(path.join(infoPath, 'notesInfo.json'))

        /**信息文件 */
        let CsvInfo = await readFile.FileReader(path.join(infoPath, 'info.csv'))
        let Csvdif = await readFile.FileReader(path.join(infoPath, 'difficulty.csv'))
        let Jsoninfo = await readFile.FileReader(path.join(infoPath, 'infolist.json'))

        let oldDif = await readFile.FileReader(path.join(oldInfoPath, 'difficulty.csv'))
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

            this.ori_info[CsvInfo[i].song] = Jsoninfo[CsvInfo[i].id]
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
                        if (!OldDifList[id][level] || OldDifList[id][level] != Csvdif[i][level] || JSON.stringify(oldNotes[id][level]) != JSON.stringify(notesInfo[id][level])) {
                            let tem = {}
                            if (!OldDifList[CsvInfo[i].id][level]) {
                                Object.assign(tem, { ...notesInfo[id][level], difficulty: Csvdif[i][level], isNew: true })
                            } else {
                                if (OldDifList[id][level] != Csvdif[i][level]) {
                                    Object.assign(tem, { difficulty: [OldDifList[id][level], Csvdif[i][level]] })
                                }
                                if (oldNotes[id][level].tap != notesInfo[id][level].tap) {
                                    Object.assign(tem, { tap: [oldNotes[id][level].tap, notesInfo[id][level].tap] })
                                }
                                if (oldNotes[id][level].drag != notesInfo[id][level].drag) {
                                    Object.assign(tem, { drag: [oldNotes[id][level].drag, notesInfo[id][level].drag] })
                                }
                                if (oldNotes[id][level].hold != notesInfo[id][level].hold) {
                                    Object.assign(tem, { hold: [oldNotes[id][level].hold, notesInfo[id][level].hold] })
                                }
                                if (oldNotes[id][level].flick != notesInfo[id][level].flick) {
                                    Object.assign(tem, { flick: [oldNotes[id][level].flick, notesInfo[id][level].flick] })
                                }
                                let oldCombo = oldNotes[id][level].tap + oldNotes[id][level].drag + oldNotes[id][level].hold + oldNotes[id][level].flick
                                let newCombo = notesInfo[id][level].tap + notesInfo[id][level].drag + notesInfo[id][level].hold + notesInfo[id][level].flick
                                if (oldCombo != newCombo) {
                                    Object.assign(tem, { combo: [oldCombo, newCombo] })
                                }
                            }
                            if (!this.updatedChart[CsvInfo[i].song]) {
                                this.updatedChart[CsvInfo[i].song] = {}
                            }
                            this.updatedChart[CsvInfo[i].song][level] = tem
                            // console.log(this.updatedChart)
                        }
                    }

                    if (!this.ori_info[CsvInfo[i].song].chart[level]) {
                        this.ori_info[CsvInfo[i].song].chart[level] = {}
                    }
                    this.ori_info[CsvInfo[i].song].chart[level].charter = CsvInfo[i][level]
                    this.ori_info[CsvInfo[i].song].chart[level].difficulty = Number(Csvdif[i][level])
                    this.ori_info[CsvInfo[i].song].chart[level].tap = notesInfo[id][level].tap
                    this.ori_info[CsvInfo[i].song].chart[level].drag = notesInfo[id][level].drag
                    this.ori_info[CsvInfo[i].song].chart[level].hold = notesInfo[id][level].hold
                    this.ori_info[CsvInfo[i].song].chart[level].flick = notesInfo[id][level].flick
                    this.ori_info[CsvInfo[i].song].chart[level].combo = notesInfo[id][level].tap + notesInfo[id][level].drag + notesInfo[id][level].hold + notesInfo[id][level].flick

                    /**最高定数 */
                    this.MAX_DIFFICULTY = Math.max(this.MAX_DIFFICULTY, Number(Csvdif[i][level]))
                }
            }
            this.illlist.push(CsvInfo[i].song)
            this.songlist.push(CsvInfo[i].song)
        }


        if (this.MAX_DIFFICULTY != MAX_DIFFICULTY) {
            console.error('[phi-plugin] MAX_DIFFICULTY 常量未更新，请回报作者！', MAX_DIFFICULTY, this.MAX_DIFFICULTY)
        }


        let nicklistTemp = await readFile.FileReader(path.join(infoPath, 'nicklist.yaml'))
        /**默认别名,以曲名为key */
        this.nicklist = {}
        /**以别名为key */
        this.songnick = {}
        for (let id in nicklistTemp) {
            let song = this.idgetsong(id + '.0') || id
            this.nicklist[song] = nicklistTemp[id]
            for (let j in nicklistTemp[id]) {
                if (this.songnick[nicklistTemp[id][j]]) {
                    this.songnick[nicklistTemp[id][j]].push(song)
                } else {
                    this.songnick[nicklistTemp[id][j]] = [song]
                }
            }
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

        const fuzzyMatch = (str1, str2) => {
            if (str1 == str2) {
                return 1
            }
            //首先第一次去除空格和其他符号，并转换为小写
            const pattern = /[\s~`!@#$%^&*()\-=_+\]{}|;:'",<.>/?！￥…（）—【】、；‘：“”，《。》？↑↓←→]/g
            const formattedStr1 = str1.replace(pattern, '').toLowerCase()
            const formattedStr2 = str2.replace(pattern, '').toLowerCase()

            //第二次再计算str1和str2之间的JaroWinkler距离
            const distance = this.jaroWinklerDistance(formattedStr1, formattedStr2)

            //如果距离大于等于某个阈值，则认为匹配
            //可以根据实际情况调整这个阈值
            return distance
        }

        /**按照匹配程度排序 */
        let result = []

        const usernick = Config.getUserCfg('nickconfig')
        const allinfo = this.all_info()


        for (let std in usernick) {
            let dis = fuzzyMatch(mic, std)
            if (dis >= Distance) {
                for (let i in usernick[std]) {
                    result.push({ song: usernick[std][i], dis: dis })
                }
            }
        }
        for (let std in this.songnick) {
            let dis = fuzzyMatch(mic, std)
            if (dis >= Distance) {
                for (let i in this.songnick[std]) {
                    result.push({ song: this.songnick[std][i], dis: dis })
                }
            }
        }
        for (let std in allinfo) {
            let dis = fuzzyMatch(mic, std)
            if (dis >= Distance) {
                result.push({ song: allinfo[std]['song'], dis: dis })
            }
        }

        result = result.sort((a, b) => b.dis - a.dis)

        let all = []
        for (let i in result) {

            if (all.includes(result[i].song)) continue //去重
            /**如果有完全匹配的曲目则放弃剩下的 */
            if (result[0].dis == 1 && result[i].dis < 1) break


            all.push(result[i].song)
        }

        return all
    }

    //采用Jaro-Winkler编辑距离算法来计算str间的相似度，复杂度为O(n)=>n为较长的那个字符出的长度
    jaroWinklerDistance(s1, s2) {
        let m = 0 //匹配的字符数量

        //如果任任一字符串为空则距离为0
        if (s1.length === 0 || s2.length === 0) {
            return 0
        }

        //字符串完全匹配，距离为1
        if (s1 === s2) {
            return 1
        }

        let range = (Math.floor(Math.max(s1.length, s2.length) / 2)) - 1, //搜索范围
            s1Matches = new Array(s1.length),
            s2Matches = new Array(s2.length)

        //查找匹配的字符
        for (let i = 0; i < s1.length; i++) {
            let low = (i >= range) ? i - range : 0,
                high = (i + range <= (s2.length - 1)) ? (i + range) : (s2.length - 1)

            for (let j = low; j <= high; j++) {
                if (s1Matches[i] !== true && s2Matches[j] !== true && s1[i] === s2[j]) {
                    ++m
                    s1Matches[i] = s2Matches[j] = true
                    break
                }
            }
        }

        //如果没有匹配的字符，那么捏Jaro距离为0
        if (m === 0) {
            return 0
        }

        //计算转置的数量
        let k = 0, n_trans = 0
        for (let i = 0; i < s1.length; i++) {
            if (s1Matches[i] === true) {
                let j
                for (j = k; j < s2.length; j++) {
                    if (s2Matches[j] === true) {
                        k = j + 1
                        break
                    }
                }

                if (s1[i] !== s2[j]) {
                    ++n_trans
                }
            }
        }

        //计算Jaro距离
        let weight = (m / s1.length + m / s2.length + (m - (n_trans / 2)) / m) / 3,
            l = 0,
            p = 0.1

        //如果Jaro距离大于0.7，计算Jaro-Winkler距离
        if (weight > 0.7) {
            while (s1[l] === s2[l] && l < 4) {
                ++l
            }

            weight = weight + l * p * (1 - weight)
        }

        return weight
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
     * @param {string} name 原名
     * @param {'common'|'blur'|'low'} [kind='common'] 清晰度
     * @return {string} 网址或文件地址
    */
    getill(name, kind = 'common') {
        const songsinfo = this.all_info()[name]
        let ans = songsinfo?.illustration_big
        let reg = /^(?:(http|https|ftp):\/\/)((?:[\w-]+\.)+[a-z0-9]+)((?:\/[^/?#]*)+)?(\?[^#]+)?(#.+)?$/i
        if (ans && !reg.test(ans)) {
            ans = path.join(ortherIllPath, ans)
        } else if (this.ori_info[name] || this.sp_info[name]) {
            if (this.ori_info[name]) {
                if (fs.existsSync(path.join(originalIllPath, this.SongGetId(name).replace(/.0$/, '.png')))) {
                    ans = path.join(originalIllPath, this.SongGetId(name).replace(/.0$/, '.png'))
                } else if (fs.existsSync(path.join(originalIllPath, "ill", this.SongGetId(name).replace(/.0$/, '.png')))) {
                    if (kind == 'common') {
                        ans = path.join(originalIllPath, "ill", this.SongGetId(name).replace(/.0$/, '.png'))
                    } else if (kind == 'blur') {
                        ans = path.join(originalIllPath, "illBlur", this.SongGetId(name).replace(/.0$/, '.png'))
                    } else if (kind == 'low') {
                        ans = path.join(originalIllPath, "illLow", this.SongGetId(name).replace(/.0$/, '.png'))
                    }
                } else {
                    if (kind == 'common') {
                        ans = `${Config.getUserCfg('config', 'onLinePhiIllUrl')}/ill/${this.SongGetId(name).replace(/.0$/, '.png')}`
                    } else if (kind == 'blur') {
                        ans = `${Config.getUserCfg('config', 'onLinePhiIllUrl')}/illBlur/${this.SongGetId(name).replace(/.0$/, '.png')}`
                    } else if (kind == 'low') {
                        ans = `${Config.getUserCfg('config', 'onLinePhiIllUrl')}/illLow/${this.SongGetId(name).replace(/.0$/, '.png')}`
                    }
                }
            } else {
                if (fs.existsSync(path.join(originalIllPath, "SP", name + '.png'))) {
                    ans = path.join(originalIllPath, "SP", name + '.png')
                } else {
                    ans = `${Config.getUserCfg('config', 'onLinePhiIllUrl')}/SP/${name}.png`
                }
            }
        }
        if (!ans) {
            ans = path.join(imgPath, 'phigros.png')
        }
        return ans
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
        if (this.avatarid[id]) {
            return this.avatarid[id]
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
     * @returns 曲目id
     */
    SongGetId(song) {
        return this.idssong[song]
    }

}()
