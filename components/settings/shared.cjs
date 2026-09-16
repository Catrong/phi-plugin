const fs = require('node:fs')
const path = require('node:path')
const YAML = require('yaml')
/**
 * @typedef {object} SettingDefinition
 * @property {string} key
 * @property {string} group
 * @property {string} label
 * @property {string} [description]
 * @property {string} type
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {string} [unit]
 * @property {string} [placeholder]
 * @property {boolean} [required]
 * @property {boolean} [internal]
 * @property {boolean} [generated]
 * @property {boolean} [secret]
 * @property {boolean} [allowFalse]
 * @property {boolean} [allowCustom]
 * @property {string} [format]
 * @property {{ label: string, value: string | number }[]} [options]
 */
/** @type {SettingDefinition[]} */
const definitions = require('./definitions.json')

// 默认值仍由原有 YAML 唯一维护，两个平台不再各写一套默认值。
const defaults = YAML.parse(fs.readFileSync(path.join(__dirname, '../../config/default_config/config.yaml'), 'utf8'))
const editable = definitions.filter(item => !item.internal)
const fields = new Set(editable.map(item => item.key))

// 读取时获取实际签发值，不把凭据快照固化为启动时的空默认值。
function readGeneratedSettings() {
    const file = path.join(__dirname, '../../config/config/config.yaml')
    const local = fs.existsSync(file) ? YAML.parse(fs.readFileSync(file, 'utf8')) : {}
    return Object.fromEntries(definitions.filter(item => item.generated)
        .map(item => [item.key, local?.[item.key] ?? defaults[item.key]]))
}

/** @param {Record<string, any>} input */
function normalizeSettings(input) {
    const result = Object.fromEntries(Object.entries(input).filter(([key]) => fields.has(key)))
    if (result.githubProxy === 'false') result.githubProxy = false
    if (result.isGuild) {
        result.WordB19Img = false
        result.WordSuggImg = false
    }
    return result
}

/** @param {Record<string, any>} input */
function validateSettings(input) {
    const result = normalizeSettings(input)
    for (const item of editable) {
        const value = result[item.key]
        if (value === undefined) continue
        const invalid = () => { throw new TypeError(`配置项「${item.label}」的值无效`) }
        if (item.type === 'number') {
            if (typeof value !== 'number' || !Number.isFinite(value)) invalid()
            if (item.min !== undefined && value < item.min) invalid()
            if (item.max !== undefined && value > item.max) invalid()
        } else if (item.type === 'boolean') {
            if (typeof value !== 'boolean') invalid()
        } else if (item.type === 'string') {
            if (!(item.allowFalse && value === false) && typeof value !== 'string') invalid()
        } else if (!item.options?.some(option => option.value === value) && !(item.allowCustom && typeof value === 'string')) {
            invalid()
        }
        if (item.format === 'https-origin') {
            let url
            try { url = new URL(value) } catch { invalid() }
            if (!url || url.protocol !== 'https:' || url.origin !== value) invalid()
        }
    }
    return result
}

module.exports = { definitions, defaults, editable, fields, readGeneratedSettings, normalizeSettings, validateSettings }
