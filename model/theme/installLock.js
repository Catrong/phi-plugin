import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { AsyncLocalStorage } from 'node:async_hooks'
import { ThemeMarketClientError } from './marketClient.js'
import { migrateLegacyThemeDirectories, themesDir } from './paths.js'

const LOCK_PATH = path.join(themesDir, '.phi-market-install.lock')
const LOCK_REAP_PREFIX = `${LOCK_PATH}.reap-`
const LOCK_WAIT_MS = 120_000
const LOCK_STALE_MS = 5 * 60_000

/** @type {Promise<void>} */
let processQueue = Promise.resolve()
const installLockContext = new AsyncLocalStorage()

/** @param {number} ms */
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

/** @returns {string | null} 本进程的调度器启动标识（clock ticks）；非 Linux 或 /proc 不可用时返回 null */
function currentProcessStartIdentity() {
    try {
        const stat = fs.readFileSync(`/proc/${process.pid}/stat`, 'utf8')
        // comm 字段可能含空格和括号，字段从最后一个 ')' 之后数起：其后首列是第 3 列 state，
        // 因此第 22 列 starttime 的下标为 19。重启后 starttime 归零，可顺带识别跨重启的残留锁。
        return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19] || null
    } catch {
        return null
    }
}

/**
 * 核对锁记录的 pid 当前是否仍是当初那个进程：pid 被无关进程复用时启动标识不同，
 * 崩溃持有者的锁才能被回收，而不是被永久判为存活。
 * @param {number} pid @param {string | undefined} identity
 * @returns {boolean | null} 无法判定（非 Linux / proc 不可读 / 旧锁未记录）时为 null
 */
function processIdentityMatches(pid, identity) {
    if (!identity) return null
    try {
        const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
        const current = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]
        return current ? current === identity : null
    } catch {
        return null
    }
}

/** @param {number} pid @param {string | undefined} identity */
function processAlive(pid, identity) {
    if (!Number.isSafeInteger(pid) || pid <= 0) return false
    try {
        process.kill(pid, 0)
    } catch (error) {
        if (/** @type {any} */ (error)?.code !== 'EPERM') return false
    }
    // 无法核对启动标识时保持保守的“存活”结论，避免误清他人的锁。
    return processIdentityMatches(pid, identity) !== false
}

/** @returns {Promise<{stat:fs.Stats,owner:any,generation:string}|null>} */
async function readFileLockState() {
    const stat = await fs.promises.stat(LOCK_PATH).catch(() => null)
    if (!stat) return null
    const raw = await fs.promises.readFile(LOCK_PATH, 'utf8').catch(() => '')
    let owner = null
    try { owner = JSON.parse(raw) } catch { }
    const generation = typeof owner?.token === 'string' && /^[a-f0-9-]{36}$/i.test(owner.token)
        ? owner.token.toLowerCase()
        : `legacy-${crypto.createHash('sha256')
            .update(`${raw}\0${stat.dev}\0${stat.ino}\0${stat.mtimeMs}\0${stat.size}`)
            .digest('hex')}`
    return { stat, owner, generation }
}

/** @param {{stat:fs.Stats,owner:any}} state */
function isStaleFileLock(state) {
    return Date.now() - state.stat.mtimeMs > LOCK_STALE_MS
        && !processAlive(Number(state.owner?.pid), state.owner?.identity)
}

/**
 * A token-specific reap file elects one cleanup owner for a stale lock
 * generation. A crashed reaper fails closed for that generation instead of
 * letting a second process unlink a newly-created lock.
 */
async function reapStaleFileLock() {
    const observed = await readFileLockState()
    if (!observed || !isStaleFileLock(observed)) return false
    const reapPath = `${LOCK_REAP_PREFIX}${observed.generation}`
    let reapHandle
    try {
        reapHandle = await fs.promises.open(reapPath, 'wx', 0o600)
        await reapHandle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }))
        await reapHandle.sync()
    } catch (error) {
        if (reapHandle) {
            await reapHandle.close().catch(() => {})
            await fs.promises.rm(reapPath, { force: true }).catch(() => {})
        }
        if (/** @type {any} */ (error)?.code === 'EEXIST') return false
        throw error
    }

    try {
        const current = await readFileLockState()
        if (!current || current.generation !== observed.generation || !isStaleFileLock(current)) return false
        await fs.promises.unlink(LOCK_PATH).catch(error => {
            if (/** @type {any} */ (error)?.code !== 'ENOENT') throw error
        })
        return true
    } finally {
        await reapHandle.close().catch(() => {})
        await fs.promises.rm(reapPath, { force: true }).catch(() => {})
    }
}

async function acquireFileLock() {
    migrateLegacyThemeDirectories()
    await fs.promises.mkdir(themesDir, { recursive: true, mode: 0o700 })
    const started = Date.now()
    while (Date.now() - started < LOCK_WAIT_MS) {
        let handle
        try {
            handle = await fs.promises.open(LOCK_PATH, 'wx', 0o600)
            const token = crypto.randomUUID()
            try {
                await handle.writeFile(JSON.stringify({
                    pid: process.pid,
                    identity: currentProcessStartIdentity(),
                    token,
                    createdAt: new Date().toISOString(),
                }))
                await handle.sync()
                return { handle, token }
            } catch (error) {
                await handle.close().catch(() => {})
                await fs.promises.rm(LOCK_PATH, { force: true }).catch(() => {})
                throw error
            }
        } catch (error) {
            if (/** @type {any} */ (error)?.code !== 'EEXIST') throw error
            if (await reapStaleFileLock()) continue
            await wait(200)
        }
    }
    throw new ThemeMarketClientError('theme_install_busy')
}

/** @template T @param {() => Promise<T>} operation @returns {Promise<T>} */
export async function withMarketInstallLock(operation) {
    if (installLockContext.getStore()) return operation()
    const previous = processQueue.catch(() => {})
    /** @type {() => void} */
    let releaseQueue = () => {}
    processQueue = new Promise(resolve => { releaseQueue = () => resolve() })
    await previous
    let lock
    try {
        lock = await acquireFileLock()
        return await installLockContext.run(lock, operation)
    } finally {
        if (lock) {
            await lock.handle.close().catch(() => {})
            const current = await readFileLockState()
            if (current?.owner?.token === lock.token) {
                await fs.promises.rm(LOCK_PATH, { force: true }).catch(() => {})
            }
        }
        releaseQueue()
    }
}

export const marketInstallLockPath = LOCK_PATH
