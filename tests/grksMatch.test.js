import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { EventEmitter, once } from 'node:events'
import { grksMatchClass, selectPair, GRKS_MATCH_QUEUE_RULES } from '../apps/grks/match.js'
import { grksSoloClass } from '../apps/grks/solo.js'
import { phiGrks } from '../apps/grks.js'
import Config from '../components/Config.js'
import { getPlatformAdapter } from '../components/platform/index.js'
import send from '../model/render/send.js'
import picmodle from '../model/render/picmodle.js'
import fCompute from '../model/game/fCompute.js'
import getInfo from '../model/game/getInfo.js'
import { addScore, getPlayer, getStoreFile, setStoreFile } from '../model/game/gameScore/index.js'
import { shortcutCommands } from '../components/platform/koishiCommandNames.js'
import { menus } from '../model/render/messages.js'
import { buildQuickCommandKeyboard } from '../model/render/message.js'

test.before(async () => await getInfo.loadAvatar())

/** @import {botEvent} from '../components/baseClass.js' */
/** @import {PlatformMessageInput} from '../components/platform/types.js' */
/** @import {grksMatchConfig, grksMatchRoom} from '../apps/grks/match.js' */
/** @typedef {import('../model/game/LevelRecordInfo.js').default} LevelRecordInfo */

/**
 * @typedef {object} grksTestMessage
 * @property {botEvent} event 收到消息的会话
 * @property {PlatformMessageInput} content 消息内容
 */

/** @param {string} id @param {string} [group] @returns {botEvent} */
function event(id, group = `group-${id}`) {
    return {
        user_id: id, group_id: group, self_id: 'review-bot', platform: 'qq',
        isGroup: true, isPrivate: false, msg: '',
    }
}

/** @param {string} userId @returns {LevelRecordInfo[]} */
function records(userId) {
    return Array.from({ length: 27 }, (_, index) => ({
        id: /** @type {idString} */ (`${userId}-${index}.0`),
        song: /** @type {songString} */ (`Song ${userId}${index}`),
        illustration: 'test.png',
        rank: /** @type {levelKind} */ ('IN'),
        difficulty: 16,
        rks: 15.8 - index * 0.01 + (userId === 'b' ? 0.1 : 0),
        score: index < 3 ? 1000000 : 995000,
        acc: index < 3 ? 100 : 99.1,
        fc: index < 3,
        Rating: /** @type {ratingKind} */ (index < 3 ? 'phi' : 'V'),
    }))
}

/** @param {import('node:test').TestContext} t */
function fixture(t) {
    const solo = new grksSoloClass()
    const matches = new grksMatchClass(solo)
    /** @type {grksMatchConfig} */
    const config = { maxScore: 10, minRecord: 27, tolerance: 0.01, turnTime: 90 }
    t.mock.method(matches, 'readConfig', () => config)
    t.mock.method(solo, 'banCheck', async () => false)
    t.mock.method(solo, 'cmdPrefix', () => '#phi grks')
    t.mock.method(send, 'getsave_result', async (/** @type {botEvent} */ e) => ({
        getRecord: () => records(String(e.user_id)),
        getStats: () => [{ cleared: 27, fc: 3, phi: 3 }],
        saveInfo: { PlayerId: `Phigros ${e.user_id}`, summary: { challengeModeRank: 456, avatar: 'Glaciaxion' }, modifiedAt: { iso: new Date('2026-10-24T00:00:00Z') } },
    }))
    /** @type {import('../apps/grks/soloRender.js').grksSoloView[]} */
    const views = []
    t.mock.method(picmodle, 'grks', async (/** @type {botEvent} */ _event, /** @type {import('../apps/grks/soloRender.js').grksSoloView} */ view) => {
        views.push(view)
        return false
    })
    t.mock.method(fCompute, 'randBackground', () => 'test-background')
    /** @type {grksTestMessage[]} */
    const sent = []
    t.mock.method(send, 'send_with_At', async (/** @type {botEvent} */ e, /** @type {PlatformMessageInput} */ content) => {
        sent.push({ event: e, content })
        return true
    })
    const adapter = getPlatformAdapter()
    const originalSender = adapter.sendToChat
    const proactive = t.mock.fn(() => { throw new Error('匹配必须使用保存的会话回复') })
    adapter.sendToChat = proactive
    const originalStore = getStoreFile()
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phi-grks-stage-notify-'))
    setStoreFile(path.join(directory, 'scores.json'))
    t.after(() => {
        matches.reset()
        adapter.sendToChat = originalSender
        setStoreFile(originalStore)
        assert.equal(path.dirname(directory), path.resolve(os.tmpdir()))
        fs.rmSync(directory, { recursive: true, force: true })
        assert.equal(proactive.mock.callCount(), 0)
    })
    return { solo, matches, config, sent, views, a: event('a'), b: event('b') }
}

/** @param {ReturnType<typeof fixture>} setup */
async function openRoom(setup) {
    assert.equal(await setup.matches.join(setup.a), true)
    assert.equal(await setup.matches.join(setup.b), true)
    const found = setup.matches.findPlayer(setup.a)
    assert.ok(found)
    assert.equal(found.room.phase, 'playing')
    return found.room
}

/** @param {ReturnType<typeof fixture>} setup */
async function queuedEntries(setup) {
    setup.matches.scanning = true
    await setup.matches.join(setup.a)
    await setup.matches.join(setup.b)
    setup.matches.scanning = false
    return [...setup.matches.queue.values()]
}

