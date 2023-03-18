
import fs from 'node:fs'
import YAML from 'yaml'
import { _path } from "./path.js";
import { segment } from "oicq";
import fetch from "node-fetch"
import atlas from "./songatlas.js"


class get {
    constructor() {
        /**曲绘资源、曲目信息路径 */
        this.infoPath = `${_path}/plugins/phi-plugin/resources/`
        this.info = {}

        /**用户数据路径 */
        this.userPath = `${_path}/plugins/phi-plugin/data/`
        this.user = {}

        /**用户设置路径 */
        this.configPath = `${_path}/plugins/phi-plugin/config/`
        this.config = {}

        /**默认设置路径 */
        this.defaultPath = `${_path}/plugins/phi-plugin/config/default_config/`
        this.default = {}
    }


    /**获取 chos.yaml 文件 */
    getData(chos) {
        let path
        if (chos.includes('list')) {
            path = `${this.infoPath}`
        } else if (chos.includes('config')) {
            path = `${this.configPath}`
            try {
                if (!fs.existsSync(`${path}${chos}.yaml`)) { return YAML.parse(fs.readFileSync(`${this.defaultPath}${chos}.yaml`, 'utf8')) }
                return YAML.parse(fs.readFileSync(`${path}${chos}.yaml`, 'utf8'))
            } catch (error) {
                logger.error(`[phi插件][${chos}].yaml 读取失败 ${error}`)
                return false
            }
        } else {
            path = `${this.userPath}`
        }
        try {
            if (!fs.existsSync(`${path}${chos}.yaml`)) { return false }
            return YAML.parse(fs.readFileSync(`${path}${chos}.yaml`, 'utf8'))
        } catch (error) {
            logger.error(`[phi插件][${chos}].yaml 读取失败 ${error}`)
            return false
        }
    }

    /**修改 chos.yaml 文件为 data */
    setData(chos, data) {
        let path
        if (chos.includes('list')) {
            path = `${this.infoPath}`
        } else if (chos.includes('config')) {
            path = `${this.configPath}`
        } else {
            path = `${this.userPath}`
        }
        try {
            if (!fs.existsSync(path)) {
                // 递归创建目录
                fs.mkdirSync(path, { recursive: true });
            }
            fs.writeFileSync(`${path}${chos}.yaml`, YAML.stringify(data), 'utf8')
        } catch (error) {
            logger.error(`[phi插件]写入文件${chos}.yaml时遇到错误\n${error}`)
            return false
        }
    }

    /**删除 chos.yaml 文件 */
    delData(chos) {
        let path = `${this.userPath}`
        try {
            if (!fs.existsSync(`${path}${chos}.yaml`)) { return false }
            fs.unlink(`${path}${chos}.yaml`, (err) => {
                if (err) throw err
                logger.info(`[phi插件] ${chos}.yaml 已删除`)
            })
            return true
        } catch (error) {
            logger.error(`[phi插件][${chos}].yaml 读取失败 ${error}`)
            return false
        }
    }


    /**获取曲绘/图片 ，曲名为原名 是否为大图 */
    getimg(img, isBig) {
        // name = 'phi'
        let infolist = this.getData('infolist')
        let song = this.songsnick(img)
        let url = 0
        if (song) {
            if (isBig) {
                url = infolist[`${song}`][`illustration_big`]
            } else {
                url = infolist[`${song}`][`illustration`]
            }
        }

        if (url) {
            return segment.image(url)
        }
        logger.info('未找到 ' + img)
        return false
        //} else {
        //    return segment.image(`/plugins/phi-plugin/resources/otherimg/${img}`)
        //}
    }


    /**获取歌曲的曲名序号(音序)，曲名为原名 */
    getsongsxh(mic) {
        let resonglist = this.getData('resonglist')
        if (resonglist[`${mic}`]) {
            return resonglist[`${mic}`]
        } else {
            return false
        }
    }


    /**匹配歌曲名称，根据参数返回原曲名称 */
    songsnick(mic) {
        let songnick = this.getData('nicklist')
        let nickconfig = this.getData('nickconfig')
        let all = []
        if (songnick[mic]) {
            for (var i in songnick[mic]) {
                all.push(songnick[mic][i])
            }
        }
        if (nickconfig[mic]) {
            for (var i in nickconfig[mic]) {
                all.push(nickconfig[mic][i])
            }
        }
        if (all) {
            if (all.length == 1) {
                return all[0]
            } else {
                return all
            }
        }
        return false
    }

    /**设置别名 原名, 别名 */
    setnick(mic, nick) {
        let nickconfig = this.getData('nickconfig')
        if (!nickconfig) {
            nickconfig = {}
        }
        if (!nickconfig[nick]) {
            nickconfig[nick] = []
        }
        nickconfig[nick].push(mic)

        this.setData('nickconfig', nickconfig)
    }

    /**获取歌曲介绍，曲名为原名，格式支持修改/config/showconfig.yaml热更新 */
    getsongsinfo(e, name) {
        if (name) {
            let infolist = this.getData('infolist')
            return atlas.atlas(e, infolist[name])
        } else {
            /**未找到曲目 */
            return `未找到${name}的相关曲目信息QAQ`
        }
    }
}

export default new get()
