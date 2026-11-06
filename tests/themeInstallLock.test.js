import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { marketInstallLockPath, withMarketInstallLock } from '../model/theme/installLock.js'
import { themesDir } from '../model/theme/paths.js'

const lockPath = marketInstallLockPath
/** @param {string} token */
const reapPathOf = token => `${lockPath}.reap-${token}`

/** 刚退出的子进程 pid：必然已死，用来模拟崩溃的锁持有者或回收者。 */
function deadPid() {
    return spawnSync(process.execPath, ['-e', ''], { stdio: 'ignore' }).pid ?? 0
}

/** @param {string} token @param {number} pid */
function writeStaleLock(token, pid) {
    fs.mkdirSync(themesDir, { recursive: true })
    fs.writeFileSync(lockPath, JSON.stringify({
        pid,
        identity: null,
        token,
        createdAt: new Date().toISOString(),
    }), { mode: 0o600 })
    const backdated = new Date(Date.now() - 10 * 60_000)
    fs.utimesSync(lockPath, backdated, backdated)
}

test('回收者被杀后残留的 reap 文件不再让安装锁永久卡死', async () => {
    const token = crypto.randomUUID()
    writeStaleLock(token, deadPid())
    fs.writeFileSync(reapPathOf(token), JSON.stringify({ pid: deadPid(), createdAt: new Date().toISOString() }))
    let entered = false
    try {
        await withMarketInstallLock(async () => { entered = true })
        assert.equal(entered, true)
        assert.equal(fs.existsSync(lockPath), false)
        assert.equal(fs.existsSync(reapPathOf(token)), false)
    } finally {
        fs.rmSync(lockPath, { force: true })
        fs.rmSync(reapPathOf(token), { force: true })
    }
})

test('PHI_MARKET_LOCK_WAIT_MS 可以缩短锁等待上限', async () => {
    const previous = process.env.PHI_MARKET_LOCK_WAIT_MS
    fs.mkdirSync(themesDir, { recursive: true })
    fs.writeFileSync(lockPath, JSON.stringify({
        pid: process.pid,
        identity: null,
        token: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    }), { mode: 0o600 })
    process.env.PHI_MARKET_LOCK_WAIT_MS = '300'
    const started = Date.now()
    try {
        await assert.rejects(withMarketInstallLock(async () => { }), error => /** @type {any} */ (error)?.code === 'theme_install_busy')
        assert.ok(Date.now() - started < 5000, `等待时间应远小于默认 120 秒，实际 ${Date.now() - started}ms`)
    } finally {
        if (previous === undefined) delete process.env.PHI_MARKET_LOCK_WAIT_MS
        else process.env.PHI_MARKET_LOCK_WAIT_MS = previous
        fs.rmSync(lockPath, { force: true })
    }
})