/** @param {ReturnType<typeof fixture>} setup @param {grksMatchRoom} room */
async function timeout(setup, room) {
    await setup.matches.runRoom(room, async () => {
        await setup.matches.onTimeout(room)
        return { ok: true }
    })
}

/** @param {ReturnType<typeof fixture>} setup @param {string} [redSlot] @param {string} [blueSlot] */
async function enterAnswer(setup, redSlot = 'P1', blueSlot = 'P1') {
    assert.equal(await setup.matches.hint(setup.a, '1', redSlot), true)
    assert.equal(await setup.matches.hint(setup.b, '1', blueSlot), true)
}

/** @param {ReturnType<typeof fixture>} setup */
async function enterLastAnswer(setup) {
    for (let turn = 1; turn <= 10; turn++) {
        await enterAnswer(setup, `B${turn}`, `B${turn}`)
        if (turn === 10) return
        await setup.matches.guess(setup.a, '1')
        await setup.matches.guess(setup.b, '1')
    }
}

test('匹配成功后向双方各发送一次开局消息，红蓝游戏状态独立', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    const opening = setup.sent.filter(item => String(item.content).includes('匹配成功，双方进入提示回合'))
    assert.equal(opening.length, 2)
    assert.deepEqual(new Set(opening.map(item => item.event.user_id)), new Set(['a', 'b']))
    assert.equal(room.sides.red.team, 'red')
    assert.equal(room.sides.blue.team, 'blue')
    assert.notEqual(room.sides.red.game, room.sides.blue.game)
    assert.notEqual(room.sides.red.game.knownRecords, room.sides.blue.game.knownRecords)
})

test('匹配结算为双方保存 Phigros 名称与头像，不使用聊天身份', async t => {
    const setup = fixture(t)
    setup.a.sender = { user_name: '红方用户名', nickname: '红方昵称', card: '红方群名片' }
    setup.a.member = { getAvatarUrl: () => 'https://example.com/red.png' }
    setup.b.sender = { nickname: '蓝方昵称', card: '蓝方群名片' }
    setup.b.member = { getAvatarUrl: () => 'https://example.com/blue.png' }
    const room = await openRoom(setup)
    assert.equal(room.sides.red.nickname, 'Phigros a')
    assert.equal(room.sides.blue.nickname, 'Phigros b')
    await setup.matches.cancel(setup.a)
    assert.deepEqual(getPlayer('grks', 'match', 'a')?.profile, { source: 'phigros', name: 'Phigros a', avatar: 'Glaciaxion' })
    assert.deepEqual(getPlayer('grks', 'match', 'b')?.profile, { source: 'phigros', name: 'Phigros b', avatar: 'Glaciaxion' })
})

test('匹配按钮按自身提示状态和回合切换，重复操作与终局回复使用当前可用指令', async t => {
    const setup = fixture(t)
    setup.a.bot = { adapter: 'qqbot' }
    setup.b.bot = { adapter: 'qqbot' }
    const originalConfig = Config.getUserCfg.bind(Config)
    t.mock.method(Config, 'getUserCfg', (/** @type {'config'} */ name, /** @type {configName} */ key) => {
        if (key === 'cmdhead') return 'phi'
        if (key === 'LetterMarkdown') return 'markdown'
        return originalConfig(name, key)
    })
    /** @type {{id: string, keyboard: unknown}[]} */
    const keyboards = []
    t.mock.method(send, 'send_with_At', async (
        /** @type {botEvent} */ e, /** @type {PlatformMessageInput} */ content,
        /** @type {boolean} */ _quote, /** @type {Record<string, unknown>} */ data,
    ) => {
        setup.sent.push({ event: e, content })
        keyboards.push({ id: String(e.user_id), keyboard: data.keyboard })
        return true
    })
    const room = await openRoom(setup)
    assert.deepEqual(keyboards[0].keyboard, buildQuickCommandKeyboard(menus.grksQueue()))
    const opening = keyboards.at(-2)?.keyboard
    assert.deepEqual(opening, buildQuickCommandKeyboard(menus.grksMatch(setup.matches.menuState(room, room.sides.red))))
    assert.equal(await setup.matches.hint(setup.a, '3', 'histogram'), true)
    assert.equal(await setup.matches.hint(setup.a, '4'), false)
    assert.deepEqual(keyboards.at(-1)?.keyboard, buildQuickCommandKeyboard([[{ command: '/phi grks cancel', label: '退出匹配（判负）' }]]))
    assert.equal(await setup.matches.hint(setup.b, '4'), true)
    assert.deepEqual(keyboards.at(-1)?.keyboard, buildQuickCommandKeyboard([
        [{ command: '/phi grks 0', label: '猜测' }, { command: '/phi grks cancel', label: '退出匹配（判负）' }],
    ]))
    assert.equal(await setup.matches.guess(setup.a, '1'), true)
    assert.equal(await setup.matches.guess(setup.a, '2'), false)
    assert.deepEqual(keyboards.at(-1)?.keyboard, buildQuickCommandKeyboard([[{ command: '/phi grks cancel', label: '退出匹配（判负）' }]]))
    assert.equal(await setup.matches.guess(setup.b, '1'), true)
    const red = keyboards.at(-2)
    const blue = keyboards.at(-1)
    assert.equal(red?.id, 'a')
    assert.equal(blue?.id, 'b')
    assert.ok(!JSON.stringify(red?.keyboard).includes('grks hint 3'))
    assert.ok(JSON.stringify(red?.keyboard).includes('grks hint 4'))
    assert.ok(JSON.stringify(blue?.keyboard).includes('grks hint 3'))
    assert.ok(!JSON.stringify(blue?.keyboard).includes('grks hint 4'))
    await enterAnswer(setup, 'P1', 'B1')
    await setup.matches.guess(setup.a, '1')
    await setup.matches.guess(setup.b, '1')
    assert.ok(JSON.stringify(keyboards.at(-2)?.keyboard).includes('/phi grks hint P2'))
    assert.ok(!JSON.stringify(keyboards.at(-2)?.keyboard).includes('"data":"/phi grks hint P1"'))
    assert.ok(JSON.stringify(keyboards.at(-1)?.keyboard).includes('/phi grks hint B2'))
    await setup.matches.cancel(setup.a)
    assert.deepEqual(keyboards.at(-2)?.keyboard, buildQuickCommandKeyboard(menus.grksHome()))
    assert.deepEqual(keyboards.at(-1)?.keyboard, buildQuickCommandKeyboard(menus.grksHome()))
})

