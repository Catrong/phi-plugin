import assert from 'node:assert/strict'
import test from 'node:test'
import template from 'art-template'
import { fileURLToPath } from 'node:url'
import Config from '../components/Config.js'
import send from '../model/render/send.js'
import picmodle from '../model/render/picmodle.js'
import { isUsableImage } from '../model/game/grks/renderResult.js'
import { grksSoloRender } from '../apps/grks/soloRender.js'
import { grksClass } from '../apps/grks/grks.js'
import { grksMessages, grksSoloMessages, grksMatchMessages, menus } from '../model/render/messages.js'
import { buildQuickCommandKeyboard, sendMessage } from '../model/render/message.js'

/** @typedef {import('../model/game/LevelRecordInfo.js').default} LevelRecordInfo */
/** @typedef {import('../apps/grks/grks.js').grksKnownData} grksKnownData */

/**
 * 构造一条 B30 成绩。
 * @param {number} index
 * @returns {LevelRecordInfo}
 */
function record(index) {
    return /** @type {LevelRecordInfo} */ ({
        fc: false,
        score: 995000,
        acc: 99.1,
        id: `song.${index}`,
        rank: 'IN',
        Rating: 'V',
        rks: 15.6 - index * 0.01,
        difficulty: 15,
        song: `Song ${index}`,
        illustration: `ill-${index}.png`,
    })
}

/**
 * 构造 30 条成绩（P3 + B27）。
 * @returns {LevelRecordInfo[]}
 */
function makeRecords() {
    return Array.from({ length: 30 }, (_, index) => record(index))
}

test('recognizes rendered images from every platform shape', () => {
    // Yunzai 的 CQ 码字符串、Koishi 的元素对象、长图分段数组都算渲染成功
    assert.equal(isUsableImage('[CQ:image,file=base64://abc]'), true)
    assert.equal(isUsableImage({ type: 'image', data: 'x' }), true)
    assert.equal(isUsableImage([{ type: 'image' }, '[CQ:image,file=x]']), true)
    // 渲染器失败时返回错误文案字符串，或调用方 catch 后保持 null
    assert.equal(isUsableImage('渲染失败QAQ！\nError: boom'), false)
    assert.equal(isUsableImage('图片生成请求较多，请稍后重试QAQ！'), false)
    assert.equal(isUsableImage(null), false)
    assert.equal(isUsableImage(undefined), false)
    assert.equal(isUsableImage([]), false)
    assert.equal(isUsableImage([null]), false)
})

test('builds the view from known data', () => {
    /** @type {grksKnownData} */
    const partial = {
        records: makeRecords().slice(0, 5),
        info: null,
        sheet: { range: null, histogram: null },
    }
    const hidden = grksSoloRender.buildView({ data: partial, orderKnown: false, footnote: '状态' })
    assert.equal(hidden.stats.revealed, false)
    assert.equal(hidden.sheet.kind, 'hidden')
    assert.equal(hidden.records.length, 5)
    assert.equal(hidden.records[0].revealed, true)
    assert.equal(hidden.records[0].slot, '')
    // 位置未知时按单曲 rks 降序
    assert.ok(hidden.records[0].record && hidden.records[1].record)
    assert.ok(Number(hidden.records[0].rksText) >= Number(hidden.records[1].rksText))
    assert.equal(hidden.header.challenge, null)

    /** @type {grksKnownData} */
    const full = {
        records: makeRecords(),
        info: {
            stats: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
            challenge: 234,
            updateAt: Date.now(),
        },
        sheet: { range: null, histogram: makeRecords().map(item => item.rks) },
    }
    const known = grksSoloRender.buildView({ data: full, orderKnown: true })
    assert.equal(known.stats.revealed, true)
    assert.equal(known.stats.rows.length, 4)
    assert.equal(known.records.length, 30)
    assert.equal(known.records[0].slot, 'P1')
    assert.equal(known.records[3].slot, 'B1')
    assert.equal(known.sheet.kind, 'histogram')
    assert.equal(known.sheet.bars.length, 30)
    assert.deepEqual(known.sheet.bars.map(bar => bar.label), [
        'P1', 'P2', 'P3',
        'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9',
        'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19',
        'B20', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27',
    ])
    assert.deepEqual(known.header.challenge, { colorIndex: 2, score: 34 })
    assert.equal(known.header.rks, '----')
})

