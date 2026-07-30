// @ts-nocheck
import assert from 'node:assert/strict'
import test from 'node:test'
import Config from '../components/Config.js'
import {
    BotApiAuth,
    PhiApiError,
    classifyApiConnectionError,
    getPhiApiUserMessage,
    hasPhiApiUserMessage,
    isApiConnectionError,
    isFatalBotIdentityError,
} from '../model/botApiAuth.js'

test('API connection failures retain a specific stable error code', () => {
    const cases = [
        ['ECONNABORTED', 'api_timeout'],
        ['ETIMEDOUT', 'api_timeout'],
        ['ENOTFOUND', 'api_dns_error'],
        ['EAI_AGAIN', 'api_dns_error'],
        ['ECONNREFUSED', 'api_connection_refused'],
        ['CERT_HAS_EXPIRED', 'api_tls_error'],
        ['ECONNRESET', 'api_network_error'],
    ]

    for (const [nativeCode, expected] of cases) {
        const error = classifyApiConnectionError(Object.assign(new Error(nativeCode), { code: nativeCode }))
        assert.equal(error.code, expected)
        assert.equal(isApiConnectionError(error), true)
    }
})

test('user-facing API errors explain the actual failure and next action', () => {
    assert.match(getPhiApiUserMessage(new PhiApiError('', 0, 'api_timeout')), /超时/)
    assert.match(getPhiApiUserMessage(new PhiApiError('', 0, 'api_dns_error')), /解析API地址/)
    assert.match(getPhiApiUserMessage(new PhiApiError('', 401, 'bot_client_unknown')), /重置API Bot身份/)
    assert.match(getPhiApiUserMessage(new PhiApiError('', 404, 'binding_not_found')), /sessionToken绑定/)
    const privateBindingMessage = getPhiApiUserMessage(new PhiApiError('', 403, 'user_id_binding_disabled'))
    assert.match(privateBindingMessage, /bind <sessionToken>/)
    assert.match(privateBindingMessage, /bind qrcode/)
    assert.equal(hasPhiApiUserMessage(new PhiApiError('', 500, 'internal_error')), false)
})

test('temporary identity verification failures are retried instead of cached forever', async () => {
    const originalGetUserCfg = Config.getUserCfg
    Config.getUserCfg = (_name, style) => ({
        apiBotClientId: 'issued-client-id',
        apiBotClientSecret: 'issued-secret',
        apiBotSecretVersion: 1,
    })[style]

    const auth = new BotApiAuth()
    let requests = 0
    auth.signedRequest = async () => {
        requests += 1
        if (requests === 1) throw new PhiApiError('timeout', 0, 'api_timeout')
        return { clientId: 'issued-client-id' }
    }

    try {
        await assert.rejects(auth.initialize(), error => error.code === 'api_timeout')
        const identity = await auth.initialize()
        assert.equal(identity.clientId, 'issued-client-id')
        assert.equal(requests, 2)
    } finally {
        Config.getUserCfg = originalGetUserCfg
    }
})

test('invalid issued credentials remain stopped until the identity changes', async () => {
    const originalGetUserCfg = Config.getUserCfg
    Config.getUserCfg = (_name, style) => ({
        apiBotClientId: 'revoked-client-id',
        apiBotClientSecret: 'revoked-secret',
        apiBotSecretVersion: 1,
    })[style]

    const auth = new BotApiAuth()
    let requests = 0
    auth.signedRequest = async () => {
        requests += 1
        throw new PhiApiError('revoked', 403, 'bot_client_revoked')
    }

    try {
        await assert.rejects(auth.initialize(), error => isFatalBotIdentityError(error))
        await assert.rejects(auth.initialize(), error => error.code === 'bot_client_revoked')
        assert.equal(requests, 1)
    } finally {
        Config.getUserCfg = originalGetUserCfg
    }
})

test('a missing Bot identity is registered on reconnect and concurrent recovery is single-flight', async () => {
    const originalGetUserCfg = Config.getUserCfg
    Config.getUserCfg = (_name, style) => ({
        apiBotClientId: '',
        apiBotClientSecret: '',
        apiBotSecretVersion: 0,
    })[style]

    const auth = new BotApiAuth()
    let registrations = 0
    auth.register = async () => {
        registrations += 1
        await new Promise(resolve => setTimeout(resolve, 5))
        auth.ready = true
        return { clientId: 'new-client-id', secret: 'secret', secretVersion: 1 }
    }

    try {
        const [first, second] = await Promise.all([
            auth.recoverAfterReconnect('v1.0.0'),
            auth.recoverAfterReconnect('v1.0.0'),
        ])
        assert.equal(first.clientId, 'new-client-id')
        assert.equal(second.clientId, 'new-client-id')
        assert.equal(registrations, 1)
    } finally {
        Config.getUserCfg = originalGetUserCfg
    }
})
