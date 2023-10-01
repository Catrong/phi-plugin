
import fs from 'node:fs'
import { _path } from "./path.js";
import { segment } from "oicq";
import Film from './Doc.js';
import atlas from "./picmodle.js";
import Config from "../components/Config.js";
import LevelRecord from "./class/LevelRecordInfo.js";
import SongsInfo from './class/SongsInfo.js';
import Save from './class/Save.js';
import PhigrosUser from '../lib/PhigrosUser.js';
import send from './send.js';
import scoreHistory from './class/scoreHistory.js'


var lock = []

class getdata {


    constructor() {
        /**曲绘资源、曲目信息路径 */
        // this.infoPath = `E:/bot/233/Miao-Yunzai/plugins/phi-plugin/resources/info/`
        this.infoPath = `${_path}/plugins/phi-plugin/resources/info/`

        /**用户数据路径 */
        // this.userPath = `E:/bot/233/Miao-Yunzai/plugins/phi-plugin/data/`
        this.userPath = `${_path}/plugins/phi-plugin/data/`

        /**用户娱乐数据路径 */
        this.pluginDataPath = `${_path}/plugins/phi-plugin/data/pluginData/`

        /**用户设置路径 */
        this.configPath = `${_path}/plugins/phi-plugin/config/config/`
        this.config = 0

        /**默认设置路径 */
        this.defaultPath = `${_path}/plugins/phi-plugin/config/default_config/`
        this.default = 0

        /**默认图片路径 */
        this.imgPath = `${_path}/plugins/phi-plugin/resources/otherimg/`

        /**用户图片路径 */
        this.orillPath = `${_path}/plugins/phi-plugin/resources/otherill/`

        /**资源路径 */
        this.resPath = `${_path}/plugins/phi-plugin/resources/`

        /**插件路径 */
        this.pluginPath = `${_path}/plugins/phi-plugin/`


        this.Level = ['EZ', 'HD', 'IN', 'AT', 'LEGACY'] //难度映射

        this.MAX_DIFFICULTY = 16.9
    }

    async init() {
        /**原版信息 */
        this.ori_info = await this.getData('infolist.json', this.infoPath)
        /**SP信息 */
        this.sp_info = await this.getData('spinfo.json', this.infoPath)
        /**id映射曲名 */
        this.songsid = await this.getData('songsid.yaml', this.infoPath)
        /**默认别名 */
        this.songnick = await this.getData('nicklist.yaml', this.infoPath)
        /**头像id */
        this.avatarid = await this.getData('avatarid.yaml', this.infoPath)

        /**含有曲绘的曲目列表，原曲名称 */
        this.illlist = []
        var info = this.info()
        for (var i in info) {
            if (info[i]['illustration_big']) {
                this.illlist.push(i)
            }
        }

        /**原曲名称映射id */
        this.idssong = {}

        for (let id in this.songsid) {
            this.idssong[this.songsid[id]] = id
        }
    }

