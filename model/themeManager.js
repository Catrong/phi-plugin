import fs from 'node:fs'
import path from 'node:path'
import logger from '../components/Logger.js'
import fileWatcherRegistry from '../components/FileWatcherRegistry.js'
import YamlReader from '../components/YamlReader.js'
import { pluginResources } from './filesystem/path.js'
import { USER_SETTING_OPTIONS } from './game/constNum.js'

/** 自定义主题目录 */
const THEMES_DIR = path.join(pluginResources, 'html', 'b19', 'themes')

/**
 * 内置主题（default/snow/star 无独立模板，走默认 tplFile 解析与布局 theme 分支；
 * dss2 的独立模板在 BUILTIN_TEMPLATES 中统一分发）
 * @type {{id: string, name: string}[]}
 */
const BUILTIN_THEMES = [
    { id: 'default', name: '默认' },
    { id: 'snow', name: '寒冬' },
    { id: 'star', name: '使一颗心免于哀伤' },
    { id: 'dss2', name: '大师赛2' },
]

/** 内置主题的 b19 独立模板（绝对路径） */
/** @type {Record<string, string>} */
const BUILTIN_TEMPLATES = {
    dss2: path.join(pluginResources, 'html', 'b19', 'dss2.art').replace(/\\/g, '/'),
}

/** 自定义主题 id 不允许与之冲突的 id（内置优先） */
const CONFLICT_IDS = new Set(['default', 'snow', 'star', 'dss2', 'topText', 'foolsDay'])

/** 主题 id 合法性 */
const ID_RE = /^[a-zA-Z0-9_-]+$/

/** 页面样式键：app 或 app/template */
const PAGE_KEY_RE = /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?$/

/** 难度色合法性（#RRGGBB / #RGB 等） */
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/

/**
 * 对 URL 中由主题包控制的路径逐段编码，同时保留目录分隔符。
 * @param {string} value
 */
const encodeThemeUrlPath = value => value.split('/').map(encodeURIComponent).join('/')

/**
 * @typedef {object} CustomTheme 自定义主题条目（由 info.yaml 解析得到）
 * @property {string} id 主题标识
 * @property {string} name 显示名
 * @property {string} [author] 作者
 * @property {string} [description] 描述（myset 展示）
 * @property {string} dir 主题目录绝对路径
 * @property {string} dirName 主题目录名
 * @property {string} [font] 字体文件名
 * @property {string} [background] 背景图文件名
 * @property {Record<string, string>} [icons] 评级图标文件名映射（key 与 song.Rating 取值一致）
 * @property {Record<string, string>} [colors] 四难度基础色（AT/IN/HD/EZ）
 * @property {string} [template] b19 模板文件名
 * @property {Record<string, string>} [css] 按渲染页面配置的样式表文件名
 * @property {boolean} [legacyCss] 是否使用旧版 B19 替换样式语义
 */

/**
 * 主题管理器：内置主题与 resources/html/b19/themes/ 下自定义主题的统一注册表，
 * 提供主题列表/选项/渲染配置解析，并支持目录热更新（无需重启 bot）。
 */
