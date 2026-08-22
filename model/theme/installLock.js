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

/** @param {number} pid */
function processAlive(pid) {
    if (!Number.isSafeInteger(pid) || pid <= 0) return false
    try {
        process.kill(pid, 0)
        return true
    } catch (error) {
        return /** @type {any} */ (error)?.code === 'EPERM'
    }
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
        && !processAlive(Number(state.owner?.pid))
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
                await handle.writeFile(JSON.stringify({ pid: process.pid, token, createdAt: new Date().toISOString() }))
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
