import assert from 'node:assert/strict'
import test from 'node:test'
import send from '../model/render/send.js'
import { grksSoloClass } from '../apps/grks/solo.js'
import picmodle from '../model/render/picmodle.js'
import { grksClass } from '../apps/grks/grks.js'
import { chatTargetFromEvent, chatTargetKey } from '../components/platform/sendTarget.js'

/** @import {botEvent} from '../components/baseClass.js' */
/** @import {grksAnswer} from '../apps/grks/grks.js' */

/**
 * 构造一条 B30 成绩。
 * @param {number} index
 * @returns {import('../model/game/LevelRecordInfo.js').default}
 */
function record(index) {
    return /** @type {import('../model/game/LevelRecordInfo.js').default} */ ({
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
 * @returns {import('../model/game/LevelRecordInfo.js').default[]}
 */
function makeRecords() {
    return Array.from({ length: 30 }, (_, index) => record(index))
}

/**
 * @param {string} userId
 * @returns {botEvent}
 */
function privateEvent(userId) {
    return /** @type {botEvent} */ ({
        msg: '',
        user_id: userId,
        isGroup: false,
        isPrivate: true,
    })
}

/**
 * @param {string} userId
 * @returns {botEvent}
 */
function groupEvent(userId) {
    return /** @type {botEvent} */ ({
        msg: '',
        user_id: userId,
        group_id: 'group-1',
        isGroup: true,
        isPrivate: false,
    })
}

/**
 * @param {grksSoloClass} solo
 * @param {grksAnswer} answer
 * @param {botEvent} event
 * @returns {{key: string, room: import('../apps/grks/solo.js').grksSoloRoom}}
 */
function installRoom(solo, answer, event) {
    const key = chatTargetKey(chatTargetFromEvent(event))
    const room = {
        key,
        game: new grksClass(answer),
        event,
        startedAt: Date.now(),
        answerAtByUser: new Map(),
        lastHintAt: 0,
        settled: false,
        timer: null,
    }
    solo.rooms.set(key, room)
    return { key, room }
}

/**
 * @returns {grksAnswer}
 */
function makeAnswer() {
    return {
        rks: 15.4,
        record: makeRecords(),
        stats: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
        challenge: 0,
        updateAt: Date.now(),
    }
}

test('单机开局立即展示首条提示，计入提示冷却且不占用猜测机会', async t => {
    const solo = new grksSoloClass()
    const event = privateEvent('first-hint-player')
    const cfg = { ...solo.readConfig(), cd: 5 }
    let now = Date.now()
    t.mock.method(Date, 'now', () => now)
    t.mock.method(solo, 'banCheck', async () => false)
    t.mock.method(solo, 'readConfig', () => cfg)
    t.mock.method(solo, 'drawAnswer', async () => ({ answer: makeAnswer(), candidateCount: 1 }))
    const renderer = t.mock.method(picmodle, 'grks', async (
        /** @type {botEvent} */ _event,
        /** @type {import('../apps/grks/soloRender.js').grksSoloView} */ _view,
    ) => ({ type: 'image', data: 'test' }))
    t.mock.method(send, 'send_with_At', async () => true)

    assert.equal(await solo.start(event), true)
    const key = chatTargetKey(chatTargetFromEvent(event))
    const room = solo.rooms.get(key)
    assert.ok(room)
    t.after(() => solo.dispose(room))
    assert.equal(room.game.hintCnt, 1)
    assert.equal(room.lastHintAt, now)
    assert.equal(room.game.guessHistory.length, 0)
    assert.equal(room.answerAtByUser.size, 0)
    assert.equal(room.game.history.length, 1)
    assert.equal(room.game.history[0].result, 'pending')
    assert.notEqual(room.game.history[0].hint, '无新增提示')
    const opening = renderer.mock.calls[0]
    assert.ok(opening)
    assert.equal(opening.arguments[1].history[0].hint, room.game.history[0].hint)
    assert.equal(opening.arguments[1].stats.revealed, Boolean(room.game.getKnownData().info))

    assert.equal(await solo.guess(event, '1'), true)
    assert.equal(room.game.hintCnt, 1)
    assert.equal(room.game.guessHistory.length, 1)
    assert.equal(room.game.history[0].result, 'wrong')
    assert.equal(room.game.history.length, 1)
    for (let turn = 2; turn <= grksClass.MAX_GUESSES; turn++) {
        now += cfg.cd * 1000
        assert.equal(await solo.guess(event, '1'), true)
    }
    assert.equal(solo.rooms.has(key), false)
    assert.equal(room.game.hintCnt, grksClass.MAX_GUESSES - 1)
    assert.equal(room.game.guessHistory.length, grksClass.MAX_GUESSES)
    assert.equal(room.game.history.length, grksClass.MAX_GUESSES)
})

test('keeps answer CD per player and hint CD per room', async () => {
    const solo = new grksSoloClass()
    const user1 = groupEvent('user-1')
    const user2 = groupEvent('user-2')
    const { key, room } = installRoom(solo, makeAnswer(), user1)

    /** @type {unknown[]} */
    const sent = []
    /** @type {string[]} */
    const rendered = []
    /** @type {import('../apps/grks/soloRender.js').grksSoloView[]} */
    const views = []
    test.mock.method(send, 'send_with_At', async (/** @type {unknown} */ _e, /** @type {unknown} */ msg) => {
        sent.push(msg)
        return true
    })
    test.mock.method(picmodle, 'grks', async (
        /** @type {unknown} */ _e,
        /** @type {import('../apps/grks/soloRender.js').grksSoloView} */ view,
    ) => {
        views.push(view)
        rendered.push(view.footnote)
        return { type: 'image', data: 'test' }
    })
    test.mock.method(grksSoloClass.prototype, 'recordPlay', async () => undefined)

    // user1 首次猜错：回答 CD 通过，提示 CD 到期，系统给出提示
    await solo.guess(user1, '1')
    assert.equal(room.game.hintCnt, 1)
    assert.equal(rendered.length, 1)
    assert.ok(rendered.at(-1)?.includes('系统已给出第 1 条提示'))

    // user2 不受 user1 的回答 CD 影响，但房间提示 CD 未到，本次不给提示
    await solo.guess(user2, '2')
    assert.equal(room.game.hintCnt, 1)
    assert.equal(rendered.length, 2)
    assert.ok(rendered.at(-1)?.includes('提示冷却中'))

    // user1 再次回答：个人回答 CD 未到，被拒绝
    await solo.guess(user1, '3')
    assert.equal(rendered.length, 2)
    assert.ok(String(sent.at(-1)).includes('回答冷却'))

    // 提示 CD 到期后，user2 再次猜错才获得提示
    room.lastHintAt = 0
    room.answerAtByUser.set('user-2', 0)
    await solo.guess(user2, '4')
    assert.equal(room.game.hintCnt, 2)

    // 首位猜中即结算，房间关闭
    const answer = room.game.answer
    assert.ok(answer)
    room.answerAtByUser.set('user-2', 0)
    await solo.guess(user2, String(answer.rks))
    assert.equal(solo.rooms.has(key), false)
    assert.ok(rendered.at(-1)?.includes('猜对了'))

    const finalView = views.at(-1)
    assert.ok(finalView)
    assert.equal(finalView.header.rks, answer.rks.toFixed(4))
    assert.equal(finalView.records.length, 30)
    assert.equal(finalView.records[0].slot, 'P1')
    assert.equal(finalView.stats.revealed, true)
})

test('rejects guesses without an active room', async () => {
    const solo = new grksSoloClass()
    const event = privateEvent('user-3')

    /** @type {unknown[]} */
    const sent = []
    test.mock.method(send, 'send_with_At', async (/** @type {unknown} */ _e, /** @type {unknown} */ msg) => {
        sent.push(msg)
        return true
    })

    const accepted = await solo.guess(event, '15.4')
    assert.equal(accepted, false)
    assert.ok(String(sent.at(-1)).includes('当前没有进行中的猜 RKS'))
})

test('并发回答时每条最终消息保持自身的猜测记录快照', async t => {
    const solo = new grksSoloClass()
    const user1 = groupEvent('snapshot-1')
    const user2 = groupEvent('snapshot-2')
    const { room } = installRoom(solo, makeAnswer(), user1)
    t.after(() => solo.dispose(room))
    /** @type {import('../apps/grks/soloRender.js').grksSoloView[]} */
    const views = []
    t.mock.method(picmodle, 'grks', async (
        /** @type {botEvent} */ _event,
        /** @type {import('../apps/grks/soloRender.js').grksSoloView} */ view,
    ) => {
        views.push(view)
        return { type: 'image', data: 'test' }
    })
    t.mock.method(send, 'send_with_At', async () => true)
    assert.deepEqual(await Promise.all([solo.guess(user1, '1'), solo.guess(user2, '2')]), [true, true])
    assert.equal(views.length, 2)
    assert.equal(views[0].answeredCount, 1)
    assert.equal(views[0].history[1].result, 'pending')
    assert.equal(views[1].answeredCount, 2)
    assert.equal(views[1].history[1].answer, '2')
    assert.equal(views[1].history[1].result, 'wrong')
})

for (const lastCorrect of [false, true]) {
    test(`单机第十次${lastCorrect ? '猜中获胜' : '猜错立即判负'}且不再生成提示`, async t => {
        const solo = new grksSoloClass()
        const event = privateEvent('limit-player')
        const { room, key } = installRoom(solo, makeAnswer(), event)
        t.after(() => solo.dispose(room))
        const renderer = t.mock.method(picmodle, 'grks', async (
            /** @type {botEvent} */ _event,
            /** @type {import('../apps/grks/soloRender.js').grksSoloView} */ _view,
        ) => ({ type: 'image', data: 'test' }))
        t.mock.method(send, 'send_with_At', async () => true)
        const score = t.mock.method(solo, 'recordPlay', async () => undefined)
        for (let turn = 1; turn <= 9; turn++) {
            room.answerAtByUser.clear()
            room.lastHintAt = 0
            await solo.guess(event, '1')
            assert.equal(solo.rooms.has(key), true)
        }
        const hintCount = room.game.hintCnt
        room.answerAtByUser.clear()
        room.lastHintAt = 0
        await solo.guess(event, lastCorrect ? '15.4' : '1')
        assert.equal(solo.rooms.has(key), false)
        assert.equal(room.game.hintCnt, hintCount)
        assert.equal(room.game.guessHistory.length, 10)
        assert.equal(room.game.history.length, 10)
        assert.equal(room.game.history[9].result, lastCorrect ? 'correct' : 'wrong')
        const call = renderer.mock.calls.at(-1)
        assert.ok(call)
        assert.match(call.arguments[1].footnote, lastCorrect ? /猜对了/ : /10 次猜测均未猜中，本局判负/)
        assert.equal(score.mock.callCount(), lastCorrect ? 1 : 0)
    })
}

test('提示记录隐藏单机成绩位置，并在公开顺序后记录槽位', () => {
    const game = new grksClass(makeAnswer())
    game.userHint({ type: 'record', value: [0, 3] })
    assert.equal(game.history[0].hint, '公开随机成绩 2 条')
    game.recordGuess(1, 'wrong')
    game.knownOrder = true
    game.userHint({ type: 'record', value: [1, 4] })
    assert.equal(game.history[1].hint, '公开 P2 / B2')
    game.recordGuess(15.4, 'correct')
    assert.deepEqual(game.history.map(entry => entry.guess), [1, 15.4])
    assert.deepEqual(game.history.map(entry => entry.result), ['wrong', 'correct'])
})

test('多人同时争用最后一次猜测机会时只接受一次回答', async t => {
    const solo = new grksSoloClass()
    const user1 = groupEvent('limit-user-1')
    const user2 = groupEvent('limit-user-2')
    const { room, key } = installRoom(solo, makeAnswer(), user1)
    t.after(() => solo.dispose(room))
    t.mock.method(picmodle, 'grks', async () => ({ type: 'image', data: 'test' }))
    t.mock.method(send, 'send_with_At', async () => true)
    for (let turn = 0; turn < 9; turn++) {
        room.answerAtByUser.clear()
        await solo.guess(user1, '1')
    }
    room.answerAtByUser.clear()
    assert.deepEqual(await Promise.all([
        solo.guess(user1, '1'), solo.guess(user2, '15.4'),
    ]), [true, false])
    assert.equal(solo.rooms.has(key), false)
    assert.equal(room.game.guessHistory.length, 10)
    assert.equal(room.game.history.length, 10)
    assert.equal(room.game.history[9].result, 'wrong')
})

/** @type {('range' | 'histogram')[]} */
const sheetKinds = ['range', 'histogram']

for (const kind of sheetKinds) {
    test(`单机获得 ${kind} 后随机提示不会追加另一种统计图`, t => {
        t.mock.method(Math, 'random', () => 0.9999)
        const game = new grksClass(makeAnswer())
        game.userHint({ type: 'sheet', value: kind })
        game.recordGuess(1, 'wrong')
        for (let turn = 0; turn < 4; turn++) {
            game.randomHint()
            game.recordGuess(1, 'wrong')
            assert.equal(game.knownSheetType, kind)
            const sheet = game.getKnownData().sheet
            assert.equal(sheet.histogram !== null, kind === 'histogram')
            assert.equal(sheet.range !== null, kind === 'range')
        }
        assert.equal(game.history.filter(entry => /等效 RKS (直方图|上下界)/.test(entry.hint)).length, 1)
    })
}
