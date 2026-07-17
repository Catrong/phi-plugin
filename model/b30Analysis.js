export const MIN_B30_TAG_VOTES = 30

/**
 * @typedef {object} B30AnalysisRecord
 * @property {idString} id
 * @property {allLevelKind} rank
 * @property {number} rks
 * @property {'phi'|'best'} kind
 * @property {string} slot
 */

/**
 * 取得实际参与 RKS 计算的 P3 + B27 槽位。
 * @param {{phi?: any[], b19_list?: any[]}} b30
 * @returns {B30AnalysisRecord[]}
 */
export function getB30AnalysisRecords(b30) {
    const phi = (b30.phi || []).slice(0, 3).map((record, index) => record && ({
        id: record.id,
        rank: record.rank,
        rks: Number(record.rks),
        kind: 'phi',
        slot: `P${index + 1}`,
    })).filter(Boolean)
    const best = (b30.b19_list || []).slice(0, 27).map((record, index) => record && ({
        id: record.id,
        rank: record.rank,
        rks: Number(record.rks),
        kind: 'best',
        slot: `B${index + 1}`,
    })).filter(Boolean)
    return /** @type {B30AnalysisRecord[]} */ ([...phi, ...best].filter(record =>
        record.id && ['EZ', 'HD', 'IN', 'AT', 'LEGACY'].includes(record.rank) && Number.isFinite(record.rks)
    ))
}

/**
 * 合并相同曲目的难度，生成批量谱面标签请求。
 * @param {B30AnalysisRecord[]} records
 */
export function buildChartTagBatchRequest(records) {
    /** @type {Map<idString, Set<levelKind>>} */
    const grouped = new Map()
    for (const record of records) {
        if (!['EZ', 'HD', 'IN', 'AT'].includes(record.rank)) continue
        if (!grouped.has(record.id)) grouped.set(record.id, new Set())
        grouped.get(record.id)?.add(/** @type {levelKind} */ (record.rank))
    }
    return [...grouped.entries()].map(([song_id, ranks]) => ({ song_id, rank: [...ranks] }))
}

/**
 * @param {B30AnalysisRecord[]} records
 * @param {{
 *  data?: Record<string, Record<string, Record<string, number>>>,
 *  tree?: Record<string, Record<string, {name: string, voteCount: number, sortOrder?: number}[]>>
 * } | null} response
 * @param {number} [minimumVotes]
 */
export function buildB30TagAnalysis(records, response, minimumVotes = MIN_B30_TAG_VOTES) {
    /** @type {Map<string, {weightedRks: number, weight: number, votes: number}>} */
    const tagTotals = new Map()
    let totalVotes = 0

    for (const record of records) {
        const chartTags = response?.data?.[record.id]?.[record.rank] || {}
        const maxVotes = Math.max(0, ...Object.values(chartTags).map(Number).filter(Number.isFinite))
        if (maxVotes <= 0) continue
        for (const [name, rawVotes] of Object.entries(chartTags)) {
            const votes = Number(rawVotes)
            if (!Number.isFinite(votes) || votes <= 0) continue
            const weight = votes / maxVotes
            const current = tagTotals.get(name) || { weightedRks: 0, weight: 0, votes: 0 }
            // 单谱面标签贡献：单曲等效 RKS * (该标签票数 / 该谱面最高标签票数)。
            current.weightedRks += record.rks * weight
            current.weight += weight
            current.votes += votes
            totalVotes += votes
            tagTotals.set(name, current)
        }
    }

    const tags = [...tagTotals.entries()].map(([name, value]) => ({
        name,
        rks: value.weightedRks / value.weight,
        votes: value.votes,
    })).sort((a, b) => b.rks - a.rks || b.votes - a.votes || a.name.localeCompare(b.name, 'zh-CN'))

    const strong = tags.slice(0, 3)
    const strongNames = new Set(strong.map(tag => tag.name))
    const weak = [...tags].reverse().filter(tag => !strongNames.has(tag.name)).slice(0, 3)
    const averageRks = records.length
        ? records.reduce((sum, record) => sum + record.rks, 0) / records.length
        : 0
    const categories = buildCategoryTagSummary(records, response, averageRks)

    return {
        totalVotes,
        minimumVotes,
        averageRks,
        categories,
        radar: buildTagRadar(categories, averageRks),
        strong,
        weak,
        insufficient: totalVotes < minimumVotes || strong.length < 3 || weak.length < 3,
    }
}

/**
 * 汇总标签树的顶层分类，并按有效票数计算等效 RKS。
 * @param {B30AnalysisRecord[]} records
 * @param {{
 *  data?: Record<string, Record<string, Record<string, number>>>,
 *  tree?: Record<string, Record<string, {name: string, voteCount: number, sortOrder?: number}[]>>
 * } | null} response
 * @param {number} averageRks
 */