test('shows the answer rks, update time and slots on the settlement view', () => {
    const updateAt = new Date(2026, 0, 2, 3, 4).getTime()
    /** @type {grksKnownData} */
    const data = {
        records: makeRecords(),
        info: {
            stats: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
            challenge: 234,
            updateAt,
        },
        sheet: { range: [15.5, 14.2], histogram: null },
    }
    const view = grksSoloRender.buildView({
        data,
        orderKnown: false,
        answerRks: 15.4,
        revealAll: true,
        footnote: '本局已结算',
    })
    assert.equal(view.header.rks, '15.4000')
    assert.equal(view.header.date, '2026-01-02 03:04')
    assert.equal(view.records.length, 30)
    assert.equal(view.records[0].slot, 'P1')
    assert.equal(view.records[29].slot, 'B27')
    assert.equal(view.stats.revealed, true)
    assert.deepEqual(view.header.challenge, { colorIndex: 2, score: 34 })
    assert.equal(view.sheet.kind, 'range')
})

test('仅在课题分与统计信息公开后展示玩家时间', () => {
    const game = new grksClass({
        rks: 15.4, record: makeRecords(), stats: [], challenge: 0, updateAt: Date.now(),
    })
    const templatePath = fileURLToPath(new URL('../resources/html/grks/grks.art', import.meta.url))
    for (const revealed of [false, true]) {
        if (revealed) game.userHint({ type: 'info' })
        const view = grksSoloRender.buildView({ data: game.getKnownData(), orderKnown: false })
        const html = template(templatePath, {
            ...view,
            defaultLayout: fileURLToPath(new URL('../resources/html/common/layout/default.art', import.meta.url)),
            _res_path: '/resources/', _plugin: 'phi-plugin', Version: { ver: 'test' }, sys: { scale: '' },
            renderNoJs: true, themeInfo: null,
        })
        assert.equal(html.includes('class="date"'), revealed)
        assert.equal(html.includes('class="clgBox"'), revealed)
        if (revealed) assert.ok(html.includes(`<p>${view.header.date}</p>`))
    }
})

test('提示方视角保留完整 B30，未向对手公开的部分盖遮罩并给出提示指令', () => {
    /** @type {LevelRecordInfo[]} */
    const records = makeRecords()
    /** @type {grksKnownData} */
    const data = {
        records,
        info: { stats: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]], challenge: 234, updateAt: Date.now() },
        sheet: { range: [records[3].rks, records[29].rks], histogram: records.map(item => item.rks) },
    }
    const view = grksSoloRender.buildGiverView({
        data,
        known: { records: records.map((_, index) => index === 0 || index === 9), info: false, sheetKind: '' },
        prefix: '#phi grks',
        playerId: '红方 · 提示者视角',
        answerRks: 15.4,
        history: [{ turn: 1, hint: '公开随机成绩 1 条', guess: 1.2345, result: 'wrong' }],
    })
    assert.equal(view.giver, true)
    assert.equal(view.header.playerId, '红方 · 提示者视角')
    assert.equal(view.header.rks, '15.4000')
    assert.equal(view.header.challengeMasked, true)
    assert.equal(view.records.length, 30)
    assert.equal(view.records[0].masked, false)
    assert.equal(view.records[0].slot, 'P1')
    assert.equal(view.records[9].masked, false)
    assert.equal(view.records[1].masked, true)
    assert.equal(view.records[1].command, '#phi grks hint P2')
    assert.equal(view.records[1].rksText, records[1].rks.toFixed(2))
    assert.equal(view.stats.masked, true)
    assert.equal(view.stats.revealed, true)
    assert.equal(view.sheet.kind, 'histogram')
    assert.equal(view.sheet.masked, true)
    assert.equal(view.history[0].answerLabel, '对手答 1.2345')
    assert.equal(view.history[0].hintLabel, '已给提示：公开随机成绩 1 条')
    assert.equal(view.historyTitle, '对手猜测记录')

    const templatePath = fileURLToPath(new URL('../resources/html/grks/grks.art', import.meta.url))
    const render = () => template(templatePath, {
        ...view,
        defaultLayout: fileURLToPath(new URL('../resources/html/common/layout/default.art', import.meta.url)),
        _res_path: '/resources/', _plugin: 'phi-plugin', Version: { ver: 'test' }, sys: { scale: '' },
        renderNoJs: true, themeInfo: null,
    })
    const html = render()
    /** 28 个未公开槽位 + 统计与课题分 + 直方图各一处遮罩 */
    assert.equal((html.match(/class="grks-giver-label"/g) || []).length, 30)
    assert.ok(html.includes('未向对手公开 · P2'))
    assert.ok(html.includes('#phi grks hint P2'))
    assert.ok(html.includes('统计与课题分尚未向对手公开'))
    assert.ok(html.includes('直方图尚未向对手公开'))
    assert.ok(html.includes('对手猜测记录'))
    assert.ok(html.includes('对手答 1.2345'))
    assert.ok(!html.includes('成绩未公开'))

    const revealed = grksSoloRender.buildGiverView({
        data,
        known: { records: records.map(() => true), info: true, sheetKind: 'histogram' },
        prefix: '#phi grks',
    })
    assert.equal(revealed.records.every(slot => !slot.masked), true)
    assert.equal(revealed.stats.masked, false)
    assert.equal(revealed.sheet.masked, false)
    const revealedHtml = template(templatePath, {
        ...revealed,
        defaultLayout: fileURLToPath(new URL('../resources/html/common/layout/default.art', import.meta.url)),
        _res_path: '/resources/', _plugin: 'phi-plugin', Version: { ver: 'test' }, sys: { scale: '' },
        renderNoJs: true, themeInfo: null,
    })
    assert.ok(!revealedHtml.includes('grks-giver-label'))
    assert.ok(!revealedHtml.includes('未向对手公开'))
})

