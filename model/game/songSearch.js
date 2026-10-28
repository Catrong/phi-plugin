import getInfo from './getInfo.js'
import { Level } from './constNum.js'

/** @typedef {import('./SongsInfo.js').default} SongsInfo */

/** @typedef {'bpm' | 'difficulty' | 'combo'} SearchFilterKey */

/**
 * @typedef {Object} SearchFilter
 * @property {SearchFilterKey} key
 * @property {number} bottom
 * @property {number} top
 * @property {string} label 用户输入的范围原文，用于展示
 */

/**
 * @typedef {SongsInfo & { bpmList?: number[] }} SearchableSong
 */

/**
 * @typedef {Object} SearchChartHit
 * @property {number} difficulty
 * @property {number | undefined} combo
 * @property {boolean} matched 是否命中本次难度或物量筛选
 */

/**
 * @typedef {Object} SearchHit
 * @property {idString} id
 * @property {SearchableSong | undefined} info
 * @property {Partial<Record<levelKind, SearchChartHit>>} charts
 */

/**
 * @typedef {Object} TableColumn
 * @property {string} title
 * @property {'left' | 'center' | 'right'} [align]
 * @property {string} [width]
 * @property {boolean} [highlight]
 */

/**
 * @typedef {Object} TableCell
 * @property {string} text
 * @property {string} [subtext]
 * @property {'left' | 'center' | 'right'} [align]
 * @property {boolean} [highlight]
 * @property {string} [className]
 */

/**
 * @typedef {Object} SearchTable
 * @property {TableColumn[]} columns
 * @property {TableCell[][]} rows
 * @property {number} total 命中总数
 * @property {number} shown 实际展示行数
 * @property {boolean} truncated 是否因上限被截断
 */

/**
 * @param {number} value
 * @param {SearchFilter} filter
 */
function inRange(value, filter) {
    return Number.isFinite(value) && filter.bottom <= value && value <= filter.top
}

/**
 * @type {Record<SearchFilterKey, {
 *   regex: RegExp,
 *   match: (info: SearchableSong | undefined, filter: SearchFilter) => boolean
 * }>}
 */
const FILTERS = {
    bpm: {
        regex: /bpm[\s:：,，/|~是为]*([0-9]+(?:\s*-\s*[0-9]+)?)/,
        match: (info, filter) => {
            const list = Array.isArray(info?.bpmList) ? info.bpmList : []
            if (list.length) return list.some(bpm => inRange(Number(bpm), filter))
            return inRange(Number(info?.bpm), filter)
        }
    },
    difficulty: {
        regex: /(?:difficulty|dif|定数|难度|定级)[\s:：,，/|~是为]*([0-9.]+(?:\s*-\s*[0-9.]+)?)/,
        match: (info, filter) => Level.some(level => {
            const chart = info?.chart?.[level]
            return chart ? inRange(Number(chart.difficulty), filter) : false
        })
    },
    combo: {
        regex: /(?:combo|cmb|物量|连击)[\s:：,，/|~是为]*([0-9]+(?:\s*-\s*[0-9]+)?)/,
        match: (info, filter) => Level.some(level => {
            const chart = info?.chart?.[level]
            return chart ? inRange(Number(chart.combo), filter) : false
        })
    }
}

/**
 * 解析检索指令中的筛选条件。
 * @param {string} input
 * @returns {SearchFilter[]}
 */
export function parseSearchFilters(input) {
    const text = String(input ?? '').toLowerCase()
    /** @type {SearchFilter[]} */
    const filters = []
    for (const key of /** @type {SearchFilterKey[]} */ (Object.keys(FILTERS))) {
        const match = text.match(FILTERS[key].regex)
        if (!match) continue
        const label = match[1].replace(/\s+/g, '')
        const [first, second] = label.split('-')
        const firstNum = Number(first)
        const secondNum = second === undefined ? firstNum : Number(second)
        if (!Number.isFinite(firstNum) || !Number.isFinite(secondNum)) continue
        const bottom = Math.min(firstNum, secondNum)
        const top = Math.max(firstNum, secondNum)
        /** 整数定级包含该级所有小数谱面，如 15 覆盖 15.0~15.9 */
        const expandedTop = key === 'difficulty' && !label.includes('.0') && top % 1 === 0 ? top + 0.9 : top
        filters.push({ key, bottom, top: expandedTop, label })
    }
    return filters
}

