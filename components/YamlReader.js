import fs from 'fs'
import YAML from 'yaml'
import lodash from 'lodash'
import chokidar from 'chokidar'
// import Constant from '../server/constant/Constant.js'

const Constant = {
    CONFIG_INTEGER_KEY: '__yaml_integer_key__',
}

export default class YamlReader {
    /**
     * 读写yaml文件
     *
     * @param {string} yamlPath yaml文件绝对路径
     * @param {boolean} [isWatch] 是否监听文件变化
     */
    constructor(yamlPath, isWatch = false) {
        this.yamlPath = yamlPath
        this.isWatch = isWatch
        /** @type {YAML.Document.Parsed | undefined} */
        this.document = undefined
        /** @type {import('chokidar').FSWatcher | undefined} */
        this.watcher = undefined
        this.isSave = false
        this.initYaml()
    }

    initYaml() {
        try {
            // parseDocument 将会保留注释
            this.document = YAML.parseDocument(fs.readFileSync(this.yamlPath, 'utf8'))
        } catch (error) {
            throw error
        }
        if (this.isWatch && !this.watcher) {
            this.watcher = chokidar.watch(this.yamlPath).on('change', () => {
                if (this.isSave) {
                    this.isSave = false
                    return
                }
                this.initYaml()
            })
        }
    }

    /**返回读取的对象 */
    get jsonData() {
        if (!this.document) {
            return null
        }
        return this.document.toJSON()
    }

    /*检查集合是否包含key的值*/
    /**
     * @param {string} keyPath
     */
    has(keyPath) {
        return this.document?.hasIn(keyPath.split('.')) ?? false
    }
    /*返回key的值*/
    /**
     * @param {string} keyPath
     */
    get(keyPath) {
        return lodash.get(this.jsonData, keyPath)
    }
    /*修改某个key的值*/
    /**
     * @param {string} keyPath
     * @param {unknown} value
     */
    set(keyPath, value) {
        this.document?.setIn(keyPath.split('.'), value)
        this.save()
    }
    /*删除key*/
    /**
     * @param {string} keyPath
     */
    delete(keyPath) {
        this.document?.deleteIn(keyPath.split('.'))
        this.save()
    }
    //数组添加数据
    /**
     * @param {string} keyPath
     * @param {unknown} value
     */
    addIn(keyPath, value) {
        this.document?.addIn(keyPath.split('.'), value)
        this.save()
    }
    /**
     * 设置 document 的数据（递归式）
     * @param {unknown} data 要写入的数据
     */
    setData(data) {
        this.setDataRecursion(data, [])
        this.save()
    }

    /**
     * @param {unknown} data
     * @param {string[]} parentKeys
     */
    setDataRecursion(data, parentKeys) {
        if (Array.isArray(data)) {
            this.document?.setIn(this.mapParentKeys(parentKeys), data)
        } else if (typeof data === 'object' && data !== null) {
            for (const [key, value] of Object.entries(data)) {
                this.setDataRecursion(value, parentKeys.concat([key]))
            }
        } else {
            const mappedParentKeys = this.mapParentKeys(parentKeys)
            this.document?.setIn(mappedParentKeys, data)
        }
    }

    // 将数字key转为number类型，防止出现引号
    /**
     * @param {string[]} parentKeys
     * @returns {(string | number)[]}
     */
    mapParentKeys(parentKeys) {
        return parentKeys.map((k) => {
            if (k.startsWith(Constant.CONFIG_INTEGER_KEY)) {
                return Number.parseInt(k.replace(Constant.CONFIG_INTEGER_KEY, ''))
            }
            return k
        })
    }

    // 彻底删除某个key
    /**
     * @param {string} keyPath
     */
    deleteKey(keyPath) {
        const keys = this.mapParentKeys(keyPath.split('.'))
        this.document?.deleteIn(keys)
        this.save()
    }

    save() {
        this.isSave = true
        let yaml = this.document?.toString() ?? ''
        fs.writeFileSync(this.yamlPath, yaml, 'utf8')
    }
}
