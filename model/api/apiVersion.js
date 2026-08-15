/** 插件当前支持的 phi-plugin-api 协议版本。 */
export const SUPPORTED_API_VERSION = '1.1.0'

let versionBlocked = false

/**
 * @typedef {'compatible'|'minor_mismatch'|'major_mismatch'|'invalid'} ApiVersionCompatibility
 */

/**
 * 解析严格的三段式语义版本号，可接受可选的 `v` 前缀。
 * @param {unknown} value 待解析的版本号
 * @returns {{major: number, minor: number, patch: number, normalized: string} | null} 解析结果
 */
export function parseApiVersion(value) {
    if (typeof value !== 'string') return null
    const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value.trim())
    if (!match) return null
    const major = Number(match[1])
    const minor = Number(match[2])
    const patch = Number(match[3])
    return { major, minor, patch, normalized: `${major}.${minor}.${patch}` }
}

/**
 * 主版本不同视为不兼容；主版本外的任一版本差异仅提示更新。
 * @param {unknown} apiVersion API 返回的协议版本
 * @param {string} [supportedVersion] 插件支持的协议版本
 * @returns {{status: ApiVersionCompatibility, apiVersion: string, supportedVersion: string}}
 */
export function compareApiVersion(apiVersion, supportedVersion = SUPPORTED_API_VERSION) {
    const actual = parseApiVersion(apiVersion)
    const supported = parseApiVersion(supportedVersion)
    if (!actual || !supported) {
        return {
            status: 'invalid',
            apiVersion: typeof apiVersion === 'string' ? apiVersion.trim() : '',
            supportedVersion,
        }
    }
    const status = actual.major !== supported.major
        ? 'major_mismatch'
        : actual.minor !== supported.minor || actual.patch !== supported.patch
            ? 'minor_mismatch'
            : 'compatible'
    return {
        status,
        apiVersion: actual.normalized,
        supportedVersion: supported.normalized,
    }
}

/**
 * 更新当前运行周期的 API 协议阻断状态。
 * @param {boolean} blocked 是否阻止所有 API 请求
 */
export function setApiVersionBlocked(blocked) {
    versionBlocked = blocked
}

/**
 * 查询当前运行周期是否已因协议版本不兼容而关闭 API。
 * @returns {boolean}
 */
export function isApiVersionBlocked() {
    return versionBlocked
}