/**
 * @param {SearchableSong | undefined} info
 * @param {SearchFilter[]} chartFilters
 * @returns {Partial<Record<levelKind, SearchChartHit>>}
 */
function collectChartHits(info, chartFilters) {
    /** @type {Partial<Record<levelKind, SearchChartHit>>} */
    const charts = {}
    for (const level of Level) {
        const chart = info?.chart?.[level]
        if (!chart) continue
        const difficulty = Number(chart.difficulty)
        const combo = chart.combo === undefined ? undefined : Number(chart.combo)
        charts[level] = {
            difficulty,
            combo,
            matched: chartFilters.length > 0 && chartFilters.every(filter =>
                inRange(filter.key === 'difficulty' ? difficulty : Number(combo), filter)
            )
        }
    }
    return charts
}

/**
 * 按筛选条件检索曲目。
 * @param {string} input
 * @param {Record<string, SongsInfo | undefined>} [songs]
 * @returns {{ filters: SearchFilter[], hits: SearchHit[] }}
 */
export function searchSongs(input, songs = getInfo.all_info()) {
    const filters = parseSearchFilters(input)
    const ids = /** @type {idString[]} */ (Object.keys(songs))
    const remain = filters.reduce((current, filter) => {
        const matches = FILTERS[filter.key].match
        return current.filter(id => matches(/** @type {SearchableSong | undefined} */ (songs[id]), filter))
    }, ids)
    const chartFilters = filters.filter(filter => filter.key !== 'bpm')
    return {
        filters,
        hits: remain.map(id => {
            const info = /** @type {SearchableSong | undefined} */ (songs[id])
            return { id, info, charts: collectChartHits(info, chartFilters) }
        })
    }
}

/**
 * @param {SearchableSong | undefined} info
 * @returns {string}
 */
function formatBpm(info) {
    const list = Array.isArray(info?.bpmList)
        ? info.bpmList.filter(bpm => Number.isFinite(Number(bpm)))
        : []
    if (list.length) return list.map(bpm => String(bpm)).join(' / ')
    return info?.bpm ? String(info.bpm) : '-'
}

/**
 * @param {SearchChartHit} chart
 * @returns {string}
 */
function formatChart(chart) {
    const difficulty = Number.isFinite(chart.difficulty) ? String(chart.difficulty) : '-'
    if (chart.combo === undefined || !Number.isFinite(chart.combo)) return difficulty
    return `${difficulty} · ${chart.combo}`
}

/**
 * 把检索结果转换为通用表格模板数据。
 * @param {SearchHit[]} hits
 * @param {SearchFilter[]} filters
 * @param {number} limit 单页最大行数
 * @returns {SearchTable}
 */
export function buildSearchTable(hits, filters, limit) {
    const size = Number.isSafeInteger(limit) && limit > 0 ? limit : hits.length
    const shown = hits.slice(0, size)
    const hasBpm = filters.some(filter => filter.key === 'bpm')
    const hasChart = filters.some(filter => filter.key !== 'bpm')
    const levelColumns = Level.map(level => {
        /** @type {TableColumn} */
        const column = { title: level, align: 'center', highlight: hasChart }
        return column
    })
    /** @type {TableColumn[]} */
    const columns = [
        { title: '曲目', align: 'left', width: '30%' },
        { title: 'BPM', align: 'center', width: '13%', highlight: hasBpm },
        ...levelColumns
    ]
    /** @type {TableCell[][]} */
    const rows = shown.map(hit => [
        { text: hit.info?.song || hit.id, subtext: hit.id, align: 'left' },
        { text: formatBpm(hit.info), highlight: hasBpm },
        ...Level.map(level => {
            const chart = hit.charts[level]
            /** @type {TableCell} */
            const cell = { text: chart ? formatChart(chart) : '-', className: `level-${level}` }
            if (chart?.matched) cell.highlight = true
            return cell
        })
    ])
    return {
        columns,
        rows,
        total: hits.length,
        shown: shown.length,
        truncated: shown.length < hits.length
    }
}
