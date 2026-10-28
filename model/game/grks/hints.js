import { buildRksHistogram, getB30AnalysisRecords } from '../b30Analysis.js'
import fCompute from '../fCompute.js'
import { grksHintWords } from '../../render/messages.js'

/**
 * 猜 RKS 的提示生成（纯函数，不读写文件、不依赖平台）。
 *
 * 提示类型：
 * - `records`   : 公开若干条 B30 成绩（单机随机、匹配由持有者指定槽位）
 * - `stats`     : B30 等效 rks 条形图或上下界（互斥，可指定，缺省随机）
 * - `challenge` : 课题模式成绩与谱面完成度统计
 */

/** P 槽位（满分的最高三条）。 */
export const PHI_SLOTS = ['P1', 'P2', 'P3']
/** B 槽位（Best27）。 */
export const BEST_SLOTS = Array.from({ length: 27 }, (_, index) => `B${index + 1}`)
/** 全部槽位，顺序与 B30 面板一致。 */
export const ALL_SLOTS = [...PHI_SLOTS, ...BEST_SLOTS]

/** 灰框占位内容：位置未公开时展示。 */
export const NOINFO_TEXT = 'noinfo'

/**
 * @typedef {object} grksSlotRecord 一条参与 B30 计算的成绩
 * @property {string} slot 槽位名，如 P1 / B7
 * @property {'phi' | 'best'} kind 槽位类型
 * @property {string} id 曲目 id
 * @property {string} song 曲名
 * @property {string} rank 难度
 * @property {number} difficulty 定数
 * @property {number} score 分数
 * @property {number} acc 准确率
 * @property {number} rks 单曲等效 rks
 * @property {string} illustration 曲绘
 * @property {boolean} fc 是否 FC
 *
 * @typedef {object} grksStatSummary 单个难度的完成度
 * @property {string} title 难度名
 * @property {number} tot 谱面总数
 * @property {number} cleared 通关数
 * @property {number} fc FC 数
 * @property {number} phi φ 数
 *
 * @typedef {object} grksPuzzle 谜题（某个玩家的 B30）
 * @property {string} sourceToken 出题存档的 sessionToken
 * @property {number} rks B30 计算得到的 rks（答案）
 * @property {grksSlotRecord[]} slots 参与计算的成绩，已按槽位顺序排列
 * @property {number} phiCount P 槽数量
 * @property {number} bestCount B 槽数量
 * @property {number} recordCount B30 计算用到的成绩条数
 * @property {{min: number, max: number, average: number, histogram: ReturnType<typeof buildRksHistogram>}} analysis 统计信息
 * @property {grksStatSummary[]} stats 各难度完成度
 * @property {number} challengeModeRank 课题模式分数
 * @property {number} [takenAt] 出题时间戳
 */

/**
 * 由 `Save.getB19()` 的结果构建谜题。
 * @param {object} options
 * @param {{phi?: any[], b19_list?: any[]}} options.b30 getB19 的返回
 * @param {import('../b30Analysis.js').B30AnalysisRecord[] | any[]} [options.stats] `Save.getStats()` 的返回
 * @param {number} [options.challengeModeRank] 课题模式分数
 * @param {string} [options.sourceToken] 出题存档 token
 * @returns {grksPuzzle}
 */
