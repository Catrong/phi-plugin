/** @param {unknown} value @returns {Record<string, unknown>} */
function object(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('分析 API 对象格式错误')
    return Object.fromEntries(Object.entries(value))
}
/** @param {unknown} value */
function number(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('分析 API 数值无效')
    return value
}
/** @param {unknown} value */
function count(value) {
    const result = number(value)
    if (!Number.isInteger(result)) throw new Error('分析 API 谱面数量无效')
    return result
}
/** @param {unknown} value */
function text(value) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('分析 API 名称无效')
    return value
}
/** @param {unknown} value @returns {unknown[]} */
function array(value) {
    if (!Array.isArray(value)) throw new Error('分析 API 列表格式错误')
    return value
}
/** @param {unknown} value */
function boolean(value) {
    if (typeof value !== 'boolean') throw new Error('分析 API 状态格式错误')
    return value
}
/** @param {unknown} value @returns {{songId: string, rank: 'EZ'|'HD'|'IN'|'AT', rks: number, difficulty: number}} */
function contribution(value) {
    const item = object(value)
    const rank = text(item.rank)
    if (rank !== 'EZ' && rank !== 'HD' && rank !== 'IN' && rank !== 'AT') throw new Error('分析 API 难度无效')
    return { songId: text(item.songId), rank, rks: number(item.rks), difficulty: number(item.difficulty) }
}
/** @param {unknown} value */
function tag(value) {
    const item = object(value)
    return { name: text(item.name), rks: number(item.rks), ceiling: number(item.ceiling),
        sampleCount: count(item.sampleCount), dimensionWeight: number(item.dimensionWeight),
        contributions: array(item.contributions).map(contribution) }
}
const dimensions = [
    { name: '读谱', key: 'reading', color: '#75e5ef' },
    { name: '硬抗', key: 'stamina', color: '#ffa478' },
    { name: '拆谱', key: 'pattern', color: '#c2a5ff' },
    { name: '定位', key: 'precision', color: '#95cfae' },
    { name: '多指', key: 'multifinger', color: '#f1ce81' },
]
/** @param {unknown} value */
function radarPoints(value) {
    const points = text(value).trim().split(/\s+/)
    if (points.length !== 5) throw new Error('分析 API 雷达图必须包含五个顶点')
    for (const point of points) {
        if (!/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(point) || point.split(',').some(part => !Number.isFinite(Number(part)))) throw new Error('分析 API 雷达图坐标无效')
    }
    return points.join(' ')
}
/** @param {unknown} value */
function parseRadar(value) {
    const radar = object(value)
    const categories = array(radar.categories).map(value => text(object(value).name))
    const grids = array(radar.grids).map(radarPoints)
    const axes = array(radar.axes).map(value => {
        const axis = object(value)
        return { x: number(axis.x), y: number(axis.y) }
    })
    if (!categories.length && !grids.length && !axes.length && radar.points === '') return { grids, axes, points: '' }
    if (categories.length !== 5 || categories.some((name, i) => name !== dimensions[i].name) || axes.length !== 5 || !grids.length) throw new Error('分析 API 雷达图维度与页面不一致')
    return { grids, axes, points: radarPoints(radar.points) }
}
/** @param {string} value */
function textWidth(value) {
    return [...value].reduce((width, char) => width + (/^[\x00-\x7f]$/.test(char) ? 8 : 14), 0)
}
/** @param {{name: string, valid: boolean, value: string, sampleCount: number}[]} tags @param {number} width */
function packRows(tags, width) {
    /** @type {{name: string, valid: boolean, value: string, sampleCount: number, width: number}[][]} */
    const rows = []
    let used = 0
    for (const tag of tags) {
        const size = textWidth(tag.name) + (tag.valid ? textWidth(`${tag.value} / ${tag.sampleCount} 首`) + 36 : 30)
        if (size > width) throw new Error(`词条名称过长，无法排版：${tag.name}`)
        if (!rows.length || used + 8 + size > width) { rows.push([]); used = 0 }
        rows[rows.length - 1].push({ ...tag, width: size })
        used += size + (used ? 8 : 0)
    }
    return rows
}
/**
 * @param {unknown} response
 * @param {number} playerRks
 * @param {(songId: string, rank: 'EZ'|'HD'|'IN'|'AT') => string} illustration
 */
