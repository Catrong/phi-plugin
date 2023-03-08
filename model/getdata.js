
import fs from 'node:fs'
import YAML from 'yaml'
import { _path } from "./path.js";
import { segment } from "oicq";
import fetch from "node-fetch"


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
        this.defaultPath = `${_path}/plugins/phi-plugin/config/default/`
        this.default = {}
    }


    /**获取 chos.yaml 文件 */
    getData(chos) {
        let path
        if (chos.includes('list')) {
            path = `${this.infoPath}`
        } else if(chos.includes('config')) {
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
            if (!fs.existsSync(`${path}${chos}.yaml`)) { return false}
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
        } else if(chos.includes('config')) {
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
        if (song) {
            let url
            if(isBig) {
                url = infolist[`${img}`][`illustration_big`]
            } else {
                url = infolist[`${img}`][`illustration`]
            }
        }
        logger.info('未找到 ' + img)
        return false
        
        //if (url) {
        //    return segment.image(url)
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

    /**获取章节信息，曲名为原名 */
    songschap(mic) {
        let infolist = this.getData('infolist')
        return infolist[`${mic}`]['chapter']
    }

    /**获取上架时间，曲名为原名 */
    // songsvison(mic) {
    //     let infolist = this.getData('infolist')
    //     return infolist[`${mic}`]['version']
    // }

    /**匹配歌曲名称，根据参数返回原曲名称 list优先级大于config */
    songsnick(mic) {
        let songnick = this.getData('nicklist')
        let nickconfig = this.getData('nickconfig')
        if (songnick[mic]) {
            return songnick[mic]
        } else if (nickconfig[mic]) {
            return nickconfig[mic]
        }
        return false
    }

    /**设置别名 原名, 别名 */
    setnick(mic, nick) {
        let nickconfig = this.getData('nickconfig')
        nickconfig[`${nick}`] = `${mic}`
        this.setData('nickconfig', nickconfig)
    }

    /**获取歌曲介绍，曲名支持别名，格式支持修改/config/showconfig.yaml热更新 */
    getsongsinfo(mic) {
        let name = this.songsnick(mic)
        if (name) {
            let showconfig = this.getData('showconfig')
            let infolist = this.getData('infolist')
            let msgRes = []
            let cnt = 0
            for (let i = 1; ; ++i) {
                if (showconfig[`${i}`]['vis'] == '结束') {
                    /**结束 */
                    break
                }
                switch (showconfig[`${i}`]['vis']) {
                    case '曲绘': {
                        /**特殊类型：曲绘 */
                        msgRes[cnt++] = this.getimg(name, true)
                        break
                    } case '文字': {
                        /**特殊类型：文字 */
                        msgRes[cnt++] = showconfig[`${i}`]['val']
                        break
                    } case '定级': {
                        /**特殊类型：定级(物量)  */
                        if (infolist[`${name}`]['sp_level']) {
                            msgRes[cnt++] = `SP: ${infolist[`${name}`]['sp_level']}    物量: ${infolist[`${name}`]['sp_combo']}\n谱师: ${infolist[`${name}`]['sp_charter']}\n`
                        }
                        if (infolist[`${name}`]['at_level']) {
                            msgRes[cnt++] = `AT: ${infolist[`${name}`]['at_level']}    物量: ${infolist[`${name}`]['at_combo']}\n谱师: ${infolist[`${name}`]['at_charter']}\n`
                        }
                        if (infolist[`${name}`]['in_level']) {
                            msgRes[cnt++] = `IN: ${infolist[`${name}`]['in_level']}    物量: ${infolist[`${name}`]['in_combo']}\n谱师: ${infolist[`${name}`]['in_charter']}\n`
                        }
                        if (infolist[`${name}`]['hd_level']) {
                            msgRes[cnt++] = `HD: ${infolist[`${name}`]['in_level']}    物量: ${infolist[`${name}`]['hd_combo']}\n谱师: ${infolist[`${name}`]['hd_charter']}\n`
                        }
                        if (infolist[`${name}`]['ez_level']) {
                            msgRes[cnt++] = `EZ: ${infolist[`${name}`]['ez_level']}    物量: ${infolist[`${name}`]['ez_combo']}\n谱师: ${infolist[`${name}`]['ez_charter']}`
                        }
                        break
                    } case '曲名': {
                        msgRes[cnt++] = infolist[`${name}`][`song`]
                        break
                    } case '曲师': {
                        msgRes[cnt++] = infolist[`${name}`][`composer`]
                        break
                    } case '长度': {
                        msgRes[cnt++] = infolist[`${name}`][`length`]
                        break
                    } case '章节': {
                        msgRes[cnt++] = infolist[`${name}`][`chapter`]
                        break
                    } case '画师': {
                        msgRes[cnt++] = infolist[`${name}`][`illustrator`]
                        break
                    } case 'BPM': {
                        msgRes[cnt++] = infolist[`${name}`][`bpm`]
                        break
                    }
                    default: {
                        /**错误类型 */
                        logger.info(`[phi 插件] 未找到 ${showconfig[`${i}`]['vis']} 所对应的信息`)
                    }
                }
            }
            return msgRes
        } else {
            /**未找到曲目 */
            return `未找到${mic}的相关曲目信息QAQ`
        }
    }
}

export default new get()
