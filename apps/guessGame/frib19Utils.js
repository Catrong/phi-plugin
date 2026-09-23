/**
 * 「弗一把」猜歌游戏的纯逻辑工具。
 * 这里只做数据整理与属性对比判定，不涉及消息发送与游戏状态，便于单测覆盖。
 */

/** 属性对比结果：相同 / 相近 / 不同 / 数据未知 */
export const FRIB_STATE = {
    SAME: 'same',
    NEAR: 'near',
    DIFF: 'diff',
    UNKNOWN: 'unknown',
}

/** 箭头方向：答案更高更晚 / 答案更低更早 / 无 */
export const FRIB_ARROW = {
    UP: 'up',
    DOWN: 'down',
    NONE: '',
}

/** 曲目早于收录的最早版本时展示的占位文本 */
export const FRIB_UNKNOWN_VERSION = 'x.xx.xx-'

/** 属性数据缺失时展示的占位文本 */
export const FRIB_UNKNOWN_TEXT = '—'

/** 可指定分档的难度 */
export const FRIB_LEVELS = /** @type {levelKind[]} */ (['EZ', 'HD', 'IN', 'AT'])

/** 默认分档难度 */
export const FRIB_DEFAULT_LEVEL = /** @type {levelKind} */ ('IN')

/**
 * @typedef {object} fribVersionInfo
 * @property {string} label 版本号文本，如 3.5.1
 * @property {number} order 版本在收录历史中的序号
 */

/**
 * @typedef {object} fribVersionIndex
 * @property {Map<idString, fribVersionInfo | null>} bySong 曲目加入版本，null 表示早于收录范围
 * @property {Map<string, number>} orderOfCode 版本编号对应的历史序号
 */

/**
 * @typedef {object} fribSongChart
 * @property {number} [difficulty]
 * @property {number} [combo]
 */

/**
 * @typedef {object} fribSongInfo
 * @property {string} [id]
 * @property {string} [song]
 * @property {string} [composer]
 * @property {string} [chapter]
 * @property {string} [bpm]
 * @property {boolean} [isOriginal]
 * @property {Partial<Record<allLevelKind, fribSongChart>>} [chart]
 */

/**
 * @typedef {object} fribCompareItem
 * @property {string} value 展示文本
 * @property {string} state 对比结果
 * @property {string} arrow 箭头方向
 */

/**
 * @typedef {object} fribRow
 * @property {string} player 猜测玩家
 * @property {string} song 曲名
 * @property {boolean} hit 是否命中答案
 * @property {fribCompareItem} composer 作曲
 * @property {fribCompareItem} version 加入版本
 * @property {fribCompareItem} chapter 所属章节
 * @property {fribCompareItem} original 是否独占
 * @property {fribCompareItem} difficulty 定数
 * @property {fribCompareItem} bpm BPM
 * @property {fribCompareItem} combo 物量
 */

/** @typedef {{ min: number, max: number }} fribNumberRange */

/**
 * 归一化文本，忽略大小写与首尾空白
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
    return String(value ?? '').trim().toLowerCase()
}

/**
 * 把单值包装成区间
 * @param {unknown} value
 * @returns {fribNumberRange | null}
 */
function toRange(value) {
    return typeof value === 'number' && Number.isFinite(value) ? { min: value, max: value } : null
}

/**
 * 解析 BPM 文本，兼容 35~400 这类区间写法
 * @param {unknown} bpm
 * @returns {fribNumberRange | null}
 */
export function parseBpmRange(bpm) {
    const matched = String(bpm ?? '').match(/\d+(?:\.\d+)?/g)
    if (!matched?.length) return null
    const values = matched.map(value => Number(value)).filter(value => Number.isFinite(value))
    if (!values.length) return null
    return { min: Math.min(...values), max: Math.max(...values) }
}

/**
 * 解析开局参数，例如「/phi 弗一把 IN 14+」
 * @param {string} msg 触发消息
 * @param {levelKind} [defaultLevel] 未指定难度时使用的分档
 * @returns {{ level: levelKind, minDifficulty: number | null }}
 */
export function parseStartArgs(msg, defaultLevel = FRIB_DEFAULT_LEVEL) {
    const text = String(msg ?? '').replace(/-\s*[lL]\s*\d+/g, '')
    const rawLevel = text.match(/\b(EZ|HD|IN|AT)\b/i)?.[1]?.toUpperCase() ?? ''
    const fallback = FRIB_LEVELS.find(item => item === defaultLevel) ?? FRIB_DEFAULT_LEVEL
    const level = FRIB_LEVELS.find(item => item === rawLevel) ?? fallback
    const rawDifficulty = text.match(/(\d+(?:\.\d+)?)\s*\+?/)
    return {
        level,
        minDifficulty: rawDifficulty ? Number(rawDifficulty[1]) : null,
    }
}

/**
 * 数值与数值区间对比
 * @param {fribNumberRange | null} guess
 * @param {fribNumberRange | null} answer
 * @param {number} tolerance 允许的相近范围
 * @returns {{ state: string, arrow: string }}
 */
