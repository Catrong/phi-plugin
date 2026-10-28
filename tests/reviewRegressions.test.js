import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import Config from '../components/Config.js'
import { getPlatformAdapter } from '../components/platform/index.js'
import getBanGroup from '../model/user/getBanGroup.js'
import getNotes from '../model/user/getNotes.js'
import getInfo from '../model/game/getInfo.js'
import fCompute from '../model/game/fCompute.js'
import LocalSaveRepository from '../model/save/getSave.js'
import send from '../model/render/send.js'
import picmodle from '../model/render/picmodle.js'
import TapInfo from '../model/integrations/getInfoFromTap.js'
import { UserCredentials } from '../model/user/userCredentials.js'
import { grksSoloClass } from '../apps/grks/solo.js'
import { grksSoloMessages } from '../model/render/messages.js'
import guessLetter from '../apps/guessGame/guessLetter.js'
import { phisong } from '../apps/phisong.js'
import { phisstk } from '../apps/session.js'
import { phiset } from '../apps/manage.js'
import fs from 'node:fs'

/** @import {botEvent} from '../components/baseClass.js' */

/** @returns {botEvent} */
function event() {
    return {
        msg: '/phi ltr review',
        user_id: 'review-user',
        group_id: 'review-group',
        isGroup: true,
        isPrivate: false,
        bot: { adapter: 'qqbot' },
        isMaster: true,
    }
}

/** @param {number} count */
function records(count) {
    return Array.from({ length: count }, (_, index) => ({
        rks: 17 - index * 0.1,
        score: index < 3 ? 1000000 : 990000,
    }))
}

test('猜 RKS 允许 P3 同时进入 B27，27 条成绩即可组成完整题目', async t => {
    const solo = new grksSoloClass()
    for (const count of [27, 33]) {
        const all = records(count)
        t.mock.method(LocalSaveRepository, 'getSaveBySessionToken', async () => ({
            getRecord: () => all,
            getStats: () => [],
            saveInfo: { summary: { challengeModeRank: 0 }, modifiedAt: { iso: new Date() } },
        }))
        const answer = await solo.loadAnswer('review-token')
        assert.ok(answer)
        assert.equal(answer.record.length, 30)
        assert.deepEqual(answer.record, [...all.slice(0, 3), ...all.slice(0, 27)])
        assert.equal(answer.rks, 15.82)
    }
})

test('猜 RKS 不用普通成绩填充缺失的 P3', async t => {
    const all = records(33)
    all[2].score = 990000
    t.mock.method(LocalSaveRepository, 'getSaveBySessionToken', async () => ({ getRecord: () => all }))
    assert.equal(await new grksSoloClass().loadAnswer('review-token'), null)
})

test('同一房间并发开局只创建一道题和一个定时器', async t => {
    const solo = new grksSoloClass()
    t.mock.method(solo, 'banCheck', async () => false)
    const draw = t.mock.method(solo, 'drawAnswer', async () => {
        await setImmediate()
        return { answer: { rks: 15.4, record: records(30), stats: [], challenge: 0, updateAt: Date.now() }, candidateCount: 1 }
    })
    const timers = t.mock.method(solo, 'armTimeout', () => undefined)
    const views = t.mock.method(grksSoloMessages.start, 'opened', async () => ({ text: '开局', button: [] }))
    t.mock.method(send, 'send_with_At', async () => true)
    assert.deepEqual(await Promise.all([solo.start(event()), solo.start(event())]), [true, false])
    assert.equal(draw.mock.callCount(), 1)
    assert.equal(timers.mock.callCount(), 1)
    assert.equal(views.mock.callCount(), 1)
    assert.equal(solo.rooms.size, 1)
})

test('抽题失败后释放开局占用，允许重试', async t => {
    const solo = new grksSoloClass()
    t.mock.method(solo, 'banCheck', async () => false)
    let attempts = 0
    t.mock.method(solo, 'drawAnswer', async () => {
        if (++attempts === 1) throw new Error('读取失败')
        return { answer: { rks: 15.4, record: records(30), stats: [], challenge: 0, updateAt: Date.now() }, candidateCount: 1 }
    })
    t.mock.method(solo, 'armTimeout', () => undefined)
    t.mock.method(grksSoloMessages.start, 'opened', async () => ({ text: '开局', button: [] }))
    await assert.rejects(solo.start(event()), /读取失败/)
    assert.equal(await solo.start(event()), true)
})

test('未绑定和存档版本不足时发送可读文本', async t => {
    t.mock.method(getNotes, 'getNotesData', async () => ({ allowApiUsage: false }))
    t.mock.method(Config, 'getUserCfg', () => 'off')
    t.mock.method(UserCredentials.prototype, 'getSessionToken', async () => undefined)
    t.mock.method(UserCredentials.prototype, 'getUpdatedSaveFromLocal', async () => ({ save: { Recordver: 1 } }))
    const replies = t.mock.method(send, 'send_with_At', async () => true)
    assert.equal(await send.getsave_result(event()), false)
    assert.match(String(replies.mock.calls[0].arguments[1]), /请先绑定sessionToken/)
    t.mock.method(UserCredentials.prototype, 'getSessionToken', async () => 'review-token')
    assert.equal(await send.getsave_result(event(), 2), false)
    assert.match(String(replies.mock.calls[1].arguments[1]), /请先更新数据/)
})

