import { grksViewWords } from '../../model/render/messages.js'
import { Level } from '../../model/game/constNum.js'
import fCompute from '../../model/game/fCompute.js'

/** @import {grksKnownData, grksGuessEntry, grksGuessResult} from './grks.js' */

/** @typedef {import('../../model/game/LevelRecordInfo.js').default} LevelRecordInfo */

/**
 * 成绩中模板会用到的字段。
 * @typedef {object} grksRecordLike
 * @property {idString} id 曲目 id
 * @property {allLevelKind} rank 难度名
 * @property {number} difficulty 定数
 * @property {number} score 分数
 * @property {number} acc 准确率
 * @property {number} rks 单曲等效 rks
 * @property {ratingKind} Rating 评级
 * @property {string} [song] 曲名（曲目信息缺失时没有）
 * @property {string} [illustration] 曲绘（曲目信息缺失时没有）
 */

/**
 * 构建猜 RKS 对局视图。
 *
 * 视图只使用 `grksClass#getKnownData()` 的输出：`records` / `info` / `sheet`，
 * 不再假设调用方持有完整题目。模板为 `resources/html/grks/grks.art`。
 */

/**
 * 模板中一条成绩所需的数据。
 * @typedef {object} grksSoloRecordData
 * @property {string} song 曲名
 * @property {string} illustration 曲绘
 * @property {string} rank 难度名
 * @property {number} difficulty 定数
 * @property {number} score 分数
 * @property {number} acc 准确率
 */

/**
 * 模板中的一条成绩槽位。
 * @typedef {object} grksSoloRecordView
 * @property {string} slot 槽位名；位置未知时为空字符串
 * @property {boolean} revealed 是否已公开
 * @property {grksSoloRecordData | null} record 成绩数据；未公开时为 null
 * @property {string} rating 评级图标名
 * @property {string} rksText 单曲等效 rks 文本
 * @property {'phi' | 'best'} kind 槽位样式
 */

/**
 * 模板中的一行难度统计。
 * @typedef {object} grksSoloStatsRow
 * @property {string} title 难度名
 * @property {number} clear 通关数
 * @property {number} fc FC 数
 * @property {number} phi φ 数
 */

/**
 * 直方图的一根柱子。
 * @typedef {object} grksSoloBar
 * @property {number} height 高度百分比
 * @property {string} label 底部槽位标签
 * @property {'phi' | 'best'} kind 柱状样式
 */

/**
 * 标尺刻度。
 * @typedef {object} grksSoloTick
 * @property {string} label 刻度文本
 * @property {number} position 自底部的百分比位置
 */

/**
 * 统计图（直方图或上下界）视图。
 * @typedef {object} grksSoloSheet
 * @property {'hidden' | 'histogram' | 'range'} kind 展示形式
 * @property {grksSoloBar[]} bars 直方图柱子
 * @property {grksSoloTick[]} ticks 数值刻度
 * @property {number} average 平均单曲 rks
 * @property {number} count 参与统计的成绩条数
 * @property {number} min 最小值
 * @property {number} max 最大值
 * @property {number} minPosition 最小值在标尺上的百分比位置
 * @property {number} maxPosition 最大值在标尺上的百分比位置
 */

/**
 * 标题栏视图。
 * @typedef {object} grksSoloHeader
 * @property {string} playerId 玩家标识（匿名）
 * @property {string} avatar 头像文件名
 * @property {string} rks 答案 rks；未结算时为占位
 * @property {string} date 日期文本
 * @property {{colorIndex: number, score: number} | null} challenge 课题分；未公开时为 null
 */

/**
 * 一张提示图所需的全部数据。
 * @typedef {object} grksSoloView
 * @property {grksSoloHeader} header 标题栏
 * @property {{revealed: boolean, rows: grksSoloStatsRow[]}} stats 存档统计
 * @property {grksSoloRecordView[]} records 成绩槽位
 * @property {grksSoloSheet} sheet 统计图
 * @property {string} background 背景图
 * @property {string} footnote 底部状态
 * @property {grksHistoryCell[]} history 十次猜测记录
 * @property {number} answeredCount 已回答次数
 */

