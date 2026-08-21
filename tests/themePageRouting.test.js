import assert from 'node:assert/strict'
import test from 'node:test'
import Config from '../components/Config.js'
import { phihelp as ApiSettings } from '../apps/apiSetting.js'
import { phihelp as UserSettings } from '../apps/setting.js'
import { phiuser as UserInfo } from '../apps/user.js'
import getInfo from '../model/game/getInfo.js'
import fCompute from '../model/game/fCompute.js'
import picmodle from '../model/render/picmodle.js'
import send from '../model/render/send.js'
import getBanGroup from '../model/user/getBanGroup.js'
import getNotes from '../model/user/getNotes.js'
import themeManager from '../model/theme/manager.js'
import themeUseService from '../model/theme/useService.js'
import { UserCredentials } from '../model/user/userCredentials.js'

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
    let currentTheme = 'milthm'

    getBanGroup.get = async () => false
    getNotes.getNotesData = async () => /** @type {any} */ ({ ...pluginData(), theme: currentTheme })
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
        const themedOptions = renders[0][2].items.find((/** @type {any} */ item) => item.key === 'theme').options
        assert.deepEqual(themedOptions.slice(0, 4).map((/** @type {any} */ option) => option.value), ['default', 'snow', 'star', 'dss2'])
        assert.equal(themedOptions.length, 5)
        assert.equal(themedOptions[4].title, 'Milthm')
        assert.equal(themedOptions[4].selected, true)
        assert.equal(themedOptions[4].fullWidth, true)
        assert.match(themedOptions[4].description, /\/phi market <slug>/)

        currentTheme = 'default'
        assert.equal(await command.showUserSetting(/** @type {any} */ (event('/phi myset'))), true)
        const defaultOptions = renders[1][2].items.find((/** @type {any} */ item) => item.key === 'theme').options
        assert.equal(defaultOptions[0].selected, true)
        assert.equal(defaultOptions[4].title, '自定义')
        assert.equal(defaultOptions[4].selected, false)
        assert.equal(defaultOptions[4].fullWidth, true)
    } finally {
        getBanGroup.get = originals.getBan
        getNotes.getNotesData = originals.getNotesData
        getInfo.getill = originals.getIll
        picmodle.common = originals.common
        send.send_with_At = originals.send
    }
})