test('提示只暂存，双方选完后各通知一次，并使用最新提示会话', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    const redHint = event('a', 'red-hint-group')
    const blueHint = event('b', 'blue-hint-group')
    const before = setup.sent.length
    await setup.matches.hint(redHint, '1', 'B7')
    assert.equal(setup.sent.length, before)
    assert.equal(room.sides.red.game.hintCnt, 0)
    assert.equal(room.sides.red.game.knownRecords[9], false)
    await setup.matches.hint(blueHint, '1', 'B8')
    const messages = setup.sent.slice(before)
    assert.equal(messages.length, 2)
    assert.deepEqual(new Set(messages.map(item => item.event.group_id)), new Set(['red-hint-group', 'blue-hint-group']))
    assert.equal(room.sides.red.event, redHint)
    assert.equal(room.sides.blue.event, blueHint)
    assert.equal(room.stage, 'answer')
    assert.equal(room.sides.red.game.hintCnt, 1)
    assert.ok(messages.some(item => item.event.user_id === 'b' && String(item.content).includes('Song a6')))
    assert.ok(messages.some(item => item.event.user_id === 'a' && String(item.content).includes('Song b7')))
})

test('双方回答结束后各通知一次，下一轮使用本轮最新回答会话', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    await enterAnswer(setup)
    const redAnswer = event('a', 'red-answer-group')
    const blueAnswer = event('b', 'blue-answer-group')
    const before = setup.sent.length
    await setup.matches.guess(redAnswer, '1')
    assert.equal(setup.sent.length, before)
    assert.deepEqual(room.sides.blue.game.guessHistory, [])
    await setup.matches.guess(blueAnswer, '1')
    assert.equal(room.turn, 2)
    assert.equal(room.stage, 'hint')
    const messages = setup.sent.slice(before)
    assert.equal(messages.length, 2)
    assert.deepEqual(new Set(messages.map(item => item.event.group_id)), new Set(['red-answer-group', 'blue-answer-group']))
    assert.ok(messages.every(item => String(item.content).includes('第 1 轮双方均未猜中')))
    assert.equal(room.sides.red.event, redAnswer)
    assert.equal(room.sides.blue.event, blueAnswer)
    assert.deepEqual(room.sides.blue.game.guessHistory, [1])
})

test('正确答案也等待双方作答后才判定，并且只发送一次终局通知', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    await enterAnswer(setup)
    const before = setup.sent.length
    await setup.matches.guess(setup.a, String(room.sides.blue.answer.rks))
    assert.equal(room.phase, 'playing')
    assert.equal(getPlayer('grks', 'match', 'a'), null)
    assert.equal(setup.sent.length, before)
    await setup.matches.guess(setup.b, '1')
    assert.equal(room.phase, 'settled')
    assert.equal(getPlayer('grks', 'match', 'a')?.wins, 1)
    assert.equal(getPlayer('grks', 'match', 'b')?.losses, 1)
    assert.equal(getPlayer('grks', 'match', 'b')?.hintSum, 10)
    assert.equal(setup.sent.length - before, 2)
    assert.ok(setup.sent.slice(before).every(item => String(item.content).includes('匹配结束')))
    assert.equal(room.timer, null)
})

test('猜测记录按各自视角关联提示，单方提交时不提前公开回答', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    await setup.matches.hint(setup.a, '1', 'B1')
    assert.deepEqual(room.sides.red.game.history, [])
    await setup.matches.hint(setup.b, '1', 'B2')
    assert.equal(setup.views.at(-2)?.history[0].hint, '公开 B2')
    assert.equal(setup.views.at(-1)?.history[0].hint, '公开 B1')
    const before = setup.views.length
    await setup.matches.guess(setup.a, '1')
    assert.equal(setup.views.length, before)
    assert.equal(room.sides.blue.game.history[0].guess, null)
    assert.equal(room.sides.blue.game.history[0].result, 'pending')
    await setup.matches.guess(setup.b, '2')
    assert.equal(setup.views.at(-2)?.history[0].answer, '1')
    assert.equal(setup.views.at(-1)?.history[0].answer, '2')
    assert.equal(setup.views.at(-2)?.history[0].result, 'wrong')
    assert.equal(setup.views.at(-2)?.history[1].result, 'empty')
    await enterAnswer(setup, 'B3', 'B4')
    await setup.matches.guess(setup.a, String(room.sides.blue.answer.rks))
    await timeout(setup, room)
    assert.equal(setup.views.at(-2)?.history[1].result, 'correct')
    assert.equal(setup.views.at(-1)?.history[1].result, 'timeout')
    assert.equal(setup.views.at(-1)?.history[1].answer, '—')
    assert.equal(room.sides.blue.game.history.length, 2)
})