export function buildPuzzle({ b30, stats, challengeModeRank, sourceToken }) {
    /** @type {grksSlotRecord[]} */
    const slots = []
    const phi = Array.isArray(b30?.phi) ? b30.phi.slice(0, 3) : []
    phi.forEach((record, index) => {
        const slot = normalizeSlotRecord(record, PHI_SLOTS[index], 'phi')
        if (slot) slots.push(slot)
    })
    const best = Array.isArray(b30?.b19_list) ? b30.b19_list.slice(0, 27) : []
    best.forEach((record, index) => {
        const slot = normalizeSlotRecord(record, BEST_SLOTS[index], 'best')
        if (slot) slots.push(slot)
    })

    const analysisRecords = getB30AnalysisRecords({
        phi: /** @type {any[]} */ (Array.isArray(b30?.phi) ? b30.phi : []),
        b19_list: /** @type {any[]} */ (Array.isArray(b30?.b19_list) ? b30.b19_list : []),
    })
    const histogram = buildRksHistogram(analysisRecords)
    const rksValues = slots.map(slot => slot.rks)
    const totalRks = rksValues.reduce((sum, value) => sum + value, 0)
    const rks = Math.round(totalRks / 30 * 10000) / 10000

    return {
        sourceToken: String(sourceToken || ''),
        rks,
        slots,
        phiCount: slots.filter(slot => slot.kind === 'phi').length,
        bestCount: slots.filter(slot => slot.kind === 'best').length,
        recordCount: slots.length,
        analysis: {
            min: rksValues.length ? Math.min(...rksValues) : 0,
            max: rksValues.length ? Math.max(...rksValues) : 0,
            average: histogram.average || 0,
            histogram,
        },
        stats: normalizeStats(stats),
        challengeModeRank: Number(challengeModeRank) || 0,
    }
}

/**
 * 归一化一条成绩。
 * @param {any} record
 * @param {string} slot
 * @param {'phi' | 'best'} kind
 * @returns {grksSlotRecord | null}
 */
function normalizeSlotRecord(record, slot, kind) {
    if (!record || !record.id) return null
    const rks = Number(record.rks)
    const difficulty = Number(record.difficulty)
    if (!Number.isFinite(rks) && !Number.isFinite(difficulty)) return null
    return {
        slot,
        kind,
        id: String(record.id),
        song: String(record.song || record.id),
        rank: String(record.rank || 'IN'),
        difficulty: Number.isFinite(difficulty) ? difficulty : 0,
        score: Number(record.score) || 0,
        acc: Number(record.acc) || 0,
        rks: Number.isFinite(rks) ? rks : 0,
        illustration: String(record.illustration || ''),
        fc: Boolean(record.fc),
    }
}

/**
 * 归一化完成度统计。
 * @param {any[] | undefined} stats
 * @returns {grksStatSummary[]}
 */
function normalizeStats(stats) {
    if (!Array.isArray(stats)) return []
    return stats.slice(0, 4).map(item => ({
        title: String(item?.title || ''),
        tot: Number(item?.tot) || 0,
        cleared: Number(item?.cleared) || 0,
        fc: Number(item?.fc) || 0,
        phi: Number(item?.phi) || 0,
    }))
}

/**
 * 课程序号 → 段位名。
 * @param {number} challengeModeRank
 * @returns {{name: string, level: number, score: number, colorIndex: number}}
 */
export function challengeModeInfo(challengeModeRank) {
    const value = Number(challengeModeRank) || 0
    const names = ['白', '绿', '蓝', '红', '金', '彩']
    const level = Math.floor(value / 100)
    const colorIndex = level <= 0 ? 0 : Math.min(names.length - 1, Math.floor((level - 1) / 4))
    return { name: names[colorIndex] || names[0], level, score: value % 100, colorIndex }
}

/**
 * @typedef {object} grksSoloState 单机状态
 * @property {string} puzzleKey 谜题标识，用于校验状态与谜题一致
 * @property {number} hintCount 已给出的提示条数
 * @property {string[]} revealedSlots 已公开的槽位
 * @property {boolean} positionRevealed 是否已公开位置
 * @property {'' | 'histogram' | 'range'} statsKind 已公开的统计形式（空串表示尚未公开）
 * @property {boolean} challengeRevealed 是否已公开课题完成度
 * @property {number} wrongCount 猜错次数
 * @property {number} lastHintAt 最近一次提示时间戳
 * @property {number} lastGuessAt 最近一次猜测时间戳
 */

/**
 * 创建单机状态。
 * @param {string} puzzleKey
 * @returns {grksSoloState}
 */
