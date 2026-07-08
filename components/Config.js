
import YAML from 'yaml'
import chokidar from 'chokidar'
import fs from 'node:fs'
import YamlReader from './YamlReader.js'
import { pluginRoot } from '../model/path.js'
import logger from './Logger.js'
import platform from './platform/index.js'

const Plugin_Name = 'phi-plugin'
const Plugin_Path = pluginRoot
class Config {
    constructor() {
        /** @type {Record<string, any>} */
        this.config = {}

        /** 监听文件 */
        /** @type {Record<string, any>} */
        this.watcher = { config: {}, defSet: {} }

        this.initCfg()
    }

    /** 初始化配置 */
    initCfg() {
        let path = `${Plugin_Path}/config/config/`
        let pathDef = `${Plugin_Path}/config/default_config/`
        const files = fs.readdirSync(pathDef).filter(file => file.endsWith('.yaml'))
        for (let file of files) {
            if (!fs.existsSync(`${path}${file}`)) {
                fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
            }
            this.watch(`${path}${file}`, file.replace('.yaml', ''), 'config')
        }
    }

    /** 群配置 */
    getGroup(groupId = '') {
        let config = this.getConfig('whole')
        let group = this.getConfig('group')
        let defCfg = this.getdefSet('whole')

        if (group[groupId]) {
            return { ...defCfg, ...config, ...group[groupId] }
        }
        return { ...defCfg, ...config }
    }

    /**
     * @overload
     * @param {'config'} name 文件名
     * @param {configName} style key值
     * @returns {any} 配置值
     */
    /**
     * @overload
     * @param {'nickconfig'} name 文件名
     * @param {string} mic 别名
     * @returns {idString[]} 原曲id
     */
    /**
     * @overload
     * @param {'nickconfig'} name 文件名
     * @returns {Record<string, idString[]>} <别名: 原曲id[]>
     */
    /**
     * @overload
     * @param {'otherinfo'} name 文件名
     * @returns {any} 其他信息
     */
    /** 
     * @param {'config'|'nickconfig'|'otherinfo'} name 文件名
     * @param {any} [style] key值
     * @description 默认配置和用户配置
    */
    getUserCfg(name, style = undefined) {
        let def = this.getdefSet(name)
        let config = this.getConfig(name)
        if (name == 'otherinfo' && config) {
            for (let i in config) {
                config[i].sp_vis = true;
            }
        }
        if (style) {
            if (typeof config[style] != 'undefined') {
                return config[style]
            } else {
                /**对设置进行补全 */
                if (name == 'config') {
                    this.modify(name, style, def[style])
                }
                return def[style]
            }
        }
        else
            return (config ? config : def)
    }

    /** 默认配置 */
    /**
     * @param {string} name
     * @returns {Record<string, any>}
     */
    getdefSet(name) {
        return this.getYaml('default_config', name)
    }

    /** 用户配置 */
    /**
     * @param {string} name
     * @returns {Record<string, any>}
     */
    getConfig(name) {
        return this.getYaml('config', name)
    }

    /**
     * 获取配置yaml
     * @param {'config'|'default_config'} type 默认配置-defSet，用户配置-config
     * @param {string} name 名称
     * @returns {Record<string, any>}
     */
    getYaml(type, name) {
        let file = `${Plugin_Path}/config/${type}/${name}.yaml`
        let key = `${type}.${name}`

        if (this.config[key]) return this.config[key]

        this.config[key] = YAML.parse(
            fs.readFileSync(file, 'utf8')
        )

        this.watch(file, name, type)

        return this.config[key]
    }

    /** 监听配置文件 */
    /**
     * @param {string} file
     * @param {string} name
     * @param {'config'|'default_config'} [type]
     */
    watch(file, name, type = 'default_config') {
        let key = `${type}.${name}`

        if (this.watcher[key]) return

        const watcher = chokidar.watch(file)
        watcher.on('change', path => {
            delete this.config[key]
            if (!platform.isBotReady()) return
            logger.mark(`[phi修改配置文件][${type}][${name}]`)
            const changeHandler = /** @type {Record<string, any>} */ (this)[`change_${name}`]
            if (typeof changeHandler === 'function') {
                changeHandler.call(this)
            }
        })

        this.watcher[key] = watcher
    }

    /**
     * @overload
     * @param {'config'} name 文件名
     * @param {configName} key 修改的key值
     * @param {String|Number|boolean} value 修改的value值
     * @param {'config'|'default_config'} [type] 配置文件或默认，默认为配置
     * @returns {void}
     */
    /**
     * @overload
     * @param {'nickconfig'} name 文件名
     * @param {any} key 别名
     * @param {String|Number|any[]} value 修改的value值
     * @param {'config'|'default_config'} [type] 配置文件或默认，默认为配置
     * @returns {void}
     */
    /**
     * @description: 修改设置
     * @param {'config'|'nickconfig'} name 文件名
     * @param {any} key 修改的key值
     * @param {String|Number|boolean|any[]} value 修改的value值
     * @param {'config'|'default_config'} [type] 配置文件或默认
     */
    modify(name, key, value, type = 'config') {
        let path = `${Plugin_Path}/config/${type}/${name}.yaml`
        new YamlReader(path).set(key, value)
        delete this.config[`${type}.${name}`]
    }

    /**
     * @description: 修改配置数组
     * @param {'config'|'nickconfig'} name 文件名
     * @param {string | number} key key值
     * @param {String|Number} value value
     * @param {'add'|'del'} category 类别 add or del
     * @param {'config'|'default_config'} type 配置文件或默认
     */
    modifyarr(name, key, value, category = 'add', type = 'config') {
        let path = `${Plugin_Path}/config/${type}/${name}.yaml`
        let yaml = new YamlReader(path)
        const keyPath = String(key)
        if (category == 'add') {
            yaml.addIn(keyPath, value)
        } else {
            let index = yaml.jsonData[keyPath].indexOf(value)
            yaml.delete(`${keyPath}.${index}`)
        }
    }
}

export default new Config()