test('提示阶段不能回答，回答阶段不能给提示，无效操作不覆盖保存的会话', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    assert.equal(await setup.matches.guess(event('a', 'invalid-group'), '1'), false)
    assert.equal(room.sides.red.event, setup.a)
    await enterAnswer(setup)
    const current = room.sides.red.event
    assert.equal(await setup.matches.hint(event('a', 'invalid-group'), '1', 'B1'), false)
    assert.equal(room.sides.red.event, current)
    assert.equal(room.sides.red.guess, null)
})

test('重复选择和重复回答只报错，不重复公布或覆盖首次提交', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    assert.deepEqual(await Promise.all([
        setup.matches.hint(setup.a, '1', 'B1'), setup.matches.hint(setup.a, '1', 'B2'),
    ]), [true, false])
    assert.equal(room.sides.red.game.hintCnt, 0)
    await setup.matches.hint(setup.b, '1', 'B1')
    const before = setup.sent.length
    assert.deepEqual(await Promise.all([
        setup.matches.guess(setup.a, '1'), setup.matches.guess(setup.a, '2'),
    ]), [true, false])
    assert.equal(room.sides.red.guess, 1)
    assert.equal(setup.sent.length - before, 1)
})

test('无效槽位和非法数值不推进状态', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    for (const slot of ['P0', 'B28', 'P4', 'other']) assert.equal(await setup.matches.hint(setup.a, '1', slot), false)
    assert.equal(room.sides.red.pendingHint, null)
    await enterAnswer(setup)
    for (const value of ['NaN', '-1', '1.2.3', '100', '1e1']) assert.equal(await setup.matches.guess(setup.a, value), false)
    assert.equal(room.sides.red.guess, null)
})

for (const kind of ['range', 'histogram']) {
    test(`匹配选择 ${kind} 后不能再选择另一种统计图`, async t => {
        const setup = fixture(t)
        const room = await openRoom(setup)
        const other = kind === 'range' ? 'histogram' : 'range'
        assert.equal(await setup.matches.hint(setup.a, '3', kind), true)
        assert.equal(await setup.matches.hint(setup.b, '3', other), true)
        assert.equal(room.sides.red.game.knownSheetType, kind)
        assert.equal(room.sides.blue.game.knownSheetType, other)
        await setup.matches.guess(setup.a, '1')
        await setup.matches.guess(setup.b, '1')
        assert.equal(await setup.matches.hint(setup.a, '3', other), false)
        assert.equal(await setup.matches.hint(setup.b, '3', kind), false)
        assert.equal(room.sides.red.game.knownSheetType, kind)
        assert.equal(room.sides.blue.game.knownSheetType, other)
        assert.equal(room.sides.red.game.hintCnt, 1)
        assert.equal(room.sides.blue.game.hintCnt, 1)
        assert.equal(room.sides.red.pendingHint, null)
        assert.equal(room.sides.blue.pendingHint, null)
    })
}

test('单方回答超时立即判负，已回答方即使猜错也因对方放弃获胜', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    await enterAnswer(setup)
    const answer = event('a', 'latest-answer-group')
    await setup.matches.guess(answer, '1')
    const before = setup.sent.length
    await timeout(setup, room)
    assert.equal(room.phase, 'settled')
    assert.equal(room.turn, 1)
    assert.equal(getPlayer('grks', 'match', 'a')?.wins, 1)
    assert.equal(getPlayer('grks', 'match', 'b')?.losses, 1)
    assert.deepEqual(getPlayer('grks', 'match', 'a')?.answers, { total: 1, correct: 0 })
    assert.deepEqual(getPlayer('grks', 'match', 'b')?.answers, { total: 1, correct: 0 })
    assert.equal(setup.sent.length - before, 2)
    assert.ok(setup.sent.slice(before).some(item => item.event === answer))
})

test('双方回答超时立即零分平局，不再等待连续多轮超时', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    await enterAnswer(setup)
    const before = setup.sent.length
    await timeout(setup, room)
    assert.equal(room.phase, 'settled')
    assert.equal(room.turn, 1)
    assert.equal(getPlayer('grks', 'match', 'a')?.draws, 1)
    assert.equal(getPlayer('grks', 'match', 'a')?.score, 0)
    assert.deepEqual(getPlayer('grks', 'match', 'a')?.answers, { total: 1, correct: 0 })
    assert.deepEqual(getPlayer('grks', 'match', 'b')?.answers, { total: 1, correct: 0 })
    assert.equal(setup.sent.length - before, 2)
})

