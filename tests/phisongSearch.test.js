import assert from 'node:assert/strict'
import test from 'node:test'
import { phisong } from '../apps/phisong.js'
import Config from '../components/Config.js'
import getInfo from '../model/game/getInfo.js'
import getBanGroup from '../model/user/getBanGroup.js'
import getNotes from '../model/user/getNotes.js'
import picmodle from '../model/render/picmodle.js'
import send from '../model/render/send.js'
import { phisongMessages } from '../model/render/messages.js'

/** @param {string} msg */
const event = msg => /** @type {any} */ ({
    msg,
    user_id: 'test-user',
    self_id: 'test-bot',
    isGroup: false,
    isPrivate: true,
})

/** @param {number} count */
const songs = count => {
    /** @type {Record<string, any>} */
    const result = {}
    for (let index = 0; index < count; index++) {
        const id = `song-${index}`
        result[id] = {
            id,
            song: `Song ${index}`,
            bpm: '200',
            chart: { IN: { difficulty: 15.4, combo: 1100 } },
        }
    }
    return result
}

test('search 渲染通用表格：每页上限取 listScoreMaxNum，超限时提示缩小筛选', async () => {
    const originals = {
        getBan: getBanGroup.get,
        allInfo: getInfo.all_info,
        getill: getInfo.getill,
        getNotes: getNotes.getNotesData,
        tableImage: picmodle.tableImage,
        getUserCfg: Config.getUserCfg,
        sendWithAt: send.send_with_At,
        reply: send.reply,
    }
    /** @type {any[][]} */
    const renders = []
    /** @type {any[]} */
    const sent = []

    getBanGroup.get = async () => false
    getInfo.all_info = () => songs(3)
    getInfo.getill = () => 'background.png'
    getNotes.getNotesData = /** @type {any} */ (async () => ({ theme: 'star' }))
    Config.getUserCfg = /** @type {any} */ ((/** @type {string} */ name, /** @type {string} */ style) =>
        style === 'listScoreMaxNum' ? 2 : /** @type {any} */ (originals.getUserCfg).call(Config, name, style))
    picmodle.tableImage = /** @type {any} */ (async (/** @type {any[]} */ ...args) => {
        renders.push(args)
        return 'table-image'
    })
    send.send_with_At = /** @type {any} */ (async (/** @type {any} */ _e, /** @type {any} */ payload) => {
        sent.push(payload)
        return undefined
    })
    send.reply = /** @type {any} */ (async () => undefined)

    try {
        const command = new phisong()
        assert.equal(await command.search(event('/phi search bpm 200')), true)

        assert.equal(renders.length, 1)
        const data = renders[0][1]
        assert.equal(renders[0][0].msg, '/phi search bpm 200')
        assert.equal(data.pageTitle, '曲目检索')
        assert.equal(data.pageDescription, '当前筛选：BPM 200')
        assert.equal(data.theme, 'star')
        assert.equal(data.background, 'background.png')
        assert.match(data.notice, /共找到 3 首曲目，仅展示前 2 首/)
        assert.equal(data.footer, '共 3 首曲目')
        assert.equal(data.rows.length, 2)
        assert.deepEqual(data.columns.map((/** @type {any} */ column) => column.title), ['曲目', 'BPM', 'EZ', 'HD', 'IN', 'AT'])
        assert.equal(data.columns[1].highlight, true)
        assert.equal(data.rows[0][1].text, '200')
        assert.equal(data.rows[0][4].text, '15.4 · 1100')
        assert.equal(data.rows[0][4].highlight, undefined)
        assert.equal(sent.length, 1)
        assert.equal(sent[0], 'table-image')
    } finally {
        getBanGroup.get = originals.getBan
        getInfo.all_info = originals.allInfo
        getInfo.getill = originals.getill
        getNotes.getNotesData = originals.getNotes
        picmodle.tableImage = originals.tableImage
        Config.getUserCfg = originals.getUserCfg
        send.send_with_At = originals.sendWithAt
        send.reply = originals.reply
    }
})

