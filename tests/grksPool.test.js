import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
    clearPoolCache,
    countRecords,
    getPool,
    pickEntry,
    rebuildPool,
    setPoolPaths,
} from '../model/game/grks/pool.js'

/**
 * 在临时目录写一份最小存档。
 * @param {string} dir 存档根目录
 * @param {string} token sessionToken
 * @param {{records?: number, rks?: number}} [options]
 */
function writeSave(dir, token, options = {}) {
    const records = options.records ?? 30
    /** @type {Record<string, any[]>} */
    const gameRecord = {}
    for (let index = 0; index < records; index++) {
        gameRecord[`song-${token}-${index}.0`] = [{ score: 990000, acc: 98.5, fc: false }]
    }
    const savePath = path.join(dir, token)
    fs.mkdirSync(savePath, { recursive: true })
    fs.writeFileSync(path.join(savePath, 'save.json'), JSON.stringify({
        session: token,
        saveInfo: { summary: { rankingScore: options.rks ?? 15.5 } },
        gameRecord,
    }), 'utf8')
}

/** 建立隔离的临时存档目录与池缓存文件。 */
function setupPoolFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phi-grks-pool-'))
    const saveDir = path.join(root, 'saveData')
    fs.mkdirSync(saveDir, { recursive: true })
    setPoolPaths({ saveDir, poolFile: path.join(root, 'grksPool.json') })
    clearPoolCache()
    return { root, saveDir }
}

test('counts valid records only', () => {
    assert.equal(countRecords(null), 0)
    assert.equal(countRecords({}), 0)
    assert.equal(countRecords({ gameRecord: { a: [{ score: 100 }, { score: 0 }, { score: 1 }, { score: 2 }, { score: 999 }] } }), 3)
    assert.equal(countRecords({ gameRecord: { a: [{ score: 100 }], b: 'bad' } }), 1)
})

test('keeps only saves with enough records', () => {
    const { saveDir } = setupPoolFixture()
    writeSave(saveDir, 'full', { records: 30, rks: 16.1 })
    writeSave(saveDir, 'edge', { records: 27, rks: 15.2 })
    writeSave(saveDir, 'small', { records: 26, rks: 14.9 })
    fs.mkdirSync(path.join(saveDir, 'empty'), { recursive: true })

    const pool = rebuildPool(27)
    assert.equal(pool.scanned, 4)
    assert.deepEqual(pool.entries.map(entry => entry.token).sort(), ['edge', 'full'])
    assert.equal(pool.entries.find(entry => entry.token === 'full')?.rks, 16.1)
    assert.equal(pool.entries.find(entry => entry.token === 'full')?.recordCount, 30)

    /** 未变化的存档复用旧统计，不重复解析 */
    const reused = rebuildPool(27, pool)
    assert.deepEqual(reused.entries.map(entry => entry.token).sort(), ['edge', 'full'])
    assert.equal(reused.entries.find(entry => entry.token === 'full')?.mtime, pool.entries.find(entry => entry.token === 'full')?.mtime)
})

test('picks entries while excluding the requester', async () => {
    const { saveDir } = setupPoolFixture()
    writeSave(saveDir, 'mine', { records: 30 })
    writeSave(saveDir, 'other', { records: 30 })

    const picked = await pickEntry({ minRecord: 27, rng: () => 0 })
    assert.ok(picked)
    assert.equal(picked?.fallback, false)
    assert.equal(picked?.entry.token, 'mine')

    const excluded = await pickEntry({ excludeTokens: ['mine'], minRecord: 27, rng: () => 0 })
    assert.equal(excluded?.entry.token, 'other')
    assert.equal(excluded?.fallback, false)

    const fallback = await pickEntry({ excludeTokens: ['mine', 'other'], minRecord: 27, rng: () => 0 })
    assert.equal(fallback?.fallback, true)

    const none = await pickEntry({ excludeTokens: ['mine', 'other'], allowFallback: false, minRecord: 27 })
    assert.equal(none, null)
})

test('caches the pool for the configured window', async () => {
    const { saveDir } = setupPoolFixture()
    writeSave(saveDir, 'a', { records: 30 })
    const first = await getPool({ minRecord: 27, refreshHours: 1 })
    assert.equal(first.entries.length, 1)

    writeSave(saveDir, 'b', { records: 30 })
    const cached = await getPool({ minRecord: 27, refreshHours: 1 })
    assert.equal(cached.entries.length, 1)

    const forced = await getPool({ minRecord: 27, refreshHours: 1, force: true })
    assert.equal(forced.entries.length, 2)

    const zeroWindow = await getPool({ minRecord: 27, refreshHours: 0 })
    assert.equal(zeroWindow.entries.length, 2)
})