export function createSoloState(puzzleKey) {
    return {
        puzzleKey: String(puzzleKey || ''),
        hintCount: 0,
        revealedSlots: [],
        positionRevealed: false,
        statsKind: '',
        challengeRevealed: false,
        wrongCount: 0,
        lastHintAt: 0,
        lastGuessAt: 0,
    }
}

/**
 * @typedef {object} grksHint 一条提示
 * @property {'records' | 'stats' | 'challenge' | 'exhausted'} kind
 * @property {string[]} [slots] 本次新增公开的槽位
 * @property {'histogram' | 'range'} [statsKind] 统计提示的展示形式
 * @property {any} [histogram] 直方图数据（渲染用）
 * @property {{min: number, max: number}} [range] 上下界数据（渲染用）
 */

/**
 * 读取整数配置，非法值回退默认。
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} [min]
 * @param {number} [max]
 * @returns {number}
 */
export function intCfg(value, fallback, min = 0, max = 1000) {
    const num = Math.trunc(Number(value))
    if (!Number.isFinite(num)) return fallback
    return Math.min(max, Math.max(min, num))
}

/**
 * 解析统计提示的展示形式：显式参数 > 配置 > 随机。
 * @param {unknown} cfgValue 配置项 StatsHint：auto / histogram / range
 * @param {string | undefined} arg 玩家指定的形式
 * @param {() => number} [rng]
 * @returns {'histogram' | 'range'}
 */
export function resolveStatsKind(cfgValue, arg, rng = Math.random) {
    /** @param {unknown} value */
    const pick = value => (value === 'histogram' || value === 'range' ? value : null)
    const explicit = pick(arg)
    if (explicit) return explicit
    const configured = pick(cfgValue)
    if (configured) return configured
    return rng() < 0.5 ? 'histogram' : 'range'
}

/**
 * 判断单机下一条提示的类型。
 * 前 N-1 条为成绩、第 N 条成绩并同步开启位置、第 N+1 条统计、第 N+2 条课题与完成度，之后继续补成绩。
 * @param {grksSoloState} state
 * @param {unknown} positionHintAt 配置：第几条提示后开启位置
 * @returns {'records' | 'stats' | 'challenge'}
 */
export function soloHintKind(state, positionHintAt) {
    const positionAt = intCfg(positionHintAt, 5, 1, 30)
    const next = state.hintCount + 1
    if (next === positionAt + 1) return 'stats'
    if (next === positionAt + 2) return 'challenge'
    return 'records'
}

/**
 * 从数组随机取若干不重复元素（Fisher-Yates 局部洗牌）。
 * @template T
 * @param {T[]} list
 * @param {number} count
 * @param {() => number} [rng]
 * @returns {T[]}
 */
export function sample(list, count, rng = Math.random) {
    const pool = [...list]
    const take = Math.min(Math.max(1, Math.trunc(count) || 1), pool.length)
    for (let index = 0; index < take; index++) {
        const swap = index + Math.floor(rng() * (pool.length - index))
        const temp = pool[index]
        pool[index] = pool[swap]
        pool[swap] = temp
    }
    return pool.slice(0, take)
}

/**
 * 推进单机提示。
 * @param {grksSoloState} state
 * @param {grksPuzzle} puzzle
 * @param {any} cfg 配置：PositionHintAt / HintRevealNum / StatsHint
 * @param {() => number} [rng]
 * @returns {{state: grksSoloState, hint: grksHint}}
 */
