import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { ThemeMarketClientError } from './marketClient.js'
import { themesDir } from './paths.js'
import { getBackupThemeId, readMarketReceipt } from './recovery.js'

export const MARKET_INSTALL_LIMITS = Object.freeze({
    maxPending: 8,
    maxInstalled: 32,
    maxDiskBytes: 512 * 1024 * 1024,
    freshInstallsPerUser: 3,
    freshInstallWindowMs: 60 * 60_000,
})

/** @param {string} directory */
async function directorySize(directory) {
    let total = 0
    const entries = await fs.promises.readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
        const target = path.join(directory, entry.name)
        if (entry.isDirectory()) total += await directorySize(target)
        else total += (await fs.promises.lstat(target)).size
    }
    return total
}

/**
 * @param {{root?:string}} [options]
 * @returns {Promise<{count:number,totalBytes:number,byTheme:Map<string, number>}>}
 */
export async function getMarketThemeStorageUsage(options = {}) {
    const root = options.root || themesDir
    const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(error => {
        if (/** @type {any} */ (error)?.code === 'ENOENT') return []
        throw error
    })
    /** @type {Map<string, number>} */
    const byTheme = new Map()
    let totalBytes = 0
    for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const themeId = entry.name.startsWith('.') ? getBackupThemeId(entry.name) : entry.name
        if (!themeId) continue
        const directory = path.join(root, entry.name)
        const stat = await fs.promises.lstat(directory)
        if (!stat.isDirectory() || stat.isSymbolicLink()) continue
        const marker = await fs.promises.lstat(path.join(directory, '.phi-market.json')).catch(() => null)
        const receipt = await readMarketReceipt(path.join(directory, '.phi-market.json'))
        if (receipt?.slug !== themeId && !marker?.isFile()) continue
        const bytes = await directorySize(directory)
        byTheme.set(themeId, (byTheme.get(themeId) || 0) + bytes)
        totalBytes += bytes
    }
    return { count: byTheme.size, totalBytes, byTheme }
}

/**
 * Reject a new theme before downloading when the current installation already
 * exhausts a hard quota. The staged directory is checked again before commit.
 * @param {string} themeId
 * @param {{root?:string,maxInstalled?:number,maxDiskBytes?:number}} [options]
 */
export async function assertFreshMarketInstallCapacity(themeId, options = {}) {
    const usage = await getMarketThemeStorageUsage(options)
    if (usage.byTheme.has(themeId)) return { fresh: false, usage }
    const maxInstalled = options.maxInstalled ?? MARKET_INSTALL_LIMITS.maxInstalled
    const maxDiskBytes = options.maxDiskBytes ?? MARKET_INSTALL_LIMITS.maxDiskBytes
    if (usage.count >= maxInstalled) throw new ThemeMarketClientError('theme_install_count_quota_exceeded')
    if (usage.totalBytes >= maxDiskBytes) throw new ThemeMarketClientError('theme_install_disk_quota_exceeded')
    return { fresh: true, usage }
}

/**
 * Check the exact post-commit count and byte usage while the install lock is held.
 * @param {string} themeId
 * @param {string} stagedDirectory
 * @param {{root?:string,maxInstalled?:number,maxDiskBytes?:number}} [options]
 */
export async function assertMarketInstallQuota(themeId, stagedDirectory, options = {}) {
    const usage = await getMarketThemeStorageUsage(options)
    const incomingBytes = await directorySize(stagedDirectory)
    const existingBytes = usage.byTheme.get(themeId) || 0
    const nextCount = usage.count + (usage.byTheme.has(themeId) ? 0 : 1)
    const nextBytes = usage.totalBytes - existingBytes + incomingBytes
    const maxInstalled = options.maxInstalled ?? MARKET_INSTALL_LIMITS.maxInstalled
    const maxDiskBytes = options.maxDiskBytes ?? MARKET_INSTALL_LIMITS.maxDiskBytes
    if (nextCount > maxInstalled) throw new ThemeMarketClientError('theme_install_count_quota_exceeded')
    if (nextBytes > maxDiskBytes) throw new ThemeMarketClientError('theme_install_disk_quota_exceeded')
    return { count: nextCount, totalBytes: nextBytes }
}

export class FreshInstallRateLimiter {
    /** @param {{limit?:number,windowMs?:number,now?:()=>number}} [options] */
    constructor(options = {}) {
        this.limit = options.limit ?? MARKET_INSTALL_LIMITS.freshInstallsPerUser
        this.windowMs = options.windowMs ?? MARKET_INSTALL_LIMITS.freshInstallWindowMs
        this.now = options.now || Date.now
        /** @type {Map<string, number[]>} */
        this.records = new Map()
    }

    /** @param {string} requesterId */
    consume(requesterId) {
        requesterId ||= 'unknown'
        const now = this.now()
        const cutoff = now - this.windowMs
        const recent = (this.records.get(requesterId) || []).filter(timestamp => timestamp > cutoff)
        if (recent.length >= this.limit) throw new ThemeMarketClientError('theme_install_rate_limited', 429)
        recent.push(now)
        this.records.set(requesterId, recent)
        return true
    }

    /** @param {string} [requesterId] */
    clear(requesterId) {
        if (requesterId) this.records.delete(requesterId)
        else this.records.clear()
    }
}

export class PersistentFreshInstallRateLimiter {
    /** @param {{filePath?:string,limit?:number,windowMs?:number,now?:()=>number}} [options] */
    constructor(options = {}) {
        this.filePath = options.filePath || path.join(themesDir, '.phi-market-rate-limits.json')
        this.limit = options.limit ?? MARKET_INSTALL_LIMITS.freshInstallsPerUser
        this.windowMs = options.windowMs ?? MARKET_INSTALL_LIMITS.freshInstallWindowMs
        this.now = options.now || Date.now
    }

