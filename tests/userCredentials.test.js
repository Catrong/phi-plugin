import assert from 'node:assert/strict'
import test from 'node:test'
import getSave from '../model/getSave.js'
import getSaveFromApi from '../model/getSaveFromApi.js'
import getUpdateSave from '../model/getUpdateSave.js'
import { UserCredentials } from '../model/userCredentials.js'

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

const noopBotAuth = {
    bind: async () => ({}),
    ensureBinding: async () => ({ bindingId: 'binding-id' }),
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
    const botAuth = {
        bind: async (/** @type {any} */ params) => {
            calls.push(params)
            return { bindingId: 'binding-id', apiUserId: params.api_user_id, bindingCredential: 'credential', credentialVersion: 1 }
        },
        ensureBinding: async () => ({}),
    }
    const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store), botAuth })
    const result = await credentials.bindWithApiId('12345')
    assert.equal(result.apiUserId, '12345')
    assert.deepEqual(calls, [{ platform: 'yunzai', platform_id: 'local-user', _local_user_id: 'local-user', api_user_id: '12345' }])
    assert.deepEqual(await credentials.getLocalCredentials(), { sessionToken: undefined, apiId: '12345' })
})

test('SSTK binding commits the resolved API ID and SSTK', async () => {
    const store = fakeStore()
    const botAuth = {
        bind: async () => ({ bindingId: 'binding-id', apiUserId: '67890', bindingCredential: 'credential', credentialVersion: 1 }),
        ensureBinding: async () => ({}),
    }
    const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store), botAuth })
    await credentials.bindWithSessionToken(/** @type {phigrosToken} */ ('sstk-value'), true)
    assert.deepEqual(await credentials.getLocalCredentials(), { sessionToken: 'sstk-value', apiId: '67890' })
})

test('remote API ID bind failures preserve local state', async () => {
    const store = fakeStore()
    store.sessions.set('local-user', 'old-token')
    store.apiIds.set('local-user', 'old-api-id')
    const botAuth = {
        bind: async () => { throw new Error('API unavailable') },
        ensureBinding: async () => ({}),
    }
    const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store), botAuth })
    assert.equal(await credentials.bindWithApiId('new-api-id'), null)
    assert.deepEqual(await credentials.getLocalCredentials(), { sessionToken: 'old-token', apiId: 'old-api-id' })
})

test('local credential changes clear the cached platform binding', async () => {
    const store = fakeStore()
    /** @type {any[]} */ const invalidations = []
    const botAuth = {
        bind: async () => ({}),
        ensureBinding: async () => ({}),
        invalidateBinding: async (/** @type {any} */ params) => { invalidations.push(params) },
    }
    const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store), botAuth })
    await credentials.useLocalSessionToken(/** @type {phigrosToken} */ ('local-sstk'))
    await credentials.useLocalApiId('4321')
    assert.equal(invalidations.length, 2)
    assert.deepEqual(invalidations[0], { platform: 'yunzai', platform_id: 'local-user', _local_user_id: 'local-user' })
    assert.deepEqual(await credentials.getLocalCredentials(), { sessionToken: undefined, apiId: '4321' })
})

test('local unbind clears local credentials and never calls the API', async () => {
    const store = fakeStore()
    store.sessions.set('local-user', 'old-token')
    store.apiIds.set('local-user', 'old-api-id')
    let invalidations = 0
    const botAuth = {
        bind: async () => { throw new Error('must not bind') },
        ensureBinding: async () => { throw new Error('must not resolve') },
        invalidateBinding: async () => { invalidations += 1 },
    }
    const originalDelSave = getSave.delSave
    /** @type {string[]} */ const deletedUsers = []
    getSave.delSave = async userId => { deletedUsers.push(String(userId)); return true }
    try {
        const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store), botAuth })
        assert.deepEqual(await credentials.unbindLocal(), { hadBinding: true })
        assert.deepEqual(await credentials.getLocalCredentials(), { sessionToken: undefined, apiId: undefined })
        assert.deepEqual(deletedUsers, ['local-user'])
        assert.equal(invalidations, 1)
    } finally {
        getSave.delSave = originalDelSave
    }
})

