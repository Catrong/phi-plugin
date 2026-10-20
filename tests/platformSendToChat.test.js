import assert from 'node:assert/strict'
import test from 'node:test'
import {
    chatTargetFromEvent,
    chatTargetKey,
    dispatchToChat,
    normalizeChatTarget,
} from '../components/platform/sendTarget.js'
import yunzaiAdapter from '../components/platform/yunzai.js'

test('normalizes group and private chat targets', () => {
    assert.deepEqual(normalizeChatTarget({ scene: 'group', groupId: 'g1', botId: '9' }), {
        scene: 'group', platform: '', botId: '9', chatId: 'g1', guildId: 'g1', userId: '',
    })
    assert.equal(normalizeChatTarget({ scene: 'group' }), null)
    assert.equal(normalizeChatTarget({} ), null)
    assert.equal(normalizeChatTarget({ scene: 'private' }), null)
    assert.deepEqual(normalizeChatTarget({ scene: 'private', userId: 'u1' }), {
        scene: 'private', platform: '', botId: '', chatId: '', guildId: '', userId: 'u1',
    })
    /** 未声明 scene 时按字段推断 */
    assert.equal(normalizeChatTarget({ chatId: 'g2' })?.scene, 'group')
    assert.equal(normalizeChatTarget({ userId: 'u2' })?.scene, 'private')
})

test('derives chat targets from platform events', () => {
    const yunzaiGroup = chatTargetFromEvent({ isGroup: true, group_id: 'g1', self_id: '9', user_id: 'u1' })
    assert.equal(yunzaiGroup?.scene, 'group')
    assert.equal(yunzaiGroup?.chatId, 'g1')
    assert.equal(yunzaiGroup?.botId, '9')

    const yunzaiPrivate = chatTargetFromEvent({ isPrivate: true, user_id: 'u1', self_id: '9' })
    assert.equal(yunzaiPrivate?.scene, 'private')
    assert.equal(yunzaiPrivate?.userId, 'u1')

    const koishiGroup = chatTargetFromEvent({ group_id: 'g2', chatId: 'ch2', self_id: 'b1', session: { platform: 'discord', guildId: 'guild2', channelId: 'ch2' } })
    assert.equal(koishiGroup?.chatId, 'g2')
    assert.equal(koishiGroup?.platform, 'discord')
    assert.equal(koishiGroup?.guildId, 'guild2')

    const koishiPrivate = chatTargetFromEvent({ user_id: 'u2', session: { selfId: 'b2', platform: 'onebot', userId: 'u2' } })
    assert.equal(koishiPrivate?.scene, 'private')
    assert.equal(koishiPrivate?.botId, 'b2')
    assert.equal(koishiPrivate?.platform, 'onebot')

    assert.equal(chatTargetFromEvent(null), null)
})

test('builds stable chat keys to detect same-channel matches', () => {
    const a = chatTargetKey({ scene: 'group', chatId: 'g1', botId: '9', platform: 'qq' })
    const b = chatTargetKey({ scene: 'group', chatId: 'g2', botId: '9', platform: 'qq' })
    const c = chatTargetKey({ scene: 'private', userId: 'u1', botId: '9', platform: 'qq' })
    assert.notEqual(a, b)
    assert.notEqual(a, c)
    assert.equal(a, chatTargetKey({ scene: 'group', chatId: 'g1', botId: '9', platform: 'qq' }))
    assert.equal(chatTargetKey(null), '')
})

test('dispatches with graceful fallbacks', async () => {
    /** @type {string[]} */
    const calls = []

    const viaBot = await dispatchToChat({
        pickBot: () => ({ selfId: 'bot' }),
        sendMessage: (_bot, channelId, content) => { calls.push(`bot:${channelId}:${content}`); return [] },
    }, { scene: 'group', chatId: 'g1' }, 'hi')
    assert.equal(viaBot, true)
    assert.deepEqual(calls, ['bot:g1:hi'])

    calls.length = 0
    const viaGroup = await dispatchToChat({
        pickBot: () => null,
        sendMessage: () => { throw new Error('should not be used') },
        pickGroup: groupId => ({ sendMsg: (/** @type {any} */ content) => { calls.push(`group:${groupId}:${content}`); return { message_id: 1 } } }),
    }, { scene: 'group', chatId: 'g2' }, 'hi')
    assert.equal(viaGroup, true)
    assert.deepEqual(calls, ['group:g2:hi'])

    calls.length = 0
    const viaGroupMsg = await dispatchToChat({
        sendGroupMsg: (groupId, content) => { calls.push(`sendGroupMsg:${groupId}:${content}`); return true },
    }, { scene: 'group', chatId: 'g3' }, 'hi')
    assert.equal(viaGroupMsg, true)
    assert.deepEqual(calls, ['sendGroupMsg:g3:hi'])

    calls.length = 0
    const viaFriend = await dispatchToChat({
        sendFriendMsg: (botId, userId, content) => { calls.push(`friend:${botId}:${userId}:${content}`); return true },
    }, { scene: 'private', userId: 'u1', botId: '9' }, 'hi')
    assert.equal(viaFriend, true)
    assert.deepEqual(calls, ['friend:9:u1:hi'])

    calls.length = 0
    const viaFriendObject = await dispatchToChat({
        pickFriend: userId => ({ sendMsg: (/** @type {any} */ content) => { calls.push(`friendObj:${userId}:${content}`); return true } }),
    }, { scene: 'private', userId: 'u2' }, 'hi')
    assert.equal(viaFriendObject, true)
    assert.deepEqual(calls, ['friendObj:u2:hi'])

    assert.equal(await dispatchToChat({}, { scene: 'group', chatId: 'g4' }, 'hi'), false)
    assert.equal(await dispatchToChat({}, null, 'hi'), false)
    assert.equal(await dispatchToChat({
        pickBot: () => ({ selfId: 'bot' }),
        sendMessage: () => { throw new Error('boom') },
    }, { scene: 'group', chatId: 'g5' }, 'hi'), false)
    assert.equal(await dispatchToChat({
        sendMessage: () => false,
    }, { scene: 'group', chatId: 'g6' }, 'hi'), false)
})

test('yunzai adapter sends to groups and private chats directly', async () => {
    /** @type {any[]} */
    const sent = []
    const host = /** @type {any} */ (globalThis)
    host.Bot = {
        pickGroup: async (/** @type {string} */ groupId) => ({
            sendMsg: async (/** @type {any} */ content) => { sent.push(['group', groupId, content]); return { message_id: 1 } },
        }),
        sendFriendMsg: async (/** @type {string} */ botId, /** @type {string} */ userId, /** @type {any} */ content) => {
            sent.push(['friend', botId, userId, content])
            return true
        },
    }
    const sendToChat = /** @type {(target: any, msg: any) => Promise<boolean>} */ (
        /** @type {any} */ (yunzaiAdapter).sendToChat.bind(yunzaiAdapter)
    )
    try {
        assert.equal(await sendToChat({ scene: 'group', chatId: 'g1', botId: '9' }, 'hello'), true)
        assert.equal(sent[0][0], 'group')
        assert.equal(sent[0][1], 'g1')

        assert.equal(await sendToChat({ scene: 'private', userId: 'u1', botId: '9' }, 'hi'), true)
        assert.deepEqual(sent[1].slice(0, 3), ['friend', '9', 'u1'])

        /** 缺少必要字段时返回 false，调用方回滚 */
        assert.equal(await sendToChat({ scene: 'group' }, 'x'), false)
    } finally {
        host.Bot = undefined
    }
})