test('最终消息叶子只带图片与按钮，渲染结果原样交给发送层', async t => {
    const data = { records: makeRecords().slice(0, 5), info: null, sheet: { range: /** @type {[number, number]} */ ([15.5, 14.2]), histogram: null } }
    const options = { data, orderKnown: false, hintCount: 1, prefix: '#phi grks' }
    const event = /** @type {import('../components/baseClass.js').botEvent} */ ({ user_id: 'leaf-render' })
    let image = /** @type {unknown} */ ({ type: 'image', data: 'ok' })
    t.mock.method(picmodle, 'grks', async () => image)
    const sender = t.mock.method(send, 'send_with_At', async () => true)
    const success = await grksSoloMessages.start.opened(event, options, { cd: 5, limit: 10 })
    assert.deepEqual(success.image, image)
    assert.match(String(success.text), /^猜 RKS 开始/)
    assert.deepEqual(success.button, menus.grksSolo())
    assert.equal(sender.mock.callCount(), 0)
    /** 渲染器返回错误文案时也原样透传，不再拼接文字详情 */
    image = '渲染失败QAQ！\nError: boom'
    const failed = await grksSoloMessages.start.opened(event, options, { cd: 5, limit: 10 })
    assert.equal(failed.image, image)
    assert.deepEqual(failed.button, success.button)
    assert.equal(failed.text, success.text)
    assert.equal(sender.mock.callCount(), 0)
    /** 渲染异常直接抛出，不再兜底成文字 */
    const error = new Error('渲染异常')
    t.mock.method(picmodle, 'grks', async () => { throw error })
    await assert.rejects(grksSoloMessages.start.opened(event, options, { cd: 5, limit: 10 }), error)
})

test('完整消息直接发送时保留失败返回值与异常', async t => {
    const event = /** @type {import('../components/baseClass.js').botEvent} */ ({ user_id: 'send-failure' })
    const message = grksSoloMessages.guess.cooldown(5)
    t.mock.method(send, 'send_with_At', async () => false)
    assert.equal(await sendMessage(event, message, { at: true }), false)
    const failure = { error: [new Error('发送失败')] }
    t.mock.method(send, 'send_with_At', async () => failure)
    assert.equal(await sendMessage(event, message, { at: true }), failure)
    const error = new Error('发送异常')
    t.mock.method(send, 'send_with_At', async () => { throw error })
    await assert.rejects(sendMessage(event, message, { at: true }), error)
})

test('普通消息叶子自行提供按钮，直接发送并遵循快捷操作配置', async t => {
    const originalConfig = Config.getUserCfg.bind(Config)
    let shortcut = 'markdown'
    t.mock.method(Config, 'getUserCfg', (/** @type {'config'} */ name, /** @type {configName} */ key) => {
        if (key === 'cmdhead') return 'test'
        if (key === 'LetterMarkdown') return shortcut
        return originalConfig(name, key)
    })
    const event = /** @type {import('../components/baseClass.js').botEvent} */ ({ user_id: 'buttons', bot: { adapter: 'qqbot' } })
    /** @type {Record<string, unknown>[]} */
    const sent = []
    t.mock.method(send, 'send_with_At', async (
        /** @type {import('../components/baseClass.js').botEvent} */ _event,
        /** @type {unknown} */ _content,
        /** @type {boolean} */ _quote,
        /** @type {Record<string, unknown>} */ data,
    ) => { sent.push(data); return true })
    const home = grksMatchMessages.cancel.leftQueue()
    const solo = grksSoloMessages.guess.cooldown(5)
    const queue = grksMatchMessages.join.joined(1, { timeout: 240 }, '#test grks')
    assert.deepEqual(home.button, menus.grksHome())
    assert.deepEqual(solo.button, menus.grksSolo())
    assert.deepEqual(queue.button, menus.grksQueue())
    for (const message of [home, solo, queue]) await sendMessage(event, message, { at: true })
    assert.deepEqual(sent[0].keyboard, buildQuickCommandKeyboard(menus.grksHome()))
    assert.deepEqual(sent[1].keyboard, buildQuickCommandKeyboard(menus.grksSolo()))
    assert.deepEqual(sent[2].keyboard, buildQuickCommandKeyboard(menus.grksQueue()))
    for (const command of ['grks', 'grks match', 'grks lb', 'ltr', 'guess', 'tipgame', 'friberg']) {
        assert.ok(menus.grksHome().flat().some(button => button.command === `/test ${command}`))
    }
    shortcut = 'off'
    await sendMessage(event, grksMatchMessages.cancel.leftQueue(), { at: true })
    assert.equal(sent[3].keyboard, undefined)
})

