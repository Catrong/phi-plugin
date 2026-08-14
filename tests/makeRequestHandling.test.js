import assert from 'node:assert/strict'
import test from 'node:test'
import makeRequest from '../model/api/makeRequest.js'
import phiApiClient from '../model/api/phiApiClient.js'
import { PhiApiError } from '../model/api/phiApiErrors.js'
import platform from '../components/platform/index.js'
import { UserCredentials } from '../model/user/userCredentials.js'

const event = {
    msg: '',
    user_id: 'request-user',
    userId: 'request-user',
    platform: 'qq',
    isGroup: false,
    isPrivate: true,
}

test('makeRequest endpoint execution only ignores explicit unbound errors', async () => {
    const originalSend = platform.sendWithAt
    /** @type {string[]} */
    const messages = []
    platform.sendWithAt = async (_event, message) => { messages.push(String(message)) }
    const originalRequest = phiApiClient.request
    try {
        phiApiClient.request = async () => { throw new PhiApiError('not bound', 404, 'binding_not_found') }
        const ignored = await makeRequest.getUserBan(
            /** @type {any} */ ({ platform: 'qq', platform_id: 'request-user' }),
            {
                event: /** @type {any} */ (event),
                ignoreUnboundError: true,
                notifyUser: true,
            },
        )
        assert.equal(ignored, null)
        assert.deepEqual(messages, [])

        phiApiClient.request = async () => { throw new PhiApiError('forbidden', 403, 'permission_denied') }
        const rejected = await makeRequest.getUserBan(
            /** @type {any} */ ({ platform: 'qq', platform_id: 'request-user' }),
            {
                event: /** @type {any} */ (event),
                ignoreUnboundError: true,
                notifyUser: true,
            },
        )
        assert.equal(rejected, null)
        assert.equal(messages.length, 1)
        assert.match(messages[0], /API访问被拒绝/)
    } finally {
        phiApiClient.request = originalRequest
        platform.sendWithAt = originalSend
    }
})

test('UserCredentials endpoint methods forward ignoreUnboundError and use the typed makeRequest endpoint', async () => {
    const originalSend = platform.sendWithAt
    /** @type {string[]} */
    const messages = []
    /** @type {any[]} */
    const calls = []
    const store = {
        getSessionToken: async () => 'sstk-value',
        getApiId: async () => undefined,
    }
    const originalRequest = phiApiClient.request
    phiApiClient.request = /** @type {any} */ (async function (/** @type {any} */ path, /** @type {any} */ params, /** @type {any} */ method = 'POST') {
        calls.push({ path, params, method, argumentCount: arguments.length })
        throw new PhiApiError('not bound', 404, 'binding_not_found')
    })
    platform.sendWithAt = async (_event, message) => { messages.push(String(message)) }
    try {
        const credentials = UserCredentials.fromEvent(event, {
            store: /** @type {any} */ (store),
        })
        const result = await credentials.getUserAPIBanStatus({
            ignoreUnboundError: true,
        })

        assert.equal(result, null)
        assert.deepEqual(messages, [])
        assert.equal(calls.length, 1)
        assert.equal(calls[0].path, '/get/banUser')
        assert.equal(calls[0].params.platform_id, 'request-user')
        assert.equal(calls[0].params.token, 'sstk-value')
        assert.equal(calls[0].argumentCount, 3)
    } finally {
        phiApiClient.request = originalRequest
        platform.sendWithAt = originalSend
    }
})

test('UserCredentials can ignore missing local credentials before making the API request', async () => {
    let calls = 0
    const store = {
        getSessionToken: async () => undefined,
        getApiId: async () => undefined,
    }
    const originalRequest = phiApiClient.request
    phiApiClient.request = async () => { calls += 1 }
    try {
        const credentials = UserCredentials.fromEvent(event, {
            store: /** @type {any} */ (store),
        })

        assert.equal(
            await credentials.getUserAPIBanStatus({ ignoreUnboundError: true }),
            null,
        )
        assert.equal(calls, 0)
        await assert.rejects(
            credentials.getUserAPIBanStatus(),
            (/** @type {any} */ error) => error.code === 'binding_not_found',
        )
        assert.equal(calls, 0)
    } finally {
        phiApiClient.request = originalRequest
    }
})
