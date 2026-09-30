import assert from 'node:assert/strict'
import test from 'node:test'
import { phihelp } from '../apps/apiSetting.js'
import { phisstk } from '../apps/session.js'
import getBanGroup from '../model/user/getBanGroup.js'
import makeRequestFnc from '../model/api/makeRequestFnc.js'
import send from '../model/render/send.js'
import { UserCredentials } from '../model/user/userCredentials.js'

const event = (msg = '') => ({
    msg,
    user_id: 'test-user',
    self_id: 'test-bot',
    isGroup: false,
    isPrivate: true,
})

test('clearApiData requires confirmation and authenticates deletion with SSTK', async () => {
    const originals = {
        getBan: getBanGroup.get,
        getToken: UserCredentials.prototype.getSessionToken,
        deleteLocalSave: UserCredentials.prototype.deleteApiCachedSave,
        makePlatform: makeRequestFnc.makePlatform,
        clear: UserCredentials.prototype.deleteApiAccount,
        send: send.send_with_At,
    }
    /** @type {any[]} */ const messages = []
    /** @type {any[]} */ const contexts = []
    /** @type {any[]} */ const finished = []
    /** @type {any[]} */ const clearRequests = []

    getBanGroup.get = async () => false
    UserCredentials.prototype.getSessionToken = /** @type {any} */ (async () => 'sstk-value')
    UserCredentials.prototype.deleteApiCachedSave = async () => true
    makeRequestFnc.makePlatform = /** @type {any} */ (() => ({ platform: 'test', platform_id: 'test-user', _local_user_id: 'test-user' }))
    UserCredentials.prototype.deleteApiAccount = /** @type {any} */ (async function () {
        clearRequests.push({ ...(await this.platformParams()), token: await this.getSessionToken() })
        return { message: 'ok' }
    })
    send.send_with_At = /** @type {any} */ ((/** @type {any} */ _e, /** @type {any} */ message) => messages.push(message))

    try {
        const command = new phihelp()
        command.checkApiEnabled = async () => true
        command.setContext = (...args) => contexts.push(args)
        command.finish = (...args) => finished.push(args)

        assert.equal(await command.clearApiData(/** @type {any} */ (event('/phi clearApiData'))), true)
        assert.equal(clearRequests.length, 0)
        assert.equal(contexts[0][0], 'confirmClearApiData')
        assert.match(messages[0], /永久清除云端账号及全部数据/)

        command.e = /** @type {any} */ (event('确认'))
        assert.equal(await command.confirmClearApiData(), true)
        assert.deepEqual(clearRequests, [{
            platform: 'test',
            platform_id: 'test-user',
            _local_user_id: 'test-user',
            token: 'sstk-value',
        }])
        assert.equal(finished[0][0], 'confirmClearApiData')
        assert.match(messages.at(-1), /账号已注销/)
    } finally {
        getBanGroup.get = originals.getBan
        UserCredentials.prototype.getSessionToken = originals.getToken
        UserCredentials.prototype.deleteApiCachedSave = originals.deleteLocalSave
        makeRequestFnc.makePlatform = originals.makePlatform
        UserCredentials.prototype.deleteApiAccount = originals.clear
        send.send_with_At = originals.send
    }
})

test('clearApiData cancellation does not call the API', async () => {
    const originalSend = send.send_with_At
    const originalDeleteAccount = UserCredentials.prototype.deleteApiAccount
    let requested = false

    UserCredentials.prototype.deleteApiAccount = /** @type {any} */ (async () => {
        requested = true
        return null
    })
    send.send_with_At = /** @type {any} */ (async () => undefined)

    try {
        const command = new phihelp()
        command.e = /** @type {any} */ (event('取消'))
        command.finish = () => undefined

        assert.equal(await command.confirmClearApiData(), true)
        assert.equal(requested, false)
    } finally {
        UserCredentials.prototype.deleteApiAccount = originalDeleteAccount
        send.send_with_At = originalSend
    }
})

test('unbind always describes a local-only operation', async () => {
    const originals = {
        getBan: getBanGroup.get,
        getCredentials: UserCredentials.prototype.getLocalCredentials,
        send: send.send_with_At,
    }
    /** @type {any[]} */ const messages = []

    getBanGroup.get = async () => false
    send.send_with_At = /** @type {any} */ ((/** @type {any} */ _e, /** @type {any} */ message) => messages.push(message))

    try {
        const command = new phisstk()
        command.setContext = () => undefined

        UserCredentials.prototype.getLocalCredentials = /** @type {any} */ (async () => ({ sessionToken: 'sstk-value', apiId: '123' }))
        assert.equal(await command.unbind(/** @type {any} */ (event('/phi unbind'))), true)
        assert.match(messages.at(-1), /只会清除当前 Bot 本地保存的绑定、存档和历史/)
        assert.match(messages.at(-1), /不会修改 API 数据/)

        UserCredentials.prototype.getLocalCredentials = /** @type {any} */ (async () => ({ sessionToken: 'sstk-value', apiId: null }))
        assert.equal(await command.unbind(/** @type {any} */ (event('/phi unbind'))), true)
        assert.match(messages.at(-1), /不会修改 API 数据/)
    } finally {
        getBanGroup.get = originals.getBan
        UserCredentials.prototype.getLocalCredentials = originals.getCredentials
        send.send_with_At = originals.send
    }
})