test('所有普通消息分支直接产出文本与按钮，无需后续补齐', () => {
    /** @type {import('../model/render/messages.js').grksMatchMenuOptions} */
    const state = {
        stage: 'hint', settled: false, hinted: false, guessed: false,
        knownRecords: Array(30).fill(false), knownInfo: false, knownSheetType: '',
    }
    const messages = [
        grksMessages.rankList.unavailable('积分榜'), grksMessages.start.matching('#phi grks'),
        grksMessages.hint.format('#phi grks', state), grksMessages.guess.format('#phi grks', state),
        grksSoloMessages.start.banned(), grksSoloMessages.start.existing('#phi grks'),
        grksSoloMessages.start.noArchive(27), grksSoloMessages.start.drawFailed(),
        grksSoloMessages.guess.notRunning('#phi grks'), grksSoloMessages.guess.invalidValue('#phi grks'),
        grksSoloMessages.guess.cooldown(5), grksMatchMessages.join.incomplete(27),
        grksMatchMessages.join.alreadyInMatch('#phi grks', 'queue'), grksMatchMessages.join.noSession(),
        grksMatchMessages.join.soloGame('#phi grks'), grksMatchMessages.join.joined(1, { timeout: 240 }, '#phi grks'),
        grksMatchMessages.join.timedOut(240),
        grksMatchMessages.hint.wrongStage(state), grksMatchMessages.hint.invalidHint(state),
        grksMatchMessages.hint.noMatch('#phi grks'), grksMatchMessages.hint.alreadyHinted(state),
        grksMatchMessages.guess.wrongStage(state), grksMatchMessages.guess.staleTurn(state),
        grksMatchMessages.guess.ended(), grksMatchMessages.guess.invalidValue('#phi grks', state),
        grksMatchMessages.guess.alreadyGuessed(state), grksMatchMessages.cancel.leftQueue(),
    ]
    for (const message of messages) {
        assert.ok(message.text.length > 0)
        assert.ok(message.button.length > 0)
    }
})

test('单机开局、猜错和每类结算消息均直接包含图片与按钮', async t => {
    const data = { records: [], info: null, sheet: { range: null, histogram: null } }
    const options = { data, orderKnown: false, hintCount: 1, prefix: '#phi grks', answerRks: 15.4 }
    const event = /** @type {import('../components/baseClass.js').botEvent} */ ({ user_id: 'solo-leaves' })
    let image = true
    t.mock.method(picmodle, 'grks', async () => image ? { type: 'image', data: 'test' } : false)
    const factories = [
        () => grksSoloMessages.start.opened(event, options, { cd: 5, limit: 10 }),
        () => grksSoloMessages.guess.wrong(event, options, { hintGiven: true, hintWait: 0, cd: 5 }),
        () => grksSoloMessages.reveal.correct(event, { ...options, revealAll: true }, {
            rks: '15.4000', guess: '15.4', tolerance: 0.1, points: '10', hints: 1,
        }),
        () => grksSoloMessages.reveal.failed(event, { ...options, revealAll: true }, 10),
        () => grksSoloMessages.reveal.timeout(event, { ...options, revealAll: true }, 600),
        () => grksSoloMessages.reveal.abandoned(event, { ...options, revealAll: true }),
    ]
    for (const [index, factory] of factories.entries()) {
        image = true
        const success = await factory()
        assert.ok(success.image)
        assert.deepEqual(success.button, index < 2 ? menus.grksSolo() : menus.grksHome())
        /** 渲染结果无论是否可用都原样交给发送层，叶子不再改写文字 */
        image = false
        const failed = await factory()
        assert.equal(failed.image, false)
        assert.deepEqual(failed.button, success.button)
        assert.equal(failed.text, success.text)
    }
})

