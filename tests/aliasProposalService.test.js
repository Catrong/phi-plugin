import assert from 'node:assert/strict'
import test from 'node:test'
import aliasProposalService, { formatAliasNotification, validateApprovedAliasSnapshot } from '../model/aliasProposalService.js'
import getInfo from '../model/getInfo.js'
import getSave from '../model/getSave.js'
import { setPlatformAdapter } from '../components/platform/index.js'
import { aliasProposal } from '../apps/aliasProposal.js'

test('provides a callable scheduled-task handler for the Yunzai loader', async () => {
    const originalInitialize = aliasProposalService.initialize
    const originalScheduledTask = aliasProposalService.scheduledTask
    let calls = 0
    aliasProposalService.initialize = async () => {}
    aliasProposalService.scheduledTask = async () => { calls++ }
    try {
        const plugin = new aliasProposal()
        const task = /** @type {import('../components/platform/types.js').PlatformTask} */ (plugin.task)
        assert.equal(task.cron, '0 */5 * * * ?')
        assert.equal(typeof task.fnc, 'function')
        await /** @type {() => Promise<unknown>} */ (task.fnc)()
        assert.equal(calls, 1)
    } finally {
        aliasProposalService.initialize = originalInitialize
        aliasProposalService.scheduledTask = originalScheduledTask
    }
})

test('validates the public YAML shape and rejects malformed values', () => {
    assert.deepEqual(validateApprovedAliasSnapshot({ song: ['nick', 'other'] }), { song: ['nick', 'other'] })
    assert.throws(() => validateApprovedAliasSnapshot([]), /Invalid alias snapshot/)
    assert.throws(() => validateApprovedAliasSnapshot({ song: 'nick' }), /Invalid alias snapshot/)
    assert.throws(() => validateApprovedAliasSnapshot({ song: [''] }), /Invalid alias snapshot/)
})

test('rebuilds separate bundled and approved alias layers', () => {
    const songWithout0 = /** @type {idStringWithout0} */ ('song')
    const songWith0 = /** @type {idString} */ ('song.0')
    getInfo.baseNicklist = { [songWithout0]: ['base', 'shared'] }
    getInfo.setApprovedAliasSnapshot({ song: ['remote', 'SHARED'], other: ['multi'] })
    assert.deepEqual(getInfo.nicklist?.[songWith0], ['base', 'shared', 'remote'])
    assert.deepEqual(getInfo.songnick?.remote, [songWith0])
    getInfo.setApprovedAliasSnapshot({ other: ['multi'] })
    assert.equal(getInfo.songnick?.remote, undefined)
    assert.deepEqual(getInfo.nicklist?.[songWith0], ['base', 'shared'])
})

test('keeps alias notification metadata adjacent to the existing token binding', async () => {
    await getSave.add_user_token('user', /** @type {phigrosToken} */ ('token-value'))
    await getSave.set_alias_binding('user', {
        clientId: 'client', aliasNotificationKey: 'key', aliasNotificationKeyUpdatedAt: 'now', botId: 'bot',
    })
    const binding = await getSave.get_alias_binding('user')
    assert.ok(binding)
    assert.equal(binding.aliasNotificationKey, 'key')
    await getSave.del_user_token('user')
    assert.equal(await getSave.get_user_token('user'), null)
    assert.equal(await getSave.get_alias_binding('user'), null)
})

test('confirms notifications only after a successful private message', async () => {
    const clientId = '00000000-0000-4000-8000-000000000001'
    await getSave.set_alias_binding('notify-user', {
        clientId,
        aliasNotificationKey: 'ank_test_key_123456789',
        aliasNotificationKeyUpdatedAt: 'now',
        botId: 'bot',
    })
    /** @type {Array<{url: string, body: any}>} */
    const calls = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = /** @type {typeof fetch} */ (async (url, options = {}) => {
        calls.push({ url: String(url), body: JSON.parse(String(options.body || '{}')) })
        if (String(url).endsWith('/poll')) {
            return new Response(JSON.stringify({ clients: [{
                clientId,
                items: [{
                    id: '00000000-0000-4000-8000-000000000002',
                    proposalId: 'proposal',
                    type: 'final_approved',
                    payload: { alias: 'nick', songId: 'song.0', status: 'approved' },
                }],
            }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return new Response(JSON.stringify({ confirmed: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    setPlatformAdapter({ relpyPrivate: async () => ({ message_id: 'sent' }) })
    try {
        await aliasProposalService.pollNotifications()
        assert.equal(calls.length, 2)
        assert.equal(calls[1].body.clients[0].notificationIds.length, 1)
        assert.match(formatAliasNotification({ id: 'notification', proposalId: 'proposal', type: 'final_approved', payload: {} }), /正式通过/)
    } finally {
        globalThis.fetch = originalFetch
    }
})
