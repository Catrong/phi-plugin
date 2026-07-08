import lodash from 'lodash'
import fs from 'fs'
import { pluginRoot } from '../model/path.js'
import logger from './Logger.js'
import { redis } from './platform/index.js'

/**
 * @param {string} [root]
 * @returns {string}
 */
const getRoot = (root = '') => {
    if (root === 'root' || root === 'yunzai') {
        root = `${process.cwd()}/`
    } else if (!root) {
        root = `${pluginRoot}/`
    }
    return root
}

/**
 * @typedef {object} DataPickOptions
 * @property {Record<string, any>} [defaultData]
 * @property {boolean} [lowerFirstKey]
 * @property {string} [keyPrefix]
 */

/** @type {Record<string, any>} */
let Data = {

    /*
    * 根据指定的path依次检查与创建目录
    * */
    createDir(path = '', root = '', includeFile = false) {
        root = getRoot(root)
        let pathList = path.split('/')
        let nowPath = root
        pathList.forEach((name, idx) => {
            name = name.trim()
            if (!includeFile && idx <= pathList.length - 1) {
                nowPath += name + '/'
                if (name) {
                    if (!fs.existsSync(nowPath)) {
                        fs.mkdirSync(nowPath)
                    }
                }
            }
        })
    },

    /** 读取json */
    readJSON(file = '', root = '') {
        root = getRoot(root)
        if (fs.existsSync(`${root}/${file}`)) {
            try {
                return JSON.parse(fs.readFileSync(`${root}/${file}`, 'utf8'))
            } catch (e) {
                logger.error(e)
            }
        }
        return {}
    },

    /** 写JSON */
    /**
     * @param {string} file
     * @param {unknown} data
     * @param {string} [root]
     * @param {string | number} [space]
     */
    writeJSON(file, data, root = '', space = '\t') {
        // 检查并创建目录
        Data.createDir(file, root, true)
        root = getRoot(root)
        // delete data._res
        try {
            fs.writeFileSync(`${root}/${file}`, JSON.stringify(data, null, space))
            return true
        } catch (err) {
            logger.error(err)
            return false
        }
    },

    /**
     * @param {string} key
     */
    async getCacheJSON(key) {
        try {
            let txt = await redis.get(key)
            if (txt) {
                return JSON.parse(txt)
            }
        } catch (e) {
            logger.error(e)
        }
        return {}
    },

    /**
     * @param {string} key
     * @param {unknown} data
     * @param {number} [EX]
     */
    async setCacheJSON(key, data, EX = 3600 * 24 * 90) {
        await redis.set(key, JSON.stringify(data), { EX })
    },

    /**
     * @param {string} file
     * @param {string} [root]
     */
    async importModule(file, root = '') {
        root = getRoot(root)
        if (!/\.js$/.test(file)) {
            file = file + '.js'
        }
        if (fs.existsSync(`${root}/${file}`)) {
            try {
                let data = await import(`file://${root}/${file}?t=${Date.now()}`)
                return data || {}
            } catch (e) {
                logger.error(e)
            }
        }
        return {}
    },

    /**
     * @param {string} file
     * @param {string} [root]
     */
    async importDefault(file, root) {
        let ret = await Data.importModule(file, root)
        return ret.default || {}
    },

    /**
     * @param {string} name
     */
    async import(name) {
        return await Data.importModule(`components/optional-lib/${name}.js`)
    },

    /**
     * @param {string} key
     */
    async importCfg(key) {
        let sysCfg = await Data.importModule(`config/system/${key}_system.js`)
        let diyCfg = await Data.importModule(`config/${key}.js`)
        if (diyCfg.isSys) {
            logger.error(`phi-plugin: config/${key}.js无效，已忽略`)
            logger.error(`如需配置请复制config/${key}_default.js为config/${key}.js，请勿复制config/system下的系统文件`)
            diyCfg = {}
        }
        return {
            sysCfg,
            diyCfg
        }
    },

    /*
    * 返回一个从 target 中选中的属性的对象
    *
    * keyList : 获取字段列表，逗号分割字符串
    *   key1, key2, toKey1:fromKey1, toKey2:fromObj.key
    *
    * defaultData: 当某个字段为空时会选取defaultData的对应内容
    * toKeyPrefix：返回数据的字段前缀，默认为空。defaultData中的键值无需包含toKeyPrefix
    *
    * */

    /**
     * @param {Record<string, any>} target
     * @param {string | string[]} [keyList]
     * @param {DataPickOptions} [cfg]
     */
    getData(target, keyList = '', cfg = {}) {
        target = target || {}
        let defaultData = cfg.defaultData || {}
        /** @type {Record<string, any>} */
        let ret = {}
        // 分割逗号
        if (typeof (keyList) === 'string') {
            keyList = keyList.split(',')
        }

        lodash.forEach(keyList, (keyCfg) => {
            // 处理通过:指定 toKey & fromKey
            let _keyCfg = keyCfg.split(':')
            let keyTo = _keyCfg[0].trim()
            let keyFrom = (_keyCfg[1] || _keyCfg[0]).trim()
            let keyRet = keyTo
            if (cfg.lowerFirstKey) {
                keyRet = lodash.lowerFirst(keyRet)
            }
            if (cfg.keyPrefix) {
                keyRet = cfg.keyPrefix + keyRet
            }
            // 通过Data.getVal获取数据
            ret[keyRet] = Data.getVal(target, keyFrom, defaultData[keyTo], cfg)
        })
        return ret
    },

    /**
     * @param {Record<string, any>} target
     * @param {string} keyFrom
     * @param {unknown} defaultValue
     */
    getVal(target, keyFrom, defaultValue) {
        return lodash.get(target, keyFrom, defaultValue)
    },

    // 异步池，聚合请求
    /**
     * @template T, R
     * @param {number} poolLimit
     * @param {T[]} array
     * @param {(item: T, array: T[]) => R | Promise<R>} iteratorFn
     * @returns {Promise<R[]>}
     */
    async asyncPool(poolLimit, array, iteratorFn) {
        /** @type {Promise<R>[]} */
        const ret = [] // 存储所有的异步任务
        /** @type {Promise<void>[]} */
        const executing = [] // 存储正在执行的异步任务
        for (const item of array) {
            // 调用iteratorFn函数创建异步任务
            const p = Promise.resolve().then(() => iteratorFn(item, array))
            // 保存新的异步任务
            ret.push(p)

            // 当poolLimit值小于或等于总任务个数时，进行并发控制
            if (poolLimit <= array.length) {
                // 当任务完成后，从正在执行的任务数组中移除已完成的任务
                const e = p.then(() => undefined)
                executing.push(e) // 保存正在执行的异步任务
                void e.then(() => {
                    const index = executing.indexOf(e)
                    if (index >= 0) executing.splice(index, 1)
                })
                if (executing.length >= poolLimit) {
                    // 等待较快的任务执行完成
                    await Promise.race(executing)
                }
            }
        }
        return Promise.all(ret)
    },

    // sleep
    /**
     * @param {number} ms
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    },

    // 获取默认值
    def() {
        for (let idx in arguments) {
            if (!lodash.isUndefined(arguments[idx])) {
                return arguments[idx]
            }
        }
    },

    // 循环字符串回调
    /**
     * @param {string | number | Array<string | number>} arr
     * @param {(value: string | number, index: number | string) => void} fn
     */
    eachStr: (arr, fn) => {
        if (lodash.isString(arr)) {
            arr = arr.replace(/\s*(;|；|、|，)\s*/, ',')
            arr = arr.split(',')
        } else if (lodash.isNumber(arr)) {
            arr = [arr.toString()]
        }
        lodash.forEach(arr, (str, idx) => {
            if (!lodash.isUndefined(str)) {
                const value = typeof str === 'string' ? str.trim() : str
                fn(value, idx)
            }
        })
    },

    /**
     * @param {RegExp} reg
     * @param {string} txt
     * @param {number} idx
     */
    regRet(reg, txt, idx) {
        if (reg && txt) {
            let ret = reg.exec(txt)
            if (ret && ret[idx]) {
                return ret[idx]
            }
        }
        return false
    }
}

export default Data
