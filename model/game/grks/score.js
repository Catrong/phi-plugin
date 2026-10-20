/** @import {gameScoreRecord} from '../gameScore/store.js' */

/**
 * 猜 RKS 的判定与计分（纯函数）。
 */

/** 默认容差：猜测值与真实 B30 rks 相差不超过该值即算猜对。 */
export const DEFAULT_TOLERANCE = 0.1

/** 默认单局满分。 */
export const DEFAULT_MAX_SCORE = 10

/**
 * 解析玩家输入的猜测数值。
 * 支持 `15.2`、`15.20`、`15`、`15.234`；不接受负数、多段小数或其它字符。
 * @param {unknown} input
 * @returns {number | null}
 */
export function parseGuess(input) {
    if (typeof input === 'number') {
        return Number.isFinite(input) ? input : null
    }
    const text = String(input ?? '').trim().replace(/,/g, '.').replace(/。/g, '.')
    if (!text) return null
    const match = text.match(/^(\d{1,2})(?:\.(\d{1,4}))?$/)
    if (!match) return null
    const value = Number(`${match[1]}${match[2] !== undefined ? `.${match[2]}` : ''}`)
    return Number.isFinite(value) ? value : null
}

/**
 * 判断猜测是否命中。
 * @param {number} guess 猜测值
 * @param {number} truth 真实 rks
 * @param {number} [tolerance] 容差
 * @returns {boolean}
 */
export function isCorrect(guess, truth, tolerance = DEFAULT_TOLERANCE) {
    if (!Number.isFinite(guess) || !Number.isFinite(truth)) return false
    const limit = Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : DEFAULT_TOLERANCE
    /** 1e-9 抹掉浮点表示误差，避免 |15.6-15.5| = 0.10000000000000142 被判错 */
    return Math.abs(guess - truth) <= limit + 1e-9
}

/**
 * 按提示次数计分：满分 / n，n 至少为 1。
 * @param {number} hintCount 猜对前给出的提示条数
 * @param {number} [maxScore] 满分
 * @returns {number} 保留两位小数
 */
export function scoreForHintCount(hintCount, maxScore = DEFAULT_MAX_SCORE) {
    const max = Number.isFinite(maxScore) && maxScore > 0 ? maxScore : DEFAULT_MAX_SCORE
    const count = Math.max(1, Math.trunc(Number(hintCount) || 0))
    return Math.round(max / count * 100) / 100
}

/**
 * 格式化分数字符串。
 * @param {number} value
 * @returns {string}
 */
export function formatScoreValue(value) {
    const num = Number(value)
    return Number.isFinite(num) ? num.toFixed(2) : '0.00'
}

/**
 * 格式化记录（供文本版提示使用）。
 * @param {gameScoreRecord | null | undefined} record
 * @returns {string}
 */
export function formatRecordBrief(record) {
    if (!record) return '暂无记录'
    return `${record.score.toFixed(2)} 分 · ${record.plays} 局 · 胜 ${record.wins} 负 ${record.losses} 平 ${record.draws}`
}
