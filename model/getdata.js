
import fs from 'node:fs'
import YAML from 'yaml'
import { _path } from "./path.js";
import { segment } from "oicq";


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


    /**获取曲绘/图片 ，曲名为原名 */
    getimg(img) {
        // name = 'phi'
        let Illlist = this.getData('Illlist')
        let name = Illlist[`${img}`]
        if (name) {
            return segment.image(`/plugins/phi-plugin/resources/Ill/${name}.png`)
        } else {
            return segment.image(`/plugins/phi-plugin/resources/otherimg/${img}`)
        }
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
        return infolist[`${mic}`]['chap']
    }

    /**获取上架时间，曲名为原名 */
    songsvison(mic) {
        let infolist = this.getData('infolist')
        return infolist[`${mic}`]['version']
    }

    /**匹配歌曲名称，根据参数返回原曲名称 */
    songsnick(mic) {
        let songnick = this.getData('nicklist')
        return songnick[mic]
    }

    /**设置别名 原名, 别名 */
    setnick(mic, nick) {
        let songnick = this.getData('nicklist')
        songnick[`${nick}`] = `${mic}`
        this.setData('nicklist', songnick)
    }

    /**获取歌曲介绍，曲名支持别名，格式支持修改/config/showconfig.yaml热更新 */
    getsongsinfo(mic) {
        let name = this.songsnick(mic)
        if (name) {
            let showconfig = this.getData('showconfig')
            let infolist = this.getData('infolist')
            let ranklist = this.getData('ranklist')
            let msgRes = []
            let cnt = 0
            for (let i = 1; ; ++i) {
                if (showconfig[`${i}`]['vis'] == 'done') {
                    /**结束 */
                    break
                }
                switch (showconfig[`${i}`]['vis']) {
                    case 'img': {
                        /**特殊类型：曲绘 */
                        msgRes[cnt++] = this.getimg(name)
                        break
                    } case 'msg': {
                        /**特殊类型：文字 */
                        msgRes[cnt++] = showconfig[`${i}`]['val']
                        break
                    } case 'rank': {
                        /**特殊类型：定级(物量) 须保持ranklist和infolist一致 */
                        if (ranklist[`${name}`]['SP']) {
                            msgRes[cnt++] = `SP: ${ranklist[`${name}`]['SP']}    物量: ${infolist[`${name}`]['SP']}\n`
                        }
                        if (ranklist[`${name}`]['AT']) {
                            msgRes[cnt++] = `AT: ${ranklist[`${name}`]['AT']}    物量: ${infolist[`${name}`]['AT']}\n`
                        }
                        if (ranklist[`${name}`]['IN']) {
                            msgRes[cnt++] = `IN: ${ranklist[`${name}`]['IN']}    物量: ${infolist[`${name}`]['IN']}\n`
                        }
                        if (ranklist[`${name}`]['HD']) {
                            msgRes[cnt++] = `HD: ${ranklist[`${name}`]['HD']}    物量: ${infolist[`${name}`]['HD']}\n`
                        }
                        if (ranklist[`${name}`]['EZ']) {
                            msgRes[cnt++] = `EZ: ${ranklist[`${name}`]['EZ']}    物量: ${infolist[`${name}`]['EZ']}`
                        }
                        break
                    } default: {
                        /**非特殊类型，直接读取infolist.yaml */
                        msgRes[cnt++] = infolist[`${name}`][`${showconfig[`${i}`]['vis']}`]
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