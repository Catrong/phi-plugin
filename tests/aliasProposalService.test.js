import assert from 'node:assert/strict'
import test from 'node:test'
import aliasProposalService, { validateApprovedAliasSnapshot } from '../model/api/aliasProposalService.js'
import getInfo from '../model/game/getInfo.js'
import makeRequest from '../model/api/makeRequest.js'
import userCredentialStore from '../model/user/userCredentialStore.js'
import { aliasProposal } from '../apps/aliasProposal.js'
import botSyncService from '../model/api/botSyncService.js'

test('provides a callable scheduled-task handler for the Yunzai loader', async () => {
    const originalInitialize = aliasProposalService.initialize
    const originalScheduledTask = aliasProposalService.scheduledTask
    const originalBotInitialize = botSyncService.initialize
    const originalBotScheduledTask = botSyncService.scheduledTask
    let calls = 0
    aliasProposalService.initialize = async () => {}
    aliasProposalService.scheduledTask = async () => { calls++ }
    botSyncService.initialize = async () => {}
    botSyncService.scheduledTask = async () => { calls++ }
    try {
        const plugin = new aliasProposal()
        const task = /** @type {import('../components/platform/types.js').PlatformTask} */ (plugin.task)
        assert.equal(task.cron, '0 * * * * ?')
        assert.equal(typeof task.fnc, 'function')
        await /** @type {() => Promise<unknown>} */ (task.fnc)()
        assert.equal(calls, 2)
    } finally {
        aliasProposalService.initialize = originalInitialize
        aliasProposalService.scheduledTask = originalScheduledTask
        botSyncService.initialize = originalBotInitialize
        botSyncService.scheduledTask = originalBotScheduledTask
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
            platform: 'yunzai',
            platform_id: 'proposal-user',
            _local_user_id: 'proposal-user',
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
