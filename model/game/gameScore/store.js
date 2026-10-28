import fs from 'node:fs'
import path from 'node:path'
import { otherDataPath } from '../../filesystem/path.js'
import logger from '../../../components/Logger.js'
import { parsePlayerProfile } from './profile.js'

/** @import {gameScoreProfile} from './profile.js' */

/**
 * 通用游戏积分持久化。
 *
 * 存储结构（`data/otherData/gameScore.json`）：
 * ```json
 * { "version": 1, "games": { "<gameId>": { "<mode>": { "<userId>": { ...record } } } } }
 * ```
 * 读取带内存缓存，写入通过队列串行化并整文件落盘，避免并发写坏文件。
 *
 * @typedef {object} gameScoreRecord 玩家在某个游戏模式下的累计数据
 * @property {number} score 累计积分
 * @property {number} plays 游玩次数
 * @property {number} best 单局最高分
 * @property {number} wins 胜场（仅匹配）
 * @property {number} losses 负场（仅匹配）
 * @property {number} draws 平局（仅匹配）
 * @property {number} hintSum 已统计对局的提示数合计（准确率榜用）
 * @property {number} hintPlays 已统计提示数的对局数（准确率榜用）
 * @property {number} updatedAt 最近一次更新时间戳（毫秒）
 * @property {gameScoreProfile} [profile] 最近结算时的游戏身份
 * @property {gameScoreAnswerStats} [answers] 实际答题统计，旧数据无此字段
 *
 * @typedef {{version: number, games: Record<string, Record<string, Record<string, gameScoreRecord>>>}} gameScoreStore 存储结构
 */

/**
 * @typedef {object} gameScoreAnswerStats
 * @property {number} total 已结算回答轮次，含回答超时
 * @property {number} correct 回答正确次数
 */

const DEFAULT_FILE = path.join(otherDataPath, 'gameScore.json')

/** @type {gameScoreStore | null} */
let cache = null
/** @type {Promise<void>} */
let writeQueue = Promise.resolve()
/** @type {string} */
let storeFile = DEFAULT_FILE

/**
 * 覆盖存储文件路径（测试使用）。
 * @param {string} file
 */
export function setStoreFile(file) {
    storeFile = file
    cache = null
}

/**
 * 读取存储文件；缺失或损坏时返回空结构。
 * @returns {gameScoreStore}
 */
function loadStore() {
    if (cache) return cache
    /** @type {gameScoreStore} */
    let data = { version: 1, games: {} }
    try {
        if (fs.existsSync(storeFile)) {
            const raw = JSON.parse(fs.readFileSync(storeFile, 'utf8'))
            if (raw && typeof raw === 'object' && raw.games && typeof raw.games === 'object') {
                data = { version: Number(raw.version) || 1, games: raw.games }
            }
        }
    } catch (error) {
        logger.warn(`[phi-plugin][gameScore] 读取 ${storeFile} 失败，已按空数据处理`)
        logger.warn(error)
    }
    cache = data
    return cache
}

/**
 * 归一化一条玩家记录，兼容旧数据与脏数据。
 * @param {Partial<gameScoreRecord> | undefined} raw
 * @returns {gameScoreRecord}
 */
function normalizeRecord(raw) {
    /**
     * @param {unknown} value
     * @param {number} [fallback]
     */
    const num = (value, fallback = 0) => {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : fallback
    }
    const profile = parsePlayerProfile(raw?.profile)
    const answers = parseAnswerStats(raw?.answers)
    return {
        ...(profile ? { profile } : {}),
        ...(answers ? { answers } : {}),
        score: round2(num(raw?.score)),
        plays: Math.max(0, Math.trunc(num(raw?.plays))),
        best: round2(num(raw?.best)),
        wins: Math.max(0, Math.trunc(num(raw?.wins))),
        losses: Math.max(0, Math.trunc(num(raw?.losses))),
        draws: Math.max(0, Math.trunc(num(raw?.draws))),
        hintSum: round2(num(raw?.hintSum)),
        hintPlays: Math.max(0, Math.trunc(num(raw?.hintPlays))),
        updatedAt: Math.max(0, Math.trunc(num(raw?.updatedAt))),
    }
}

/** @param {unknown} value @returns {gameScoreAnswerStats | undefined} */
function parseAnswerStats(value) {
    if (value === undefined) return undefined
    if (!value || typeof value !== 'object' || Array.isArray(value) || !('total' in value) || !('correct' in value)
        || typeof value.total !== 'number' || typeof value.correct !== 'number'
        || !Number.isSafeInteger(value.total) || !Number.isSafeInteger(value.correct)
        || value.total < 0 || value.correct < 0 || value.correct > value.total) {
        throw new Error('答题统计必须为非负安全整数，且正确次数不能超过回答轮次')
    }
    return { total: value.total, correct: value.correct }
}

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
    return Math.round(value * 100) / 100
}

