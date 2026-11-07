import assert from 'node:assert/strict'
import test from 'node:test'
import send from '../model/render/send.js'
import { UserCredentials } from '../model/user/userCredentials.js'
import autoSeekApi from '../model/api/autoSeekApi.js'
import Config from '../components/Config.js'
import getNotes from '../model/user/getNotes.js'

/** @param {import('node:test').TestContext} t @param {boolean} enabled */
function setup(t, enabled) {
    const previous = autoSeekApi.openPhiPluginApi
    autoSeekApi.openPhiPluginApi = enabled
    t.after(() => { autoSeekApi.openPhiPluginApi = previous })
    t.mock.method(Config, 'getUserCfg', () => true)
    t.mock.method(getNotes, 'getNotesData', async () => ({ allowApiUsage: true }))
    t.mock.method(UserCredentials.prototype, 'getSessionToken', async () => 'test-token')
    t.mock.method(UserCredentials.prototype, 'getLocalHistory', async () => { throw new Error('不应重复读取历史') })
    t.mock.method(UserCredentials.prototype, 'getCloudHistory', async () => { throw new Error('不应重复同步历史') })
    return { user_id: 'test-user', userId: 'test-user', platform: 'qq', msg: '' }
}

test('API 成功返回同一次同步的 save 和 history', async t => {
    const event = setup(t, true)
    const save = { Recordver: 2 }
    const history = { source: 'api' }
    const sync = t.mock.method(UserCredentials.prototype, 'getUpdatedSaveFromApi', async () => ({ save, history }))
    t.mock.method(UserCredentials.prototype, 'getUpdatedSaveFromLocal', async () => { throw new Error('不应直连') })
    const result = await send.getsave_result(event, 1, false)
    assert.ok(result)
    assert.equal(result.save, save)
    assert.equal(result.history, history)
    assert.equal(sync.mock.callCount(), 1)
})

for (const apiEnabled of [false, true]) {
    test(`API ${apiEnabled ? '失败降级' : '关闭'}时使用同一次本地更新的历史`, async t => {
        const event = setup(t, apiEnabled)
        const save = { Recordver: 2 }
        const history = { source: 'local' }
        t.mock.method(UserCredentials.prototype, 'getUpdatedSaveFromApi', async () => { throw new Error('模拟 API 失败') })
        const local = t.mock.method(UserCredentials.prototype, 'getUpdatedSaveFromLocal', async () => ({ save, history }))
        const result = await send.getsave_result(event, 1, false)
        assert.ok(result)
        assert.equal(result.save, save)
        assert.equal(result.history, history)
        assert.equal(local.mock.callCount(), 1)
    })
}

test('API 存档版本不足和未绑定仍返回 false', async t => {
    const event = setup(t, true)
    t.mock.method(UserCredentials.prototype, 'getUpdatedSaveFromApi', async () => ({ save: { Recordver: 1 }, history: {} }))
    assert.equal(await send.getsave_result(event, 2, false), false)
    autoSeekApi.openPhiPluginApi = false
    t.mock.method(UserCredentials.prototype, 'getSessionToken', async () => undefined)
    assert.equal(await send.getsave_result(event, undefined, false), false)
})
