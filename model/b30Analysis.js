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
