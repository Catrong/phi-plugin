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

/** 属性数据缺失时展示的占位文本 */
export const FRIB_UNKNOWN_TEXT = '—'

/** 可指定分档的难度 */
export const FRIB_LEVELS = /** @type {levelKind[]} */ (['EZ', 'HD', 'IN', 'AT'])

/** 默认分档难度 */
export const FRIB_DEFAULT_LEVEL = /** @type {levelKind} */ ('IN')

/** 默认的参与人数次数表：1 人起依次为 8/9/10/12/14/17/20 次，更多人保持最后一个值 */
export const FRIB_GUESS_NUM_TABLE = [8, 9, 10, 12, 14, 17, 20]

/**
 * @typedef {object} fribVersionInfo
 * @property {string} label 版本号文本，如 3.5.1；早于收录范围时为最早版本号加 -
 * @property {number} date 版本更新时间戳（秒），无数据时为 0
 * @property {number} order 版本在收录历史中的序号；早于收录范围的曲目排在最早版本之前
 * @property {boolean} beforeRange 是否早于收录的最早版本，此类曲目只比较早晚、不判定相近
 */

/**
 * @typedef {object} fribVersionIndex
 * @property {Map<idString, fribVersionInfo | null>} bySong 曲目加入版本，null 表示没有任何收录记录
 * @property {Map<string, number>} orderOfCode 版本编号对应的历史序号
 * @property {string} earliestLabel 收录的最早版本号
 */

/**
 * @typedef {object} fribVersionSource
 * @property {Record<string, { version_label?: string, update_date?: number } | undefined>} [oldVersionInfo] oldInfo 的版本信息，与其它来源冲突时以它为准
 * @property {Record<string, Record<string, unknown> | undefined>} [oldHistory] oldInfo 的历史定数记录
 * @property {Record<string, number>} [songVersion] songVersion.csv：曲目 id → 收录版本号
 * @property {Array<{ version_label?: string, update_date?: number, version_code?: number }>} [taptapUpdates] taptap-updates.json：版本号、更新时间与版本名称
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
 * @property {string} [sub] 展示在主文本下方的副文本
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
 * 解析参与人数次数表配置，非法或为空时回退默认表
 * @param {unknown} text 形如 "8,9,10,12,14,17,20"，也接受数字数组
 * @returns {number[]}
 */
export function parseGuessNumTable(text) {
    const raw = Array.isArray(text) ? text : String(text ?? '').split(/[,，\s]+/)
    const values = raw
        .map(value => Number(value))
        .filter(value => Number.isFinite(value) && value > 0)
        .map(value => Math.floor(value))
    return values.length ? values : [...FRIB_GUESS_NUM_TABLE]
}

/**
 * 按参与人数取本局可猜次数，人数超过表长时取表内最后一个值
 * @param {number} players 参与人数
 * @param {number[]} [table] 次数表
 * @returns {number}
 */
export function guessNumLimit(players, table = FRIB_GUESS_NUM_TABLE) {
    const list = table.length ? table : FRIB_GUESS_NUM_TABLE
    const count = Number.isFinite(players) ? Math.floor(players) : 1
    const index = Math.min(Math.max(count, 1), list.length) - 1
    return list[index]
}

/**
 * 计算回答冷却剩余时间：个人冷却与群冷却同时生效，返回剩余更长的一项
 * @param {object} options
 * @param {number} options.now 当前时间戳（毫秒）
 * @param {number} options.selfSeconds 个人回答冷却秒数
 * @param {number} options.groupSeconds 群内回答冷却秒数
 * @param {number} options.lastSelfGuess 本人上次有效回答时间戳（毫秒），未回答过传 0
 * @param {number} options.lastGroupGuess 群内上次有效回答时间戳（毫秒），未回答过传 0
 * @returns {{ kind: 'self' | 'group' | '', seconds: number }} kind 为空表示不在冷却中
 */
export function guessCooldown(options) {
    const selfLeft = options.selfSeconds * 1000 - (options.now - options.lastSelfGuess)
    const groupLeft = options.groupSeconds * 1000 - (options.now - options.lastGroupGuess)
    if (selfLeft <= 0 && groupLeft <= 0) return { kind: '', seconds: 0 }
    const selfFirst = selfLeft >= groupLeft
    return {
        kind: selfFirst ? 'self' : 'group',
        seconds: Math.ceil((selfFirst ? selfLeft : groupLeft) / 1000),
    }
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
 * 版本对比，相近范围为前后若干代；
 * 早于收录范围的曲目只比较早晚，不判定相近
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
    else if (!guess.beforeRange && !answer.beforeRange && Math.abs(offset) <= tolerance) state = FRIB_STATE.NEAR
    let arrow = FRIB_ARROW.NONE
    if (offset > 0) arrow = FRIB_ARROW.UP
    else if (offset < 0) arrow = FRIB_ARROW.DOWN
    return { state, arrow }
}

/**
 * 版本更新时间戳（秒）转 YYYY-MM-DD。
 * 固定按 UTC+8 输出，避免渲染结果随运行环境时区变化。
 * @param {unknown} seconds
 * @returns {string}
 */
