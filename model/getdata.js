

import { _path } from "./path.js";
import { segment } from "oicq";
import Film from './Doc.js';
import atlas from "./picmodle.js";
import Config from "../components/Config.js";


class get {


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

    }

    async init() {
        this.ori_info = { ...await this.getData('infolist.json', this.infoPath), ...await this.getData('spinfo.json', this.infoPath) }
        this.songsid = await this.getData('songsid.yaml', this.infoPath)
        this.songnick = await this.getData('nicklist.yaml', this.infoPath)
        this.avatarid = await this.getData('avatarid.yaml', this.infoPath)
    }

    info() {
        switch (Config.getDefOrConfig('config', 'otherinfo')) {
            case 0: {
                return this.ori_info
            }
            case 1: {
                return { ...this.ori_info, ...Config.getDefOrConfig('otherinfo') }
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
    * @returns 原曲名称
    */
    fuzzysongsnick(mic) {
        const nickconfig = Config.getDefOrConfig('nickconfig', mic)

        //字符出是否是中英文混合
        const isMixedChineseEnglish = (str) => {
            const chinesePattern = /[\u4e00-\u9fa5]/g
            const englishPattern = /[a-zA-Z]/g
            return chinesePattern.test(str) && englishPattern.test(str)
        }
    
        const fuzzyMatch = (str1, str2) => {
            //首先第一次去除空格和其他符号，并转换为小写
            const pattern = /[\s~`!@#$%^&*()\-=_+\]{}|;:'",<.>/?！￥…（）—【】、；‘：“”，《。》？↑↓←→]/g
            const formattedStr1 = str1.replace(pattern, '').toLowerCase()
            const formattedStr2 = str2.replace(pattern, '').toLowerCase()
        
            //第二次再计算str1和str2之间的JaroWinkler距离
            const distance = this.jaroWinklerDistance(formattedStr1, formattedStr2)

            //检测输入字符串的语言，并选择相应的阈值
            //不同语言的歌曲可能需要不同的阈值
            //中文曲目由于每个汉字代表的信息量比较大，需要更高的阈值
            let patternThresholdMap = [
                { pattern: chinesePattern, threshold: 0.9 },
                { pattern: isMixedChineseEnglish, threshold: 0.86 },
                { pattern: englishPattern, threshold: 0.82 },
                { pattern: japanesePattern, threshold: 0.76 }
            ]

            let threshold = patternThresholdMap.find(item => item.pattern.test(formattedStr1))?.threshold ?? 0.8 //其他语言默认0.8
        
            //如果距离大于等于某个阈值，则认为匹配
            //可以根据实际情况调整这个阈值
            return distance >= threshold
        }
    
        const infoKeys = Object.keys(this.info()).filter(key => fuzzyMatch(mic, key))
        const songnickKeys = Object.keys(this.songnick).filter(key => fuzzyMatch(mic, key))
        const songnickValues = songnickKeys.flatMap(key => this.songnick[key])
    
        let all = [...infoKeys, ...songnickValues]
    
        if (nickconfig) {
            all = [...all, ...Object.values(nickconfig)]
        }
    
        //使用 Set 对象去重
        return [...new Set(all)]
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

    /**获取best19图片 */
    async getb19(e, data) {
        return await atlas.b19(e, data)
    }
    
    /**获取update图片 */
    async getupdate(e, data) {
        return await atlas.update(e, data)
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
        var ans
        if (isBig) {
            ans = this.info()[name].illustration_big
        } else {
            ans = this.info()[name].illustration
        }
        var reg = /^(?:(http|https|ftp):\/\/)((?:[\w-]+\.)+[a-z0-9]+)((?:\/[^/?#]*)+)?(\?[^#]+)?(#.+)?$/i
        if (ans && !reg.test(ans)) {
            ans = `${this.orillPath}${ans}`
        }
        if (!ans) {
            ans = `${this.imgPath}phigros.png`
        }
        return ans
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
     * @returns save
     */
    async getpluginData(id) {
        return await this.getData(`${id}_.json`, `${this.pluginDataPath}`)
    }

    /**
     * 保存QQ号对应的娱乐数据
     * @param {String} id user_id
     * @param {Object} data 
     */
    async putpluginData(id, data) {
        return await this.setData(`${id}_.json`, data, `${this.pluginDataPath}`)
    }

    /**
     * 删除QQ号对应的娱乐数据
     * @param {String} id user_id
     */
    async delpluginData(id) {
        return this.delData(`${id}_.json`,`${this.pluginDataPath}`)
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
        if (info)
            return this.ori_info[this.songsid[id]]
        else
            return this.songsid[id]
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

    /**计算所需acc */
    comsuggest(rks, difficulty) {
        var ans = 45 * Math.sqrt(Number(rks.toFixed(2)) / difficulty) + 55

        if (ans >= 100)
            return "已经到顶啦"
        else
            return ans.toFixed(2) + "%"
    }


}

export default new get()
