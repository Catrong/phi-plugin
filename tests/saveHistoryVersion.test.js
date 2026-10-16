import assert from 'node:assert/strict'
import test from 'node:test'
import saveHistory from '../model/save/saveHistory.js'

/** 旧版曾用 version 4 表示「删除 DAN」，scoreHistory 仍是 v3 扁平数组 */
const legacyStored = {
    version: 4,
    data: [{ date: '2024-01-15T10:00:00Z', value: [1, 2, 3, 4, 5] }],
    rks: [{ date: '2024-01-15T10:00:00Z', value: 15.123456 }],
    challengeModeRank: [{ date: '2024-01-15T10:00:00Z', value: 100 }],
    scoreHistory: { 'song.0': { EZ: [[99.12345, 1000000, '2024-01-15T10:00:00Z', true]] } },
}

test('version 为 4 但结构是 v3 的旧数据按结构识别并升级', () => {
    const json = new saveHistory(legacyStored).toJSON()
    assert.equal(json.version, 4)
    assert.deepEqual(json.scoreHistory['song.0'].EZ, [[2024, [[1, [[15, [[36000000, [99.1235, 1000000, 1]]]]]]]]])
    assert.deepEqual(json.rks, [[2024, [[1, [[15, [[36000000, 15.1235]]]]]]]])
    assert.deepEqual(json.data, [[2024, [[1, [[15, [[36000000, [1, 2, 3, 4, 5]]]]]]]]])
})

test('显式声明 v1 的历史不被导入', () => {
    const history = new saveHistory({
        version: 1,
        scoreHistory: { '曲名': { EZ: [[99, 1000000, '2024-01-15T10:00:00Z', true]] } },
    })
    assert.deepEqual(history.toJSON().scoreHistory, {})
})