    /**
     * @param {string} [song=undefined] 原曲曲名
     */
    info(song = undefined) {
        var result
        switch (Config.getDefOrConfig('config', 'otherinfo')) {
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
        if (song) {
            return result[song]
        } else {
            return result
        }
    }

    /**获取 chos 文件 
     * @param {string}  chos 文件名称 含后缀 yaml json
     * @param {string}  kind 路径
    */
    async getData(chos, path) {
        if (chos.includes('.yaml')) {
            return Film.YamlReader(`${path}${chos}`, path)
        } else {
            return Film.JsonReader(`${path}${chos}`, path)
        }
    }

    /**修改 chos 文件为 data 
     * @param {string} chos 文件名称 含后缀 yaml json
     * @param {string} data 覆写内容
     * @param {string} path 路径
    */
    async setData(chos, data, path) {
        if (chos.includes('.yaml')) {
            return Film.SetYaml(`${path}${chos}`, data, path)
        } else {
            return Film.SetJson(`${path}${chos}`, data, path)
        }
    }

    /**删除 chos.yaml 文件
     * @param {string} chos 文件名称 含后缀 yaml json
     * @param {string} path 路径
    */
    delData(chos, path) {
        if (!Film.DelFile(`${path}${chos}`)) {
            logger.info(`[phi插件] ${chos} 已删除`)
            return false
        } else {
            return true
        }
    }


    /**
     * 获取QQ号对应的存档文件
     * @param {String} id user_id
     * @returns save
     */
    async getsave(id) {
        var result = await this.getData(`${id}.json`, `${this.userPath}`)
        if (result) {
            return new Save(result)
        } else {
            return null
        }

    }

    /**
     * 保存QQ号对应的存档文件
     * @param {String} id user_id
     * @param {Object} data 
     */
    async putsave(id, data) {
        return await this.setData(`${id}.json`, data, `${this.userPath}`)
    }

    /**
         * 删除QQ号对应的存档文件
         * @param {String} id user_id
         */
    async delsave(id) {
        return this.delData(`${id}.json`, this.userPath)
    }

    /**
     * 获取QQ号对应的娱乐数据
     * @param {String} user_id 
     * @param {boolean} [islock=false] 是否锁定文件
     * @returns save
     */
    async getpluginData(id, islock = false) {
        if (lock.indexOf(id) != -1) {
            logger.info(`[phi-plugin][${id}]文件读取等待中`)
            var tot = 0
            while (lock.indexOf(id) != -1 && tot < 20) {
                await segment.sleep(500)
                ++tot
            }
            if (tot == 20) {
                logger.error(`[phi-plugin][${id}]文件读取失败！`)
                throw new Error(`[phi-plugin][${id}]文件读取失败！`)
            }
        }

        if (islock) {
            lock.push(id)
        }
        return await this.getData(`${id}_.json`, `${this.pluginDataPath}`)
    }

    /**
     * 保存QQ号对应的娱乐数据，并解锁文件
     * @param {String} id user_id
     * @param {Object} data 
     */
    async putpluginData(id, data) {
        var returns = await this.setData(`${id}_.json`, data, `${this.pluginDataPath}`)
        if (lock.indexOf(id) != -1) {
            delete lock[lock.indexOf(id)]
        }
        return returns
    }

    /**
     * 取消对id文件的锁定
     * @param {String} id 用户id
     */
    async delLock(id) {
        if (lock.indexOf(id) != -1) {
            delete lock[lock.indexOf(id)]
        }
    }

    /**
     * 删除QQ号对应的娱乐数据
     * @param {String} id user_id
     */
    async delpluginData(id) {
        return this.delData(`${id}_.json`, `${this.pluginDataPath}`)
    }

    /**
     * 获取并初始化 id 货币相关数据
     * @param {String} id 
     * @param {boolean} [islock=false] 是否锁定
     * @returns 整个data对象
     */
    async getmoneydata(id, islock = false) {
        var data = await this.getpluginData(id, islock)
        if (!data) {
            data = {}
        }
        if (!data.plugin_data || !data.plugin_data.money) {
            data.plugin_data = {
                money: 0,
                sign_in: 'Thu Jul 27 2023 11:40:26 GMT+0800 (中国标准时间)',
                task_time: 'Thu Jul 27 2023 11:40:26 GMT+0800 (中国标准时间)',
                task: []
            }
        }
        return data
    }

    /**获取本地图片,带后缀
     * @param {string} img 文件名
     * @param {string} style 文件格式，默认为png
     */
    getimg(img, style = 'png') {
        // name = 'phi'
        var url = `${this.imgPath}/${img}.${style}`
        if (url) {
            return segment.image(url)
        }
        logger.info('未找到 ' + `${img}.${style}`)
        return false
    }



    /**
     * 匹配歌曲名称，根据参数返回原曲名称
     * @param {string} mic 别名
     * @returns 原曲名称
     */
    songsnick(mic) {
        let nickconfig = Config.getDefOrConfig('nickconfig', mic)
        var all = []

        if (this.info()[mic]) all.push(mic)

        if (this.songnick[mic]) {
            for (var i in this.songnick[mic]) {
                all.push(this.songnick[mic][i])
            }
        }
        if (nickconfig) {
            for (var i in nickconfig) {
                all.push(nickconfig[i])
            }
        }
        if (all.length) {
            all = Array.from(new Set(all)) //去重
            return all
        }
        return false
    }

    //采用Jaro-Winkler编辑距离算法来计算str间的相似度，复杂度为O(n)=>n为较长的那个字符出的长度
    jaroWinklerDistance(s1, s2) {
        var m = 0 //匹配的字符数量

        //如果任任一字符串为空则距离为0
        if (s1.length === 0 || s2.length === 0) {
            return 0
        }

        //字符串完全匹配，距离为1
        if (s1 === s2) {
            return 1
        }

        var range = (Math.floor(Math.max(s1.length, s2.length) / 2)) - 1, //搜索范围
            s1Matches = new Array(s1.length),
            s2Matches = new Array(s2.length)

        //查找匹配的字符
        for (var i = 0; i < s1.length; i++) {
            var low = (i >= range) ? i - range : 0,
                high = (i + range <= (s2.length - 1)) ? (i + range) : (s2.length - 1)

            for (var j = low; j <= high; j++) {
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
        var k = 0, n_trans = 0
        for (var i = 0; i < s1.length; i++) {
            if (s1Matches[i] === true) {
                var j
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
        var weight = (m / s1.length + m / s2.length + (m - (n_trans / 2)) / m) / 3,
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
    * 根据参数模糊匹配返回原曲名称
    * @param {string} mic 别名
    * @param {number} [Distance=0.85] 阈值
    * @returns 原曲名称数组，按照匹配程度降序
    */
    fuzzysongsnick(mic, Distance = 0.85) {

        const nickconfig = Config.getDefOrConfig('nickconfig', mic)

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
        var result = []

        const usernick = Config.getDefOrConfig('nickconfig')
        const allinfo = this.info()
        for (var std in usernick) {
            var dis = fuzzyMatch(mic, std)
            if (dis >= Distance) {
                for (var i in usernick[std]) {
                    result.push({ song: usernick[std][i], dis: dis })
                }
            }
        }
        for (var std in this.songnick) {
            var dis = fuzzyMatch(mic, std)
            if (dis >= Distance) {
                for (var i in this.songnick[std]) {
                    result.push({ song: this.songnick[std][i], dis: dis })
                }
            }
        }
        for (var std in allinfo) {
            var dis = fuzzyMatch(mic, std)
            if (dis >= Distance) {
                result.push({ song: allinfo[std]['song'], dis: dis })
            }
        }

        result = result.sort((a, b) => b.dis - a.dis)

        var all = []
        for (var i in result) {
            if (all.includes(result[i].song)) continue //去重
            all.push(result[i].song)
        }

        return all
    }


    /**设置别名 原名, 别名 */
    async setnick(mic, nick) {
        if (!Config.getDefOrConfig('nickconfig', mic)) {
            Config.modify('nickconfig', nick, [mic])
        } else {
            Config.modifyarr('nickconfig', nick, mic, 'add')
        }
    }

    /**获取歌曲图鉴，曲名为原名 */
    GetSongsInfoAtlas(e, name, data = undefined) {

        if (!data) {
            data = this.info()[name]
        }
        if (data) {
            data.illustration = this.getill(name)
            return atlas.atlas(e, data)
        } else {
            /**未找到曲目 */
            return `未找到${name}的相关曲目信息!QAQ`
        }
    }

    /**
     * 通过曲目获取曲目图鉴
     * @param {*} e 消息e
     * @param {string} name 原曲名称
     * @param { {illustration:string, illustrator:string} } data 自定义数据
     * @returns 
     */
    async GetSongsIllAtlas(e, name, data = undefined) {
        if (data) {
            return await get.getillatlas(e, { illustration: data.illustration, illustrator: data.illustrator })
        } else {
            return await get.getillatlas(e, { illustration: get.getill(name), illustrator: get.info()[name]["illustrator"] })
        }

    }

    /**
     * 更新存档
     * @param {*} e 
     * @param {PhigrosUser} User 
     * @returns 
     */
    async buildingRecord(e, User) {
        try {
            await User.buildRecord()
        } catch (err) {
            send.send_with_At(e, "绑定失败！QAQ\n" + err)
            return true
        }
        var old = await this.getsave(e.user_id)
        var pluginData = await this.getpluginData(e.user_id, true)

        try {
            await this.putsave(e.user_id, User)
        } catch (err) {
            send.send_with_At(e, `保存存档失败！\n${err}`)
            return true
        }

        if (!pluginData) {
            pluginData = {}
        }

        if (!pluginData.version || pluginData.version < 1.0) {
            /**v1.0,取消对当次更新内容的存储，取消对task的记录，更正scoreHistory */
            if (pluginData.update) {
                delete pluginData.update
            }
            if (pluginData.task_update) {
                delete pluginData.task_update
            }
            if (pluginData.scoreHistory) {
                delete pluginData.scoreHistory
            }
            pluginData.version = 1
        }

        /**data历史记录 */
        if (!pluginData.data) {
            pluginData.data = []
        }
        /**rks历史记录 */
        if (!pluginData.rks) {
            pluginData.rks = []
        }


        var now = new Save(User)
        var date = User.saveInfo.modifiedAt.iso


        for (var song in now.gameRecord) {
            if (old && song in old.gameRecord) {
                for (var i in now['gameRecord'][song]) {
                    if (now['gameRecord'][song][i]) {
                        var nowRecord = now['gameRecord'][song][i]
                        var oldRecord = old['gameRecord'][song][i]
                        if (oldRecord && ((nowRecord.acc != oldRecord.acc) || (nowRecord.score != oldRecord.score))) {
                            add_new_score(pluginData, this.Level[i], this.idgetsong(song, false), nowRecord, oldRecord, new Date(now.saveInfo.updatedAt), new Date(old.saveInfo.updatedAt))
                        } else if (!oldRecord) {
                            add_new_score(pluginData, this.Level[i], this.idgetsong(song, false), nowRecord, undefined, new Date(now.saveInfo.updatedAt), new Date(old.saveInfo.updatedAt))
                        }
                    }
                }
            } else {
                for (var i in now['gameRecord'][song]) {
                    if (now['gameRecord'][song][i]) {
                        var nowRecord = now['gameRecord'][song][i]
                        add_new_score(pluginData, this.Level[i], get.idgetsong(song, false), nowRecord, undefined, new Date(now.saveInfo.updatedAt), undefined)
                    }
                }
            }
        }

        if (pluginData.data.length >= 2 && now.gameProgress.money == pluginData.data[pluginData.data.length - 2]['value']) {
            pluginData.data[pluginData.data.length - 1] = {
                "date": date,
                "value": now.gameProgress.money
            }
        } else {
            pluginData.data.push({
                "date": date,
                "value": now.gameProgress.money
            })
        }

        if (pluginData.rks.length >= 2 && now.saveInfo.summary.rankingScore == pluginData.rks[pluginData.rks.length - 2]['value']) {
            pluginData.rks[pluginData.rks.length - 1] = {
                "date": date,
                "value": now.saveInfo.summary.rankingScore
            }
        } else {
            pluginData.rks.push({
                "date": date,
                "value": now.saveInfo.summary.rankingScore
            })
        }


        await this.putpluginData(e.user_id, pluginData)

        return false
    }

    /**获取best19图片 */
    async getb19(e, data) {
        return await atlas.b19(e, data)
    }

    /**获取update图片 */
    async getupdate(e, data) {
        return await atlas.update(e, data)
    }

    /**获取任务列表图片 */
    async gettasks(e, data) {
        return await atlas.tasks(e, data)
    }

    /**获取个人信息图片 */
    async getuser_info(e, data, kind) {
        return await atlas.user_info(e, data, kind)
    }

    /**获取定级区间成绩 */
    async getlvsco(e, data) {
        return await atlas.lvsco(e, data)
    }

    /**获取单曲成绩 */
    async getsingle(e, data) {
        return await atlas.score(e, data)
    }

    /**获取曲绘图鉴 */
    async getillatlas(e, data) {
        return await atlas.ill(e, data)
    }

    /**获取猜曲绘图片 */
    async getguess(e, data) {
        return await atlas.guess(e, data)
    }

    /**获取随机曲目图片 */
    async getrand(e, data) {
        return await atlas.rand(e, data)
    }

    /**获取曲绘，返回地址，原名
     * @param {string} name 原名
     * @return 网址或文件地址
    */
    getill(name) {
        const totinfo = { ...this.ori_info, ...this.sp_info, ...Config.getDefOrConfig('otherinfo') }
        var ans
        if (!totinfo[name]) {
            throw new Error(`未找到[${name}]的曲目资料！`)
        }
        ans = totinfo[name].illustration_big
        var reg = /^(?:(http|https|ftp):\/\/)((?:[\w-]+\.)+[a-z0-9]+)((?:\/[^/?#]*)+)?(\?[^#]+)?(#.+)?$/i
        if (ans && !reg.test(ans)) {
            ans = `${this.orillPath}${ans}`
        }
        if (!ans) {
            ans = `${this.imgPath}phigros.png`
        }
        if (this.ori_info[name]) {
            if (fs.existsSync(`${this.resPath}original_ill/${this.SongGetId(name).replace(/.0$/, '.png')}`)) {
                ans = `${this.resPath}original_ill/${this.SongGetId(name).replace(/.0$/, '.png')}`
            }
        }
        return ans
    }

    /**
     * 通过id获得头像文件名称
     * @param {string} id 
     * @returns file name
     */
    idgetavatar(id) {
        return this.avatarid[id]
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

    /**
     * 计算等效rks
     * @param {number} acc 
     * @param {number} difficulty 
     * @returns 
     */
    getrks(acc, difficulty) {
        if (acc == 100) {
            /**满分原曲定数即为有效rks */
            return Number(difficulty)
        } else if (acc < 55) {
            /**无效acc */
            return 0
        } else {
            /**非满分计算公式 [(((acc - 55) / 45) ^ 2) * 原曲定数] */
            return difficulty * (((acc - 55) / 45) * ((acc - 55) / 45))
        }
    }

    /**
     * 计算所需acc
     * @param {Number} rks 目标rks
     * @param {Number} difficulty 定数
     * @param {Number} [count=undefined] 保留位数
     * @returns 所需acc
     */
    comsuggest(rks, difficulty, count = undefined) {
        var ans = 45 * Math.sqrt(Number(rks.toFixed(2)) / difficulty) + 55

        if (ans >= 100)
            return "无法推分"
        else {
            if (count != undefined) {
                return `${ans.toFixed(count)}%`
            } else {
                return ans
            }
        }
    }

    /**
     * 根据原曲曲名获取结构化的曲目信息
     * @param {string} song 原曲曲名
     * @param {boolean} [ori=false] 是否只启用原版
     */
    init_info(song, ori = false) {
        if (ori) {
            return new SongsInfo(this.ori_info[song])
        } else {
            return new SongsInfo(this.info(song))
        }
    }

    /**
     * 结构化存档数组
     * @param {Array} Record 单曲存档数组
     */
    init_Record(Record, id) {
        for (var i in Record) {
            Record[i] = new LevelRecord(Record[i], id, this.Level[i])
        }
    }

}

var get = new getdata()
await get.init()
export default get


/**
 * 处理新成绩
 * @param {Object} pluginData
 * @param {EZ|HD|IN|AT|LEGACY} level 
 * @param {String} song 原曲名称
 * @param {Object} nowRecord 当前成绩
 * @param {Object} oldRecord 旧成绩
 * @param {Date} new_date 新存档时间
 * @param {Date} old_date 旧存档时间
 */
function add_new_score(pluginData, level, song, nowRecord, oldRecord, new_date, old_date) {


    if (!pluginData.scoreHistory) {
        pluginData.scoreHistory = {}
    }
    if (!pluginData.scoreHistory[song]) {
        pluginData.scoreHistory[song] = {}
        if (oldRecord) {
            pluginData.scoreHistory[song][level] = [scoreHistory.create(oldRecord.acc, oldRecord.score, old_date)]
        }
    }
    if (!pluginData.scoreHistory[song][level]) {
        pluginData.scoreHistory[song][level] = []
    }
    pluginData.scoreHistory[song][level].push(scoreHistory.create(nowRecord.acc, nowRecord.score, new_date))

    var task
    if (pluginData.plugin_data) {
        task = pluginData.plugin_data.task
    }
    if (task) {
        for (var i in task) {
            if (!task[i]) continue
            if (!task[i].finished && song == task[i].song && level == task[i].request.rank) {
                var isfinished = false
                var reward = 0
                switch (task[i].request.type) {
                    case 'acc': {
                        if (nowRecord.acc >= task[i].request.value) {
                            isfinished = true
                            pluginData.plugin_data.task[i].finished = true
                            pluginData.plugin_data.money += task[i].reward
                            reward = task[i].reward
                        }
                        break
                    }
                    case 'score': {
                        if (nowRecord.score >= task[i].request.value) {
                            isfinished = true
                            pluginData.plugin_data.task[i].finished = true
                            pluginData.plugin_data.money += task[i].reward
                            reward = task[i].reward
                        }
                        break
                    }
                }
            }
        }
    }
    return false
}