export function applySoloHint(state, puzzle, cfg, rng = Math.random) {
    const kind = soloHintKind(state, cfg?.PositionHintAt)
    const positionAt = intCfg(cfg?.PositionHintAt, 5, 1, 30)
    const hintCount = state.hintCount + 1
    if (kind === 'records') {
        const remaining = puzzle.slots.filter(slot => !state.revealedSlots.includes(slot.slot))
        if (!remaining.length) {
            return {
                state: { ...state, positionRevealed: true },
                hint: { kind: 'exhausted' },
            }
        }
        const picked = sample(remaining, intCfg(cfg?.HintRevealNum, 2, 1, 10), rng)
        return {
            state: {
                ...state,
                hintCount,
                revealedSlots: [...state.revealedSlots, ...picked.map(slot => slot.slot)],
                positionRevealed: hintCount >= positionAt,
                lastHintAt: Date.now(),
            },
            hint: { kind: 'records', slots: picked.map(slot => slot.slot) },
        }
    }
    if (kind === 'stats') {
        /** 统计形式一经公开就在后续提示中保持不变，避免下一张图又变回空白 */
        const statsKind = resolveStatsKind(cfg?.StatsHint, undefined, rng)
        return {
            state: {
                ...state,
                hintCount,
                positionRevealed: hintCount >= positionAt,
                statsKind,
                lastHintAt: Date.now(),
            },
            hint: { kind: 'stats', statsKind },
        }
    }
    return {
        state: {
            ...state,
            hintCount,
            positionRevealed: hintCount >= positionAt,
            challengeRevealed: true,
            lastHintAt: Date.now(),
        },
        hint: { kind: 'challenge' },
    }
}

/**
 * 一局单机最多会用到的提示条数：全部槽位公开所需条数 + 统计 + 课题。
 * 未猜出的对局按满提示计入准确率统计，避免放弃或超时拉低平均值。
 * @param {grksPuzzle} puzzle
 * @param {any} cfg 配置：HintRevealNum
 * @returns {number}
 */
export function maxSoloHints(puzzle, cfg) {
    const slots = Array.isArray(puzzle?.slots) ? puzzle.slots.length : 0
    const reveal = intCfg(cfg?.HintRevealNum, 2, 1, 10)
    return Math.max(1, Math.ceil(slots / reveal) + 2)
}

/**
 * 一局匹配中一方最多能收到的提示条数：逐个公开槽位 + 统计 + 课题。
 * @param {grksPuzzle} puzzle 需要猜的谜题
 * @returns {number}
 */
export function maxMatchHints(puzzle) {
    const slots = Array.isArray(puzzle?.slots) ? puzzle.slots.length : 0
    return Math.max(1, slots + 2)
}

/**
 * 解析匹配模式的提示类型参数。
 * @param {unknown} typeText '1' / '3' / '4'
 * @returns {'records' | 'stats' | 'challenge' | null}
 */
export function matchHintType(typeText) {
    switch (String(typeText ?? '').trim()) {
        case '1': return 'records'
        case '3': return 'stats'
        case '4': return 'challenge'
        default: return null
    }
}

/**
 * 归一化槽位参数（如 b7 → B7、p1 → P1）。
 * @param {unknown} slotText
 * @returns {string | null}
 */
export function normalizeSlotName(slotText) {
    const text = String(slotText ?? '').trim().toUpperCase()
    const match = text.match(/^([PB])(\d{1,2})$/)
    if (!match) return null
    const index = Number(match[2])
    if (match[1] === 'P') return index >= 1 && index <= 3 ? `P${index}` : null
    return index >= 1 && index <= 27 ? `B${index}` : null
}

/**
 * @typedef {object} grksMatchSideState 匹配中一方（谜题持有者）的提示状态
 * @property {string[]} revealedSlots 已公开槽位
 * @property {number} hintCount 已给出的提示条数
 * @property {'' | 'histogram' | 'range'} statsKind 已公开的统计形式（空串表示尚未公开）
 * @property {boolean} challengeRevealed 是否已公开课题完成度
 */

/**
 * 创建匹配一方的提示状态。
 * @returns {grksMatchSideState}
 */
export function createMatchSideState() {
    return { revealedSlots: [], hintCount: 0, statsKind: '', challengeRevealed: false }
}

/**
 * 校验匹配提示请求。
 * @param {grksMatchSideState} side
 * @param {grksPuzzle} puzzle
 * @param {'records' | 'stats' | 'challenge'} type
 * @param {string} [arg] 类型 1 的槽位、类型 3 的展示形式
 * @returns {{ok: boolean, error?: string, slot?: string, statsKind?: 'histogram' | 'range'}}
 */