test('song 图鉴把谱面按钮随曲目图一起发出', async () => {
    const originals = {
        getBan: getBanGroup.get,
        fuzzysongsnick: getInfo.fuzzysongsnick,
        info: getInfo.info,
        common: picmodle.common,
        getUserCfg: Config.getUserCfg,
        sendWithAt: send.send_with_At,
        reply: send.reply,
    }
    /** @type {any[]} */
    const sent = []
    getBanGroup.get = async () => false
    getInfo.fuzzysongsnick = /** @type {any} */ (() => ['Credits.Frums.0'])
    getInfo.info = /** @type {any} */ ((/** @type {string} */ id) => ({
        id,
        song: 'Credits',
        chart: { EZ: { difficulty: 2 }, HD: { difficulty: 8 }, IN: { difficulty: 13 }, AT: { difficulty: 15 } },
    }))
    picmodle.common = /** @type {any} */ (async () => 'atlas-image')
    Config.getUserCfg = /** @type {any} */ ((/** @type {string} */ name, /** @type {string} */ key) => {
        if (key === 'LetterMarkdown') return 'button'
        if (key === 'allowComment') return false
        return /** @type {any} */ (originals.getUserCfg).call(Config, name, key)
    })
    send.send_with_At = /** @type {any} */ (async (/** @type {any} */ _e, /** @type {any} */ payload) => {
        sent.push(payload)
        return undefined
    })
    send.reply = /** @type {any} */ (async () => undefined)

    try {
        const command = new phisong()
        const e = { ...event('/phi song Credits'), bot: { adapter: { name: 'QQBot' } } }
        assert.equal(await command.song(e), true)

        const items = Array.isArray(sent[0]) ? sent[0] : [sent[0]]
        const button = items.find((/** @type {any} */ item) => item?.type === 'button')
        assert.ok(button)
        // icqq 的 button 段只保留首行（content），TRSS 用 data 承载全部行，这里断言首行以兼容两者。
        const firstRow = (button.data ?? button.rows ?? [button.content])[0]
        assert.deepEqual(firstRow.map((/** @type {any} */ item) => item.text ?? item.label), ['AT', 'IN'])
        assert.equal(firstRow[0].input ?? firstRow[0].command, '/p chart Credits.Frums.0 AT')
    } finally {
        getBanGroup.get = originals.getBan
        getInfo.fuzzysongsnick = originals.fuzzysongsnick
        getInfo.info = originals.info
        picmodle.common = originals.common
        Config.getUserCfg = originals.getUserCfg
        send.send_with_At = originals.sendWithAt
        send.reply = originals.reply
    }
})

test('song 图鉴的谱面按钮按 AT/IN、HD/EZ 两行排列，缺失难度自动跳过', () => {
    /**
     * @param {string} id
     * @param {string[]} ranks
     * @returns {any}
     */
    const chart = (id, ranks) => ({ id, ranks })
    const full = phisongMessages.song.image('atlas-image', chart('Credits.Frums.0', ['EZ', 'HD', 'IN', 'AT']))
    assert.deepEqual(
        (full.button || []).map(row => row.map(item => [item.label, item.command])),
        [
            [['AT', '/p chart Credits.Frums.0 AT'], ['IN', '/p chart Credits.Frums.0 IN']],
            [['HD', '/p chart Credits.Frums.0 HD'], ['EZ', '/p chart Credits.Frums.0 EZ']],
        ],
    )
    assert.equal(full.image, 'atlas-image')

    const noAt = phisongMessages.song.image('atlas-image', chart('Glaciaxion.SunsetRay.0', ['EZ', 'HD', 'IN']))
    assert.deepEqual(
        (noAt.button || []).map(row => row.map(item => item.label)),
        [['IN'], ['HD', 'EZ']],
    )

    const onlyIn = phisongMessages.song.image('atlas-image', chart('SpSong.0', ['IN']))
    assert.deepEqual((onlyIn.button || []).map(row => row.map(item => item.label)), [['IN']])

    // 没有曲目信息时不附加按钮
    assert.equal(phisongMessages.song.image('atlas-image').button, undefined)
})

test('search 无筛选时展示全部曲目摘要，未命中时给出空状态文案', async () => {
    const originals = {
        getBan: getBanGroup.get,
        allInfo: getInfo.all_info,
        getill: getInfo.getill,
        getNotes: getNotes.getNotesData,
        tableImage: picmodle.tableImage,
        sendWithAt: send.send_with_At,
        reply: send.reply,
    }
    /** @type {any[][]} */
    const renders = []

    getBanGroup.get = async () => false
    getInfo.all_info = () => songs(1)
    getInfo.getill = () => 'background.png'
    getNotes.getNotesData = /** @type {any} */ (async () => ({ theme: 'default' }))
    picmodle.tableImage = /** @type {any} */ (async (/** @type {any[]} */ ...args) => {
        renders.push(args)
        return 'table-image'
    })
    send.send_with_At = /** @type {any} */ (async () => undefined)
    send.reply = /** @type {any} */ (async () => undefined)

    try {
        const command = new phisong()
        assert.equal(await command.search(event('/phi search bpm 9999')), true)
        const data = renders[0][1]
        assert.equal(data.pageDescription, '当前筛选：BPM 9999')
        assert.equal(data.rows.length, 0)
        assert.equal(data.emptyText, '未找到符合条件的曲目QAQ')
        assert.equal(data.notice, '')
        assert.equal(data.footer, '')

        assert.equal(await command.search(event('/phi search')), true)
        assert.equal(renders[1][1].pageDescription, '当前筛选：无（全部曲目）')
        assert.equal(renders[1][1].rows.length, 1)
    } finally {
        getBanGroup.get = originals.getBan
        getInfo.all_info = originals.allInfo
        getInfo.getill = originals.getill
        getNotes.getNotesData = originals.getNotes
        picmodle.tableImage = originals.tableImage
        send.send_with_At = originals.sendWithAt
        send.reply = originals.reply
    }
})