export default await new class themeManager {

    constructor() {
        /** @type {Map<string, CustomTheme>} 自定义主题注册表（key 为 id） */
        this.customThemes = new Map()
        /** 扫描去重：扫描中收到新事件则扫描完成后补扫一次 */
        this.scanning = false
        this.rescanRequested = false
    }

    async init() {
        this.scan()
        // 监听主题目录：info.yaml 及主题目录的增删改均触发重新扫描（目录不存在时 chokidar 会等待其出现）
        const lease = fileWatcherRegistry.watch('b19:themes', THEMES_DIR, () => {
            this.scan()
        }, ['add', 'addDir', 'change', 'unlink', 'unlinkDir'], { ignoreInitial: true })
        // ignoreInitial 会丢弃初始扫描完成前的变更，等 watcher 就绪后补扫一次兜底
        await new Promise(resolve => lease.watcher.once('ready', () => resolve(undefined)))
        this.scan()
        return this
    }

    /**
     * 扫描主题目录，重建自定义主题注册表（同步主体，失败不影响内置主题）
     */
    scan() {
        if (this.scanning) {
            this.rescanRequested = true
            return
        }
        this.scanning = true
        try {
            /** @type {Map<string, CustomTheme>} */
            const themes = new Map()
            if (fs.existsSync(THEMES_DIR)) {
                for (const dirName of fs.readdirSync(THEMES_DIR)) {
                    const dir = path.join(THEMES_DIR, dirName)
                    let isDir = false
                    try {
                        // 主题根目录必须是实体目录，避免通过目录链接绕过资源根边界。
                        isDir = fs.lstatSync(dir).isDirectory()
                    } catch { }
                    if (!isDir) continue
                    const entry = this.parseThemeDir(dir, dirName, themes)
                    if (entry) themes.set(entry.id, entry)
                }
            }
            this.customThemes = themes
            logger.info(`[phi-plugin][主题] 注册表更新完成：内置 ${BUILTIN_THEMES.length} 个，自定义 ${themes.size} 个`)
        } catch (err) {
            logger.error('[phi-plugin][主题] 扫描自定义主题失败', err)
        } finally {
            this.scanning = false
            if (this.rescanRequested) {
                this.rescanRequested = false
                this.scan()
            }
        }
    }

    /**
     * 解析单个主题目录的 info.yaml，非法/冲突则 warn 并跳过
     * @param {string} dir 主题目录绝对路径
     * @param {string} dirName 目录名（日志用）
     * @param {Map<string, CustomTheme>} themes 已注册的主题（用于查重）
     * @returns {CustomTheme | null}
     */
    parseThemeDir(dir, dirName, themes) {
        const yamlPath = path.join(dir, 'info.yaml')
        if (!fs.existsSync(yamlPath)) {
            logger.warn(`[phi-plugin][主题] ${dirName} 缺少 info.yaml，跳过该主题`)
            return null
        }
        /** @type {any} */
        let yamlData
        try {
            yamlData = new YamlReader(yamlPath).jsonData
        } catch (err) {
            logger.warn(`[phi-plugin][主题] ${dirName} 的 info.yaml 解析失败，跳过该主题`)
            logger.warn(err)
            return null
        }
        if (!yamlData || typeof yamlData !== 'object') {
            logger.warn(`[phi-plugin][主题] ${dirName} 的 info.yaml 为空或格式非法，跳过该主题`)
            return null
        }

        /** 校验 id：缺失/非法时回退目录名，仍非法则跳过 */
        let id = typeof yamlData.id === 'string' && yamlData.id ? yamlData.id : dirName
        if (!ID_RE.test(id)) {
            logger.warn(`[phi-plugin][主题] ${dirName} 的 id「${id}」非法（须匹配 /^[a-zA-Z0-9_-]+$/），跳过该主题`)
            return null
        }
        if (CONFLICT_IDS.has(id)) {
            logger.warn(`[phi-plugin][主题] ${dirName} 的 id「${id}」与内置主题冲突，跳过该主题（内置优先）`)
            return null
        }
        if (themes.has(id)) {
            logger.warn(`[phi-plugin][主题] ${dirName} 的 id「${id}」与其他自定义主题重复，跳过该主题`)
            return null
        }

        const name = typeof yamlData.name === 'string' && yamlData.name ? yamlData.name : id
        /** @type {CustomTheme} */
        const entry = { id, name, dir, dirName }
        if (typeof yamlData.Author === 'string' && yamlData.Author) entry.author = yamlData.Author
        if (typeof yamlData.description === 'string' && yamlData.description) entry.description = yamlData.description
        /** @type {['font', 'background', 'template']} */
        const assetKeys = ['font', 'background', 'template']
        for (const key of assetKeys) {
            if (typeof yamlData[key] === 'string' && yamlData[key]) entry[key] = yamlData[key]
        }
        if (typeof yamlData.css === 'string' && yamlData.css) {
            // 旧主题包的字符串 CSS 会替换 B19 默认样式，不能改成覆盖层。
            entry.css = { 'b19/b19': yamlData.css }
            entry.legacyCss = true
        } else if (yamlData.css && typeof yamlData.css === 'object') {
            /** @type {Record<string, string>} */
            const pageCss = {}
            for (const [page, file] of Object.entries(yamlData.css)) {
                if (PAGE_KEY_RE.test(page) && typeof file === 'string' && file) pageCss[page] = file
            }
            if (Object.keys(pageCss).length) entry.css = pageCss
        }
        if (yamlData.icon && typeof yamlData.icon === 'object') {
            /** @type {Record<string, string>} */
            const icons = {}
            for (const [k, v] of Object.entries(yamlData.icon)) {
                if (typeof v === 'string' && v) icons[k] = v
            }
            if (Object.keys(icons).length) entry.icons = icons
        }
        if (yamlData.color && typeof yamlData.color === 'object') {
            /** @type {Record<string, string>} */
            const colors = {}
            for (const key of ['AT', 'IN', 'HD', 'EZ']) {
                const v = yamlData.color[key]
                if (typeof v === 'string' && COLOR_RE.test(v)) colors[key] = v
            }
            if (Object.keys(colors).length) entry.colors = colors
        }
        return entry
    }

    /**
     * 获取主题条目（内置或自定义），未知 id 返回 null
     * @param {string} [id]
     * @returns {{id: string, name: string, dir?: string, dirName?: string, template?: string, css?: Record<string, string>, legacyCss?: boolean, font?: string, background?: string, icons?: Record<string, string>, colors?: Record<string, string>} | null}
     */
    getTheme(id) {
        if (!id) return null
        const custom = this.customThemes.get(id)
        if (custom) return custom
        const builtin = BUILTIN_THEMES.find(t => t.id === id)
        return builtin || null
    }

    /**
     * 是否已知主题（含内置）
     * @param {string} [id]
     */
    isTheme(id) {
        return Boolean(this.getTheme(id))
    }

    /**
     * 是否自定义主题
     * @param {string} [id]
     */
    isCustomTheme(id) {
        return Boolean(id && this.customThemes.has(id))
    }

    /**
     * 主题列表 [{id, src}]，内置在前自定义在后（money.js /theme 使用）
     * @returns {{id: string, src: string}[]}
     */
    getThemeList() {
        return [
            ...BUILTIN_THEMES.map(t => ({ id: t.id, src: t.name })),
            ...[...this.customThemes.values()].map(t => ({ id: t.id, src: t.name })),
        ]
    }

    /**
     * 完整主题选项 map（内置 + 自定义，序号连续），setting.js 展示用
     * @returns {Record<string, {title: string, description: string}>}
     */
    getThemeOptions() {
        /** @type {Record<string, {title: string, description: string}>} */
        const options = { ...USER_SETTING_OPTIONS.theme }
        let index = Object.keys(options).length
        for (const t of this.customThemes.values()) {
            options[t.id] = {
                title: `[${index}]${t.name}`,
                description: t.description || (t.author ? `作者：${t.author}` : ''),
            }
            index++
        }
        return options
    }

    /**
     * 渲染配置解析：自定义主题返回模板路径与 themeInfo（实时检查资源存在性，不缓存文件状态）；
     * 内置 dss2 返回其独立模板路径（themeInfo 为 null）；未知/内置无资源返回 null
     * @param {string} id
     * @param {string} resPath 资源根路径（结尾带 /）
     * @param {string} [page] 当前渲染目标（app/template；短键 app 会规范为 app/app）
     * @returns {{tplFile: string | null, themeInfo: any} | null}
     */
    getRenderInfo(id, resPath, page = 'b19/b19') {
        if (!id) return null
        const custom = this.customThemes.get(id)
        if (custom) {
            const baseUrl = `${resPath}html/b19/themes/${encodeURIComponent(custom.dirName)}/`
            const renderTarget = page.includes('/') ? page : `${page}/${page}`
            const app = renderTarget.split('/')[0]
            let realThemeDir
            try {
                realThemeDir = fs.realpathSync(custom.dir)
            } catch {
                return null
            }
            /** 仅解析主题目录内的普通文件，缺失或越界资源均走默认回退。 */
            /** @param {string | undefined} name */
            const resolveAsset = (name) => {
                if (!name) return null
                const candidate = path.resolve(custom.dir, name)
                const relative = path.relative(custom.dir, candidate)
                if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null
                try {
                    if (!fs.lstatSync(candidate).isFile()) return null
                    const realCandidate = fs.realpathSync(candidate)
                    const realRelative = path.relative(realThemeDir, realCandidate)
                    if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) return null
                    return {
                        file: candidate,
                        relative: relative.replace(/\\/g, '/'),
                    }
                } catch {
                    return null
                }
            }
            /** @param {{relative: string}} asset */
            const assetUrl = (asset) => baseUrl + encodeThemeUrlPath(asset.relative)
            /** @type {any} */
            const themeInfo = { id: custom.id, name: custom.name, baseUrl }
            const cssNames = custom.legacyCss
                ? (renderTarget === 'b19/b19' ? [custom.css?.['b19/b19']] : [])
                : [custom.css?.[renderTarget], custom.css?.[app]]
            const pageCss = cssNames.map(resolveAsset).find(Boolean)
            if (pageCss) {
                themeInfo.cssUrl = assetUrl(pageCss)
                themeInfo.cssMode = custom.legacyCss ? 'replace' : 'overlay'
                // 未给当前页面配置 CSS 时保留插件原生字体。
                const font = resolveAsset(custom.font)
                if (font) themeInfo.fontUrl = assetUrl(font)
            }
            const background = resolveAsset(custom.background)
            if (background) themeInfo.backgroundUrl = assetUrl(background)
            if (custom.icons) {
                /** @type {Record<string, string>} */
                const icons = {}
                for (const [k, v] of Object.entries(custom.icons)) {
                    const icon = resolveAsset(v)
                    if (icon) icons[k] = assetUrl(icon)
                }
                if (Object.keys(icons).length) themeInfo.icons = icons
            }
            if (custom.colors) themeInfo.colors = custom.colors
            const template = resolveAsset(custom.template)
            return {
                tplFile: template ? template.file.replace(/\\/g, '/') : null,
                themeInfo,
            }
        }
        if (BUILTIN_TEMPLATES[id]) {
            return { tplFile: BUILTIN_TEMPLATES[id], themeInfo: null }
        }
        return null
    }
}().init()