/**
 * 取出（必要时创建）某玩家在指定游戏模式下的记录。
 * @param {gameScoreStore} store
 * @param {string} gameId
 * @param {string} mode
 * @param {string} userId
 * @param {boolean} [create]
 * @returns {gameScoreRecord | null}
 */
function takeRecord(store, gameId, mode, userId, create = false) {
    const gameBucket = store.games[gameId] || (store.games[gameId] = {})
    const modeBucket = gameBucket[mode] || (gameBucket[mode] = {})
    const key = String(userId)
    const existing = modeBucket[key]
    if (existing) {
        /** 回写规整结果：后续修改必须作用于存储内的对象，否则累加会丢失 */
        const record = normalizeRecord(existing)
        modeBucket[key] = record
        return record
    }
    if (!create) return null
    const record = normalizeRecord(undefined)
    modeBucket[key] = record
    return record
}

/**
 * 串行落盘，合并同一轮内的多次修改。
 * @returns {Promise<void>}
 */
function schedulePersist() {
    if (cache) {
        const snapshot = JSON.stringify(cache)
        writeQueue = writeQueue.then(() => {
            try {
                fs.mkdirSync(path.dirname(storeFile), { recursive: true })
                fs.writeFileSync(storeFile, snapshot, 'utf8')
            } catch (error) {
                logger.warn(`[phi-plugin][gameScore] 写入 ${storeFile} 失败`)
                logger.warn(error)
            }
        })
    }
    return writeQueue
}

/**
 * 读取玩家记录。
 * @param {string} gameId
 * @param {string} mode
 * @param {string} userId
 * @returns {gameScoreRecord | null}
 */
export function getPlayer(gameId, mode, userId) {
    const store = loadStore()
    const record = takeRecord(store, gameId, mode, String(userId), false)
    return record ? { ...record, ...(record.answers ? { answers: { ...record.answers } } : {}) } : null
}

/**
 * 列出某游戏模式全部玩家。
 * @param {string} gameId
 * @param {string} mode
 * @returns {Array<{userId: string} & gameScoreRecord>}
 */
export function listPlayers(gameId, mode) {
    const store = loadStore()
    const bucket = store.games[gameId]?.[mode] || {}
    return Object.entries(bucket).map(([userId, record]) => ({ userId, ...normalizeRecord(record) }))
}

/**
 * 累加一局积分（单机或匹配通用）。
 * @param {string} gameId
 * @param {string} mode
 * @param {string} userId
 * @param {number} points 本局积分，0 表示未得分但仍计场次
 * @param {{result?: 'win' | 'loss' | 'draw', hints?: number, answers?: gameScoreAnswerStats, profile?: gameScoreProfile}} [options] hints 为本局计入准确率统计的提示数
 * @returns {Promise<gameScoreRecord>} 更新后的记录
 */
export async function addScore(gameId, mode, userId, points, options = {}) {
    const answers = parseAnswerStats(options.answers)
    const store = loadStore()
    const record = takeRecord(store, gameId, mode, String(userId), true)
    if (!record) throw new Error('无法创建积分记录')
    if (answers) {
        const total = (record.answers?.total ?? 0) + answers.total
        const correct = (record.answers?.correct ?? 0) + answers.correct
        if (!Number.isSafeInteger(total) || !Number.isSafeInteger(correct)) throw new Error('累计答题统计超出安全整数范围')
        record.answers = { total, correct }
    }
    if (options.profile) record.profile = options.profile
    const gain = Number.isFinite(Number(points)) ? Math.max(0, round2(Number(points))) : 0
    record.score = round2(record.score + gain)
    record.plays += 1
    record.best = Math.max(record.best, gain)
    if (options.result === 'win') record.wins += 1
    else if (options.result === 'loss') record.losses += 1
    else if (options.result === 'draw') record.draws += 1
    /** 提示数用于准确率榜；旧数据没有该字段，只有带值的新对局参与平均 */
    const hints = Number(options.hints)
    if (Number.isFinite(hints) && hints >= 0) {
        record.hintSum = round2(record.hintSum + hints)
        record.hintPlays += 1
    }
    record.updatedAt = Date.now()
    await schedulePersist()
    return { ...record, ...(record.answers ? { answers: { ...record.answers } } : {}) }
}

/**
 * 清空内存缓存并重新读取（管理命令或测试使用）。
 * @returns {gameScoreStore}
 */
export function reloadStore() {
    cache = null
    return loadStore()
}

/**
 * 删除指定游戏的全部数据。
 * @param {string} gameId
 * @returns {Promise<void>}
 */
export async function clearGame(gameId) {
    const store = loadStore()
    delete store.games[gameId]
    await schedulePersist()
}

/**
 * 当前存储文件路径。
 * @returns {string}
 */
export function getStoreFile() {
    return storeFile
}
