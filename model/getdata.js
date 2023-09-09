
import fs from 'node:fs'
import { _path } from "./path.js";
import { segment } from "oicq";
import Film from './Doc.js';
import atlas from "./picmodle.js";
import Config from "../components/Config.js";
import LevelRecord from "./LevelRecord.js";

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


        this.Level = ['EZ', 'HD', 'IN', 'AT'] //难度映射

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

        /**含有曲绘的曲目列表 */
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

    info() {
        switch (Config.getDefOrConfig('config', 'otherinfo')) {
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

    /**获取 chos 文件 
     * @param {string}  chos 文件名称 含后缀
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
     * @param {string} chos 文件名称 含后缀
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
     * @param {string} chos 文件名称 含后缀
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
        return await this.getData(`${id}.json`, `${this.userPath}`)
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
                await timeout(500)
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
    getsongsinfo(e, name, data = undefined) {

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
    async getsongsill(e, name, data = undefined) {
        if (data) {
            return await get.getillatlas(e, { illustration: data.illustration, illustrator: data.illustrator })
        } else {
            return await get.getillatlas(e, { illustration: get.getill(name), illustrator: get.info()[songs]["illustrator"] })
        }

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
    async getuser_info(e, data) {
        return await atlas.user_info(e, data)
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
     * @param {boolean} [isBig=true] 是否为大图
    */
    getill(name, isBig = true) {
        const totinfo = { ...this.ori_info, ...this.sp_info, ...Config.getDefOrConfig('otherinfo') }
        var ans
        if (isBig) {
            ans = totinfo[name].illustration_big
        } else {
            ans = totinfo[name].illustration
        }
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
     * 根据曲目id获取曲目信息
     * @param {String} id 曲目id 
     * @param {true|false} info 是否返回info
     * @returnsthis.info
     */
    idgetsong(id, info = true) {
        if (info) {
            return this.ori_info[this.songsid[id]]
        }
        else {
            return this.songsid[id]
        }
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

    init_Record(Record) {

    }

}

var get = new getdata()
await get.init()

export default get
