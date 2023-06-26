
import fs, { copyFileSync } from 'node:fs';
import { _path } from "./path.js";
import { segment } from "oicq";
import atlas from "./picmodle.js";
import Film from './Doc.js';


class get {


    constructor() {
        /**曲绘资源、曲目信息路径 */
        // this.infoPath = `E:/bot/miao2/Miao-Yunzai/plugins/phi-plugin/resources/info/`
        this.infoPath = `${_path}/plugins/phi-plugin/resources/info/`

        /**用户数据路径 */
        this.userPath = `${_path}/plugins/phi-plugin/data/`

        /**用户设置路径 */
        this.configPath = `${_path}/plugins/phi-plugin/config/`
        this.config = 0

        /**默认设置路径 */
        this.defaultPath = `${_path}/plugins/phi-plugin/config/default_config/`
        this.default = 0

        this.imgPath = `${_path}/plugins/phi-plugin/resources/otherimg/`

    }

    async init() {
        this.info = await this.getData('infolist.json', this.infoPath)
        this.songsid = await this.getData('songsid.yaml', this.infoPath)
        this.songnick = await this.getData('nicklist.yaml', this.infoPath)
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



    /**匹配歌曲名称，根据参数返回原曲名称 */
    async songsnick(mic) {
        let nickconfig = await this.getData('nickconfig.yaml', this.configPath)
        var all = []



        if (this.songnick[mic]) {
            for (var i in this.songnick[mic]) {
                all.push(this.songnick[mic][i])
            }
        }
        if (nickconfig[mic]) {
            for (var i in nickconfig[mic]) {
                all.push(nickconfig[mic][i])
            }
        }
        if (all) {
            return all
        }
        return false
    }

    /**设置别名 原名, 别名 */
    async setnick(mic, nick) {
        let nickconfig = await this.getData('nickconfig.yaml', this.configPath)
        if (!nickconfig) {
            nickconfig = {}
        }
        if (!nickconfig[nick]) {
            nickconfig[nick] = []
        }
        nickconfig[nick].push(mic)

        this.setData('nickconfig.yaml', nickconfig, this.configPath)
    }

    /**获取歌曲介绍，曲名为原名 */
    getsongsinfo(e, name, data) {

        if (!data) {
            data = this.info[name]
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

    /**获取曲绘，返回地址，原名
     * @param {string} name 原名
     * @param {boolean} [isBig=true] 是否为大图
    */
    getill(name, isBig = true) {
        if (isBig) {
            return this.info[name].illustration_big
        } else {
            return this.info[name].illustration
        }
    }

    /**获取QQ号对应的存档文件
     * 
     * @param {String} user_id 
     * @returns save
     */
    async getsave(id) {
        return await this.getData(`${id}.json`, `${this.userPath}`)
    }

    /**根据曲目id获取曲目信息
     * 
     * @param {String} 曲目id 
     * @returnsthis.info
     */
    async idgetsong(id) {

        return this.info[this.songsid[id]]
    }

    /**计算等效rks
     * 
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
