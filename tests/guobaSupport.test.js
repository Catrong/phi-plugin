import assert from 'node:assert/strict'
import test from 'node:test'
import Config from '../components/Config.js'
import shared from '../components/settings/shared.cjs'
import { supportGuoba } from '../guoba.support.js'

test('锅巴实际入口显示渲染器并通过 Result 返回保存回执', t => {
    const originalGet = Config.getUserCfg
    const originalModify = Config.modify
    const values = { ...shared.defaults }
    /** @type {any[][]} */
    const writes = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => values[key])
    Config.modify = /** @type {any} */ ((_name = '', key = '', value = undefined) => {
        writes.push([key, value])
        values[key] = value
    })
    t.after(() => { Config.getUserCfg = originalGet; Config.modify = originalModify })

    const { pluginInfo, configInfo } = supportGuoba()
    assert.equal(pluginInfo.name, 'phi-plugin')
    const fields = configInfo.schemas.filter(item => item.field === 'renderer')
    assert.equal(fields.length, 1)
    assert.equal(fields[0].component, 'RadioGroup')
    assert.deepEqual(fields[0].componentProps.options.map((/** @type {{value: string}} */ item) => item.value), ['puppeteer', 'shotium', 'auto'])
    const { getConfigData, setConfigData } = configInfo
    assert.equal(getConfigData().renderer, 'puppeteer')

    const result = setConfigData({ renderer: 'shotium' }, {
        Result: { ok: (data, message) => ({ code: 0, data, message }) },
    })
    assert.deepEqual(result, { code: 0, data: {}, message: '配置已保存' })
    assert.deepEqual(writes, [['renderer', 'shotium']])
    assert.equal(getConfigData().renderer, 'shotium')
    assert.throws(() => setConfigData({ renderer: 'unsupported' }))
    assert.equal(writes.length, 1, '校验失败不写入配置，也不返回成功')

    assert.deepEqual(setConfigData({ renderer: 'puppeteer' }), { ok: true, message: '配置已保存' })
    assert.equal(getConfigData().renderer, 'puppeteer')
})