export function buildB30AnalysisView(response, playerRks, illustration) {
    number(playerRks)
    const data = object(response)
    if (data.valueUnit !== 'rks') throw new Error('analysis 指令需要第二版分析 API，请将 b30AnalysisVersion 设为 v2')
    const minimumSamples = count(data.minimumTagSamples)
    if (!minimumSamples) throw new Error('分析 API 最小样本数无效')
    const insufficient = boolean(data.insufficient)
    const categories = array(data.categories).map(value => {
        const item = object(value)
        return { name: text(item.name), rks: number(item.rks), hasVotes: boolean(item.hasVotes) }
    })
    const groups = array(data.tagGroups).map(value => {
        const item = object(value)
        return { name: text(item.name), tags: array(item.tags).map(tag) }
    })
    if (new Set(categories.map(item => item.name)).size !== categories.length || new Set(groups.map(item => item.name)).size !== groups.length) throw new Error('分析 API 维度重复')
    const panels = dimensions.map((dimension, index) => {
        const category = categories.find(item => item.name === dimension.name)
        const source = groups.find(item => item.name === dimension.name)?.tags ?? []
        const sorted = source.map(item => ({ ...item, valid: item.sampleCount >= minimumSamples && item.ceiling >= playerRks - 0.5 }))
            .sort((a, b) => Number(b.valid) - Number(a.valid) || b.dimensionWeight - a.dimensionWeight || b.rks - a.rks || a.name.localeCompare(b.name, 'zh-CN'))
        if (new Set(source.map(item => item.name)).size !== source.length) throw new Error('分析 API 词条重复')
        const valid = sorted.filter(item => item.valid)
        if (Boolean(category?.hasVotes) !== Boolean(valid.length)) throw new Error('分析 API 维度与有效词条不一致')
        const cards = valid.slice(0, 3).map(item => {
            const best = [...item.contributions].sort((a, b) => b.rks - a.rks)[0]
            if (!best) throw new Error(`有效词条缺少代表谱面：${item.name}`)
            return { name: item.name, value: item.rks.toFixed(2), sampleCount: item.sampleCount,
                rank: best.rank, difficulty: best.difficulty.toFixed(1), illustration: illustration(best.songId, best.rank) }
        })
        const cardNames = new Set(cards.map(item => item.name))
        const remaining = sorted.filter(item => !cardNames.has(item.name)).map(item => ({
            name: item.name, valid: item.valid, value: item.rks.toFixed(2), sampleCount: item.sampleCount,
        }))
        let height = 320
        let rows = packRows(remaining, 560 - height * 0.3 - 27)
        while (true) {
            const chartHeight = (560 - height * 0.3 - 48) / (3 * 256 / 135 - 0.3)
            const required = 48 + chartHeight + 12 + rows.length * 40 + 18
            if (required <= height) break
            height = Math.ceil(required)
            if (height > 600) throw new Error(`词条过多，无法在分析框内排版：${dimension.name}`)
            rows = packRows(remaining, 560 - height * 0.3 - 27)
        }
        const chartHeight = (560 - height * 0.3 - 48) / (3 * 256 / 135 - 0.3)
        const edge = index === 0 ? `M0 ${height - 1} L${560 - height * .3} ${height - 1}`
            : index === 1 ? `M${height * .3} 1 L1 ${height - 1}`
            : index === 4 ? `M559 1 L${560 - height * .3} ${height - 1}` : `M${height * .3} 1 L559 1`
        return { ...dimension, number: `0${index + 1}`, value: category?.hasVotes ? category.rks.toFixed(2) : '样本不足',
            rks: category?.hasVotes ? category.rks : null, height, edge, cards,
            headingLeft: (height - 13) * .3 + 18,
            chartHeight, chartWidth: chartHeight * 256 / 135, chartLeft: (height - 48 - chartHeight) * .3 + 18,
            rows: rows.map((tags, i) => {
                const top = 48 + chartHeight + 12 + i * 40
                return { tags, top, left: (height - top - 30) * .3 + 18 }
            }) }
    })
    const radar = parseRadar(data.radar)
    const upperGrowth = Math.max(0, panels[0].height - 340)
    const middleGrowth = Math.max(0, panels[1].height - 455, panels[4].height - 455)
    const bottomGrowth = Math.max(0, panels[2].height - 320, panels[3].height - 320)
    return { panels, radar, insufficient, complete: panels.every(panel => panel.rks !== null),
        upperGrowth, middleGrowth, analysisHeight: 1270 + upperGrowth + middleGrowth + bottomGrowth }
}
