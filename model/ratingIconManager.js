import fs from 'node:fs'
import path from 'node:path'
import logger from '../components/Logger.js'
import fileWatcherRegistry from '../components/FileWatcherRegistry.js'
import YamlReader from '../components/YamlReader.js'
import { pluginResources } from './path.js'
import { USER_SETTING_OPTIONS } from './constNum.js'

/** 自定义评级图标包目录 */
export const RATING_ICONS_DIR = path.join(pluginResources, 'html', 'otherimg', 'rating')

/** Phigros 评级值（与成绩数据中的 Rating 保持一致） */
export const RATING_KEYS = ['NEW', 'F', 'C', 'B', 'A', 'S', 'V', 'FC', 'phi']

const BUILTIN_RATING_ICONS = [{ id: 'default', name: '默认' }]
const CONFLICT_IDS = new Set(['default'])
/** 普通对象上的原型保留键，避免图标包 id 污染设置选项。 */
const RESERVED_IDS = new Set(['__proto__', 'constructor', 'prototype'])
const ID_RE = /^[a-zA-Z0-9_-]+$/

/**
 * @typedef {object} CustomRatingIcon 自定义评级图标包
 * @property {string} id 包标识
 * @property {string} name 显示名
 * @property {string} dir 包目录绝对路径
 * @property {string} [author] 作者
 * @property {string} [description] 描述（myset 展示）
 * @property {Record<string, string>} icons 评级值到文件名的映射
 * @property {Record<string, {x: string, y: string}>} offsets 评级值到偏移量的映射
 */

/**
 * 自定义评级图标管理器。
 * 将图标包放入 resources/html/otherimg/rating/<id>/ 即可热更新生效。
 */
