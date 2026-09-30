import assert from 'node:assert/strict'
import test from 'node:test'
import Config from '../components/Config.js'
import autoSeekApi from '../model/api/autoSeekApi.js'
import getNotes from '../model/user/getNotes.js'
import { getApiAccessState, isApiCapabilityConfigured } from '../model/user/apiPermission.js'

test('API capability switches are subordinate to the master switch', () => {
    const originalGetUserCfg = Config.getUserCfg
    let master = true
    let customTheme = true
    Config.getUserCfg = /** @type {any} */ ((/** @type {string} */ _name, /** @type {string} */ key) => {
        if (key === 'openPhiPluginApi') return master
        if (key === 'enableCustomThemeApi') return customTheme
        return true
    })
    try {
        assert.equal(isApiCapabilityConfigured('customTheme'), true)
        customTheme = false
        assert.equal(isApiCapabilityConfigured('customTheme'), false)
        customTheme = true
        master = false
        assert.equal(isApiCapabilityConfigured('customTheme'), false)
    } finally {
        Config.getUserCfg = originalGetUserCfg
    }
})

test('score statistics do not require user consent while online score does', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalGetNotesData = getNotes.getNotesData
    const originalOpen = autoSeekApi.openPhiPluginApi
    Config.getUserCfg = /** @type {any} */ (() => true)
    getNotes.getNotesData = async () => /** @type {any} */ ({ allowApiUsage: false })
    autoSeekApi.openPhiPluginApi = true
    try {
        assert.equal((await getApiAccessState(/** @type {any} */ ({ user_id: 'user' }), 'scoreStatistics')).enabled, true)
        assert.equal((await getApiAccessState(/** @type {any} */ ({ user_id: 'user' }), 'onlineScore')).enabled, false)
    } finally {
        Config.getUserCfg = originalGetUserCfg
        getNotes.getNotesData = originalGetNotesData
        autoSeekApi.openPhiPluginApi = originalOpen
    }
})