export function compareNumberRange(guess, answer, tolerance) {
    if (!guess || !answer) return { state: FRIB_STATE.UNKNOWN, arrow: FRIB_ARROW.NONE }
    const same = guess.min === answer.min && guess.max === answer.max
    const gap = Math.max(0, guess.min - answer.max, answer.min - guess.max)
    const state = same ? FRIB_STATE.SAME : (gap <= tolerance ? FRIB_STATE.NEAR : FRIB_STATE.DIFF)
    const guessCenter = (guess.min + guess.max) / 2
    const answerCenter = (answer.min + answer.max) / 2
    let arrow = FRIB_ARROW.NONE
    if (answerCenter > guessCenter) arrow = FRIB_ARROW.UP
    else if (answerCenter < guessCenter) arrow = FRIB_ARROW.DOWN
    return { state, arrow }
}

/**
 * 文本属性对比
 * @param {unknown} guess
 * @param {unknown} answer
 * @returns {{ state: string, arrow: string }}
 */
export function compareText(guess, answer) {
    const guessText = normalizeText(guess)
    const answerText = normalizeText(answer)
    if (!guessText || !answerText) return { state: FRIB_STATE.UNKNOWN, arrow: FRIB_ARROW.NONE }
    return {
        state: guessText === answerText ? FRIB_STATE.SAME : FRIB_STATE.DIFF,
        arrow: FRIB_ARROW.NONE,
    }
}

/**
 * 布尔属性对比
 * @param {boolean} guess
 * @param {boolean} answer
 * @returns {{ state: string, arrow: string }}
 */
export function compareBoolean(guess, answer) {
    return {
        state: guess === answer ? FRIB_STATE.SAME : FRIB_STATE.DIFF,
        arrow: FRIB_ARROW.NONE,
    }
}

/**
 * 版本对比，相近范围为前后若干代
 * @param {fribVersionInfo | null} guess
 * @param {fribVersionInfo | null} answer
 * @param {number} tolerance
 * @returns {{ state: string, arrow: string }}
 */
export function compareVersion(guess, answer, tolerance) {
    if (!guess || !answer) return { state: FRIB_STATE.UNKNOWN, arrow: FRIB_ARROW.NONE }
    const offset = answer.order - guess.order
    let state = FRIB_STATE.DIFF
    if (offset === 0) state = FRIB_STATE.SAME
    else if (Math.abs(offset) <= tolerance) state = FRIB_STATE.NEAR
    let arrow = FRIB_ARROW.NONE
    if (offset > 0) arrow = FRIB_ARROW.UP
    else if (offset < 0) arrow = FRIB_ARROW.DOWN
    return { state, arrow }
}

/**
 * 根据历史定数记录推导每首曲目的加入版本。
 * 收录的最早版本中已存在的曲目无法确定加入版本，记为 null。
 * @param {Record<string, { version_label?: string } | undefined>} versionInfoByCode
 * @param {Record<string, Record<string, unknown> | undefined>} historyDifficultyByVersion
 * @returns {fribVersionIndex}
 */
export function buildVersionIndex(versionInfoByCode, historyDifficultyByVersion) {
    const codes = Object.keys(versionInfoByCode || {})
        .filter(code => Number.isFinite(Number(code)))
        .sort((a, b) => Number(a) - Number(b))
    /** @type {Map<string, number>} */
    const orderOfCode = new Map()
    codes.forEach((code, index) => orderOfCode.set(code, index))
    /** @type {Map<idString, fribVersionInfo | null>} */
    const bySong = new Map()
    const earliest = codes[0]
    for (const code of codes) {
        const songs = historyDifficultyByVersion?.[code] ?? {}
        const versionInfo = versionInfoByCode?.[code]
        for (const id of Object.keys(songs)) {
            if (bySong.has(/** @type {idString} */ (id))) continue
            if (code === earliest) {
                bySong.set(/** @type {idString} */ (id), null)
                continue
            }
            bySong.set(/** @type {idString} */ (id), {
                label: String(versionInfo?.version_label ?? code),
                order: orderOfCode.get(code) ?? 0,
            })
        }
    }
    return { bySong, orderOfCode }
}

/**
 * 构造参与游戏的曲目池：需要存在对应难度谱面，并满足定数下限
 * @param {idString[]} idList 曲库曲目
 * @param {object} options
 * @param {levelKind} options.level 指定难度
 * @param {number | null} options.minDifficulty 定数下限
 * @param {(id: idString) => fribSongInfo | undefined} options.infoOf 曲目信息读取
 * @returns {idString[]}
 */
export function buildSongPool(idList, options) {
    const { level, minDifficulty, infoOf } = options
    /** @type {idString[]} */
    const pool = []
    for (const id of idList) {
        const info = infoOf(id)
        const difficulty = info?.chart?.[level]?.difficulty
        if (!info || typeof difficulty !== 'number' || !Number.isFinite(difficulty) || difficulty <= 0) continue
        if (minDifficulty !== null && difficulty < minDifficulty) continue
        pool.push(id)
    }
    return pool
}