test('用户按市场 slug 设置未下载主题时会自动下载并保存', async () => {
    const originals = {
        getUserCfg: Config.getUserCfg,
        getBan: getBanGroup.get,
        getNotesData: getNotes.getNotesData,
        putNotesData: getNotes.putNotesData,
        getThemeOptions: themeManager.getThemeOptions,
        use: themeUseService.use,
        getIll: getInfo.getill,
        common: picmodle.common,
        send: send.send_with_At,
    }
    let installed = false
    const pluginData = /** @type {any} */ ({
        theme: 'default', b30AvgKind: 'all', b30AvgColor: 'red',
        allowApiUsage: true, showB30Analysis: true,
    })
    /** @type {string[]} */ const used = []
    /** @type {any[]} */ const saved = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'cmdhead' ? 'phi' : key === 'openPhiPluginApi')
    getBanGroup.get = async () => false
    getNotes.getNotesData = async () => pluginData
    getNotes.putNotesData = (userId, data) => { saved.push({ userId, data: { ...data } }); return true }
    themeManager.getThemeOptions = () => ({
        default: { title: '[0]默认', description: '' },
        ...(installed ? { 'ocean-salt': { title: '[1]Ocean Salt', description: 'market' } } : {}),
    })
    themeUseService.use = async slug => {
        used.push(slug)
        installed = true
        return /** @type {any} */ ({ cached: false, version: '1.0.0', theme: { id: slug, name: 'Ocean Salt' } })
    }
    getInfo.getill = () => 'background.png'
    picmodle.common = /** @type {any} */ (async () => 'image')
    send.send_with_At = async () => undefined

    try {
        const command = new UserSettings()
        assert.equal(await command.showUserSetting(/** @type {any} */ (event('/phi myset 主题 ocean-salt'))), true)
        assert.deepEqual(used, ['ocean-salt'])
        assert.equal(saved.length, 1)
        assert.equal(saved[0].userId, 'test-user')
        assert.equal(saved[0].data.theme, 'ocean-salt')
    } finally {
        Config.getUserCfg = originals.getUserCfg
        getBanGroup.get = originals.getBan
        getNotes.getNotesData = originals.getNotesData
        getNotes.putNotesData = originals.putNotesData
        themeManager.getThemeOptions = originals.getThemeOptions
        themeUseService.use = originals.use
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

test('info 命令传递用户主题并正确区分新版和旧版渲染', async () => {
    const originals = {
        getBan: getBanGroup.get,
        getNotesData: getNotes.getNotesData,
        getIll: getInfo.getill,
        fuzzySongsNick: getInfo.fuzzysongsnick,
        getAvatar: getInfo.idgetavatar,
        getBackground: fCompute.getBackground,
        getSave: send.getsave_result,
        send: send.send_with_At,
        userInfo: picmodle.user_info,
        fromEvent: UserCredentials.fromEvent,
    }
    /** @type {any[]} */ const renders = []
    const history = {
        getRksAndDataLine: () => ({
            rks_history: [],
            data_history: [],
            rks_range: [0, 0],
            data_range: [0, 0],
            rks_date: [new Date(0), new Date(0)],
            data_date: [new Date(0), new Date(0)],
        }),
    }
    const save = {
        getStats: async () => [],
        getRecord: () => [],
        findAccRecord: () => [],
        gameProgress: { money: [0, 0, 0, 0, 0] },
        gameuser: { avatar: 'avatar-id', background: 'song-id', selfIntro: 'hello' },
        saveInfo: {
            PlayerId: 'TestPlayer',
            summary: { challengeModeRank: 312, rankingScore: 15.1234 },
        },
    }

    getBanGroup.get = async () => false
    getNotes.getNotesData = async () => /** @type {any} */ ({ theme: 'milthm', allowApiUsage: false })
    getInfo.getill = () => 'background.png'
    getInfo.fuzzysongsnick = /** @type {any} */ (() => ['song-id'])
    getInfo.idgetavatar = () => 'avatar1'
    fCompute.getBackground = () => 'player-background.png'
    send.getsave_result = /** @type {any} */ (async () => save)
    send.send_with_At = /** @type {any} */ (async () => undefined)
    picmodle.user_info = /** @type {any} */ (async (/** @type {any} */ e, /** @type {any} */ data, /** @type {any} */ kind) => {
        renders.push({ e, data, kind })
        return 'image'
    })
    UserCredentials.fromEvent = /** @type {any} */ (() => ({
        getLocalHistory: async () => history,
        getCloudHistory: async () => history,
    }))

    try {
        const command = new UserInfo()
        /** @type {Array<[string, number]>} */
        const cases = [
            ['/phi info', 0],
            ['/phi info1', 1],
            ['/phi info2', 2],
            ['#phi info2', 2],
            ['/phiinfo2', 2],
            ['/phi info2 Test Song', 2],
        ]
        for (const [message, expectedKind] of cases) {
            await command.info(/** @type {any} */ (event(message)))
            const render = renders.at(-1)
            assert.ok(render)
            assert.equal(render.data.theme, 'milthm')
            assert.equal(render.kind, expectedKind)
        }
        assert.equal(renders.length, cases.length)
    } finally {
        getBanGroup.get = originals.getBan
        getNotes.getNotesData = originals.getNotesData
        getInfo.getill = originals.getIll
        getInfo.fuzzysongsnick = originals.fuzzySongsNick
        getInfo.idgetavatar = originals.getAvatar
        fCompute.getBackground = originals.getBackground
        send.getsave_result = originals.getSave
        send.send_with_At = originals.send
        picmodle.user_info = originals.userInfo
        UserCredentials.fromEvent = originals.fromEvent
    }
})