/**
 * `buildView` 的输入。
 * @typedef {object} grksSoloViewOptions
 * @property {grksKnownData} data 已公开的数据
 * @property {boolean} orderKnown 是否已公开成绩位置
 * @property {string} [footnote] 底部状态
 * @property {number | null} [answerRks] 结算答案；未结算时为 null
 * @property {boolean} [revealAll] 是否结算图
 * @property {grksGuessEntry[]} [history] 已公开的提示与回答
 */

/**
 * @typedef {object} grksHistoryCell
 * @property {number} turn 猜测序号
 * @property {string} hint 已获得的提示
 * @property {string} answer 回答内容
 * @property {grksGuessResult | 'empty'} result 判定样式
 * @property {string} resultText 判定文字
 */

export class grksSoloRender {

    /**
     * 由已公开的题目数据构建视图。
     * @param {grksSoloViewOptions} options
     * @returns {grksSoloView}
     */
    static buildView(options) {
        const { data } = options
        const orderKnown = options.revealAll === true || options.orderKnown
        return {
            header: {
                playerId: grksViewWords.anonymous,
                avatar: 'Introduction',
                rks: grksViewWords.answerRks(options.answerRks),
                date: grksViewWords.date(data.info?.updateAt),
                challenge: data.info ? challengeInfo(data.info.challenge) : null,
            },
            stats: {
                revealed: Boolean(data.info),
                rows: buildStatsRows(data.info),
            },
            records: buildRecords(data.records, orderKnown),
            sheet: buildSheet(data.sheet),
            background: fCompute.randBackground(true),
            footnote: options.footnote || '',
            history: buildHistory(options.history || []),
            answeredCount: (options.history || []).filter(entry => entry.guess !== null).length,
        }
    }

}

/** @param {grksGuessEntry[]} history @returns {grksHistoryCell[]} */
function buildHistory(history) {
    return Array.from({ length: 10 }, (_, index) => {
        const entry = history[index]
        const result = entry?.result || 'empty'
        return {
            turn: index + 1,
            hint: entry?.hint || grksViewWords.waitingHint,
            answer: grksViewWords.answer(entry?.guess),
            result,
            resultText: grksViewWords.guessResult[result],
        }
    })
}

/**
 * 课题分 → 段位图标与分数。
 * @param {number} value
 * @returns {{colorIndex: number, score: number}}
 */
function challengeInfo(value) {
    const challenge = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0
    return {
        colorIndex: Math.floor(challenge / 100),
        score: challenge % 100,
    }
}

/**
 * 难度统计行；未公开时数字保持 0，由模板决定是否展示。
 * @param {{stats: [clear: number, fc: number, phi: number][]} | null} info
 * @returns {grksSoloStatsRow[]}
 */
function buildStatsRows(info) {
    return Level.map((title, index) => {
        const row = info?.stats[index]
        return {
            title,
            clear: row ? row[0] : 0,
            fc: row ? row[1] : 0,
            phi: row ? row[2] : 0,
        }
    })
}

/**
 * 组装成绩槽位。
 * 位置未知时只展示已公开成绩，并按单曲 rks 降序排列；位置已知时补齐 30 个槽位。
 * @param {(LevelRecordInfo | null)[]} records 已公开的记录
 * @param {boolean} orderKnown 是否已公开位置
 * @returns {grksSoloRecordView[]}
 */
function buildRecords(records, orderKnown) {
    if (orderKnown) {
        return records.map((record, index) => buildRecordView(record, grksViewWords.slotName(index), index < 3, true))
    }
    const visible = records
        .filter(isKnownRecord)
        .sort((left, right) => right.rks - left.rks)
    return visible
        .map(record => buildRecordView(record, '', false, false))
        .filter(view => view.revealed)
}

/**
 * @param {LevelRecordInfo | null} record
 * @returns {record is LevelRecordInfo}
 */
function isKnownRecord(record) {
    return record !== null
}

