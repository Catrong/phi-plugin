import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import shared from '../components/settings/shared.cjs'
import { createGuobaConfigInfo, createGuobaSchemas } from '../components/settings/guoba.js'
import { bindHostSettings, getHostSettings, writeHostSetting, writeHostSettings, updateHostSettings } from '../components/settings/host.js'

const require = createRequire(import.meta.url)
const { Config: schema } = require('../koishi.cjs')

test('central definitions cover every YAML setting exactly once', () => {
    const keys = shared.definitions.map(item => item.key)
    assert.equal(new Set(keys).size, keys.length)
    assert.deepEqual([...keys].sort(), Object.keys(shared.defaults).sort())
})

test('Guoba and Koishi expose the same editable fields and YAML defaults', () => {
    const guobaFields = createGuobaSchemas().filter(item => item.field).map(item => item.field).sort()
    const koishiDefaults = schema({})
    assert.deepEqual(Object.keys(koishiDefaults).sort(), guobaFields)
    for (const item of shared.editable) {
        if (!item.generated) assert.equal(koishiDefaults[item.key], shared.defaults[item.key], item.key)
    }
    assert.ok(guobaFields.includes('apiBotClientSecret'))
    assert.ok(guobaFields.includes('apiBotClientId'))
    assert.ok(!guobaFields.includes('VikaToken'))
    assert.doesNotThrow(() => JSON.stringify(schema))
})

test('Koishi schema preserves numeric choices, booleans and validates bounds', () => {
    const config = schema({ onLinePhiIllUrl: 3, githubProxy: false, LetterMarkdown: false, LetterGuessCd: 0 })
    assert.equal(config.onLinePhiIllUrl, 3)
    assert.equal(config.githubProxy, false)
    assert.equal(config.LetterMarkdown, false)
    assert.equal(config.LetterGuessCd, 0)
    assert.throws(() => schema({ renderScale: 201 }))
    assert.throws(() => schema({ onLinePhiIllUrl: 99 }))
    assert.equal(schema({ downIllUrl: 'https://example.com/ill.git' }).downIllUrl, 'https://example.com/ill.git')
})

test('Guoba saves validated shared fields and preserves channel-mode dependency', () => {
    const values = { ...shared.defaults, WordB19Img: true, WordSuggImg: true }
    /** @type {string[]} */
    const writes = []
    const config = createGuobaConfigInfo({
        getUserCfg: (/** @type {string} */ _name, /** @type {string} */ key) => values[key],
        modify: (/** @type {string} */ _name, /** @type {string} */ key, /** @type {any} */ value) => {
            writes.push(key)
            values[key] = value
        },
    })
    config.setConfigData({ isGuild: true, githubProxy: 'false', apiBotClientSecret: 'edited-secret', unknown: 1 })
    assert.equal(values.WordB19Img, false)
    assert.equal(values.WordSuggImg, false)
    assert.equal(values.githubProxy, false)
    assert.equal(values.apiBotClientSecret, 'edited-secret')
    assert.ok(!writes.includes('unknown'))
    const before = writes.length
    assert.throws(() => config.setConfigData({ renderScale: -1 }))
    assert.equal(writes.length, before)
    assert.throws(() => config.setConfigData({ themeMarketDownloadOrigin: 'http://example.com/path' }))
})

test('Koishi settings reach existing readers and command writes return to the host', async () => {
    const { default: config } = await import('../components/Config.js')
    const configFile = new URL('../config/config/config.yaml', import.meta.url)
    const before = fs.readFileSync(configFile, 'utf8')
    /** @type {Record<string, any> | undefined} */
    let saved
    const unbind = bindHostSettings({ renderScale: 125, isGuild: true, WordB19Img: true }, values => { saved = values })
    try {
        assert.equal(config.getUserCfg('config', 'renderScale'), 125)
        assert.equal(config.getUserCfg('config', 'WordB19Img'), false)
        config.modify('config', 'renderScale', 150)
        assert.equal(saved?.renderScale, 150)
        assert.equal(config.getUserCfg('config', 'renderScale'), 150)
        assert.equal(writeHostSetting('unknown', 'ignored'), false)
        assert.equal(fs.readFileSync(configFile, 'utf8'), before)
    } finally {
        unbind()
        await config.close()
    }
    assert.deepEqual(getHostSettings(), {})
    assert.equal(writeHostSetting('renderScale', 100), false)
})