test('提示超时补选并向双方各发一次消息，回答阶段重新计时', async t => {
    const setup = fixture(t)
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const room = await openRoom(setup)
    await setup.matches.hint(setup.a, '1', 'B7')
    const before = setup.sent.length
    t.mock.timers.tick(setup.config.turnTime * 1000)
    await room.pending
    assert.equal(room.stage, 'answer')
    assert.equal(room.sides.red.game.knownRecords[9], true)
    assert.equal(room.sides.blue.game.knownRecords[0], true)
    assert.equal(setup.sent.length - before, 2)
    t.mock.timers.tick(setup.config.turnTime * 1000 - 1)
    await room.pending
    assert.equal(room.phase, 'playing')
    t.mock.timers.tick(1)
    await room.pending
    assert.equal(room.phase, 'settled')
    assert.equal(setup.sent.length - before, 4)
})

test('已排队的旧提示超时不会跳过新回答阶段或重复发送消息', async t => {
    const setup = fixture(t)
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const room = await openRoom(setup)
    const before = setup.sent.length
    const actions = [setup.matches.hint(setup.a, '1', 'P1'), setup.matches.hint(setup.b, '1', 'P1')]
    t.mock.timers.tick(setup.config.turnTime * 1000)
    await Promise.all(actions)
    await room.pending
    assert.equal(room.stage, 'answer')
    assert.equal(room.phase, 'playing')
    assert.equal(setup.sent.length - before, 2)
})

test('提示阶段发出的提前回答不能在排队等待后混入回答阶段', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    const results = await Promise.all([
        setup.matches.hint(setup.a, '1', 'P1'), setup.matches.hint(setup.b, '1', 'P1'),
        setup.matches.guess(setup.a, '1'),
    ])
    assert.deepEqual(results, [true, true, false])
    assert.equal(room.sides.red.guess, null)
})

test('十轮均未猜中判平且不进入第十一轮，每轮固定发送两批消息', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    const before = setup.sent.length
    await enterLastAnswer(setup)
    assert.equal(room.turn, 10)
    assert.equal(room.phase, 'playing')
    await setup.matches.guess(setup.a, '1')
    await setup.matches.guess(setup.b, '1')
    assert.equal(room.phase, 'settled')
    assert.equal(room.turn, 10)
    assert.equal(room.sides.red.game.hintCnt, 10)
    assert.equal(room.sides.red.game.history.length, 10)
    assert.equal(room.sides.blue.game.history.length, 10)
    assert.equal(setup.views.at(-2)?.history[9].result, 'wrong')
    assert.equal(getPlayer('grks', 'match', 'a')?.draws, 1)
    assert.equal(getPlayer('grks', 'match', 'a')?.score, 0)
    assert.deepEqual(getPlayer('grks', 'match', 'a')?.answers, { total: 10, correct: 0 })
    assert.deepEqual(getPlayer('grks', 'match', 'b')?.answers, { total: 10, correct: 0 })
    assert.equal(setup.sent.length - before, 10 * 2 * 2)
    assert.equal(await setup.matches.hint(setup.a, '1', 'B11'), false)
})

test('第十次回答仍可获胜，不会优先触发上限平局', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    await enterLastAnswer(setup)
    await setup.matches.guess(setup.a, String(room.sides.blue.answer.rks))
    await setup.matches.guess(setup.b, '1')
    assert.equal(getPlayer('grks', 'match', 'a')?.wins, 1)
    assert.equal(getPlayer('grks', 'match', 'a')?.score, 1)
    assert.deepEqual(getPlayer('grks', 'match', 'a')?.answers, { total: 10, correct: 1 })
    assert.deepEqual(getPlayer('grks', 'match', 'b')?.answers, { total: 10, correct: 0 })
})

test('同回合双方都猜中平局且各按提示数计分', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    await enterLastAnswer(setup)
    await setup.matches.guess(setup.a, String(room.sides.blue.answer.rks))
    await setup.matches.guess(setup.b, String(room.sides.red.answer.rks))
    assert.equal(getPlayer('grks', 'match', 'a')?.draws, 1)
    assert.equal(getPlayer('grks', 'match', 'a')?.score, 1)
    assert.equal(getPlayer('grks', 'match', 'b')?.score, 1)
    assert.deepEqual(getPlayer('grks', 'match', 'a')?.answers, { total: 10, correct: 1 })
    assert.deepEqual(getPlayer('grks', 'match', 'b')?.answers, { total: 10, correct: 1 })
})

test('图文消息在阶段结束时也只向每人发送一条', async t => {
    const setup = fixture(t)
    await openRoom(setup)
    t.mock.method(picmodle, 'grks', async () => ({ type: 'image', file: 'image.png' }))
    const before = setup.sent.length
    await enterAnswer(setup)
    assert.equal(setup.sent.length - before, 2)
    assert.ok(setup.sent.slice(before).every(item => Array.isArray(item.content)))
})

test('图片渲染失败改发文字，不中止房间或重复通知', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    t.mock.method(picmodle, 'grks', async () => { throw new Error('render failed') })
    const before = setup.sent.length
    await enterAnswer(setup)
    assert.equal(room.phase, 'playing')
    assert.equal(setup.sent.length - before, 2)
})