test('匹配视图叶子组装完整阶段消息与按钮，状态文案仅出现一次', async t => {
    const options = { data: { records: [], info: null, sheet: { range: null, histogram: null } }, orderKnown: true, hintCount: 1, prefix: '#phi grks', exitCommand: /** @type {'cancel'} */ ('cancel') }
    const event = /** @type {import('../components/baseClass.js').botEvent} */ ({ user_id: 'match-leaf' })
    let image = true
    t.mock.method(picmodle, 'grks', async () => image ? { type: 'image', data: 'test' } : false)
    /** @type {import('../model/render/messages.js').grksMatchMenuOptions} */
    const state = { stage: 'hint', settled: false, hinted: false, guessed: false, knownRecords: Array(30).fill(false), knownInfo: false, knownSheetType: '' }
    for (const stage of /** @type {const} */ (['hint', 'answer', 'settled'])) {
        state.stage = stage === 'answer' ? 'answer' : 'hint'
        state.settled = stage === 'settled'
        /** @type {import('../model/render/messages.js').grksMatchViewOptions} */
        const status = {
            id: 'test-room', team: 'red', opponent: '对手', turn: 1, maxTurns: 10,
            stage: state.stage, settled: state.settled, notice: '阶段通知', hinted: false, guessed: false,
            opponentHinted: false, opponentGuessed: false, error: false,
            result: state.settled ? ['本局结束'] : [], prefix: '#phi grks', seconds: 90, tolerance: 0.1,
        }
        image = true
        const success = await grksMatchMessages.view(event, options, status, state)
        assert.ok(success.image)
        assert.deepEqual(success.button, menus.grksMatch(state))
        /** 阶段文案只出现在消息文本里，不再拼一段文字详情 */
        assert.equal(String(success.text).split('房间 test-room').length - 1, 1)
        assert.match(String(success.text), /退出判负：#phi grks cancel/)
        assert.ok(!String(success.text).includes('#phi grks ans'))
    }
})

test('图表隐藏、区间和直方图均保留十次记录，模板转义提示内容', () => {
    const game = new grksClass({
        rks: 15.4, record: makeRecords(), stats: [], challenge: 0, updateAt: Date.now(),
    })
    game.recordHint('<script>test</script>')
    game.recordGuess(1.2345, 'wrong')
    game.userHint({ type: 'info' })
    const templatePath = fileURLToPath(new URL('../resources/html/grks/grks.art', import.meta.url))
    for (const sheet of [
        { range: null, histogram: null },
        { range: /** @type {[number, number]} */ ([15.8, 15.1]), histogram: null },
        { range: null, histogram: makeRecords().map(item => item.rks) },
    ]) {
        const data = { ...game.getKnownData(), sheet }
        const view = grksSoloRender.buildView({ data, orderKnown: false, history: game.history })
        assert.equal(view.history.length, 10)
        assert.equal(view.history[0].answer, '1.2345')
        assert.equal(view.history[0].resultText, '错误')
        assert.equal(view.history[1].resultText, '待回答')
        assert.equal(view.history[9].result, 'empty')
        assert.equal(view.answeredCount, 1)
        const html = template(templatePath, {
            ...view,
            defaultLayout: fileURLToPath(new URL('../resources/html/common/layout/default.art', import.meta.url)),
            _res_path: '/resources/', _plugin: 'phi-plugin', Version: { ver: 'test' }, sys: { scale: '' },
            renderNoJs: true, themeInfo: null,
        })
        assert.equal((html.match(/class="grks-history-cell /g) || []).length, 10)
        assert.ok(html.includes('&#60;script&#62;test&#60;/script&#62;'))
        assert.ok(!html.includes('<script>test</script>'))
        assert.equal(html.includes('class="histogram-bar '), view.sheet.kind === 'histogram')
        const tickLabels = [...html.matchAll(/class="histogram-grid-line"[^>]*>([\s\S]*?)<\/div>/g)]
        assert.equal(tickLabels.length, view.sheet.kind === 'hidden' ? 0 : 5)
        if (view.sheet.kind === 'histogram') {
            assert.ok(tickLabels.every(match => match[1].trim() === ''))
            assert.ok(!html.includes('平均 RKS'))
        } else if (view.sheet.kind === 'range') {
            assert.ok(tickLabels.every(match => /<p>[\d.]+<\/p>/.test(match[1])))
        }
    }
})
