// @ts-nocheck
import assert from 'node:assert/strict'
import test from 'node:test'
import { phihelp } from '../apps/apiSetting.js'
import { phisstk } from '../apps/session.js'
import getBanGroup from '../model/getBanGroup.js'
import getSave from '../model/getSave.js'
import getSaveFromApi from '../model/getSaveFromApi.js'
import makeRequest from '../model/makeRequest.js'
import makeRequestFnc from '../model/makeRequestFnc.js'
import send from '../model/send.js'

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
        getToken: getSave.get_user_token,
        deleteLocalSave: getSaveFromApi.delLocalSave,
        requestApi: makeRequestFnc.requestApi,
        makePlatform: makeRequestFnc.makePlatform,
        clear: makeRequest.clear,
        send: send.send_with_At,
    }
    const messages = []
    const contexts = []
    const finished = []
    const clearRequests = []

    getBanGroup.get = async () => false
    getSave.get_user_token = async () => 'sstk-value'
    getSaveFromApi.delLocalSave = async () => true
    makeRequestFnc.makePlatform = () => ({ platform: 'test', platform_id: 'test-user' })
    makeRequest.clear = async params => {
        clearRequests.push(params)
        return { message: 'ok' }
    }
    makeRequestFnc.requestApi = async (_e, request) => request()
    send.send_with_At = (_e, message) => messages.push(message)

    try {
        const command = new phihelp()
        command.checkApiEnabled = async () => true
        command.setContext = (...args) => contexts.push(args)
        command.finish = (...args) => finished.push(args)

        assert.equal(await command.clearApiData(event('/phi clearApiData')), true)
        assert.equal(clearRequests.length, 0)
        assert.equal(contexts[0][0], 'confirmClearApiData')
        assert.match(messages[0], /永久清除云端账号及全部数据/)

        command.e = event('确认')
        assert.equal(await command.confirmClearApiData(), true)
        assert.deepEqual(clearRequests, [{
            platform: 'test',
            platform_id: 'test-user',
            token: 'sstk-value',
        }])
        assert.equal(finished[0][0], 'confirmClearApiData')
        assert.match(messages.at(-1), /账号已注销/)
    } finally {
        getBanGroup.get = originals.getBan
        getSave.get_user_token = originals.getToken
        getSaveFromApi.delLocalSave = originals.deleteLocalSave
        makeRequestFnc.requestApi = originals.requestApi
        makeRequestFnc.makePlatform = originals.makePlatform
        makeRequest.clear = originals.clear
        send.send_with_At = originals.send
    }
})

test('clearApiData cancellation does not call the API', async () => {
    const originalRequestApi = makeRequestFnc.requestApi
    const originalSend = send.send_with_At
    let requested = false

    makeRequestFnc.requestApi = async () => {
        requested = true
        return null
    }
    send.send_with_At = () => undefined

    try {
        const command = new phihelp()
        command.e = event('取消')
        command.finish = () => undefined

        assert.equal(await command.confirmClearApiData(), true)
        assert.equal(requested, false)
    } finally {
        makeRequestFnc.requestApi = originalRequestApi
        send.send_with_At = originalSend
    }
})

test('unbind shows the cloud-data notice only for API bindings', async () => {
    const originals = {
        getBan: getBanGroup.get,
        getToken: getSave.get_user_token,
        getApiId: getSaveFromApi.get_user_apiId,
        send: send.send_with_At,
    }
    const messages = []

    getBanGroup.get = async () => false
    getSave.get_user_token = async () => 'sstk-value'
    send.send_with_At = (_e, message) => messages.push(message)

    try {
        const command = new phisstk()
        command.setContext = () => undefined

        getSaveFromApi.get_user_apiId = async () => '123'
        assert.equal(await command.unbind(event('/phi unbind')), true)
        assert.match(messages.at(-1), /仅清除bot本地数据，云端数据不受影响/)
        assert.match(messages.at(-1), /clearApiData/)

        getSaveFromApi.get_user_apiId = async () => null
        assert.equal(await command.unbind(event('/phi unbind')), true)
        assert.doesNotMatch(messages.at(-1), /云端数据不受影响/)
    } finally {
        getBanGroup.get = originals.getBan
        getSave.get_user_token = originals.getToken
        getSaveFromApi.get_user_apiId = originals.getApiId
        send.send_with_At = originals.send
    }
})