export default await new class ratingIconManager {

    constructor() {
        /** @type {Map<string, CustomRatingIcon>} */
        this.customRatingIcons = new Map()
        this.scanning = false
        this.rescanRequested = false
    }

    async init() {
        this.scan()
        const lease = fileWatcherRegistry.watch('rating-icons', RATING_ICONS_DIR, () => {
            this.scan()
        }, ['add', 'addDir', 'change', 'unlink', 'unlinkDir'], { ignoreInitial: true })
        await new Promise(resolve => lease.watcher.once('ready', () => resolve(undefined)))
        this.scan()
        return this
    }

    /** 扫描并重建自定义评级图标包注册表。 */
    scan() {
        if (this.scanning) {
            this.rescanRequested = true
            return
        }
        this.scanning = true
        try {
            /** @type {Map<string, CustomRatingIcon>} */
            const icons = new Map()
            if (fs.existsSync(RATING_ICONS_DIR)) {
                for (const dirName of fs.readdirSync(RATING_ICONS_DIR)) {
                    const dir = path.join(RATING_ICONS_DIR, dirName)
                    let isDir = false
                    try {
                        // 不注册指向资源目录外部的符号链接目录。
                        const stat = fs.lstatSync(dir)
                        isDir = stat.isDirectory() && !stat.isSymbolicLink()
                    } catch { }
                    if (!isDir) continue
                    const entry = this.parseRatingIconDir(dir, dirName, icons)
                    if (entry) icons.set(entry.id, entry)
                }
            }
            this.customRatingIcons = icons
            logger.info(`[phi-plugin][评级图标] 注册表更新完成：内置 ${BUILTIN_RATING_ICONS.length} 个，自定义 ${icons.size} 个`)
        } catch (err) {
            logger.error('[phi-plugin][评级图标] 扫描自定义评级图标失败', err)
        } finally {
            this.scanning = false
            if (this.rescanRequested) {
                this.rescanRequested = false
                this.scan()
            }
        }
    }

    /**
     * 解析单个图标包目录。
     * @param {string} dir
     * @param {string} dirName
     * @param {Map<string, CustomRatingIcon>} icons
     * @returns {CustomRatingIcon | null}
     */
    parseRatingIconDir(dir, dirName, icons) {
        const yamlPath = path.join(dir, 'info.yaml')
        if (!fs.existsSync(yamlPath)) {
            logger.warn(`[phi-plugin][评级图标] ${dirName} 缺少 info.yaml，跳过该图标包`)
            return null
        }

        /** @type {any} */
        let yamlData
        try {
            yamlData = new YamlReader(yamlPath).jsonData
        } catch (err) {
            logger.warn(`[phi-plugin][评级图标] ${dirName} 的 info.yaml 解析失败，跳过该图标包`)
            logger.warn(err)
            return null
        }
        if (!yamlData || typeof yamlData !== 'object') {
            logger.warn(`[phi-plugin][评级图标] ${dirName} 的 info.yaml 为空或格式非法，跳过该图标包`)
            return null
        }

        const id = typeof yamlData.id === 'string' && yamlData.id ? yamlData.id : dirName
        // 纯数字 id 会与 /myset 的序号选择冲突。
        if (!ID_RE.test(id) || /^\d+$/.test(id)) {
            logger.warn(`[phi-plugin][评级图标] ${dirName} 的 id「${id}」非法，跳过该图标包`)
            return null
        }
        const normalizedId = id.toLowerCase()
        if (CONFLICT_IDS.has(normalizedId) || RESERVED_IDS.has(normalizedId)) {
            logger.warn(`[phi-plugin][评级图标] ${dirName} 的 id「${id}」为保留值或与内置图标包冲突，跳过该图标包`)
            return null
        }
        if ([...icons.keys()].some(existingId => existingId.toLowerCase() === id.toLowerCase())) {
            logger.warn(`[phi-plugin][评级图标] ${dirName} 的 id「${id}」与其他图标包重复，跳过该图标包`)
            return null
        }

        const name = typeof yamlData.name === 'string' && yamlData.name ? yamlData.name : id
        /** @type {Record<string, unknown>} */
        const iconConfig = yamlData.icon && typeof yamlData.icon === 'object'
            ? yamlData.icon
            : (yamlData.icons && typeof yamlData.icons === 'object' ? yamlData.icons : {})
        /** @type {Record<string, unknown>} */
        const offsetConfig = yamlData.offset && typeof yamlData.offset === 'object'
            ? yamlData.offset
            : (yamlData.offsets && typeof yamlData.offsets === 'object'
                ? yamlData.offsets
                : (yamlData.iconOffset && typeof yamlData.iconOffset === 'object'
                    ? yamlData.iconOffset
                    : (yamlData.iconOffsets && typeof yamlData.iconOffsets === 'object' ? yamlData.iconOffsets : {})))
        /** @type {Record<string, string>} */
        const iconFiles = {}
        /** @type {Record<string, {x: string, y: string}>} */
        const offsets = {}
        for (const key of RATING_KEYS) {
            const value = iconConfig[key] ?? iconConfig[key.toLowerCase()]
            let file = value
            let inlineOffset = null
            if (value && typeof value === 'object') {
                const iconValue = /** @type {Record<string, unknown>} */ (value)
                file = iconValue.file ?? iconValue.path ?? iconValue.src ?? iconValue.url
                inlineOffset = iconValue.offset ?? iconValue.position ?? iconValue
            }
            if (typeof file === 'string' && file) iconFiles[key] = file
            const configuredOffset = offsetConfig[key] ?? offsetConfig[key.toLowerCase()]
            const parsedOffset = this.parseOffset(configuredOffset ?? inlineOffset)
            if (parsedOffset) offsets[key] = parsedOffset
        }
        if (!Object.keys(iconFiles).length) {
            logger.warn(`[phi-plugin][评级图标] ${dirName} 未定义有效 icon 映射，跳过该图标包`)
            return null
        }

        /** @type {CustomRatingIcon} */
        const entry = { id, name, dir, icons: iconFiles, offsets }
        if (typeof yamlData.Author === 'string' && yamlData.Author) entry.author = yamlData.Author
        if (typeof yamlData.author === 'string' && yamlData.author) entry.author = yamlData.author
        if (typeof yamlData.description === 'string' && yamlData.description) entry.description = yamlData.description
        return entry
    }

    /** @param {string} [id] @returns {CustomRatingIcon | {id: string, name: string} | null} */
    getRatingIcon(id) {
        if (!id) return null
        const exact = this.customRatingIcons.get(id) || BUILTIN_RATING_ICONS.find(item => item.id === id)
        if (exact) return exact
        if (typeof id !== 'string') return null
        const normalized = id.toLowerCase()
        return [...this.customRatingIcons.values()].find(item => item.id.toLowerCase() === normalized)
            || BUILTIN_RATING_ICONS.find(item => item.id.toLowerCase() === normalized)
            || null
    }

    /** @param {string} [id] */
    isRatingIcon(id) {
        return Boolean(this.getRatingIcon(id))
    }

    /** @param {string} [id] */
    isCustomRatingIcon(id) {
        return this.isCustomEntry(this.getRatingIcon(id))
    }

    /**
     * 返回评级图标包列表。
     * @returns {{id: string, src: string}[]}
     */
    getRatingIconList() {
        return [
            ...BUILTIN_RATING_ICONS.map(item => ({ id: item.id, src: item.name })),
            ...[...this.customRatingIcons.values()].map(item => ({ id: item.id, src: item.name })),
        ]
    }

    /**
     * 返回 /myset 使用的动态选项。
     * @returns {Record<string, {title: string, description: string}>}
     */
    getRatingIconOptions() {
        /** @type {Record<string, {title: string, description: string}>} */
        const options = Object.assign(Object.create(null), USER_SETTING_OPTIONS.ratingIcon)
        let index = Object.keys(options).length
        for (const item of this.customRatingIcons.values()) {
            options[item.id] = {
                title: `[${index}]${item.name}`,
                description: item.description || (item.author ? `作者：${item.author}` : ''),
            }
            index++
        }
        return options
    }

    // 兼容更直观的调用名，便于其它渲染入口复用。
    getIconOptions() {
        return this.getRatingIconOptions()
    }

    /**
     * 解析图标包资源 URL。缺失文件不会进入 map，由渲染层回退默认图标。
     * @param {string} id
     * @param {string} resPath
     * @returns {{id: string, name: string, baseUrl: string, icons: Record<string, string>, offsets: Record<string, {x: string, y: string}>, styles: Record<string, string>} | null}
     */
    getRenderInfo(id, resPath) {
        const item = this.getRatingIcon(id) || this.getRatingIcon('default')
        if (!item) return null
        const directory = this.isCustomEntry(item) ? encodeURIComponent(path.basename(item.dir)) : null
        const baseUrl = directory
            ? `${resPath}html/otherimg/rating/${directory}/`
            : `${resPath}html/otherimg/`
        /** @type {Record<string, string>} */
        const icons = {}
        /** @type {Record<string, {x: string, y: string}>} */
        const offsets = {}
        /** @type {Record<string, string>} */
        const styles = {}
        if (this.isCustomEntry(item)) {
            for (const [key, file] of Object.entries(item.icons)) {
                const normalizedFile = this.normalizeAssetPath(file)
                if (!normalizedFile || !this.isSafeAsset(item.dir, normalizedFile)) continue
                icons[key] = baseUrl + normalizedFile.split('/').map(encodeURIComponent).join('/')
                const offset = item.offsets[key]
                if (offset) {
                    offsets[key] = offset
                    if (offset.x !== '0px' || offset.y !== '0px') {
                        // Individual transform properties preserve template positioning and existing transform rules.
                        styles[key] = `translate: ${offset.x} ${offset.y};`
                    }
                }
            }
        }
        return { id: item.id, name: item.name, baseUrl, icons, offsets, styles }
    }

    /**
     * @param {CustomRatingIcon | {id: string, name: string} | null} item
     * @returns {item is CustomRatingIcon}
     */
    isCustomEntry(item) {
        return Boolean(item && 'dir' in item && 'icons' in item && 'offsets' in item)
    }

    /**
     * 默认评级图标 URL map。
     * @param {string} resPath
     * @returns {Record<string, string>}
     */
    getDefaultIcons(resPath) {
        return Object.fromEntries(RATING_KEYS.map(key => [key, `${resPath}html/otherimg/${key}.png`]))
    }

    /**
     * 解析一个评级的偏移配置。数字默认按 px 处理，也接受常用 CSS 长度单位。
     * 支持 {x, y}、{left, top}、[x, y] 及图标项内嵌 offset 写法。
     * @param {unknown} value
     * @returns {{x: string, y: string} | null}
     */
    parseOffset(value) {
        if (value === undefined || value === null) return null
        if (Array.isArray(value)) {
            return this.makeOffset(value[0], value[1])
        }
        if (typeof value === 'number' || typeof value === 'string') {
            return this.makeOffset(value, 0)
        }
        if (typeof value !== 'object') return null
        const object = /** @type {Record<string, unknown>} */ (value)
        if (object.offset && object.offset !== value) return this.parseOffset(object.offset)
        if (object.position && object.position !== value) return this.parseOffset(object.position)
        const x = object.x ?? object.left ?? object.offsetX ?? object.dx ?? object.horizontal
        const y = object.y ?? object.top ?? object.offsetY ?? object.dy ?? object.vertical
        if (x === undefined && y === undefined) return null
        return this.makeOffset(x ?? 0, y ?? 0)
    }

    /** @param {unknown} x @param {unknown} y */
    makeOffset(x, y) {
        const normalizedX = this.normalizeOffsetValue(x)
        const normalizedY = this.normalizeOffsetValue(y)
        if (normalizedX === null || normalizedY === null) return null
        return { x: normalizedX, y: normalizedY }
    }

    /** @param {unknown} value @returns {string | null} */
    normalizeOffsetValue(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? `${value}px` : null
        if (typeof value !== 'string') return null
        const text = value.trim()
        if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|%|vw|vh)?$/.test(text)) return null
        return /[a-z%]$/i.test(text) ? text : `${text}px`
    }

    /** @param {string} dir @param {string} asset */
    isSafeAsset(dir, asset) {
        const normalizedAsset = this.normalizeAssetPath(asset)
        if (!normalizedAsset) return false
        try {
            const root = fs.realpathSync(path.resolve(dir))
            const file = path.resolve(root, normalizedAsset)
            if (file !== root && !file.startsWith(root + path.sep)) return false
            const realFile = fs.realpathSync(file)
            if (realFile !== root && !realFile.startsWith(root + path.sep)) return false
            return fs.statSync(realFile).isFile()
        } catch {
            return false
        }
    }

    /**
     * 将包内资源路径规范化为 URL 使用的正斜杠形式，并拒绝绝对路径/目录穿越。
     * @param {unknown} asset
     * @returns {string | null}
     */
    normalizeAssetPath(asset) {
        if (typeof asset !== 'string' || !asset || asset.includes('\0')) return null
        const normalized = asset.replace(/\\/g, '/')
        if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return null
        if (normalized.split('/').some(part => part === '..')) return null
        return normalized
    }
}().init()