/**
 * 取曲目的加入版本
 * @param {fribSongInfo} info
 * @param {fribVersionIndex} versionIndex
 * @returns {fribVersionInfo | null}
 */
function versionOf(info, versionIndex) {
    const id = info?.id
    if (!id) return null
    return versionIndex.bySong.get(/** @type {idString} */ (id)) ?? null
}

/**
 * 版本展示文本
 * @param {fribSongInfo} info
 * @param {fribVersionIndex} versionIndex
 * @returns {string}
 */
function versionLabelOf(info, versionIndex) {
    return versionOf(info, versionIndex)?.label ?? FRIB_UNKNOWN_VERSION
}

/**
 * 独占标记展示文本，数据仅在独占曲目上标记 true
 * @param {unknown} isOriginal
 * @returns {string}
 */
function originalText(isOriginal) {
    return isOriginal === true ? '独占' : '非独占'
}

/**
 * 数值展示文本
 * @param {unknown} value
 * @param {number} fixed 小数位数
 * @returns {string | null}
 */
function numberText(value, fixed) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    return value.toFixed(fixed)
}

/**
 * 组合展示文本与对比结果，数据缺失时统一降级为「数据未知」
 * @param {unknown} value
 * @param {{ state: string, arrow: string }} result
 * @returns {fribCompareItem}
 */
function buildItem(value, result) {
    const text = String(value ?? '').trim()
    return {
        value: text || FRIB_UNKNOWN_TEXT,
        state: text ? result.state : FRIB_STATE.UNKNOWN,
        arrow: text ? result.arrow : FRIB_ARROW.NONE,
    }
}

/**
 * @typedef {object} fribRenderRow
 * @property {string} player 行首文本，猜测行为玩家名，答案行为曲目编号
 * @property {string} song 曲名
 * @property {boolean} hit 是否命中答案
 * @property {(fribCompareItem & { cls: string })[]} cells 除玩家与曲名外的对比列，顺序与模板一致
 */

/**
 * 把猜测记录转换为渲染数据，列顺序为 Artist / Version / 分类 / 独占 / 定数 / BPM / 物量
 * @param {fribRow[]} rows
 * @returns {fribRenderRow[]}
 */
export function toRenderRows(rows) {
    /** @type {[string, 'composer' | 'version' | 'chapter' | 'original' | 'difficulty' | 'bpm' | 'combo'][]} */
    const columns = [
        ['artistCell', 'composer'],
        ['versionCell', 'version'],
        ['chapterCell', 'chapter'],
        ['originalCell', 'original'],
        ['difficultyCell', 'difficulty'],
        ['bpmCell', 'bpm'],
        ['comboCell', 'combo'],
    ]
    return rows.map(row => ({
        player: row.player,
        song: row.song,
        hit: row.hit,
        cells: columns.map(([cls, key]) => ({ cls, ...row[key] })),
    }))
}

/**
 * 生成一行猜测记录
 * @param {fribSongInfo} guess 猜测曲目
 * @param {fribSongInfo} answer 答案曲目
 * @param {object} context
 * @param {string} context.player 猜测玩家名
 * @param {levelKind} context.level 对比使用的难度
 * @param {fribVersionIndex} context.versionIndex 版本索引
 * @param {number} context.nearDifficulty 定数相近范围
 * @param {number} context.nearBpm BPM相近范围
 * @param {number} context.nearCombo 物量相近范围
 * @param {number} context.nearVersion 版本相近范围
 * @returns {fribRow}
 */
export function createFribRow(guess, answer, context) {
    const guessChart = guess?.chart?.[context.level]
    const answerChart = answer?.chart?.[context.level]
    const difficulty = compareNumberRange(toRange(guessChart?.difficulty), toRange(answerChart?.difficulty), context.nearDifficulty)
    const combo = compareNumberRange(toRange(guessChart?.combo), toRange(answerChart?.combo), context.nearCombo)
    const bpm = compareNumberRange(parseBpmRange(guess?.bpm), parseBpmRange(answer?.bpm), context.nearBpm)
    const version = compareVersion(versionOf(guess, context.versionIndex), versionOf(answer, context.versionIndex), context.nearVersion)
    const guessSong = normalizeText(guess?.song)
    const answerSong = normalizeText(answer?.song)
    return {
        player: context.player,
        song: String(guess?.song ?? ''),
        hit: Boolean(guessSong) && guessSong === answerSong,
        composer: buildItem(guess?.composer, compareText(guess?.composer, answer?.composer)),
        version: buildItem(versionLabelOf(guess, context.versionIndex), version),
        chapter: buildItem(guess?.chapter, compareText(guess?.chapter, answer?.chapter)),
        original: buildItem(originalText(guess?.isOriginal), compareBoolean(guess?.isOriginal === true, answer?.isOriginal === true)),
        difficulty: buildItem(numberText(guessChart?.difficulty, 1), difficulty),
        bpm: buildItem(guess?.bpm, bpm),
        combo: buildItem(numberText(guessChart?.combo, 0), combo),
    }
}