test('发送异常时仍尝试通知另一方，停止房间并如实记录失败', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    /** @type {string[]} */
    const attempted = []
    t.mock.method(send, 'send_with_At', async (/** @type {botEvent} */ e) => {
        attempted.push(String(e.user_id))
        if (e.user_id === 'a') throw new Error('reply failed')
        return true
    })
    await setup.matches.hint(setup.a, '1', 'B1')
    assert.equal(await setup.matches.hint(setup.b, '1', 'B1'), false)
    assert.equal(room.error, true)
    assert.equal(room.phase, 'settled')
    assert.equal(room.timer, null)
    assert.equal(getPlayer('grks', 'match', 'a'), null)
    assert.deepEqual(new Set(attempted), new Set(['a', 'b']))
})

test('发送返回失败时不伪造成功', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    t.mock.method(send, 'send_with_At', async () => false)
    await setup.matches.hint(setup.a, '1', 'B1')
    assert.equal(await setup.matches.hint(setup.b, '1', 'B1'), false)
    assert.equal(room.error, true)
    assert.equal(room.phase, 'settled')
})

test('官方机器人返回错误列表时也识别为发送失败', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    t.mock.method(send, 'send_with_At', async () => ({ error: [new Error('reply rejected')] }))
    await setup.matches.hint(setup.a, '1', 'B1')
    assert.equal(await setup.matches.hint(setup.b, '1', 'B1'), false)
    assert.equal(room.error, true)
    assert.equal(room.phase, 'settled')
    assert.equal(room.timer, null)
})

test('主动认输更新当前会话并通知双方，重复退出不重复计分', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    const latest = event('a', 'quit-group')
    const before = setup.sent.length
    assert.equal(await setup.matches.cancel(latest), true)
    assert.equal(setup.sent.length - before, 2)
    assert.ok(setup.sent.slice(before).some(item => item.event === latest))
    assert.equal(await setup.matches.cancel(latest), false)
    assert.equal(getPlayer('grks', 'match', 'b')?.plays, 1)
    assert.deepEqual(getPlayer('grks', 'match', 'a')?.answers, { total: 0, correct: 0 })
    assert.deepEqual(getPlayer('grks', 'match', 'b')?.answers, { total: 0, correct: 0 })
    assert.equal(room.phase, 'settled')
})

test('猜测和超时并发只结算及发送一次结果', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    await enterAnswer(setup)
    await setup.matches.guess(setup.a, String(room.sides.blue.answer.rks))
    const before = setup.sent.length
    await Promise.all([
        setup.matches.guess(setup.b, String(room.sides.red.answer.rks)), timeout(setup, room),
    ])
    assert.equal(getPlayer('grks', 'match', 'a')?.plays, 1)
    assert.equal(getPlayer('grks', 'match', 'b')?.plays, 1)
    assert.deepEqual(getPlayer('grks', 'match', 'a')?.answers, { total: 1, correct: 1 })
    assert.deepEqual(getPlayer('grks', 'match', 'b')?.answers, { total: 1, correct: 1 })
    assert.equal(setup.sent.length - before, 2)
})

test('提示阶段退出不增加回答样本，下一次排队读取已结算记录', async t => {
    const setup = fixture(t)
    await openRoom(setup)
    await enterAnswer(setup)
    await setup.matches.guess(setup.a, '1')
    await setup.matches.guess(setup.b, '1')
    await setup.matches.cancel(setup.a)
    assert.deepEqual(getPlayer('grks', 'match', 'a')?.answers, { total: 1, correct: 0 })
    assert.deepEqual(getPlayer('grks', 'match', 'b')?.answers, { total: 1, correct: 0 })
    await setup.matches.join(setup.a)
    const entry = setup.matches.queue.get(setup.matches.userKey(setup.a))
    assert.equal(entry?.matches, 1)
    assert.equal(entry?.accuracy, 0)
})

test('退出时只统计已提交并结算的回答，未作答放弃不冒充超时', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    await enterAnswer(setup)
    await setup.matches.guess(setup.a, String(room.sides.blue.answer.rks))
    assert.equal(getPlayer('grks', 'match', 'a'), null)
    await setup.matches.cancel(setup.b)
    assert.deepEqual(getPlayer('grks', 'match', 'a')?.answers, { total: 1, correct: 1 })
    assert.deepEqual(getPlayer('grks', 'match', 'b')?.answers, { total: 0, correct: 0 })
})

test('其他用户或平台不能修改玩家状态或接收对局消息', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    assert.equal(await setup.matches.hint(event('other'), '1', 'B1'), false)
    assert.equal(await setup.matches.hint({ ...setup.a, platform: 'discord' }, '1', 'B1'), false)
    assert.equal(room.sides.red.pendingHint, null)
    assert.equal(room.sides.red.event, setup.a)
})

test('先比较匹配场次差，正确率与 RKS 均不能覆盖场次优先级', async t => {
    const setup = fixture(t)
    const [a, b] = await queuedEntries(setup)
    a.matches = 10
    a.accuracy = 0.1
    b.matches = 11
    b.accuracy = 0.1
    const c = { ...b, userKey: 'qq:c', sessionKey: 'group-c', matches: 10, accuracy: 0.9,
        answer: { ...b.answer, rks: 1 } }
    assert.deepEqual(selectPair([a, b, c]), [a, c])
})

