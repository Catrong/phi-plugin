import readFile from './Doc.js'
import { DlcInfoPath, configPath, imgPath, infoPath, originalIllPath, ortherIllPath } from './path.js'
import path from 'path'
import Config from '../components/Config.js'
import SongsInfo from './class/SongsInfo.js'
import fs from 'fs'


export default new class info {
    constructor() {

        /**之前改过一次名称，修正别名 */
        readFile.FileReader(path.join(configPath, 'nickconfig.yaml'), "TXT").then((nick) => {
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
        })

        /**默认别名 */
        readFile.FileReader(path.join(infoPath, 'nicklist.yaml')).then((nicklist) => {
            this.songnick = {}
            for (let i in nicklist) {
                for (let j in nicklist[i]) {
                    if (this.songnick[nicklist[i][j]]) {
                        this.songnick[nicklist[i][j]].push(i)
                    } else {
                        this.songnick[nicklist[i][j]] = [i]
                    }
                }
            }
        })



        /**扩增曲目信息 */
        this.DLC_Info = {}
        let files = fs.readdirSync(DlcInfoPath).filter(file => file.endsWith('.json'))
        files.forEach((file) => {
            this.DLC_Info[path.basename(file, '.json')] = readFile.FileReader(path.join(DlcInfoPath, file))
        })



        /**头像id */
        readFile.FileReader(path.join(infoPath, 'avatar.csv')).then((csv_avatar) => {
            this.avatarid = {}
            for (let i in csv_avatar) {
                this.avatarid[csv_avatar[i].id] = csv_avatar[i].name
            }
        })

        /**Tips */
        this.tips = readFile.FileReader(path.join(infoPath, 'tips.json'))


        /**原版信息 */
        this.ori_info = {}
        /**通过id获取曲名 */
        this.songsid = {}
        /**原曲名称获取id */
        this.idssong = {}
        /**含有曲绘的曲目列表，原曲名称 */
        this.illlist = []

        /**自定义信息 */
        let user_song = Config.getDefOrConfig('otherinfo')
        if (Config.getDefOrConfig('config', 'otherinfo')) {
            for (let i in user_song) {
                if (user_song[i]['illustration_big']) {
                    this.illlist.push(user_song[i].song)
                }
            }
        }

        /**SP信息 */
        readFile.FileReader(path.join(infoPath, 'spinfo.json')).then((info) => {
            this.sp_info = info
            for (let i in info) {
                if (info[i]['illustration_big']) {
                    this.illlist.push(info[i].song)
                }
            }
        })


        /**最高定数 */
        this.MAX_DIFFICULTY = 0
        /**难度映射 */
        this.Level = ['EZ', 'HD', 'IN', 'AT', 'LEGACY']

        /**所有曲目曲名列表 */
        this.songlist = []

        /**信息文件 */
        readFile.FileReader(path.join(infoPath, 'info.csv')).then((CsvInfo) => {
            readFile.FileReader(path.join(infoPath, 'difficulty.csv')).then((Csvdif) => {
                readFile.FileReader(path.join(infoPath, 'infolist.json')).then((Jsoninfo) => {
                    // console.info(CsvInfo, Csvdif, Jsoninfo)
                    for (let i in CsvInfo) {
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
                            /**illustration_big = 'null'为特殊标记，getill时会返回默认图片 */
                            this.ori_info[CsvInfo[i].song] = { song: CsvInfo[i].song, illustration_big: 'null', chapter: '', bpm: '', length: '', chart: {} }
                            logger.mark(`[phi-plugin]曲目详情未更新：${CsvInfo[i].song}`)
                        }
                        this.ori_info[CsvInfo[i].song].song = CsvInfo[i].song
                        this.ori_info[CsvInfo[i].song].id = CsvInfo[i].id
                        this.ori_info[CsvInfo[i].song].composer = CsvInfo[i].composer
                        this.ori_info[CsvInfo[i].song].illustrator = CsvInfo[i].illustrator
                        for (let j in this.Level) {
                            const level = this.Level[j]
                            if (CsvInfo[i][level]) {
                                if (!this.ori_info[CsvInfo[i].song].chart[level]) {
                                    this.ori_info[CsvInfo[i].song].chart[level] = {}
                                }
                                this.ori_info[CsvInfo[i].song].chart[level].charter = CsvInfo[i][level]
                                this.ori_info[CsvInfo[i].song].chart[level].difficulty = Csvdif[i][level]
                                /**最高定数 */
                                this.MAX_DIFFICULTY = Math.max(this.MAX_DIFFICULTY, Number(Csvdif[i][level]))
                            }
                        }
                        this.illlist.push(CsvInfo[i].song)
                        this.songlist.push(CsvInfo[i].song)
                    }
                })
            })
        })


    }

    /**
     * 
     * @param {string} [song=undefined] 原曲曲名
     * @param {boolean} [original=false] 仅使用原版
     */
    info(song, original = false) {
        let result
        switch (original ? 0 : Config.getDefOrConfig('config', 'otherinfo')) {
            case 0: {
                result = { ...this.ori_info, ...this.sp_info }
                break;
            }
            case 1: {
                result = { ...this.ori_info, ...this.sp_info, ...Config.getDefOrConfig('otherinfo') }
                break;
            }
            case 2: {
                result = Config.getDefOrConfig('otherinfo')
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
        switch (original ? 0 : Config.getDefOrConfig('config', 'otherinfo')) {
            case 0: {
                return { ...this.ori_info, ...this.sp_info }
            }
            case 1: {
                return { ...this.ori_info, ...this.sp_info, ...Config.getDefOrConfig('otherinfo') }
            }
            case 2: {
                return Config.getDefOrConfig('otherinfo')
            }
        }
    }


    /**
     * 匹配歌曲名称，根据参数返回原曲名称
     * @param {string} mic 别名
     * @returns 原曲名称
     */
    songsnick(mic) {
        let nickconfig = Config.getDefOrConfig('nickconfig', mic)
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
    * @param {number} [Distance=0.85] 阈值
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

        const usernick = Config.getDefOrConfig('nickconfig')
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
        if (!Config.getDefOrConfig('nickconfig', mic)) {
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
        }
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
            } else if (!ans) {
                if (kind == 'common') {
                    ans = `https://gitee.com/Steveeee-e/phi-plugin-ill/raw/main/ill/${this.SongGetId(name).replace(/.0$/, '.png')}`
                } else if (kind == 'blur') {
                    ans = `https://gitee.com/Steveeee-e/phi-plugin-ill/raw/main/illBlur/${this.SongGetId(name).replace(/.0$/, '.png')}`
                } else if (kind == 'low') {
                    ans = `https://gitee.com/Steveeee-e/phi-plugin-ill/raw/main/illLow/${this.SongGetId(name).replace(/.0$/, '.png')}`
                }
            }
        }
        if (!ans) {
            ans = path.join(imgPath, 'phigros.png')
        }
        return ans
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
