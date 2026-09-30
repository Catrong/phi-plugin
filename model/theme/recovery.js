import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { migrateLegacyThemeDirectories, themesDir } from './paths.js'

const WORK_DIR = path.join(themesDir, '.phi-market-work')
const WORK_STALE_MS = 60 * 60_000
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'

/** @param {string} receiptPath */
export async function readMarketReceipt(receiptPath) {
    try {
        const value = JSON.parse(await fs.promises.readFile(receiptPath, 'utf8'))
        if (value?.source !== 'phi-theme-marketplace' || typeof value?.slug !== 'string'
            || typeof value?.version !== 'string' || !/^[a-f0-9]{64}$/.test(value?.sha256)) return null
        return value
    } catch {
        return null
    }
}

/** @param {string} value */
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** @param {string} themeId @param {string} entryName */
function isThemeBackupName(themeId, entryName) {
    return new RegExp(`^\\.phi-market-backup-${escapeRegExp(themeId)}-${UUID_PATTERN}$`, 'i').test(entryName)
}

/** @param {string} entryName */
export function getBackupThemeId(entryName) {
    const match = new RegExp(`^\\.phi-market-backup-([a-z][a-z0-9_-]{0,119})-${UUID_PATTERN}$`, 'i').exec(entryName)
    return match?.[1] || null
}

/**
 * @param {string} directory
 * @param {string} themeId
 * @returns {Promise<{exists:boolean,healthy:boolean,marketOwned:boolean,receipt:any}>}
 */
async function inspectMarketThemeDirectory(directory, themeId) {
    const stat = await fs.promises.lstat(directory).catch(() => null)
    if (!stat) return { exists: false, healthy: false, marketOwned: false, receipt: null }
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
        return { exists: true, healthy: false, marketOwned: false, receipt: null }
    }

    const receiptPath = path.join(directory, '.phi-market.json')
    const receiptMarker = await fs.promises.lstat(receiptPath).catch(() => null)
    const receipt = await readMarketReceipt(receiptPath)
    let info = null
    try {
        info = YAML.parse(await fs.promises.readFile(path.join(directory, 'info.yaml'), 'utf8'))
    } catch { }
    return {
        exists: true,
        healthy: info?.id === themeId && receipt?.slug === themeId,
        // This marker is reserved for marketplace installs. A truncated marker
        // still distinguishes an interrupted install from a same-name local theme.
        marketOwned: Boolean(receiptMarker?.isFile()),
        receipt,
    }
}

/** @param {boolean} [force] @param {string} [workDirectory] */
export async function cleanStaleMarketWork(force = false, workDirectory = WORK_DIR) {
    const now = Date.now()
    const entries = await fs.promises.readdir(workDirectory, { withFileTypes: true }).catch(error => {
        if (/** @type {any} */ (error)?.code === 'ENOENT') return []
        throw error
    })
    for (const entry of entries) {
        const fullPath = path.join(workDirectory, entry.name)
        const stat = await fs.promises.stat(fullPath).catch(() => null)
        if (stat && (force || now - stat.mtimeMs > WORK_STALE_MS)) {
            await fs.promises.rm(fullPath, { recursive: true, force: true })
        }
    }
}

/** @param {string} themeId */
export async function recoverMarketInstall(themeId) {
    migrateLegacyThemeDirectories()
    await fs.promises.mkdir(WORK_DIR, { recursive: true, mode: 0o700 })
    const target = path.join(themesDir, themeId)
    const entries = await fs.promises.readdir(themesDir, { withFileTypes: true })
    const backups = entries.filter(entry => entry.isDirectory() && isThemeBackupName(themeId, entry.name))
    const candidates = await Promise.all(backups.map(async entry => {
        const fullPath = path.join(themesDir, entry.name)
        return {
            fullPath,
            stat: await fs.promises.stat(fullPath),
            state: await inspectMarketThemeDirectory(fullPath, themeId),
        }
    }))
    const healthyBackups = candidates
        .filter(item => item.state.healthy)
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    let targetState = await inspectMarketThemeDirectory(target, themeId)
    let recovered = false

    if ((!targetState.exists || targetState.marketOwned) && !targetState.healthy && healthyBackups.length) {
        const recoverable = healthyBackups[0]
        let displaced = ''
        if (targetState.exists) {
            displaced = path.join(WORK_DIR, `corrupt-${themeId}-${crypto.randomUUID()}`)
            await fs.promises.rename(target, displaced)
        }
        try {
            await fs.promises.rename(recoverable.fullPath, target)
            targetState = await inspectMarketThemeDirectory(target, themeId)
            if (!targetState.healthy) throw new Error(`Recovered theme ${themeId} failed validation`)
            recovered = true
            if (displaced) await fs.promises.rm(displaced, { recursive: true, force: true })
        } catch (error) {
            const restoredBackup = await fs.promises.lstat(target).catch(() => null)
            if (restoredBackup) await fs.promises.rename(target, recoverable.fullPath).catch(() => {})
            if (displaced) await fs.promises.rename(displaced, target).catch(() => {})
            throw error
        }
    }

    // Never discard a backup until a healthy marketplace target is present.
    // A same-name local theme blocks recovery but does not destroy the backup.
    if (targetState.healthy) {
        for (const candidate of candidates) {
            await fs.promises.rm(candidate.fullPath, { recursive: true, force: true })
        }
    }
    return { recovered, healthy: targetState.healthy }
}

/**
 * Recover every interrupted directory swap before the first theme scan.
 * `cleanAllWork` is safe only while the global install lock is held.
 * @param {{cleanAllWork?:boolean}} [options]
 */
export async function recoverAllMarketInstalls(options = {}) {
    await fs.promises.mkdir(themesDir, { recursive: true, mode: 0o700 })
    const entries = await fs.promises.readdir(themesDir, { withFileTypes: true })
    const themeIds = new Set(entries
        .filter(entry => entry.isDirectory())
        .map(entry => getBackupThemeId(entry.name))
        .filter(Boolean))
    /** @type {{themeId:string,error:unknown}[]} */
    const failures = []
    for (const themeId of themeIds) {
        try {
            await recoverMarketInstall(/** @type {string} */ (themeId))
        } catch (error) {
            failures.push({ themeId: /** @type {string} */ (themeId), error })
        }
    }
    try {
        await cleanStaleMarketWork(options.cleanAllWork === true)
        if (options.cleanAllWork) {
            for (const entry of entries) {
                if (!entry.isDirectory() || !/^\.phi-market-restore-[a-zA-Z0-9]+$/.test(entry.name)) continue
                await fs.promises.rm(path.join(themesDir, entry.name), { recursive: true, force: true })
            }
        }
    } catch (error) {
        failures.push({ themeId: '.phi-market-work', error })
    }
    return failures
}