test('credential API methods inject the instance platform and local SSTK', async () => {
    const store = fakeStore()
    store.sessions.set('local-user', 'sstk-value')
    store.apiIds.set('local-user', '12345')
    /** @type {any[]} */ const calls = []
    const apiClient = async (/** @type {string} */ path, /** @type {any} */ params) => {
        calls.push([path, params])
        if (path === '/token/list') return { data: { platform_data: [] } }
        if (path === '/getPgrToken') return { data: { token: 'sstk-from-api' } }
        return { message: 'ok' }
    }
    const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store), apiClient, botAuth: noopBotAuth })
    await credentials.listPlatformBindings()
    await credentials.setApiToken('api-token')
    await credentials.deleteApiAccount()
    await credentials.authenticateApiToken('api-token')
    assert.equal(await credentials.getSessionToken(), 'sstk-from-api')
    assert.deepEqual(calls.map(([path]) => path), ['/token/list', '/setApiToken', '/clear', '/getPgrToken'])
    for (const [path, params] of calls) {
        if (path === '/getPgrToken') {
            assert.deepEqual(params, { api_token: 'api-token' })
            continue
        }
        assert.equal(params.platform, 'yunzai')
        assert.equal(params.platform_id, 'local-user')
    }
})

test('save and history operations are exposed through the user instance', async () => {
    const originals = {
        localSave: getSave.getSave,
        localHistory: getSave.getHistory,
        cloudHistory: getSaveFromApi.getHistory,
        updateApi: getUpdateSave.getNewSaveFromApi,
    }
    /** @type {any[]} */ const calls = []
    getSave.getSave = async userId => { calls.push(['localSave', userId]); return /** @type {any} */ ({}) }
    getSave.getHistory = async userId => { calls.push(['localHistory', userId]); return /** @type {any} */ ({}) }
    getSaveFromApi.getHistory = async (e, fields, credentials) => { calls.push(['cloudHistory', e.userId, fields, credentials?.userId]); return /** @type {any} */ ({}) }
    getUpdateSave.getNewSaveFromApi = async (e, token, credentials) => { calls.push(['updateApi', e.userId, token, credentials?.userId]); return /** @type {any} */ ({}) }
    try {
        const store = fakeStore()
        store.apiIds.set('save-user', '12345')
        const credentials = UserCredentials.fromEvent(event('save-user'), { store: /** @type {any} */ (store), botAuth: noopBotAuth })
        await credentials.getLocalSave()
        await credentials.getLocalHistory()
        await credentials.getCloudHistory(['rks'])
        await credentials.getUpdatedSaveFromApi(/** @type {phigrosToken} */ ('token'))
        assert.deepEqual(calls, [
            ['localSave', 'save-user'],
            ['localHistory', 'save-user'],
            ['cloudHistory', 'save-user', ['rks'], 'save-user'],
            ['updateApi', 'save-user', 'token', 'save-user'],
        ])
    } finally {
        getSave.getSave = originals.localSave
        getSave.getHistory = originals.localHistory
        getSaveFromApi.getHistory = originals.cloudHistory
        getUpdateSave.getNewSaveFromApi = originals.updateApi
    }
})

test('failed API session binding can commit the new sessionToken through local binding', async () => {
    const store = fakeStore()
    store.sessions.set('local-user', 'old-token')
    store.apiIds.set('local-user', 'old-api-id')
    const botAuth = {
        bind: async () => { throw new Error('API unavailable') },
        ensureBinding: async () => ({}),
        invalidateBinding: async () => undefined,
    }
    const originalUpdateLocal = getUpdateSave.getNewSaveFromLocal
    /** @type {any[]} */ const localUpdates = []
    getUpdateSave.getNewSaveFromLocal = /** @type {any} */ (async (/** @type {any} */ e, /** @type {any} */ token, /** @type {any} */ isGlobal, /** @type {any} */ credentials) => {
        localUpdates.push([e.userId, token, isGlobal, credentials?.userId])
        return { save: { session: token } }
    })
    try {
        const credentials = UserCredentials.fromEvent(event(), { store: /** @type {any} */ (store), botAuth })
        assert.equal(await credentials.bindWithSessionToken(/** @type {phigrosToken} */ ('new-token')), null)
        const result = await credentials.bindLocallyWithSessionToken(/** @type {phigrosToken} */ ('new-token'), true)
        assert.deepEqual(result, { save: { session: 'new-token' } })
        assert.deepEqual(localUpdates, [['local-user', 'new-token', true, 'local-user']])
        assert.deepEqual(await credentials.getLocalCredentials(), { sessionToken: 'new-token', apiId: undefined })
    } finally {
        getUpdateSave.getNewSaveFromLocal = originalUpdateLocal
    }
})
