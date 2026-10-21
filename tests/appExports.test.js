import assert from 'node:assert/strict'
import test from 'node:test'
import { pickAppClass } from '../components/appExports.js'
import phiPluginBase from '../components/baseClass.js'
import * as grksModule from '../apps/grks.js'
import * as aliasProposalModule from '../apps/aliasProposal.js'
import * as helpModule from '../apps/help.js'

test('picks the plugin class when the module also exports helper functions', () => {
    // ESM 命名空间按名称排序，导出顺序不可控，不能依赖“第一个导出”。
    assert.deepEqual(Object.keys(grksModule), ['parseHintArgs', 'parseRankArgs', 'phiGrks'])
    const picked = pickAppClass(grksModule)
    assert.equal(picked, grksModule.phiGrks)
    assert.ok(picked.prototype instanceof phiPluginBase)
    // Yunzai loader 会读取实例的 task 收集定时任务，undefined 会导致加载失败。
    assert.notEqual(new picked().task, undefined)
})

test('picks the class even when helper exports sort after it', () => {
    assert.equal(pickAppClass(aliasProposalModule), aliasProposalModule.aliasProposal)
    assert.equal(pickAppClass(helpModule), helpModule.phihelp)
    assert.notEqual(new (pickAppClass(helpModule))().task, undefined)
})

test('prefers the default export and falls back to the first function', () => {
    class pluginLike extends phiPluginBase {}
    const helper = () => {}

    assert.equal(pickAppClass({ default: pluginLike, named: helper }), pluginLike)
    assert.equal(pickAppClass({ helper, pluginLike }), pluginLike)
    // 模块里没有任何插件类时保持旧行为，由宿主 loader 跳过非插件值。
    assert.equal(pickAppClass({ helper }), helper)
    assert.equal(pickAppClass({}), undefined)
    assert.equal(pickAppClass(undefined), undefined)
})
