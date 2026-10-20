import fs from 'node:fs'
import path from 'node:path'
import { otherDataPath, savePath } from '../../filesystem/path.js'
import logger from '../../../components/Logger.js'
import LocalSaveRepository from '../../save/getSave.js'
import { buildPuzzle } from './hints.js'

/**
 * 出题池：扫描本地已绑定存档，统计可用于出题的 B30。
 *
 * 池中只保存轻量元数据（token / rks / 成绩条数 / 文件时间），
 * 真正的谜题在抽中时才解析完整存档，避免常驻大量内存。
 *
 * @typedef {object} grksPoolEntry
 * @property {string} token sessionToken
 * @property {number} rks 存档 rks
 * @property {number} recordCount 有效成绩条数
 * @property {number} mtime save.json 的时间戳
 *
 * @typedef {object} grksPool
 * @property {number} builtAt 构建时间戳
 * @property {number} minRecord 构建时使用的成绩条数下限
 * @property {grksPoolEntry[]} entries 可出题的存档
 * @property {number} scanned 扫描过的存档数量
 */

const DEFAULT_POOL_FILE = path.join(otherDataPath, 'grksPool.json')

/** @type {string} */
let poolFile = DEFAULT_POOL_FILE
/** @type {string} */
let saveDir = savePath

/** @type {grksPool | null} */
let cache = null
/** @type {Promise<grksPool> | null} */
let building = null

/**
 * 覆盖存档目录与池缓存路径（测试使用）。
 * @param {{saveDir?: string, poolFile?: string}} paths
 */
export function setPoolPaths(paths = {}) {
    if (paths.saveDir) saveDir = paths.saveDir
    if (paths.poolFile) poolFile = paths.poolFile
    cache = null
}

/**
 * 读取存档目录下所有 sessionToken。
 * @returns {string[]}
 */
function listSessionTokens() {
    try {
        if (!fs.existsSync(saveDir)) return []
        return fs.readdirSync(saveDir, { withFileTypes: true })
            .filter(item => item.isDirectory())
            .map(item => item.name)
    } catch (error) {
        logger.warn('[phi-plugin][grks] 读取存档目录失败')
        logger.warn(error)
        return []
    }
}

/**
 * 统计一份存档的有效成绩条数（EZ/HD/IN/AT 且分数大于 0）。
 * @param {any} data
 * @returns {number}
 */
export function countRecords(data) {
    const gameRecord = data?.gameRecord
    if (!gameRecord || typeof gameRecord !== 'object') return 0
    let count = 0
    for (const levels of Object.values(gameRecord)) {
        if (!Array.isArray(levels)) continue
        for (let level = 0; level < 4; level++) {
            const record = levels[level]
            if (record && Number(record.score) > 0) count++
        }
    }
    return count
}

/**
 * 读取池缓存文件（仅用于减少重启后的扫描开销）。
 * @returns {grksPool | null}
 */
function readPoolCache() {
    try {
        if (!fs.existsSync(poolFile)) return null
        const raw = JSON.parse(fs.readFileSync(poolFile, 'utf8'))
        if (!raw || !Array.isArray(raw.entries)) return null
        return {
            builtAt: Number(raw.builtAt) || 0,
            minRecord: Number(raw.minRecord) || 0,
            scanned: Number(raw.scanned) || raw.entries.length,
            entries: raw.entries
                .filter(/** @param {any} item */ item => item && item.token)
                .map(/** @param {any} item */ item => ({
                    token: String(item.token),
                    rks: Number(item.rks) || 0,
                    recordCount: Number(item.recordCount) || 0,
                    mtime: Number(item.mtime) || 0,
                })),
        }
    } catch {
        return null
    }
}

/**
 * 写池缓存文件。
 * @param {grksPool} pool
 */
function writePoolCache(pool) {
    try {
        fs.mkdirSync(path.dirname(poolFile), { recursive: true })
        fs.writeFileSync(poolFile, JSON.stringify(pool), 'utf8')
    } catch (error) {
        logger.warn('[phi-plugin][grks] 写入出题池缓存失败')
        logger.warn(error)
    }
}

/**
 * 扫描并重建出题池。已有池中时间戳未变化的存档会复用统计结果。
 * @param {number} minRecord 成绩条数下限
 * @param {grksPool | null} [previous] 上一次的池，用于增量复用
 * @returns {grksPool}
 */