export function formatVersionDate(seconds) {
    const ms = Number(seconds) * 1000
    if (!Number.isFinite(ms) || ms <= 0) return ''
    const date = new Date(ms + 8 * 60 * 60 * 1000)
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${date.getUTCFullYear()}-${month}-${day}`
}

/**
 * 合并 oldInfo、songVersion.csv 与 taptap-updates.json 推导曲目加入版本。
 * 版本号与更新时间以 oldInfo 为准；oldInfo 无法确定加入版本（在最早版本内已存在）时
 * 使用 songVersion.csv；两者都没有时记为「最早版本号-」，只比较早晚、不判定相近。
 * @param {fribVersionSource} [source]
 * @returns {fribVersionIndex}
 */
export function buildVersionIndex(source = {}) {
    const oldVersionInfo = source.oldVersionInfo ?? {}
    const oldHistory = source.oldHistory ?? {}
    const songVersion = source.songVersion ?? {}
    const taptapUpdates = source.taptapUpdates ?? []

    /** 版本号 → 版本名称与更新时间，先铺 taptap，再让 oldInfo 覆盖冲突项 */
    /** @type {Map<number, { label: string, date: number }>} */
    const meta = new Map()
    for (const record of taptapUpdates) {
        const code = Number(record?.version_code)
        if (!Number.isFinite(code)) continue
        meta.set(code, {
            label: String(record?.version_label ?? code),
            date: Number(record?.update_date ?? 0),
        })
    }
    for (const key of Object.keys(oldVersionInfo)) {
        const code = Number(key)
        if (!Number.isFinite(code)) continue
        meta.set(code, {
            label: String(oldVersionInfo[key]?.version_label ?? code),
            date: Number(oldVersionInfo[key]?.update_date ?? 0),
        })
    }

    /** 全部出现过的版本号，按大小排序后作为版本序号 */
    const codeSet = new Set(meta.keys())
    for (const key of Object.keys(oldHistory)) {
        const code = Number(key)
        if (Number.isFinite(code)) codeSet.add(code)
    }
    for (const code of Object.values(songVersion)) {
        if (Number.isFinite(code)) codeSet.add(code)
    }
    const codes = [...codeSet].sort((a, b) => a - b)
    /** @type {Map<string, number>} */
    const orderOfCode = new Map()
    codes.forEach((code, index) => orderOfCode.set(String(code), index))

    /** oldInfo 收录的最早版本 */
    const oldCodes = Object.keys(oldHistory)
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => a - b)
    const earliestOld = oldCodes[0]
    /** 曲目在 oldInfo 中首次出现的版本号 */
    /** @type {Map<string, number>} */
    const firstInOldInfo = new Map()
    for (const code of oldCodes) {
        const songs = oldHistory[String(code)] ?? {}
        for (const id of Object.keys(songs)) {
            if (!firstInOldInfo.has(id)) firstInOldInfo.set(id, code)
        }
    }

    const earliestMeta = Number.isFinite(earliestOld) ? meta.get(earliestOld) : undefined
    const earliestLabel = earliestMeta?.label ?? (Number.isFinite(earliestOld) ? String(earliestOld) : '')
    const earliestOrder = Number.isFinite(earliestOld) ? (orderOfCode.get(String(earliestOld)) ?? 0) : 0

    /** @type {Map<idString, fribVersionInfo | null>} */
    const bySong = new Map()
    const songIds = new Set([...Object.keys(songVersion), ...firstInOldInfo.keys()])
    for (const id of songIds) {
        const oldFirst = firstInOldInfo.get(id)
        const fromCsv = Number(songVersion[id])
        const knownFromOld = oldFirst !== undefined && oldFirst !== earliestOld
        /** oldInfo 能确定加入版本时以它为准，否则用 songVersion.csv */
        const code = knownFromOld ? oldFirst : (Number.isFinite(fromCsv) ? fromCsv : undefined)
        if (code === undefined) {
            if (oldFirst === undefined) {
                bySong.set(/** @type {idString} */ (id), null)
                continue
            }
            bySong.set(/** @type {idString} */ (id), {
                label: `${earliestLabel}-`,
                date: earliestMeta?.date ?? 0,
                order: earliestOrder - 1,
                beforeRange: true,
            })
            continue
        }
        const info = meta.get(code)
        bySong.set(/** @type {idString} */ (id), {
            label: info?.label ?? String(code),
            date: info?.date ?? 0,
            order: orderOfCode.get(String(code)) ?? 0,
            beforeRange: false,
        })
    }
    return { bySong, orderOfCode, earliestLabel }
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
 * @param {string} [sub] 主文本下方的副文本
 * @returns {fribCompareItem}
 */
function buildItem(value, result, sub = '') {
    const text = String(value ?? '').trim()
    return {
        value: text || FRIB_UNKNOWN_TEXT,
        ...(text && sub ? { sub } : {}),
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
    const guessVersion = versionOf(guess, context.versionIndex)
    const version = compareVersion(guessVersion, versionOf(answer, context.versionIndex), context.nearVersion)
    const guessSong = normalizeText(guess?.song)
    const answerSong = normalizeText(answer?.song)
    return {
        player: context.player,
        song: String(guess?.song ?? ''),
        hit: Boolean(guessSong) && guessSong === answerSong,
        composer: buildItem(guess?.composer, compareText(guess?.composer, answer?.composer)),
        version: buildItem(guessVersion?.label, version, guessVersion ? formatVersionDate(guessVersion.date) : ''),
        chapter: buildItem(guess?.chapter, compareText(guess?.chapter, answer?.chapter)),
        original: buildItem(originalText(guess?.isOriginal), compareBoolean(guess?.isOriginal === true, answer?.isOriginal === true)),
        difficulty: buildItem(numberText(guessChart?.difficulty, 1), difficulty),
        bpm: buildItem(guess?.bpm, bpm),
        combo: buildItem(numberText(guessChart?.combo, 0), combo),
    }
}