test('转发和文件上传失败时发送可读错误提示', async t => {
    const adapter = getPlatformAdapter()
    const sendPrivate = adapter.sendPrivate
    const uploadFile = adapter.uploadFile
    adapter.sendPrivate = async () => { throw new Error('转发失败') }
    adapter.uploadFile = async () => { throw new Error('上传失败') }
    t.after(() => {
        adapter.sendPrivate = sendPrivate
        adapter.uploadFile = uploadFile
    })
    const atReplies = t.mock.method(send, 'send_with_At', async () => true)
    const replies = t.mock.method(send, 'reply', async () => true)
    await send.pick_send(event(), 'message')
    await fCompute.sendFile(event(), 'file', 'test.txt')
    assert.match(String(atReplies.mock.calls[0].arguments[1]), /转发失败/)
    assert.match(String(replies.mock.calls[0].arguments[1]), /文件上传错误.*上传失败/)
})

test('关闭快捷操作后，官方机器人仍以文本发送开字母题目和答案', async t => {
    const dlc = getInfo.DLC_Info
    getInfo.DLC_Info = { review: ['Review.0'] }
    t.after(() => { getInfo.DLC_Info = dlc })
    t.mock.method(getInfo, 'info', () => ({ song: 'Review Song' }))
    t.mock.method(Config, 'getUserCfg', (/** @type {string} */ _name, /** @type {string} */ key) => {
        if (key === 'LetterNum') return 1
        if (key === 'LetterTimeLength') return 0
        if (key === 'LetterMessageMode') return 'markdown'
        if (key === 'LetterMarkdown') return 'off'
        return 'phi'
    })
    const replies = t.mock.method(send, 'reply', async () => true)
    await guessLetter.start(event(), {})
    const messages = replies.mock.calls.map(call => call.arguments[1])
    assert.ok(messages.some(message => typeof message === 'string' && message.includes('开字母进行中：')))
    assert.ok(messages.some(message => typeof message === 'string' && message.includes('Review Song')))
})

test('新曲速递保留在线版本和更新说明，网络失败时保留本地信息', async t => {
    const updatedSong = getInfo.updatedSong
    const updatedChart = getInfo.updatedChart
    getInfo.updatedSong = []
    getInfo.updatedChart = {}
    t.after(() => {
        getInfo.updatedSong = updatedSong
        getInfo.updatedChart = updatedChart
    })
    t.mock.method(getBanGroup, 'get', async () => false)
    t.mock.method(getInfo, 'getill', () => 'background')
    t.mock.method(picmodle, 'common', async () => 'new-song-image')
    const tap = t.mock.method(TapInfo, 'PgrUpdateInfo', async () => [{ version: '3.0.0', rawHtml: '<div>新曲<br/>修复</div>' }])
    const replies = t.mock.method(send, 'send_with_At', async () => true)
    const command = new phisong()
    await command.newSong(event())
    const payload = replies.mock.calls[0].arguments[1]
    assert.deepEqual(payload, ['new-song-image', '最新版本：3.0.0\n更新信息：\n新曲\n修复\n信息文件版本：' + (await import('../components/Version.js')).default.phigros])
    tap.mock.mockImplementation(async () => { throw new Error('网络失败') })
    await command.newSong(event())
    const fallback = replies.mock.calls[1].arguments[1]
    assert.ok(Array.isArray(fallback))
    assert.equal(fallback[0], 'new-song-image')
    assert.match(fallback[1], /^信息文件版本：/)
})

test('解绑、清理数据和恢复备份向宿主提供字符串超时提示', async t => {
    t.mock.method(getBanGroup, 'get', async () => false)
    t.mock.method(UserCredentials.prototype, 'getLocalCredentials', async () => ({ sessionToken: 'review-token' }))
    t.mock.method(send, 'send_with_At', async () => true)
    const session = new phisstk()
    const contexts = t.mock.fn((name = '', isGroup = false, timeout = 0, timeoutMsg = '') => undefined)
    session.setContext = contexts
    await session.unbind(event())
    await session.clean(event())
    for (const call of contexts.mock.calls) {
        assert.equal(typeof call.arguments[3], 'string')
        assert.match(String(call.arguments[3]), /超时已取消/)
    }
    t.mock.method(fs, 'readdirSync', () => [])
    const manage = new phiset()
    const restore = t.mock.fn((name = '', isGroup = false, timeout = 0, timeoutMsg = '') => undefined)
    manage.setContext = restore
    manage.restore(event())
    assert.equal(restore.mock.callCount(), 1)
    assert.equal(typeof restore.mock.calls[0].arguments[3], 'string')
})
