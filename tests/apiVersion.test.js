import assert from 'node:assert/strict'
import test from 'node:test'
import {
    compareApiVersion,
    isApiVersionBlocked,
    parseApiVersion,
    setApiVersionBlocked,
    SUPPORTED_API_VERSION,
} from '../model/api/apiVersion.js'
import { AutoSeekApi } from '../model/api/autoSeekApi.js'

test('API protocol version parser accepts only complete semantic versions', () => {
    assert.deepEqual(parseApiVersion('v1.2.3'), {
        major: 1,
        minor: 2,
        patch: 3,
        normalized: '1.2.3',
    })
    assert.equal(parseApiVersion('1.2'), null)
    assert.equal(parseApiVersion('latest'), null)
})

test('API protocol compatibility follows major and minor version policy', () => {
    assert.equal(compareApiVersion(SUPPORTED_API_VERSION).status, 'compatible')
    assert.equal(compareApiVersion('1.0.9').status, 'minor_mismatch')
    assert.equal(compareApiVersion('1.1.0').status, 'minor_mismatch')
    assert.equal(compareApiVersion('2.0.0').status, 'major_mismatch')
    assert.equal(compareApiVersion(undefined).status, 'invalid')
})

test('API connectivity state is blocked only for incompatible or invalid protocol versions', () => {
    setApiVersionBlocked(false)
    const api = new AutoSeekApi()

    assert.equal(api.validateApiVersion('1.0.0'), true)
    assert.equal(api.isVersionBlocked(), false)

    assert.equal(api.validateApiVersion('1.0.9'), true)
    assert.equal(api.isVersionBlocked(), false)

    assert.equal(api.validateApiVersion('1.1.0'), true)
    assert.equal(api.isVersionBlocked(), false)

    api.openPhiPluginApi = true
    api.seekingApi = true
    assert.equal(api.validateApiVersion('2.0.0'), false)
    assert.equal(api.openPhiPluginApi, false)
    assert.equal(api.seekingApi, false)
    assert.equal(api.isVersionBlocked(), true)

    assert.equal(api.validateApiVersion('invalid'), false)
    assert.equal(api.isVersionBlocked(), true)
    assert.equal(isApiVersionBlocked(), true)
    setApiVersionBlocked(false)
})
