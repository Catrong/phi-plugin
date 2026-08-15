import assert from 'node:assert/strict'
import test from 'node:test'
import { BotSyncService } from '../model/api/botSyncService.js'
import makeRequest from '../model/api/makeRequest.js'
import { setPlatformAdapter } from '../components/platform/index.js'

test('Bot sync acknowledges a message only after private delivery succeeds', async () => {
    const service = new BotSyncService()
    const originalSync = makeRequest.syncBot
    /** @type {any[]} */
    const requests = []
    let delivered = 0
    makeRequest.syncBot = async body => {
        requests.push(body)
        return {
            ok: true,
            serverTime: new Date().toISOString(),
            nextSyncAfterSeconds: 60,
            reporting: { renderPressure: false },
            messages: requests.length === 1 ? [{
                id: '00000000-0000-4000-8000-000000000001',
                type: 'test',
                schemaVersion: 1,
                target: { platform: 'yunzai', platformId: '10001' },
                text: '审核结果',
                payload: {},
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
            }] : [],
        }
    }
    setPlatformAdapter({ relpyPrivate: async () => { delivered += 1; return { message_id: 'sent' } } })
    try {
        await service.sync()
        assert.equal(delivered, 1)
        assert.deepEqual(requests[0].acknowledgedMessageIds, [])
        await service.sync()
        assert.deepEqual(requests[1].acknowledgedMessageIds, ['00000000-0000-4000-8000-000000000001'])
    } finally {
        makeRequest.syncBot = originalSync
    }
})
