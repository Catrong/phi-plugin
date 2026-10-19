import assert from 'node:assert/strict'
import test from 'node:test'
import fCompute from '../model/game/fCompute.js'
import saveHistory from '../model/save/saveHistory.js'
import ScoreHistory from '../model/save/scoreHistory.js'

/** 固定绝对时刻，避免测试环境时区影响断言 */
const instant = new Date(Date.UTC(2024, 0, 15, 10, 0, 0))

test('formatDate 可按指定时区格式化历史时间', () => {
    assert.equal(fCompute.formatDate(instant, 'YYYY-MM-DD hh:mm:ss', '+08:00'), '2024-01-15 18:00:00')
    assert.equal(fCompute.formatDate(instant, 'YYYY-MM-DD hh:mm:ss', '+00:00'), '2024-01-15 10:00:00')
    assert.equal(fCompute.formatDate(instant, 'YYYY-MM-DD hh:mm:ss', '-05:00'), '2024-01-15 05:00:00')
    assert.equal(fCompute.formatDate(instant, 'YYYY-MM-DD hh:mm:ss', '-05:30'), '2024-01-15 04:30:00')
    /**跨日边界按目标时区换算 */
    assert.equal(
        fCompute.formatDate(new Date(Date.UTC(2024, 0, 15, 23, 30)), 'YYYY-MM-DD hh:mm', '+08:00'),
        '2024-01-16 07:30',
    )
})

test('formatDate 缺省时区等价于运行环境时区', () => {
    const local = new Date(2024, 0, 15, 10, 0, 0)
    assert.equal(fCompute.formatDate(local, 'YYYY-MM-DD hh:mm:ss'), '2024-01-15 10:00:00')
    /**显式传入运行环境偏移时结果一致 */
    assert.equal(
        fCompute.formatDate(local, 'YYYY-MM-DD hh:mm:ss', fCompute.timezoneOffset(local)),
        '2024-01-15 10:00:00',
    )
})

test('timezoneOffsetMinutes 解析偏移文本与分钟数', () => {
    assert.equal(fCompute.timezoneOffsetMinutes('+08:00'), 480)
    assert.equal(fCompute.timezoneOffsetMinutes('-05:30'), -330)
    assert.equal(fCompute.timezoneOffsetMinutes('+0800'), 480)
    assert.equal(fCompute.timezoneOffsetMinutes(120), 120)
    /**非法值回退运行环境偏移 */
    const fallback = -new Date(instant).getTimezoneOffset()
    assert.equal(fCompute.timezoneOffsetMinutes('bogus', instant), fallback)
    assert.equal(fCompute.timezoneOffsetMinutes(undefined, instant), fallback)
})

test('saveHistory 提供用于展示的时区', () => {
    assert.equal(new saveHistory(/** @type {any} */ ({ version: 4, timezone: '+08:00' })).getTimezone(), '+08:00')
    assert.equal(new saveHistory(null).getTimezone(), fCompute.timezoneOffset())
})

test('单曲历史从 v4 记录展开后按记录方时区展示', () => {
    /**与 API v4 响应同构：UTC 分量 + 来源时区 */
    const history = new saveHistory(/** @type {any} */ ({
        version: 4,
        timezone: '+08:00',
        scoreHistory: { 'song.0': { EZ: [[2024, [[1, [[15, [[36000000, [99.5, 1000000, 1]]]]]]]]] } },
    }))
    const details = ScoreHistory.toScoreDetails(history.scoreHistory['song.0'].EZ)
    assert.equal(details.length, 1)
    /**b19 展示流程：展开 -> 取日期 -> 按来源时区格式化 */
    assert.equal(
        fCompute.formatDate(ScoreHistory.date(details[0]), undefined, history.getTimezone()),
        '2024/01/15 18:00:00',
    )
    /**缺省时区（运行环境）依旧是同一绝对时刻的本地时间 */
    assert.equal(
        fCompute.formatDate(ScoreHistory.date(details[0]), undefined, undefined),
        fCompute.formatDate(new Date(Date.UTC(2024, 0, 15, 10, 0, 0))),
    )
})
