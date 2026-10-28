import test from 'node:test'
import assert from 'node:assert/strict'
import { getTableDifficulty, parseTableArgs } from '../model/game/tableDifficulty.js'

test('0 级谱面并入 1 级定数表，最上方显示 1-', () => {
    const zero = getTableDifficulty(0)
    const one = getTableDifficulty(1)

    assert.equal(zero.difficulty, 1)
    assert.equal(zero.label, '1-')
    assert.deepEqual(zero, one)
    assert.deepEqual(zero.buckets.slice(0, 3), ['0.0', '0.1', '0.2'])
    assert.ok(zero.buckets.includes('0.5'))
    assert.equal(zero.buckets.at(-1), '1.9')
    assert.equal(zero.buckets.length, 20)
})

test('18 级谱面并入 17 级定数表，最上方显示 17+', () => {
    const eighteen = getTableDifficulty(18)
    const seventeen = getTableDifficulty(17)

    assert.equal(eighteen.difficulty, 17)
    assert.equal(eighteen.label, '17+')
    assert.deepEqual(eighteen, seventeen)
    assert.equal(eighteen.buckets[0], '17.0')
    assert.ok(eighteen.buckets.includes('17.9'))
    assert.equal(eighteen.buckets.at(-1), '18.0')
    assert.equal(eighteen.buckets.length, 11)
})

test('中间定数仍按 10 个 0.1 档位展示，标题保持原定数', () => {
    for (const dif of [2, 9, 15, 16]) {
        const result = getTableDifficulty(dif)
        assert.equal(result.difficulty, dif)
        assert.equal(result.label, String(dif))
        assert.equal(result.buckets.length, 10)
        assert.equal(result.buckets[0], dif.toFixed(1))
        assert.equal(result.buckets.at(-1), (dif + 0.9).toFixed(1))
    }
})

test('超出 0.1 档位精度的定数不会产生浮点档位', () => {
    assert.ok(getTableDifficulty(3).buckets.every(bucket => /^\d+\.\d$/.test(bucket)))
})

test('定数参数只接受整数，小数和文字不会被静默取整', () => {
    assert.deepEqual(parseTableArgs('15'), { ok: true, difficulty: 15, version: undefined })
    assert.deepEqual(parseTableArgs(' 15 '), { ok: true, difficulty: 15, version: undefined })
    assert.deepEqual(parseTableArgs('0'), { ok: true, difficulty: 0, version: undefined })
    assert.deepEqual(parseTableArgs('18'), { ok: true, difficulty: 18, version: undefined })
    assert.deepEqual(parseTableArgs('15 -v 3.5.1'), { ok: true, difficulty: 15, version: '3.5.1' })
    assert.deepEqual(parseTableArgs('15 -v3.5.1'), { ok: true, difficulty: 15, version: '3.5.1' })
    assert.deepEqual(parseTableArgs('-v 3.5.1 15'), { ok: true, difficulty: 15, version: '3.5.1' })

    for (const bad of ['15.5', '15.0', 'abc', '15 16', '15a', '+5', '15 -v']) {
        assert.deepEqual(parseTableArgs(bad), { ok: false, reason: 'notInteger' }, bad)
    }
    assert.deepEqual(parseTableArgs(''), { ok: false, reason: 'missing' })
    assert.deepEqual(parseTableArgs('   '), { ok: false, reason: 'missing' })
    assert.deepEqual(parseTableArgs('-v 3.5.1'), { ok: false, reason: 'missing' })
})