export function rebuildPool(minRecord, previous = null) {
    const threshold = Math.max(1, Math.trunc(Number(minRecord) || 27))
    /** @type {Map<string, grksPoolEntry>} */
    const known = new Map((previous?.entries || []).map(entry => [entry.token, entry]))
    /** @type {grksPoolEntry[]} */
    const entries = []
    const tokens = listSessionTokens()
    for (const token of tokens) {
        const file = path.join(saveDir, token, 'save.json')
        let mtime = 0
        try {
            mtime = fs.statSync(file).mtimeMs
        } catch {
            continue
        }
        const cached = known.get(token)
        if (cached && cached.mtime === mtime && cached.recordCount >= threshold) {
            entries.push(cached)
            continue
        }
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'))
            const recordCount = countRecords(data)
            if (recordCount < threshold) continue
            entries.push({
                token,
                rks: Number(data?.saveInfo?.summary?.rankingScore) || 0,
                recordCount,
                mtime,
            })
        } catch {
            continue
        }
    }
    /** @type {grksPool} */
    const pool = { builtAt: Date.now(), minRecord: threshold, entries, scanned: tokens.length }
    writePoolCache(pool)
    return pool
}

/**
 * 获取出题池；缓存过期、条数下限变化或强制刷新时重建。
 * @param {object} [options]
 * @param {number} [options.minRecord] 成绩条数下限
 * @param {number} [options.refreshHours] 缓存有效期（小时）
 * @param {boolean} [options.force] 强制重建
 * @returns {Promise<grksPool>}
 */
export async function getPool(options = {}) {
    const minRecord = Math.max(1, Math.trunc(Number(options.minRecord) || 27))
    const refreshMs = Math.max(0, Number(options.refreshHours ?? 6)) * 3600 * 1000
    if (!cache) cache = readPoolCache()
    const fresh = cache
        && cache.minRecord === minRecord
        && !options.force
        && (refreshMs > 0 && Date.now() - cache.builtAt < refreshMs)
    if (fresh && cache) return cache
    if (building) return building
    building = Promise.resolve().then(() => {
        const rebuilt = rebuildPool(minRecord, cache)
        cache = rebuilt
        return rebuilt
    }).finally(() => {
        building = null
    })
    return building
}

/**
 * 从池中挑一个可出题的存档。
 * @param {object} options
 * @param {string[]} [options.excludeTokens] 需要排除的 sessionToken（通常是发起者自己）
 * @param {boolean} [options.allowFallback] 排除后为空时是否回退到被排除的存档
 * @param {number} [options.minRecord]
 * @param {number} [options.refreshHours]
 * @param {() => number} [options.rng]
 * @returns {Promise<{entry: grksPoolEntry, fallback: boolean} | null>}
 */
export async function pickEntry(options = {}) {
    const pool = await getPool(options)
    const exclude = new Set((options.excludeTokens || []).map(String).filter(Boolean))
    const rng = options.rng || Math.random
    const candidates = pool.entries.filter(entry => !exclude.has(entry.token))
    if (candidates.length) {
        return { entry: candidates[Math.floor(rng() * candidates.length) % candidates.length], fallback: false }
    }
    const fallbackList = pool.entries.filter(entry => exclude.has(entry.token))
    if (options.allowFallback !== false && fallbackList.length) {
        return { entry: fallbackList[Math.floor(rng() * fallbackList.length) % fallbackList.length], fallback: true }
    }
    return null
}

/**
 * 为一个 sessionToken 生成谜题。
 * @param {string} token
 * @param {object} [options]
 * @param {any} [options.e] 平台事件，用于可选 API 调用
 * @returns {Promise<import('./hints.js').grksPuzzle | null>}
 */
export async function loadPuzzle(token, options = {}) {
    const save = await LocalSaveRepository.getSaveBySessionToken(/** @type {any} */ (token))
    if (!save) return null
    const b30 = await save.getB19(options.e, 33, { avgType: 'none' })
    /** @type {any[]} */
    let stats = []
    try {
        stats = await save.getStats()
    } catch {
        stats = []
    }
    return buildPuzzle({
        b30,
        stats,
        challengeModeRank: save.saveInfo?.summary?.challengeModeRank,
        sourceToken: token,
    })
}

/**
 * 清空内存缓存（测试或手动刷新使用）。
 */
export function clearPoolCache() {
    cache = null
}

/**
 * 池缓存文件路径。
 * @returns {string}
 */
export function getPoolFile() {
    return poolFile
}