test('场次差相同时比较正确率差，同条件按等待先后配对', async t => {
    const setup = fixture(t)
    const [a, b] = await queuedEntries(setup)
    a.matches = b.matches = 10
    a.accuracy = 0.1
    b.accuracy = 0.8
    const c = { ...b, userKey: 'qq:c', sessionKey: 'group-c', accuracy: 0.15,
        answer: { ...b.answer, rks: 1 } }
    assert.deepEqual(selectPair([a, b, c]), [a, c])
    a.joinedAt = b.joinedAt = Date.now() - 10000
    c.accuracy = b.accuracy = a.accuracy
    assert.deepEqual(selectPair([c, a, b]), [a, b])
})

test('正确率差数学上相同时不受浮点误差干扰', async t => {
    const setup = fixture(t)
    const [a, b] = await queuedEntries(setup)
    a.matches = b.matches = 10
    a.accuracy = 0.1
    b.accuracy = 0.3
    const c = { ...a, userKey: 'qq:c', sessionKey: 'group-c', matches: 20, accuracy: 0.2, joinedAt: a.joinedAt - 10000 }
    const d = { ...b, userKey: 'qq:d', sessionKey: 'group-d', matches: 20, accuracy: 0.4, joinedAt: b.joinedAt - 10000 }
    assert.deepEqual(selectPair([a, b, c, d]), [c, d])
})

test('结算等待落盘前双方统计均已更新，重新入池不会读取旧场次', async t => {
    const setup = fixture(t)
    await openRoom(setup)
    const finishing = setup.matches.cancel(setup.a)
    await Promise.resolve()
    assert.equal(getPlayer('grks', 'match', 'a')?.plays, 1)
    assert.equal(getPlayer('grks', 'match', 'b')?.plays, 1)
    await setup.matches.join(setup.b)
    const entry = setup.matches.queue.get(setup.matches.userKey(setup.b))
    assert.equal(entry?.matches, 1)
    assert.equal(entry?.accuracy, null)
    await finishing
})

test('无场次、正确率或 RKS 差值门槛，且不存在十秒放宽机制', async t => {
    const setup = fixture(t)
    const entries = await queuedEntries(setup)
    entries[0].joinedAt = entries[1].joinedAt = 0
    entries[0].matches = 0
    entries[1].matches = 100000
    entries[0].accuracy = 0
    entries[1].accuracy = 1
    entries[0].answer.rks = 1
    entries[1].answer.rks = 20
    for (const now of [0, 9999, 10000, 239999]) assert.deepEqual(selectPair(entries, { now }), entries)
    assert.equal(selectPair(entries, { now: 240000 }), null)
    assert.equal(selectPair([entries[0], { ...entries[1], sessionKey: entries[0].sessionKey }], { now: 0 }), null)
    assert.equal(selectPair([entries[0], { ...entries[1], userKey: entries[0].userKey }], { now: 0 }), null)
})

test('旧数据和新玩家均无正确率样本，不伪造为零正确率或拒绝配对', async t => {
    const setup = fixture(t)
    await addScore('grks', 'match', 'a', 10, { result: 'win', hints: 1 })
    const [a, b] = await queuedEntries(setup)
    assert.equal(a.matches, 1)
    assert.equal(b.matches, 0)
    assert.equal(a.accuracy, null)
    assert.equal(b.accuracy, null)
    assert.deepEqual(selectPair([a, b]), [a, b])
    const c = { ...b, userKey: 'qq:c', sessionKey: 'group-c', matches: 1, accuracy: 0 }
    const d = { ...c, userKey: 'qq:d', sessionKey: 'group-d', accuracy: 1 }
    assert.deepEqual(selectPair([a, c, d]), [c, d])
    assert.deepEqual(selectPair([a, c]), [a, c])
})

test('入池只读取匹配统计，单机积分和胜率不参与配对', async t => {
    const setup = fixture(t)
    await addScore('grks', 'normal', 'a', 10, { answers: { total: 1, correct: 1 } })
    await addScore('grks', 'match', 'a', 10, { result: 'win', answers: { total: 4, correct: 0 } })
    await addScore('grks', 'match', 'a', 0, { result: 'loss', answers: { total: 1, correct: 1 } })
    await setup.matches.join(setup.a)
    const entry = setup.matches.queue.get(setup.matches.userKey(setup.a))
    assert.equal(entry?.matches, 2)
    assert.equal(entry?.accuracy, 0.2)
    assert.match(String(setup.sent.at(-1)?.content), /匹配场次差最小.*答题正确率差/)
    assert.doesNotMatch(String(setup.sent.at(-1)?.content), /RKS 差值|放宽|rks 相近/)
})

test('入池未满 240 秒继续等待，满 240 秒退队并仅通知一次，之后可重新匹配', async t => {
    const setup = fixture(t)
    let now = 1000000
    t.mock.method(Date, 'now', () => now)
    assert.equal(await setup.matches.join(setup.a), true)
    const key = setup.matches.userKey(setup.a)
    const before = setup.sent.length
    now += 239999
    await setup.matches.tryMatch()
    assert.equal(setup.matches.queue.has(key), true)
    assert.equal(setup.sent.length, before)
    now += 1
    await setup.matches.tryMatch()
    assert.equal(setup.matches.queue.has(key), false)
    assert.equal(setup.matches.isMatching(setup.a), false)
    assert.equal(setup.matches.scanner, null)
    assert.equal(setup.sent.length, before + 1)
    assert.equal(setup.sent.at(-1)?.event, setup.a)
    assert.match(String(setup.sent.at(-1)?.content), /等待已满 240s，已自动退出匹配池/)
    await setup.matches.tryMatch()
    assert.equal(setup.sent.length, before + 1)
    assert.equal(getPlayer('grks', 'match', 'a'), null)
    assert.equal(await setup.matches.join(setup.a), true)
    assert.equal(setup.matches.queue.get(key)?.joinedAt, now)
})