export function validateMatchHint(side, puzzle, type, arg) {
    const text = String(arg ?? '').trim()
    if (type === 'records') {
        if (!text) {
            return { ok: false, error: '提示类型 1 需要指定槽位，例如：grks hint 1 B7（可选 P1-P3 / B1-B27）' }
        }
        const slot = normalizeSlotName(text)
        if (!slot) return { ok: false, error: `槽位 ${text} 不合法，可选 P1-P3 / B1-B27` }
        if (!puzzle.slots.some(item => item.slot === slot)) {
            return { ok: false, error: `你的 B30 中不存在槽位 ${slot}（数据不足 30 条）` }
        }
        if (side.revealedSlots.includes(slot)) {
            const remain = puzzle.slots.filter(item => !side.revealedSlots.includes(item.slot)).length
            return { ok: false, error: `${slot} 已经提示过了，还剩 ${remain} 个槽位可提示` }
        }
        return { ok: true, slot }
    }
    if (type === 'stats') {
        if (!text) return { ok: true }
        if (text !== 'histogram' && text !== 'range') {
            return { ok: false, error: '提示类型 3 的参数只能是 histogram 或 range，留空则随机' }
        }
        return { ok: true, statsKind: /** @type {'histogram' | 'range'} */ (text) }
    }
    if (text) return { ok: false, error: '提示类型 4 不需要参数' }
    return { ok: true }
}

/**
 * 推进匹配提示。
 * @param {grksMatchSideState} side
 * @param {grksPuzzle} puzzle
 * @param {'records' | 'stats' | 'challenge'} type
 * @param {string | undefined} arg
 * @param {any} cfg 配置：StatsHint
 * @param {() => number} [rng]
 * @returns {{ok: true, side: grksMatchSideState, hint: grksHint, slot?: string} | {ok: false, error: string}}
 */
export function applyMatchHint(side, puzzle, type, arg, cfg, rng = Math.random) {
    const check = validateMatchHint(side, puzzle, type, arg)
    if (!check.ok) return { ok: false, error: check.error || '提示参数不合法' }
    if (type === 'records') {
        const slot = /** @type {string} */ (check.slot)
        return {
            ok: true,
            side: {
                ...side,
                revealedSlots: [...side.revealedSlots, slot],
                hintCount: side.hintCount + 1,
            },
            hint: { kind: 'records', slots: [slot] },
            slot,
        }
    }
    if (type === 'stats') {
        /** 统计形式一经公开就保留在状态里，后续回合的图不会又变回空白 */
        const statsKind = check.statsKind || resolveStatsKind(cfg?.StatsHint, undefined, rng)
        return {
            ok: true,
            side: { ...side, revealedSlots: [...side.revealedSlots], hintCount: side.hintCount + 1, statsKind },
            hint: { kind: 'stats', statsKind },
        }
    }
    return {
        ok: true,
        side: { ...side, revealedSlots: [...side.revealedSlots], hintCount: side.hintCount + 1, challengeRevealed: true },
        hint: { kind: 'challenge' },
    }
}

/**
 * 匹配模式下，若无有效操作时的默认提示（超时自动执行）。
 * 优先选第一个未公开槽位；全部公开后按统计 → 课题顺序。
 * @param {grksMatchSideState} side
 * @param {grksPuzzle} puzzle
 * @returns {{type: 'records' | 'stats' | 'challenge', arg?: string}}
 */
export function defaultMatchHint(side, puzzle) {
    const remain = puzzle.slots.find(item => !side.revealedSlots.includes(item.slot))
    if (remain) return { type: 'records', arg: remain.slot }
    if (side.hintCount < puzzle.slots.length + 1) return { type: 'stats' }
    return { type: 'challenge' }
}

/**
 * 标题栏日期文本。
 * @param {Date} [date]
 * @returns {string}
 */
