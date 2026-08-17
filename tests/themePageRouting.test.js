import assert from 'node:assert/strict'
import test from 'node:test'
import { phihelp as ApiSettings } from '../apps/apiSetting.js'
import { phihelp as UserSettings } from '../apps/setting.js'
import getInfo from '../model/game/getInfo.js'
import picmodle from '../model/render/picmodle.js'
import send from '../model/render/send.js'
import getBanGroup from '../model/user/getBanGroup.js'
import getNotes from '../model/user/getNotes.js'

/** @param {string} msg */
const event = msg => ({
    msg,
    user_id: 'test-user',
    self_id: 'test-bot',
    isGroup: false,
    isPrivate: true,
})

const pluginData = () => ({
    theme: 'milthm',
    b30AvgKind: 'all',
    b30AvgColor: 'red',
    allowApiUsage: true,
    showB30Analysis: true,
})

test('用户设置页把当前主题传给完整页面渲染目标', async () => {
    const originals = {
        getBan: getBanGroup.get,
        getNotesData: getNotes.getNotesData,
        getIll: getInfo.getill,
        common: picmodle.common,
        send: send.send_with_At,
    }
    /** @type {any[]} */ const renders = []

    getBanGroup.get = async () => false
    getNotes.getNotesData = async () => /** @type {any} */ (pluginData())
    getInfo.getill = () => 'background.png'
    picmodle.common = /** @type {any} */ (async (/** @type {any[]} */ ...args) => {
        renders.push(args)
        return 'image'
    })
    send.send_with_At = /** @type {any} */ (async () => undefined)

    try {
        const command = new UserSettings()
        assert.equal(await command.showUserSetting(/** @type {any} */ (event('/phi myset'))), true)
        assert.equal(renders.length, 1)
        assert.equal(renders[0][1], 'setting')
        assert.equal(renders[0][2].theme, 'milthm')
        assert.equal(renders[0][3], 'userSetting')
    } finally {
        getBanGroup.get = originals.getBan
        getNotes.getNotesData = originals.getNotesData
        getInfo.getill = originals.getIll
        picmodle.common = originals.common
        send.send_with_At = originals.send
    }
})

test('API 用户设置页把当前主题传给完整页面渲染目标', async () => {
    const originals = {
        getNotesData: getNotes.getNotesData,
        getIll: getInfo.getill,
        common: picmodle.common,
        send: send.send_with_At,
    }
    /** @type {any[]} */ const renders = []

    getNotes.getNotesData = async () => /** @type {any} */ (pluginData())
    getInfo.getill = () => 'background.png'
    picmodle.common = /** @type {any} */ (async (/** @type {any[]} */ ...args) => {
        renders.push(args)
        return 'image'
    })
    send.send_with_At = /** @type {any} */ (async () => undefined)

    try {
        const command = new ApiSettings()
        await command.renderApiUserSetting(/** @type {any} */ (event('/phi apiset')), {
            allowDataCollection: true,
            allowLeaderboard: true,
            allowDataAggregation: true,
            allowPlayerIdSearch: true,
            allowUserIdSearch: true,
        })
        assert.equal(renders.length, 1)
        assert.equal(renders[0][1], 'setting')
        assert.equal(renders[0][2].theme, 'milthm')
        assert.equal(renders[0][3], 'userSetting')
    } finally {
        getNotes.getNotesData = originals.getNotesData
        getInfo.getill = originals.getIll
        picmodle.common = originals.common
        send.send_with_At = originals.send
    }
})