function buildCategoryTagSummary(records, response, averageRks) {
    /** @type {Map<string, {name: string, weightedRks: number, votes: number, order: number}>} */
    const totals = new Map()

    for (const record of records) {
        const categoryNodes = response?.tree?.[record.id]?.[record.rank] || []
        const chartTags = response?.data?.[record.id]?.[record.rank] || {}
        const maxVotes = Math.max(0, ...Object.values(chartTags).map(Number).filter(Number.isFinite))
        for (const [index, node] of categoryNodes.entries()) {
            const current = totals.get(node.name) || {
                name: node.name,
                weightedRks: 0,
                votes: 0,
                order: Number(node.sortOrder ?? index),
            }
            const votes = Number(node.voteCount)
            if (maxVotes > 0 && Number.isFinite(votes) && votes > 0) {
                const weight = votes / maxVotes
                current.weightedRks += record.rks * weight
                current.votes += weight
            }
            totals.set(node.name, current)
        }
    }

    return [...totals.values()]
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'))
        .map(category => ({
            name: category.name,
            rks: category.votes ? category.weightedRks / category.votes : averageRks,
            votes: category.votes,
            hasVotes: category.votes > 0,
        }))
}

/**
 * 生成模板可直接绘制的雷达图坐标。分类 RKS 以 B30 平均值 +/- 1 为显示域。
 * @param {{name: string, rks: number, votes: number, hasVotes: boolean}[]} categories
 * @param {number} averageRks
 */
function buildTagRadar(categories, averageRks) {
    if (categories.length < 3) return { grids: [], axes: [], points: '', categories: [] }

    const centerX = 100
    const centerY = 92
    const radius = 55
    const labelRadius = 78
    /** @param {number} index @param {number} scale @param {number} [targetRadius] */
    const pointAt = (index, scale, targetRadius = radius) => {
        const angle = -Math.PI / 2 + Math.PI * 2 * index / categories.length
        return {
            x: centerX + Math.cos(angle) * targetRadius * scale,
            y: centerY + Math.sin(angle) * targetRadius * scale,
            cos: Math.cos(angle),
        }
    }
    /** @param {number} scale */
    const toPointString = scale => categories
        .map((_, index) => {
            const point = pointAt(index, scale)
            return `${point.x.toFixed(1)},${point.y.toFixed(1)}`
        })
        .join(' ')

    const radarCategories = categories.map((category, index) => {
        const normalized = category.hasVotes
            ? Math.min(1, Math.max(0, (category.rks - (averageRks - 1)) / 2))
            : 0
        const point = pointAt(index, normalized)
        const label = pointAt(index, 1, labelRadius)
        return {
            ...category,
            pointX: point.x,
            pointY: point.y,
            labelX: label.x,
            labelY: label.y,
            anchor: label.cos > 0.25 ? 'start' : label.cos < -0.25 ? 'end' : 'middle',
            displayRks: category.hasVotes ? category.rks.toFixed(2) : '--',
        }
    })

    return {
        grids: [0.25, 0.5, 0.75, 1].map(toPointString),
        axes: categories.map((_, index) => {
            const point = pointAt(index, 1)
            return { x: point.x, y: point.y }
        }),
        points: radarCategories.map(category => `${category.pointX.toFixed(1)},${category.pointY.toFixed(1)}`).join(' '),
        categories: radarCategories,
    }
}

/**
 * @param {number} value
 */
function niceAxisStep(value) {
    const candidates = [0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1]
    return candidates.find(candidate => candidate >= value) || Math.ceil(value)
}

/**
 * 按 P1-P3、B1-B27 槽位生成等效单曲 RKS 直方图。
 * @param {B30AnalysisRecord[]} records
 * @param {number} [targetTickCount]
 */
export function buildRksHistogram(records, targetTickCount = 4) {
    const valid = records.filter(record => Number.isFinite(record.rks))
    if (!valid.length) return { slots: [], ticks: [], average: 0, averagePosition: 0, count: 0 }

    const values = valid.map(record => record.rks)
    const minimum = Math.min(...values)
    const maximum = Math.max(...values)
    const step = niceAxisStep(Math.max(maximum - minimum, 0.2) / targetTickCount)
    const domainMin = Math.floor((minimum - step * 0.1) / step) * step
    let domainMax = Math.ceil((maximum + step * 0.1) / step) * step
    if (domainMax <= domainMin) domainMax = domainMin + step
    const domainRange = domainMax - domainMin

    const ticks = []
    const tickCount = Math.round(domainRange / step)
    for (let index = 0; index <= tickCount; index++) {
        const value = domainMin + index * step
        ticks.push({
            value,
            label: value.toFixed(2),
            position: index / tickCount * 100,
        })
    }

    const slotCounters = { phi: 0, best: 0 }
    const slots = valid.map(record => {
        slotCounters[record.kind] += 1
        return {
            label: record.slot || `${record.kind === 'phi' ? 'P' : 'B'}${slotCounters[record.kind]}`,
            rks: record.rks,
            kind: record.kind,
            height: Math.min(100, Math.max(0, (record.rks - domainMin) / domainRange * 100)),
        }
    })

    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    return {
        slots,
        ticks,
        average,
        averagePosition: Math.min(100, Math.max(0, (average - domainMin) / domainRange * 100)),
        count: valid.length,
        domainMin,
        domainMax,
    }
}
