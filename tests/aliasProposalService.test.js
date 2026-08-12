import assert from 'node:assert/strict'
import test from 'node:test'
import aliasProposalService, { formatAliasNotification, validateApprovedAliasSnapshot } from '../model/api/aliasProposalService.js'
import getInfo from '../model/game/getInfo.js'
import makeRequest from '../model/api/makeRequest.js'
import userCredentialStore from '../model/user/userCredentialStore.js'
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

test('uses the stored sessionToken through the concrete makeRequest proposal method', async () => {
    await userCredentialStore.setSessionToken('proposal-user', /** @type {phigrosToken} */ ('proposal-session-token'))
    const originalCreate = makeRequest.createAliasProposal
    /** @type {any} */ let received
    makeRequest.createAliasProposal = async params => {
        received = params
        return /** @type {any} */ ({ id: 'proposal', alias: params.alias, songId: params.songId })
    }
    try {
        const proposal = await aliasProposalService.create(/** @type {any} */ ({ userId: 'proposal-user' }), {
            songId: 'song.0', alias: 'nick', note: 'note',
        })
        assert.ok(proposal)
        assert.equal(proposal.id, 'proposal')
        assert.deepEqual(received, {
            token: 'proposal-session-token',
            alias: 'nick',
            songId: 'song.0',
            note: 'note',
            source: 'bot',
        })
    } finally {
        makeRequest.createAliasProposal = originalCreate
        await userCredentialStore.deleteSessionToken('proposal-user')
    }
})

test('confirms notifications only after a successful private message', async () => {
    await userCredentialStore.setSessionToken('notify-user', /** @type {phigrosToken} */ ('notify-session-token'))
    /** @type {Array<{type: string, body: any}>} */
    const calls = []
    const originalPoll = makeRequest.pollAliasNotifications
    const originalConfirm = makeRequest.confirmAliasNotifications
    makeRequest.pollAliasNotifications = async body => {
        calls.push({ type: 'poll', body })
        return {
            sessions: [{
                requestId: body.sessions[0].requestId,
                items: [{
                    id: '00000000-0000-4000-8000-000000000002',
                    proposalId: 'proposal',
                    type: 'final_approved',
                    payload: { alias: 'nick', songId: 'song.0', status: 'approved' },
                }],
            }],
        }
    }
    makeRequest.confirmAliasNotifications = async body => {
        calls.push({ type: 'confirm', body })
        return { confirmed: 1 }
    }
    setPlatformAdapter({ relpyPrivate: async () => ({ message_id: 'sent' }) })
    try {
        await aliasProposalService.pollNotifications()
        assert.equal(calls.length, 2)
        assert.equal(calls[0].body.sessions[0].token, 'notify-session-token')
        assert.match(calls[0].body.sessions[0].requestId, /^[0-9a-f-]{36}$/)
        assert.equal(calls[1].body.sessions[0].token, 'notify-session-token')
        assert.equal(calls[1].body.sessions[0].notificationIds.length, 1)
        assert.match(formatAliasNotification({ id: 'notification', proposalId: 'proposal', type: 'final_approved', payload: {} }), /正式通过/)
    } finally {
        makeRequest.pollAliasNotifications = originalPoll
        makeRequest.confirmAliasNotifications = originalConfirm
        await userCredentialStore.deleteSessionToken('notify-user')
    }
})
