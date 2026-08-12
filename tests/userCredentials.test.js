import assert from 'node:assert/strict'
import test from 'node:test'
import getSave from '../model/save/getSave.js'
import makeRequest from '../model/api/makeRequest.js'
import phiApiClient from '../model/api/phiApiClient.js'
import { UserCredentials } from '../model/user/userCredentials.js'

const event = (userId = 'local-user') => ({
    msg: '',
    user_id: userId,
    userId,
    platform: 'qq',
    isGroup: false,
    isPrivate: true,
})

function fakeStore() {
    const sessions = new Map()
    const apiIds = new Map()
    return {
        sessions,
        apiIds,
        getSessionToken: async (/** @type {string} */ userId) => sessions.get(String(userId)),
        setSessionToken: async (/** @type {string} */ userId, /** @type {any} */ token) => sessions.set(String(userId), token),
        deleteSessionToken: async (/** @type {string} */ userId) => Number(sessions.delete(String(userId))),
        getApiId: async (/** @type {string} */ userId) => apiIds.get(String(userId)),
        setApiId: async (/** @type {string} */ userId, /** @type {any} */ apiId) => apiIds.set(String(userId), String(apiId)),
        deleteApiId: async (/** @type {string} */ userId) => Number(apiIds.delete(String(userId))),
        clearLocalCredentials: async (/** @type {string} */ userId) => {
            sessions.delete(String(userId))
            apiIds.delete(String(userId))
        },
    }
}

test('UserCredentials is created from the event user and rejects missing user IDs', () => {
    assert.equal(UserCredentials.fromEvent(event('snake-id')).userId, 'snake-id')
    assert.equal(UserCredentials.fromEvent({ ...event(), user_id: undefined, userId: 'camel-id' }).userId, 'camel-id')
    assert.throws(() => UserCredentials.fromEvent({}), /requires e\.userId/)
})

test('instances cannot read or mutate another user credential key', async () => {
    const store = fakeStore()
    const first = UserCredentials.fromEvent(event('first'), { store: /** @type {any} */ (store) })
    const second = UserCredentials.fromEvent(event('second'), { store: /** @type {any} */ (store) })
    await first.setSessionToken(/** @type {phigrosToken} */ ('first-token'))
    await second.setSessionToken(/** @type {phigrosToken} */ ('second-token'))
    await first.setApiId('100')
    await second.setApiId('200')
    assert.deepEqual(await first.getLocalCredentials(), { sessionToken: 'first-token', apiId: '100' })
    assert.deepEqual(await second.getLocalCredentials(), { sessionToken: 'second-token', apiId: '200' })
    assert.equal(first.setSessionToken.length, 1)
    assert.equal(first.getSessionToken.length, 0)
})

test('API ID binding uses the instance platform and replaces the local SSTK only after success', async () => {
    const store = fakeStore()
    store.sessions.set('local-user', 'old-token')
    /** @type {any[]} */ const calls = []
    const originalRequest = phiApiClient.request
    phiApiClient.request = async (/** @type {any} */ path, /** @type {any} */ body) => {
        calls.push([path, body])
        return { bindingId: 'binding-id', apiUserId: body.apiUserId }
    }
    try {
        const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store) })
        const result = await credentials.bindWithApiId('12345')
        assert.ok(result)
        assert.equal(result.apiUserId, '12345')
        assert.deepEqual(calls, [['/bot/bindings/bind', { platform: 'yunzai', platformId: 'local-user', apiUserId: '12345' }]])
        assert.deepEqual(await credentials.getLocalCredentials(), { sessionToken: undefined, apiId: '12345' })
    } finally {
        phiApiClient.request = originalRequest
    }
})

test('SSTK binding stores only the direct sessionToken credential', async () => {
    const store = fakeStore()
    const originalRequest = phiApiClient.request
    phiApiClient.request = async () => ({ bindingId: 'binding-id', apiUserId: '67890' })
    try {
        const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store) })
        await credentials.bindWithSessionToken(/** @type {phigrosToken} */ ('sstk-value'), true)
        assert.deepEqual(await credentials.getLocalCredentials(), { sessionToken: 'sstk-value', apiId: undefined })
    } finally {
        phiApiClient.request = originalRequest
    }
})