export function formatNow(date = new Date()) {
    const pad = (/** @type {number} */ value) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 构建渲染视图数据（结构与 `resources/html/grks/grks.art` 对应）。
 * @param {object} options
 * @param {grksPuzzle} options.puzzle
 * @param {string[]} options.revealedSlots
 * @param {boolean} options.positionRevealed
 * @param {'solo' | 'match'} options.mode
 * @param {string} [options.hintCommand] 灰框上展示的提示指令前缀（如 `#phi grks`）
 * @param {grksHint | null} [options.hint] 本次提示
 * @param {'' | 'histogram' | 'range'} [options.statsKind] 已公开的统计形式（空串/缺省表示尚未公开）
 * @param {boolean} [options.challengeRevealed] 是否已公开课题完成度
 * @param {string} [options.playerLabel] 标题栏展示的出题者标识（默认匿名）
 * @param {string} [options.avatar] 头像文件名（`resources/html/avatar` 下的名称）
 * @param {string} [options.date] 标题栏日期
 * @param {string} [options.footnote] 底部状态与指令说明
 * @param {string} [options.background] 背景图 id
 * @returns {any}
 */
export function buildView(options) {
    const { puzzle, mode } = options
    const revealed = new Set(options.revealedSlots || [])
    const positionRevealed = Boolean(options.positionRevealed)
    const hintCommand = String(options.hintCommand || '').trim()
    const challenge = challengeModeInfo(puzzle.challengeModeRank)
    const challengeRevealedHint = options.hint?.kind === 'challenge'
    const hint = options.hint || null
    /** 提示者（匹配）以完整 B30 为底图，未公开槽位只在上方盖半透明遮罩 */
    const overlayMode = mode === 'match'
    /** 统计与课题一经公开就长期展示：优先取累积状态，兼容只传本次提示的调用 */
    const revealedStatsKind = options.statsKind
        || (hint?.kind === 'stats' ? (hint.statsKind || 'histogram') : '')
    const statsRevealed = Boolean(revealedStatsKind)
    /** 直方图数据只在 histogram 形式公开后才有值；range 形式改用标尺视图 */
    const histogramRevealed = revealedStatsKind === 'histogram'
    const challengeRevealed = Boolean(options.challengeRevealed) || challengeRevealedHint
    const histogram = puzzle.analysis.histogram || /** @type {any} */ ({})
    const analysis = {
        slots: Array.isArray(histogram.slots) ? histogram.slots : [],
        ticks: Array.isArray(histogram.ticks) ? histogram.ticks : [],
        average: Number(histogram.average) || 0,
        averagePosition: Number(histogram.averagePosition) || 0,
        count: Number(histogram.count) || 0,
        domainMin: Number(histogram.domainMin) || 0,
        domainMax: Number(histogram.domainMax) || 0,
        min: puzzle.analysis.min,
        max: puzzle.analysis.max,
    }
    /** @type {any} */
    const view = {
        mode,
        positionRevealed,
        hint: hint?.kind === 'exhausted'
            ? { kind: 'text', text: '本局 B30 成绩已全部公开，可继续猜测或放弃' }
            : hint,
        stats: puzzle.stats,
        challenge,
        analysis,
        /** 直方图区域始终渲染框架；未给出类型 3 提示时按视角遮罩或留空 */
        showAnalysis: true,
        rangeHint: revealedStatsKind === 'range',
        /** 上下界（标尺）视图：把 min~max 映射到直方图同一坐标轴上 */
        rangeRuler: buildRangeRuler(analysis),
        analysisPanel: {
            /** 提示者：底图保留完整条状图，未提示前用遮罩盖住并写出指令 */
            masked: overlayMode && !histogramRevealed,
            /** 猜测者：未提示前条状图与平均数值留空 */
            blank: !overlayMode && !histogramRevealed,
            command: overlayMode && !statsRevealed ? `${hintCommand} hint 3 (histogram|range)` : '',
        },
        recordCount: puzzle.recordCount,
        phiCount: puzzle.phiCount,
        bestCount: puzzle.bestCount,
        revealedCount: revealed.size,
        totalSlots: puzzle.slots.length,
        hintCommand,
        phiSongs: [],
        bestSongs: [],
        ordered: [],
        header: {
            PlayerId: options.playerLabel || '---',
            avatar: options.avatar || 'Introduction',
            rks: '----',
            date: options.date || '',
            /** 提示者底图保留课题段位，未给类型 4 提示前用遮罩盖住；猜测者公开后一直显示 */
            showChallenge: overlayMode || challengeRevealed,
            challengeMasked: overlayMode && !challengeRevealed,
            challengeCommand: overlayMode && !challengeRevealed ? `${hintCommand} hint 4` : '',
            ChallengeMode: challenge.colorIndex,
            ChallengeModeRank: challenge.score,
        },
        recordInfo: {
            enabled: true,
            /** 提示者：底图保留存档统计，未给类型 4 提示前用遮罩盖住 */
            masked: overlayMode && !challengeRevealed,
            /** 猜测者：未给类型 4 提示前表格照常展示，但具体数字留空 */
            blank: !overlayMode && !challengeRevealed,
            command: overlayMode && !challengeRevealed ? `${hintCommand} hint 4` : '',
            stats: puzzle.stats,
        },
        footnote: options.footnote || '',
        background: options.background || fCompute.randBackground(true),
    }

    if (positionRevealed) {
        /** 位置已知：P 行与 B 行按正常槽位展示；提示者额外保留完整底图 */
        view.phiSongs = PHI_SLOTS.map(slot => slotView(puzzle, revealed, slot, mode, hintCommand, false, overlayMode))
        view.bestSongs = BEST_SLOTS.map(slot => slotView(puzzle, revealed, slot, mode, hintCommand, false, overlayMode))
    } else {
        /** 位置未知：仅展示已公开成绩，按单曲 rks 降序排列，且不显示槽位编号 */
        view.ordered = puzzle.slots
            .filter(slot => revealed.has(slot.slot))
            .sort((a, b) => b.rks - a.rks)
            .map(slot => slotView(puzzle, revealed, slot.slot, mode, hintCommand, true))
    }

    if (hint) hint.histogram = analysis
    return view
}

/**
 * 把单曲等效 rks 的上下界映射到直方图左侧数值标尺的百分比位置。
 * @param {any} analysis
 * @returns {{min: number, max: number, minPosition: number, maxPosition: number, ticks: any[]}}
 */
export function buildRangeRuler(analysis) {
    const min = Number(analysis?.min) || 0
    const max = Number(analysis?.max) || 0
    const domainMin = Number(analysis?.domainMin) || 0
    const domainMax = Number(analysis?.domainMax) || 0
    const ticks = Array.isArray(analysis?.ticks) ? analysis.ticks : []
    const span = domainMax - domainMin
    if (!(span > 0)) return { min, max, minPosition: 0, maxPosition: 100, ticks }
    /** @param {number} value */
    const clamp = value => Math.min(100, Math.max(0, value))
    return {
        min,
        max,
        minPosition: Math.round(clamp((min - domainMin) / span * 100) * 100) / 100,
        maxPosition: Math.round(clamp((max - domainMin) / span * 100) * 100) / 100,
        ticks,
    }
}

/**
 * 单条成绩的评级图标名（对应 `resources/html/otherimg/<rating>.png`）。
 * @param {grksSlotRecord | null} record
 * @returns {string}
 */
export function ratingOf(record) {
    if (!record) return 'NEW'
    if (record.score >= 1000000) return 'phi'
    if (record.fc) return 'FC'
    if (record.score >= 960000) return 'V'
    if (record.score >= 920000) return 'S'
    if (record.score >= 880000) return 'A'
    if (record.score >= 820000) return 'B'
    if (record.score >= 700000) return 'C'
    return 'F'
}

/**
 * 单个槽位的视图数据。
 * @param {grksPuzzle} puzzle
 * @param {Set<string>} revealed
 * @param {string} slot
 * @param {'solo' | 'match'} mode
 * @param {string} hintCommand
 * @param {boolean} [hideSlot] 位置未公开时不显示槽位编号
 * @param {boolean} [keepRecord] 未公开时仍渲染真实成绩（提示者底图），由遮罩覆盖
 * @returns {any}
 */
function slotView(puzzle, revealed, slot, mode, hintCommand, hideSlot = false, keepRecord = false) {
    const record = puzzle.slots.find(item => item.slot === slot) || null
    const isRevealed = Boolean(record && revealed.has(slot))
    const command = mode === 'match' && hintCommand
        ? `${hintCommand} hint ${slot}`
        : ''
    return {
        slot: hideSlot ? '' : slot,
        kind: slot.startsWith('P') ? 'phi' : 'best',
        revealed: isRevealed,
        masked: !isRevealed && keepRecord,
        record: isRevealed || keepRecord ? record : null,
        rating: ratingOf(record),
        /** 定数下方的单曲 rks：曲目公开后才显示，未公开保持 ??? */
        recordRks: isRevealed && record ? record.rks.toFixed(2) : '???',
        placeholder: isRevealed ? '' : (command || NOINFO_TEXT),
        command,
    }
}

/**
 * 文本版提示（渲染失败或纯文本场景使用）。
 * @param {object} options
 * @param {grksPuzzle} options.puzzle
 * @param {grksHint | null} options.hint
 * @param {string[]} options.revealedSlots
 * @param {boolean} options.positionRevealed
 * @returns {string}
 */
export function formatHintText(options) {
    const { puzzle, hint } = options
    const revealed = new Set(options.revealedSlots || [])
    const lines = []
    if (!hint || hint.kind === 'exhausted') {
        lines.push(grksHintWords.exhausted)
        return lines.join('\n')
    }
    if (hint.kind === 'records') {
        lines.push(grksHintWords.recordsHeader)
        for (const slot of hint.slots || []) {
            const record = puzzle.slots.find(item => item.slot === slot)
            if (!record) continue
            const position = options.positionRevealed ? `${slot} ` : ''
            lines.push(grksHintWords.recordLine(position, record.rank, record.difficulty.toFixed(1), record.song, Math.round(record.score), record.acc.toFixed(2)))
        }
        if (!options.positionRevealed) lines.push(grksHintWords.positionHidden)
        return lines.join('\n')
    }
    if (hint.kind === 'stats') {
        const statsKind = hint.statsKind || 'histogram'
        if (statsKind === 'range') {
            lines.push(grksHintWords.range(puzzle.analysis.min.toFixed(2), puzzle.analysis.max.toFixed(2)))
        } else {
            lines.push(grksHintWords.histogramHeader)
            const histogram = puzzle.analysis.histogram
            lines.push(grksHintWords.histogramRange(Number(histogram.domainMin || 0).toFixed(2), Number(histogram.domainMax || 0).toFixed(2), puzzle.analysis.average.toFixed(2)))
            for (const slot of histogram.slots || []) {
                const blocks = Math.max(1, Math.round(Number(slot.height) / 5))
                lines.push(`${String(slot.label).padStart(3, ' ')} ${'▇'.repeat(blocks)}`)
            }
        }
        return lines.join('\n')
    }
    const challenge = challengeModeInfo(puzzle.challengeModeRank)
    lines.push(grksHintWords.challenge(challenge.name, challenge.level, challenge.score))
    lines.push(grksHintWords.completionHeader)
    for (const item of puzzle.stats) {
        lines.push(grksHintWords.statsLine(item.title, item.cleared, item.tot, item.fc, item.phi))
    }
    const fcTotal = puzzle.stats.reduce((sum, item) => sum + item.fc, 0)
    const phiTotal = puzzle.stats.reduce((sum, item) => sum + item.phi, 0)
    const clearedTotal = puzzle.stats.reduce((sum, item) => sum + item.cleared, 0)
    const totTotal = puzzle.stats.reduce((sum, item) => sum + item.tot, 0)
    lines.push(grksHintWords.totalLine(clearedTotal, totTotal, fcTotal, phiTotal))
    lines.push(grksHintWords.revealed(revealed.size, puzzle.slots.length))
    return lines.join('\n')
}
