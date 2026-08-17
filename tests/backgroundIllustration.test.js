import assert from 'node:assert/strict'
import test from 'node:test'
import fCompute from '../model/game/fCompute.js'
import getInfo from '../model/game/getInfo.js'

test('个人背景曲绘通过统一解析器获取', () => {
    const original = getInfo.getBackground
    const calls = []
    getInfo.getBackground = background => {
        calls.push(background)
        return 'resolved-background.png'
    }

    try {
        assert.equal(fCompute.getBackground('Introduction'), 'resolved-background.png')
        assert.deepEqual(calls, ['Introduction'])
    } finally {
        getInfo.getBackground = original
    }
})
