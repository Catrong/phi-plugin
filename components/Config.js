
import YAML from 'yaml'
import chokidar from 'chokidar'
import fs from 'node:fs'
import YamlReader from './YamlReader.js'

const Path = process.cwd()
const Plugin_Name = 'phi-plugin'
const Plugin_Path = `${Path}/plugins/${Plugin_Name}`
class Config {
    constructor() {
        this.config = {}

        /** 监听文件 */
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

    /** 默认配置和用户配置 
     * @param {'config'|'nickconfig'|'otherinfo'} name 文件名
     * @param {'renderScale'
     * |'randerQuality'
     * |'b19size'
     * |'WordB19Img'
     * |'WordSuggImg'
     * |'cmdhead'
     * |'GuessTipCd'
     * |'GuessTipRecall'
     * |'isGuild'
     * |'LetterWinner'
     * |'LetterGuessCd'
     * |'LetterRevealCd'
     * |'LetterTipCd'
     * |'otherinfo'
     * |'LetterNum'
     * |'timeout'
     * |'maxRandering'
     * |'waitingTimeout'
     * |'ban'
     * |'MicTipCd'
     * |'VikaToken'
     * |'HistoryScoreNum'
     * |'HistoryScoreDate'
     * |'LetterTimeLength'
     * |'HistoryDayNum' } style key值
    */
    getDefOrConfig(name, style) {
        let def = this.getdefSet(name)
        let config = this.getConfig(name)
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
    getdefSet(name) {
        return this.getYaml('default_config', name)
    }

    /** 用户配置 */
    getConfig(name) {
        return this.getYaml('config', name)
    }

    /**
     * 获取配置yaml
     * @param type 默认配置-defSet，用户配置-config
     * @param name 名称
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
    watch(file, name, type = 'default_config') {
        let key = `${type}.${name}`

        if (this.watcher[key]) return

        const watcher = chokidar.watch(file)
        watcher.on('change', path => {
            delete this.config[key]
            if (typeof Bot == 'undefined') return
            logger.mark(`[phi修改配置文件][${type}][${name}]`)
            if (this[`change_${name}`]) {
                this[`change_${name}`]()
            }
        })

        this.watcher[key] = watcher
    }

    /**
     * @description: 修改设置
     * @param {'config'|'nickconfig'} name 文件名
     * @param {String} key 修改的key值
     * @param {String|Number} value 修改的value值
     * @param {'config'|'default_config'} type 配置文件或默认，默认为配置
     */
    modify(name, key, value, type = 'config') {
        let path = `${Plugin_Path}/config/${type}/${name}.yaml`
        new YamlReader(path).set(key, value)
        delete this.config[`${type}.${name}`]
    }

    /**
     * @description: 修改配置数组
     * @param {'config'|'nickconfig'} name 文件名
     * @param {String|Number} key key值
     * @param {String|Number} value value
     * @param {'add'|'del'} category 类别 add or del
     * @param {'config'|'default_config'} type 配置文件或默认
     */
    modifyarr(name, key, value, category = 'add', type = 'config') {
        let path = `${Plugin_Path}/config/${type}/${name}.yaml`
        let yaml = new YamlReader(path)
        if (category == 'add') {
            yaml.addIn(key, value)
        } else {
            let index = yaml.jsonData[key].indexOf(value)
            yaml.delete(`${key}.${index}`)
        }
    }
}

export default new Config()
