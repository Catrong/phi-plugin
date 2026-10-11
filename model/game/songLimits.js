import { ChallengeModeName, Level, MAX_DIFFICULTY } from './constNum.js'

/**
 * 定数表推算出的理论上限，以及反作弊用的数值合法性校验。
 *
 * 这里只依赖 difficulty / id / rank / acc / score 这些字段，不依赖 getInfo
 * 与任何 IO，因此可以单独测试；插件运行时由 getInfo.getSongLimits() 提供数据。
 */

/** 课题模式需要选择三张谱面 */
export const CHALLENGE_SONG_COUNT = 3

/** 课题模式颜色档位下标上限（0 白表示没有课题成绩） */
export const MAX_CHALLENGE_COLOR = ChallengeModeName.length - 1

/**
 * rks 口径：rks 最高的 27 条 + 其中满分的前 3 条，再除以 30。
 * 与 Save.getB19 的 sum_rks / 30 保持一致。
 */
export const RKS_BEST_COUNT = 27
export const RKS_PHI_COUNT = 3
export const RKS_DIVISOR = RKS_BEST_COUNT + RKS_PHI_COUNT

/** 存档中的 rks 是 float32，比较时留出浮点误差 */
export const RKS_TOLERANCE = 1e-4

/**
 * @typedef {object} songLimitsObject
 * @property {number} chartCount 参与计算的谱面数
 * @property {number} maxRks 全部谱面满分（rks = 定数）时的 rks 上限
 * @property {number} maxChallenge 课题模式三张谱 floor(定数) 之和的上限
 * @property {number} maxChallengeUniqueSongs 同上，但要求三张谱来自不同曲目
 * @property {number} minChallenge 课题模式三张谱 floor(定数) 之和的下限
 * @property {number[] | null} bestCombo 取到 maxChallenge 的一组定数组合
 * @property {boolean} fallback 定数表不可用（未加载/为空）时为 true，此时是保守上限
 */

/**
 * 定数表不可用时的保守上限：
 * 宁可放过异常存档，也不能误封正常玩家，所以退回静态常量。
 * @returns {songLimitsObject}
 */
export function fallbackSongLimits() {
    return {
        chartCount: 0,
        maxRks: MAX_DIFFICULTY,
        maxChallenge: MAX_DIFFICULTY * CHALLENGE_SONG_COUNT,
        maxChallengeUniqueSongs: MAX_DIFFICULTY * CHALLENGE_SONG_COUNT,
        minChallenge: 1,
        bestCombo: null,
        fallback: true,
    }
}

/** 只有 EZ/HD/IN/AT 参与 rks 与课题；LEGACY 不算 */
const RANK_LEVELS = /** @type {string[]} */(Level)

/**
 * 三张谱能否来自三首不同曲目（同一首歌不能在课题里出现两次）。
 * 槽位最多 3 个，直接用匈牙利算法做二分图匹配。
 * @param {Map<number, Set<string>>} songsByFloor
 * @param {Map<number, number>} need floor -> 需要的张数
 * @returns {boolean}
 */
function hasDistinctSongs(songsByFloor, need) {
    /** @type {number[]} 每个槽位对应的 floor */
    const slots = []
    for (const [floor, count] of need) {
        for (let i = 0; i < count; i++) slots.push(floor)
    }
    /** @type {Map<string, number>} 曲目 id -> 占用的槽位 */
    const matched = new Map()
    /**
     * @param {number} slot
     * @param {Set<string>} seen
     * @returns {boolean}
     */
    const assign = (slot, seen) => {
        for (const song of songsByFloor.get(slots[slot]) || []) {
            if (seen.has(song)) continue
            seen.add(song)
            const holder = matched.get(song)
            if (holder === undefined || assign(holder, seen)) {
                matched.set(song, slot)
                return true
            }
        }
        return false
    }
    for (let slot = 0; slot < slots.length; slot++) {
        if (!assign(slot, new Set())) return false
    }
    return true
}

/**
 * 用定数表计算理论上限。
 * @param {{ id?: string, rank?: string, difficulty?: number }[]} charts 参与计算的谱面
 * @returns {songLimitsObject}
 */
