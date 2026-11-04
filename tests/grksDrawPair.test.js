import test from 'node:test'
import assert from 'node:assert/strict'
import { drawPair } from '../model/game/grks/drawPair.js'

/** @param {string[]} tokens */
const draw = tokens => drawPair(tokens, 'red', 'blue', async token => token === 'invalid' ? null : token)

test('重复条目和无效存档不能凑成两份题目', async () => {
    assert.equal(await draw(['third', 'third', 'invalid']), null)
})

test('保留唯一合法分配，允许抽到自己的存档', async () => {
    assert.deepEqual(await draw(['red', 'blue']), ['red', 'blue'])
    assert.deepEqual(await draw(['third', 'red']), ['red', 'third'])
    assert.deepEqual(await draw(['blue', 'third']), ['third', 'blue'])
})

test('双方共用绑定时各抽一份不同的第三方存档', async () => {
    const pair = await drawPair(['shared', 'a', 'b'], 'shared', 'shared', async token => token)
    assert.deepEqual(new Set(pair), new Set(['a', 'b']))
})