test('remote API ID bind failures preserve local state', async () => {
    const store = fakeStore()
    store.sessions.set('local-user', 'old-token')
    store.apiIds.set('local-user', 'old-api-id')
    const originalRequest = phiApiClient.request
    phiApiClient.request = async () => { throw new Error('API unavailable') }
    try {
        const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store) })
        assert.equal(await credentials.bindWithApiId('new-api-id'), null)
        assert.deepEqual(await credentials.getLocalCredentials(), { sessionToken: 'old-token', apiId: 'old-api-id' })
    } finally {
        phiApiClient.request = originalRequest
    }
})

test('local credential changes keep only one direct credential type', async () => {
    const store = fakeStore()
    const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store) })
    await credentials.useSessionToken(/** @type {phigrosToken} */ ('local-sstk'))
    await credentials.useApiId('4321')
    assert.deepEqual(await credentials.getLocalCredentials(), { sessionToken: undefined, apiId: '4321' })
})

test('local unbind clears local credentials and never calls the API', async () => {
    const store = fakeStore()
    store.sessions.set('local-user', 'old-token')
    store.apiIds.set('local-user', 'old-api-id')
    const originalDelSave = getSave.deleteSaveBySessionToken
    /** @type {string[]} */ const deletedUsers = []
    getSave.deleteSaveBySessionToken = async sessionToken => { deletedUsers.push(String(sessionToken)); return true }
    try {
        const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store) })
        assert.deepEqual(await credentials.unbindLocal(), { hadBinding: true })
        assert.deepEqual(await credentials.getLocalCredentials(), { sessionToken: undefined, apiId: undefined })
        assert.deepEqual(deletedUsers, ['old-token'])
    } finally {
        getSave.deleteSaveBySessionToken = originalDelSave
    }
})

test('platformParams rejects authentication when local credentials are missing', async () => {
    const store = fakeStore()
    const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store) })
    await assert.rejects(
        credentials.platformParams(true),
        (/** @type {any} */ error) => error.code === 'binding_not_found',
    )
})

test('credential API methods inject the instance platform and local SSTK', async () => {
    const store = fakeStore()
    store.sessions.set('local-user', 'sstk-value')
    store.apiIds.set('local-user', '12345')
    /** @type {any[]} */ const calls = []
    const originalRequest = phiApiClient.request
    phiApiClient.request = /** @type {any} */ (async function (/** @type {string} */ path, /** @type {any} */ params, /** @type {any} */ _method) {
        calls.push([path, params, arguments.length])
        if (path === '/token/list') return { data: { platform_data: [] } }
        if (path === '/getPgrToken') return { data: { token: 'sstk-from-api' } }
        if (path === '/bot/bindings/bind') return { apiUserId: '67890' }
        return { message: 'ok' }
    })
    try {
        const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store) })
        await credentials.listPlatformBindings()
        await credentials.setApiToken('api-token')
        await credentials.deleteApiAccount()
        await credentials.authenticateApiToken('api-token')
        assert.equal(await credentials.getSessionToken(), 'sstk-from-api')
        assert.deepEqual(calls.map(([path]) => path), ['/token/list', '/setApiToken', '/clear', '/getPgrToken', '/bot/bindings/bind'])
        for (const [path, params, argumentCount] of calls) {
            if (path === '/getPgrToken') {
                assert.deepEqual(params, { api_token: 'api-token' })
                assert.equal(argumentCount, 3)
                continue
            }
            if (path === '/bot/bindings/bind') {
                assert.deepEqual(params, {
                    platform: 'yunzai',
                    platformId: 'local-user',
                    token: 'sstk-from-api',
                })
                assert.equal(argumentCount, 3)
                continue
            }
            assert.equal(params.platform, 'yunzai')
            assert.equal(params.platform_id, 'local-user')
            assert.equal(params.token, 'sstk-value')
            assert.equal(argumentCount, 3)
        }
    } finally {
        phiApiClient.request = originalRequest
    }
})

test('platformParams optionally attaches sessionToken first and otherwise API ID', async () => {
    const store = fakeStore()
    store.sessions.set('local-user', 'sstk-value')
    store.apiIds.set('local-user', '12345')
    const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store) })
    const plain = await credentials.platformParams()
    const byToken = await credentials.platformParams(true)
    await store.deleteSessionToken('local-user')
    const byApiId = await credentials.platformParams(true)
    assert.equal(plain.token, undefined)
    assert.equal(plain.api_user_id, undefined)
    assert.equal(byToken.token, 'sstk-value')
    assert.equal(byToken.api_user_id, undefined)
    assert.equal(byApiId.token, undefined)
    assert.equal(byApiId.api_user_id, '12345')
})