export function computeSongLimits(charts) {
    /** @type {number[]} */
    const difficulties = []
    /** @type {Map<number, Set<string>>} floor -> 该档位的曲目 id */
    const songsByFloor = new Map()
    /** @type {Map<number, number>} floor -> 该档位的谱面张数 */
    const chartCountByFloor = new Map()

    for (const chart of charts || []) {
        const difficulty = Number(chart?.difficulty)
        if (!Number.isFinite(difficulty) || difficulty <= 0) continue
        if (chart?.rank && !RANK_LEVELS.includes(chart.rank)) continue
        difficulties.push(difficulty)

        const floor = Math.floor(difficulty)
        if (!songsByFloor.has(floor)) songsByFloor.set(floor, new Set())
        songsByFloor.get(floor)?.add(String(chart?.id))
        chartCountByFloor.set(floor, (chartCountByFloor.get(floor) || 0) + 1)
    }

    if (!difficulties.length) return fallbackSongLimits()

    // rks 上限：满分时 rks 等于定数，取定数最高的 27 条 + 前 3 条
    difficulties.sort((a, b) => b - a)
    /** @param {number[]} list */
    const sum = (list) => list.reduce((total, value) => total + value, 0)
    const maxRks = (sum(difficulties.slice(0, RKS_BEST_COUNT)) + sum(difficulties.slice(0, RKS_PHI_COUNT))) / RKS_DIVISOR

    // 课题上限：三张谱 floor 定数之和，同一档位可以取多张但不能超过该档张数
    const floors = [...chartCountByFloor.keys()].sort((a, b) => a - b)
    let maxChallenge = 0
    let maxChallengeUniqueSongs = 0
    let minChallenge = Number.POSITIVE_INFINITY
    /** @type {number[] | null} */
    let bestCombo = null

    for (let i = 0; i < floors.length; i++) {
        for (let j = i; j < floors.length; j++) {
            for (let k = j; k < floors.length; k++) {
                /** @type {Map<number, number>} */
                const need = new Map()
                for (const floor of [floors[i], floors[j], floors[k]]) {
                    need.set(floor, (need.get(floor) || 0) + 1)
                }
                let enough = true
                for (const [floor, count] of need) {
                    if ((chartCountByFloor.get(floor) || 0) < count) { enough = false; break }
                }
                if (!enough) continue

                const total = floors[i] + floors[j] + floors[k]
                if (total < minChallenge) minChallenge = total
                if (total > maxChallenge) {
                    maxChallenge = total
                    bestCombo = [floors[i], floors[j], floors[k]]
                }
                if (total > maxChallengeUniqueSongs && hasDistinctSongs(songsByFloor, need)) {
                    maxChallengeUniqueSongs = total
                }
            }
        }
    }

    if (!Number.isFinite(minChallenge)) minChallenge = 0

    return {
        chartCount: difficulties.length,
        maxRks,
        maxChallenge,
        maxChallengeUniqueSongs,
        minChallenge,
        bestCombo,
        fallback: false,
    }
}

/**
 * @typedef {object} saveCheckResult
 * @property {boolean} ok 是否通过
 * @property {string} field 出问题的字段（通过时为空串）
 * @property {string} reason 未通过的原因（通过时为空串）
 */

/** @param {string} field @param {string} reason @returns {saveCheckResult} */
const failCheck = (field, reason) => ({ ok: false, field, reason })

/**
 * 数值字段是否“缺失”（缺失按 0 处理，与旧行为一致；只有填了非法值才判异常）
 * @param {unknown} value
 */
const isBlank = (value) => value === undefined || value === null || value === ''

/**
 * 校验单条成绩的 acc / score 是否可能是正常数据。
 * @param {{ acc?: number, score?: number } | undefined | null} record
 * @returns {saveCheckResult}
 */
export function checkSaveRecord(record) {
    if (!isBlank(record?.acc) && !Number.isFinite(Number(record?.acc))) {
        return failCheck('acc', `acc 不是有效数字（${record?.acc}）`)
    }
    const acc = Number(record?.acc ?? 0)
    if (acc < 0 || acc > 100) return failCheck('acc', `acc ${acc} 超出 0-100`)

    if (!isBlank(record?.score) && !Number.isFinite(Number(record?.score))) {
        return failCheck('score', `score 不是有效数字（${record?.score}）`)
    }
    const score = Number(record?.score ?? 0)
    if (score < 0 || score > 1000000) return failCheck('score', `score ${score} 超出 0-1000000`)

    return { ok: true, field: '', reason: '' }
}

/**
 * 校验存档概要里的 rks 与课题分是否可能：超出定数表理论上限即判定为异常。
 * 只做“不可能值”判断，不比对具体成绩，避免误伤。
 * @param {{ rankingScore?: number, challengeModeRank?: number } | undefined | null} summary
 * @param {songLimitsObject} limits
 * @returns {saveCheckResult}
 */
export function checkSaveSummary(summary, limits) {
    const rks = Number(summary?.rankingScore)
    if (!Number.isFinite(rks)) return failCheck('rankingScore', 'rks 不是有效数字')
    if (rks < 0) return failCheck('rankingScore', `rks 为负数（${rks}）`)
    if (rks > limits.maxRks + RKS_TOLERANCE) {
        return failCheck('rankingScore', `rks ${rks} 超过上限 ${limits.maxRks.toFixed(4)}`)
    }

    const challengeModeRank = Number(summary?.challengeModeRank)
    if (!Number.isFinite(challengeModeRank)) return failCheck('challengeModeRank', '课题分不是有效数字')
    if (!Number.isInteger(challengeModeRank)) return failCheck('challengeModeRank', `课题分不是整数（${challengeModeRank}）`)
    if (challengeModeRank < 0) return failCheck('challengeModeRank', `课题分为负数（${challengeModeRank}）`)
    /** 0 表示没有课题成绩，此时不校验档位与总值 */
    if (challengeModeRank === 0) return { ok: true, field: '', reason: '' }

    const color = Math.floor(challengeModeRank / 100)
    const total = challengeModeRank % 100
    if (color < 1 || color > MAX_CHALLENGE_COLOR) {
        return failCheck('challengeModeRank', `课题颜色档位 ${color} 超出 1-${MAX_CHALLENGE_COLOR}`)
    }
    if (total < 1 || total > limits.maxChallenge) {
        return failCheck('challengeModeRank', `课题总值 ${total} 超出 1-${limits.maxChallenge}`)
    }

    return { ok: true, field: '', reason: '' }
}