test('disposing an older host binding cannot erase the replacement', () => {
    const first = bindHostSettings({ renderScale: 125 }, () => {})
    const second = bindHostSettings({ renderScale: 150 }, () => {})
    first()
    assert.equal(getHostSettings().renderScale, 150)
    second()
    assert.deepEqual(getHostSettings(), {})
})

test('credentials are editable and masked in forms, and excluded from bot setting messages', () => {
    const secret = createGuobaSchemas().find(item => item.field === 'apiBotClientSecret')
    assert.equal(secret.componentProps.type, 'password')
    assert.notEqual(secret.componentProps.disabled, true)
    assert.ok(!createGuobaSchemas(false).some(item => item.field === 'apiBotClientSecret'))
    const group = schema.list?.find(/** @param {any} item */ item => item.dict?.apiBotClientSecret)
    assert.ok(group?.dict)
    assert.equal(group.dict.apiBotClientSecret.meta.role, 'secret')
    assert.notEqual(group.dict.apiBotClientSecret.meta.disabled, true)
    assert.equal(schema({ apiBotClientId: 'client', apiBotClientSecret: 'secret', apiBotSecretVersion: 2 }).apiBotSecretVersion, 2)
    assert.throws(() => schema({ apiBotSecretVersion: -1 }))
})

test('API-generated credentials are saved together and subsequent manual edits are read back', () => {
    /** @type {Record<string, any>[]} */
    const writes = []
    const unbind = bindHostSettings({}, values => writes.push(values))
    try {
        assert.equal(writeHostSettings({ apiBotClientId: 'issued-id', apiBotClientSecret: 'issued-secret', apiBotSecretVersion: 3 }), true)
        assert.equal(writes.length, 1)
        assert.equal(writes[0].apiBotClientId, 'issued-id')
        assert.equal(writes[0].apiBotClientSecret, 'issued-secret')
        assert.equal(writes[0].apiBotSecretVersion, 3)
        updateHostSettings({ apiBotClientSecret: 'edited-secret', apiBotSecretVersion: 4 })
        assert.equal(getHostSettings().apiBotClientSecret, 'edited-secret')
        assert.equal(getHostSettings().apiBotSecretVersion, 4)
    } finally {
        unbind()
    }
})

test('actual API registration persists credentials through Koishi and signs with edited values', async () => {
    const { default: axios } = await import('axios')
    const { BotApiAuth } = await import('../model/api/botApiAuth.js')
    const configFile = new URL('../config/config/config.yaml', import.meta.url)
    const before = fs.readFileSync(configFile, 'utf8')
    const originalPost = axios.post
    /** @type {Record<string, any>[]} */
    const writes = []
    const unbind = bindHostSettings({ apiBotClientId: '', apiBotClientSecret: '', apiBotSecretVersion: 0 }, values => writes.push(values))
    axios.post = /** @type {any} */ (async () => ({ status: 200, data: { clientId: 'test-issued-id', secret: 'test-issued-secret', secretVersion: 1 } }))
    try {
        const auth = new BotApiAuth()
        await auth.register()
        assert.equal(writes.length, 1)
        assert.equal(auth.getClientId(), 'test-issued-id')
        updateHostSettings({ apiBotClientId: 'test-edited-id', apiBotClientSecret: 'test-edited-secret', apiBotSecretVersion: 2 })
        const headers = auth.sign('GET', '/test', '')
        assert.equal(headers['X-Phi-Bot-Client-Id'], 'test-edited-id')
        assert.equal(headers['X-Phi-Bot-Key-Version'], '2')
        assert.equal(fs.readFileSync(configFile, 'utf8'), before)
    } finally {
        axios.post = originalPost
        unbind()
    }
})