test('save and history operations are exposed through the user instance', async () => {
    const originals = {
        localSave: getSave.getSaveBySessionToken,
        localHistory: getSave.getHistoryBySessionToken,
        cloudHistory: makeRequest.getHistory,
        cloudHistoryRecord: makeRequest.getHistoryRecord,
    }
    /** @type {any[]} */ const calls = []
    getSave.getSaveBySessionToken = async sessionToken => { calls.push(['localSave', sessionToken]); return /** @type {any} */ ({}) }
    getSave.getHistoryBySessionToken = async sessionToken => { calls.push(['localHistory', sessionToken]); return /** @type {any} */ ({}) }
    makeRequest.getHistory = async (/** @type {any} */ params) => {
        calls.push(['cloudHistory', params._local_user_id, params.request])
        return /** @type {any} */ ({})
    }
    makeRequest.getHistoryRecord = async (/** @type {any} */ params) => {
        calls.push(['cloudHistoryRecord', params.song_id, params.rank, params.difficulty])
        return /** @type {any} */ ([])
    }
    try {
        const store = fakeStore()
        store.sessions.set('save-user', 'save-token')
        const credentials = UserCredentials.fromEvent(event('save-user'), { store: /** @type {any} */ (store) })
        await credentials.getLocalSave()
        await credentials.getLocalHistory()
        await credentials.getCloudHistory(['rks'])
        await credentials.getCloudSongHistory(/** @type {idString} */ ('song.0'), 'IN')
        assert.deepEqual(calls, [
            ['localSave', 'save-token'],
            ['localHistory', 'save-token'],
            ['cloudHistory', 'save-user', ['rks']],
            ['cloudHistoryRecord', 'song.0', 'IN', undefined],
        ])
    } finally {
        getSave.getSaveBySessionToken = originals.localSave
        getSave.getHistoryBySessionToken = originals.localHistory
        makeRequest.getHistory = originals.cloudHistory
        makeRequest.getHistoryRecord = originals.cloudHistoryRecord
    }
})

test('API save refresh is implemented by UserCredentials and reuses an unchanged cache', async () => {
    const store = fakeStore()
    store.apiIds.set('save-user', '12345')
    const credentials = UserCredentials.fromEvent(event('save-user'), { store: /** @type {any} */ (store) })
    const cached = /** @type {any} */ ({ saveInfo: { modifiedAt: { iso: new Date('2026-01-01') } } })
    const originalGetCached = credentials.getApiCachedSave
    const originalSaveInfo = makeRequest.getCloudSaveInfo
    credentials.getApiCachedSave = async () => cached
    makeRequest.getCloudSaveInfo = async () => /** @type {any} */ ({ modifiedAt: { iso: '2026-01-01T00:00:00.000Z' } })
    try {
        assert.deepEqual(await credentials.getUpdatedSaveFromApi(), {
            save: cached,
            added_rks_notes: [0, 0],
        })
    } finally {
        credentials.getApiCachedSave = originalGetCached
        makeRequest.getCloudSaveInfo = originalSaveInfo
    }
})

test('failed API session binding can commit the new sessionToken through local binding', async () => {
    const store = fakeStore()
    store.sessions.set('local-user', 'old-token')
    store.apiIds.set('local-user', 'old-api-id')
    const originalRequest = phiApiClient.request
    phiApiClient.request = async () => { throw new Error('API unavailable') }
    /** @type {any[]} */ const localUpdates = []
    const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store) })
    const originalUpdateLocal = credentials.getUpdatedSaveFromLocal
    credentials.getUpdatedSaveFromLocal = /** @type {any} */ (async (/** @type {any} */ token, /** @type {any} */ isGlobal) => {
        localUpdates.push([credentials.userId, token, isGlobal])
        return { save: { session: token } }
    })
    try {
        assert.equal(await credentials.bindWithSessionToken(/** @type {phigrosToken} */ ('new-token')), null)
        const result = await credentials.bindLocallyWithSessionToken(/** @type {phigrosToken} */ ('new-token'), true)
        assert.deepEqual(result, { save: { session: 'new-token' } })
        assert.deepEqual(localUpdates, [['local-user', 'new-token', true]])
        assert.deepEqual(await credentials.getLocalCredentials(), { sessionToken: 'new-token', apiId: undefined })
    } finally {
        phiApiClient.request = originalRequest
        credentials.getUpdatedSaveFromLocal = originalUpdateLocal
    }
})
