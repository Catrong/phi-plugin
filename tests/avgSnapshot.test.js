import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import test from 'node:test'
import { lookupAvgRange, readSnapshotBundle } from '../model/api/avgSnapshot.js'

/** @param {number} age */
function bundle(age) {
    const all = gzipSync(JSON.stringify({'3000,3020':{'song.0':{IN:[97.5,2]}}}))
    const b30 = gzipSync(JSON.stringify({'3000,3020':{'song.0':{IN:[99,1]}}}))
    /** @param {Buffer} bytes */
    const describe = bytes => ({bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex')})
    const manifest = {format:1, version:randomUUID(), generatedAt:new Date(Date.now()-age).toISOString(), files:{all:describe(all),b30:describe(b30)}}
    return Buffer.concat([Buffer.from(JSON.stringify(manifest)+'\n'),all,b30])
}

test('重启后从同一版本读取两种均值，保留无样本状态', async () => {
    const snapshot = await readSnapshotBundle(bundle(0))
    assert.ok(snapshot)
    const range = {minRks:15,maxRks:15.10}
    const all = lookupAvgRange(snapshot.data.all,range)
    assert.deepEqual(all?.['song.0'].IN,[97.5,2])
    assert.deepEqual(lookupAvgRange(snapshot.data.b30,range)?.['song.0'].IN,[99,1])
    assert.equal(all?.['song.0'].AT,undefined)
})

test('过期快照不可用，第二个文件截断时拒绝整套快照', async () => {
    assert.equal(await readSnapshotBundle(bundle(48*3600_000)),undefined)
    await assert.rejects(readSnapshotBundle(bundle(0).subarray(0,-1)),/校验失败/)
})