/**
 * @param {grksRecordLike | null} record 成绩
 * @param {string} slot 槽位名
 * @param {boolean} phi 是否 P 槽位
 * @param {boolean} revealPlaceholder 未公开时是否保留占位槽
 * @returns {grksSoloRecordView}
 */
function buildRecordView(record, slot, phi, revealPlaceholder) {
    const data = record ? toRecordData(record) : null
    const revealed = data !== null
    return {
        slot: revealed ? slot : (revealPlaceholder ? slot : ''),
        revealed,
        record: data,
        rating: record ? record.Rating : 'NEW',
        rksText: grksViewWords.recordRks(record && revealed ? record.rks : null),
        kind: phi ? 'phi' : 'best',
    }
}

/**
 * 只保留模板需要的字段，并过滤缺少曲目信息的成绩。
 * @param {grksRecordLike} record
 * @returns {grksSoloRecordData | null}
 */
function toRecordData(record) {
    if (typeof record.song !== 'string' || !record.song) return null
    if (typeof record.illustration !== 'string' || !record.illustration) return null
    return {
        song: record.song,
        illustration: record.illustration,
        rank: record.rank,
        difficulty: record.difficulty,
        score: record.score,
        acc: record.acc,
    }
}

/**
 * 组装统计图。
 * @param {{range: [number, number] | null, histogram: number[] | null}} sheet
 * @returns {grksSoloSheet}
 */
function buildSheet(sheet) {
    const histogram = sheet.histogram
    if (histogram && histogram.length) {
        const values = histogram.filter(value => Number.isFinite(value))
        const min = Math.min(...values)
        const max = Math.max(...values)
        const domain = buildDomain(min, max)
        const span = domain.max - domain.min
        const bars = values.map((value, index) => {
            /** @type {'phi' | 'best'} */
            const kind = index < 3 ? 'phi' : 'best'
            return {
                height: Math.max(2, Math.min(100, (value - domain.min) / span * 100)),
                label: grksViewWords.slotName(index),
                kind,
            }
        })
        const average = values.reduce((sum, value) => sum + value, 0) / values.length
        return {
            kind: 'histogram',
            bars,
            ticks: buildTicks(domain.min, domain.max),
            average,
            count: values.length,
            min,
            max,
            minPosition: positionOf(min, domain),
            maxPosition: positionOf(max, domain),
        }
    }
    const range = sheet.range
    if (range) {
        const max = range[0]
        const min = range[1]
        const domain = buildDomain(min, max)
        return {
            kind: 'range',
            bars: [],
            ticks: buildTicks(domain.min, domain.max),
            average: 0,
            count: 0,
            min,
            max,
            minPosition: positionOf(min, domain),
            maxPosition: positionOf(max, domain),
        }
    }
    return {
        kind: 'hidden',
        bars: [],
        ticks: [],
        average: 0,
        count: 0,
        min: 0,
        max: 0,
        minPosition: 0,
        maxPosition: 0,
    }
}

/**
 * 为绘图留出少量上下边距。
 * @param {number} min
 * @param {number} max
 * @returns {{min: number, max: number}}
 */
function buildDomain(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 }
    if (max <= min) {
        const padding = Math.max(0.05, Math.abs(min) * 0.001)
        return { min: min - padding, max: min + padding }
    }
    const padding = (max - min) * 0.05
    return { min: min - padding, max: max + padding }
}

/**
 * 数值 → 标尺百分比位置。
 * @param {number} value
 * @param {{min: number, max: number}} domain
 * @returns {number}
 */
function positionOf(value, domain) {
    const span = domain.max - domain.min
    if (!(span > 0)) return 0
    return Math.min(100, Math.max(0, (value - domain.min) / span * 100))
}

/**
 * 四等分刻度。
 * @param {number} min
 * @param {number} max
 * @returns {grksSoloTick[]}
 */
function buildTicks(min, max) {
    const span = max - min
    if (!(span > 0)) return []
    return Array.from({ length: 5 }, (_, index) => ({
        label: grksViewWords.tickRks(min + span * index / 4),
        position: index * 25,
    }))
}
