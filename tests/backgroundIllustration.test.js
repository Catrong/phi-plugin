import assert from 'node:assert/strict'
import test from 'node:test'
import fCompute from '../model/game/fCompute.js'
import getInfo from '../model/game/getInfo.js'

test('SP个人背景曲绘通过内部ID解析', async () => {
    await getInfo.init()

    assert.equal(getInfo.SongGetId('Introduction'), 'Introduction.0')
    assert.equal(
        getInfo.SongGetId('Oblivion:PHIN'),
        'OblivionPHIN.Daily天利vsEndCat终猫ftAiSSw夜輪.0'
    )

    const result = fCompute.getBackground('Introduction')
    if (!result) assert.fail('Introduction背景解析失败')

    const background = result.replace(/\\/g, '/')
    assert.match(background, /\/SP\/Introduction\.png$/)
    assert.doesNotMatch(background, /\/otherimg\/phigros\.png$/)
})