    /** @returns {Promise<Record<string, number[]>>} */
    async readRecords() {
        let value
        try {
            value = JSON.parse(await fs.promises.readFile(this.filePath, 'utf8'))
        } catch (error) {
            if (/** @type {any} */ (error)?.code === 'ENOENT') return {}
            throw new ThemeMarketClientError('theme_install_rate_state_invalid')
        }
        if (value?.version !== 1 || !value.records || typeof value.records !== 'object' || Array.isArray(value.records)) {
            throw new ThemeMarketClientError('theme_install_rate_state_invalid')
        }
        const entries = Object.entries(value.records)
        if (entries.length > 10_000) throw new ThemeMarketClientError('theme_install_rate_state_invalid')
        /** @type {Record<string, number[]>} */
        const records = {}
        for (const [key, timestamps] of entries) {
            if (!/^[a-f0-9]{64}$/.test(key) || !Array.isArray(timestamps)
                || timestamps.length > 1_000 || timestamps.some(item => !Number.isFinite(item))) {
                throw new ThemeMarketClientError('theme_install_rate_state_invalid')
            }
            records[key] = timestamps
        }
        return records
    }

    /** @param {Record<string, number[]>} records */
    async writeRecords(records) {
        await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 })
        const temporary = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`
        try {
            await fs.promises.writeFile(temporary, `${JSON.stringify({ version: 1, records })}\n`, {
                encoding: 'utf8', mode: 0o600, flag: 'wx',
            })
            await fs.promises.rename(temporary, this.filePath)
        } finally {
            await fs.promises.rm(temporary, { force: true }).catch(() => {})
        }
    }

    /**
     * The caller must hold the global market install lock so read-modify-write is
     * atomic across Bot workers.
     * @param {string} requesterId
     */
    async consume(requesterId) {
        const requesterKey = crypto.createHash('sha256').update(requesterId || 'unknown').digest('hex')
        const now = this.now()
        const cutoff = now - this.windowMs
        const records = await this.readRecords()
        for (const [key, timestamps] of Object.entries(records)) {
            const recent = timestamps.filter(timestamp => timestamp > cutoff)
            if (recent.length) records[key] = recent
            else delete records[key]
        }
        const recent = records[requesterKey] || []
        if (recent.length >= this.limit) throw new ThemeMarketClientError('theme_install_rate_limited', 429)
        if (!records[requesterKey] && Object.keys(records).length >= 10_000) {
            throw new ThemeMarketClientError('theme_install_rate_limited', 429)
        }
        recent.push(now)
        records[requesterKey] = recent
        await this.writeRecords(records)
        return true
    }

    /** @param {string} [requesterId] */
    async clear(requesterId) {
        if (requesterId === undefined) {
            await fs.promises.rm(this.filePath, { force: true })
            return
        }
        const records = await this.readRecords()
        const requesterKey = crypto.createHash('sha256').update(requesterId || 'unknown').digest('hex')
        delete records[requesterKey]
        if (Object.keys(records).length) await this.writeRecords(records)
        else await fs.promises.rm(this.filePath, { force: true })
    }
}

export class ThemeInstallCoordinator {
    /** @param {{maxPending?:number,concurrency?:number}} [options] */
    constructor(options = {}) {
        this.maxPending = options.maxPending ?? MARKET_INSTALL_LIMITS.maxPending
        this.concurrency = options.concurrency ?? 1
        this.active = 0
        /** @type {Array<{key:string,operation:()=>Promise<any>,promise:Promise<any>,resolve:(value:any)=>void,reject:(error:unknown)=>void}>} */
        this.queue = []
        /** @type {Map<string, Promise<any>>} */
        this.flights = new Map()
    }

    /** @template T @param {string} key @param {()=>Promise<T>} operation @returns {Promise<T>} */
    schedule(key, operation) {
        const existing = this.flights.get(key)
        if (existing) return existing
        if (this.active >= this.concurrency && this.queue.length >= this.maxPending) {
            return Promise.reject(new ThemeMarketClientError('theme_install_queue_full', 429))
        }

        /** @type {(value:T)=>void} */ let resolve = () => {}
        /** @type {(error:unknown)=>void} */ let reject = () => {}
        const promise = new Promise((resolvePromise, rejectPromise) => {
            resolve = resolvePromise
            reject = rejectPromise
        })
        const task = { key, operation, promise, resolve, reject }
        this.flights.set(key, promise)
        if (this.active < this.concurrency) this.start(task)
        else this.queue.push(task)
        return promise
    }

    /** @param {{key:string,operation:()=>Promise<any>,promise:Promise<any>,resolve:(value:any)=>void,reject:(error:unknown)=>void}} task */
    start(task) {
        this.active++
        Promise.resolve()
            .then(task.operation)
            .then(value => {
                if (this.flights.get(task.key) === task.promise) this.flights.delete(task.key)
                this.active--
                const next = this.queue.shift()
                if (next) this.start(next)
                task.resolve(value)
            }, error => {
                if (this.flights.get(task.key) === task.promise) this.flights.delete(task.key)
                this.active--
                const next = this.queue.shift()
                if (next) this.start(next)
                task.reject(error)
            })
    }
}

export const freshInstallRateLimiter = new PersistentFreshInstallRateLimiter()
export const marketInstallCoordinator = new ThemeInstallCoordinator()

/** @param {any} event */
export function getThemeInstallRequesterId(event) {
    const userId = event?.user_id ?? event?.userId
    if (userId === undefined || userId === null || userId === '') return ''
    const platform = event?.platform || event?.adapter || 'unknown'
    const botId = event?.self_id ?? event?.bot_id ?? event?.bot?.self_id ?? ''
    return `${platform}:${botId}:${userId}`
}