test('等待满 240 秒时优先退队，不与同一时刻入池的新玩家配对', async t => {
    const setup = fixture(t)
    let now = 1000000
    t.mock.method(Date, 'now', () => now)
    await setup.matches.join(setup.a)
    now += GRKS_MATCH_QUEUE_RULES.timeout * 1000
    assert.equal(await setup.matches.join(setup.b), true)
    assert.equal(setup.matches.queue.has(setup.matches.userKey(setup.a)), false)
    assert.equal(setup.matches.queue.has(setup.matches.userKey(setup.b)), true)
    assert.equal(setup.matches.rooms.size, 0)
    assert.equal(setup.sent.filter(item => String(item.content).includes('已自动退出匹配池')).length, 1)
})

test('已有配对处理未完成时，扫描仍会将过期玩家退队', async t => {
    const setup = fixture(t)
    let now = 1000000
    t.mock.method(Date, 'now', () => now)
    await setup.matches.join(setup.a)
    setup.matches.scanning = true
    now += GRKS_MATCH_QUEUE_RULES.timeout * 1000
    await setup.matches.tryMatch()
    assert.equal(setup.matches.queue.size, 0)
    assert.equal(setup.matches.scanner, null)
    assert.match(String(setup.sent.at(-1)?.content), /已自动退出匹配池/)
})

test('超时通知失败仍释放双方排队占用，并如实记录发送失败', async t => {
    const setup = fixture(t)
    let now = 1000000
    t.mock.method(Date, 'now', () => now)
    await setup.matches.join(setup.a)
    const b = event('b', String(setup.a.group_id))
    await setup.matches.join(b)
    const adapterLogger = getPlatformAdapter().logger
    const originalError = adapterLogger.error
    /** @type {unknown[][]} */
    const errors = []
    adapterLogger.error = (...args) => { errors.push(args) }
    t.after(() => { adapterLogger.error = originalError })
    t.mock.method(send, 'send_with_At', async (/** @type {botEvent} */ e) => {
        if (e.user_id === 'a') throw new Error('通知发送失败')
        return false
    })
    now += GRKS_MATCH_QUEUE_RULES.timeout * 1000
    await setup.matches.tryMatch()
    assert.equal(setup.matches.queue.size, 0)
    assert.equal(setup.matches.scanner, null)
    assert.equal(errors.length, 2)
})

test('加载中取消不会在读取完成后重新入池', async t => {
    const setup = fixture(t)
    const events = new EventEmitter()
    const entered = once(events, 'entered')
    const gate = once(events, 'continue')
    t.mock.method(send, 'getsave_result', async () => {
        events.emit('entered')
        await gate
        return false
    })
    const pending = setup.matches.join(setup.a)
    await entered
    assert.equal(await setup.matches.cancel(setup.a), true)
    events.emit('continue')
    assert.equal(await pending, false)
    assert.equal(setup.matches.queue.size, 0)
})

test('房间清理期间的延迟渲染不会恢复计时器', async t => {
    const setup = fixture(t)
    const room = await openRoom(setup)
    const events = new EventEmitter()
    const entered = once(events, 'entered')
    const gate = once(events, 'continue')
    t.mock.method(picmodle, 'grks', async () => {
        events.emit('entered')
        await gate
        return false
    })
    await setup.matches.hint(setup.a, '1', 'B1')
    const pending = setup.matches.hint(setup.b, '1', 'B1')
    await entered
    setup.matches.reset()
    events.emit('continue')
    await pending
    assert.equal(room.timer, null)
    assert.equal(setup.matches.rooms.size, 0)
})

test('开局通知期间清理房间不会报告匹配成功或恢复计时器', async t => {
    const setup = fixture(t)
    await setup.matches.join(setup.a)
    const events = new EventEmitter()
    const entered = once(events, 'entered')
    const gate = once(events, 'continue')
    t.mock.method(picmodle, 'grks', async () => {
        events.emit('entered')
        await gate
        return false
    })
    const pending = setup.matches.join(setup.b)
    await entered
    const room = setup.matches.findPlayer(setup.a)?.room
    assert.ok(room)
    setup.matches.reset()
    events.emit('continue')
    assert.equal(await pending, false)
    assert.equal(room.timer, null)
    assert.equal(room.cleanupTimer, null)
    assert.equal(setup.matches.rooms.size, 0)
})

test('移除查询指令及 Koishi 菜单，保留原有匹配操作', t => {
    t.mock.method(Config, 'getUserCfg', () => 'phi')
    const command = new phiGrks()
    assert.ok(command.rule)
    const rules = command.rule
    for (const text of ['/phi grks room', '/phi grks 房间', '/phi grks 状态']) {
        assert.ok(rules.every(rule => !new RegExp(rule.reg).test(text)))
    }
    for (const text of ['/phi grks match', '/phi grks hint B7', '/phi grks 15.25', '/phi grks cancel']) {
        assert.ok(rules.some(rule => new RegExp(rule.reg).test(text)))
    }
    assert.ok(shortcutCommands.every(item => item.id !== 'grks.room'))
})
