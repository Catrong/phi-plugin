import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import YAML from 'yaml'
import { ThemeMarketClientError } from './marketClient.js'
import { themesDir } from './paths.js'
import {
    readMarketReceipt,
    recoverAllMarketInstalls as recoverAllMarketInstallsUnlocked,
    recoverMarketInstall as recoverMarketInstallUnlocked,
} from './recovery.js'
import { assertMarketInstallQuota } from './installGuard.js'
import { withMarketInstallLock } from './installLock.js'

export { withMarketInstallLock } from './installLock.js'

const THEMES_DIR = themesDir
const WORK_DIR = path.join(THEMES_DIR, '.phi-market-work')
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
const MAX_FILES = 128
const MAX_ENTRIES = 256
const MAX_EXTRACTED_BYTES = 50 * 1024 * 1024
const MAX_TEXT_BYTES = 5 * 1024 * 1024
const MAX_RESOURCE_BYTES = 20 * 1024 * 1024
const MAX_COMPRESSION_RATIO = 200

const RESERVED_IDS = new Set(['default', 'snow', 'star', 'dss2', 'topText', 'foolsDay'])
const TEXT_EXTENSIONS = new Set(['.art', '.css', '.json', '.md', '.txt', '.yaml'])
const ALLOWED_EXTENSIONS = new Set([
    '.art', '.avif', '.css', '.docx', '.gif', '.jpeg', '.jpg', '.json', '.md', '.otf', '.pdf', '.png',
    '.ttf', '.txt', '.webp', '.woff', '.woff2', '.yaml',
])
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

/** @typedef {{fileName:string, compressedSize:number, uncompressedSize:number, unixPermissions:(number|null)}} ZipEntry */

/** @param {unknown} error */
function normalizedZipError(error) {
    if (error instanceof ThemeMarketClientError) return error
    const message = error instanceof Error ? error.message : String(error)
    if (/invalid relative path|absolute path|backslash/i.test(message)) {
        return new ThemeMarketClientError('theme_package_unsafe_path')
    }
    return new ThemeMarketClientError('theme_package_invalid')
}

/** @param {string} zipPath @returns {Promise<import('jszip')>} */
async function loadZip(zipPath) {
    const stat = await fs.promises.stat(zipPath)
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_ARCHIVE_BYTES) {
        throw new ThemeMarketClientError('theme_package_invalid')
    }
    const buffer = await fs.promises.readFile(zipPath)
    try {
        return await JSZip.loadAsync(buffer)
    } catch (error) {
        throw normalizedZipError(error)
    }
}

/** @param {import('jszip').JSZipObject} file @returns {ZipEntry} */
function toZipEntry(file) {
    /** @type {any} */
    const raw = file
    const data = raw._data
    return {
        fileName: raw.unsafeOriginalName ?? file.name,
        compressedSize: typeof data?.compressedSize === 'number' ? data.compressedSize : 0,
        uncompressedSize: typeof data?.uncompressedSize === 'number' ? data.uncompressedSize : 0,
        unixPermissions: typeof file.unixPermissions === 'number' ? file.unixPermissions : null,
    }
}

/** @param {string} zipPath @returns {Promise<ZipEntry[]>} */
async function listZipEntries(zipPath) {
    const zip = await loadZip(zipPath)
    /** @type {ZipEntry[]} */
    const entries = Object.keys(zip.files).map(name => toZipEntry(zip.files[name]))
    if (entries.length > MAX_ENTRIES) throw new ThemeMarketClientError('theme_package_too_many_entries')
    return entries
}

/** @param {ZipEntry} entry */
function validateEntryName(entry) {
    const name = entry.fileName
    if (!name || /[\\\u0000-\u001f\u007f]/.test(name) || name.startsWith('/') || /^[A-Za-z]:/.test(name)) {
        throw new ThemeMarketClientError('theme_package_unsafe_path')
    }
    const directory = name.endsWith('/')
    const rawSegments = name.split('/')
    if (directory) rawSegments.pop()
    if (!rawSegments.length || rawSegments.some(segment => !segment || segment === '.' || segment === '..')) {
        throw new ThemeMarketClientError('theme_package_unsafe_path')
    }
    for (const segment of rawSegments) {
        if (segment.includes(':') || /[. ]$/.test(segment) || WINDOWS_RESERVED.test(segment)) {
            throw new ThemeMarketClientError('theme_package_unsafe_path')
        }
    }

    const mode = entry.unixPermissions
    if (mode) {
        const type = mode & 0o170000
        const allowedType = directory ? 0o040000 : 0o100000
        if (type !== 0 && type !== allowedType) {
            throw new ThemeMarketClientError('theme_package_special_file')
        }
    }
    return { directory, segments: rawSegments }
}

/** @param {ZipEntry[]} entries */
function validateArchiveLayout(entries) {
    if (!entries.length) throw new ThemeMarketClientError('theme_package_invalid')
    const seen = new Set()
    /** @type {string[][]} */
    const infoPaths = []
    let files = 0
    let totalSize = 0

    for (const entry of entries) {
        const { directory, segments } = validateEntryName(entry)
        const collisionKey = segments.join('/').toLocaleLowerCase('en-US')
        if (seen.has(collisionKey)) throw new ThemeMarketClientError('theme_package_duplicate_path')
        seen.add(collisionKey)
        if (directory) continue

        files++
        if (files > MAX_FILES) throw new ThemeMarketClientError('theme_package_too_many_files')
        const basename = segments.at(-1)?.toLowerCase() || ''
        if (basename === '.phi-market.json') throw new ThemeMarketClientError('theme_package_receipt_forbidden')
        if (basename === 'info.yaml') {
            if (segments.at(-1) !== 'info.yaml') throw new ThemeMarketClientError('theme_package_info_invalid')
            infoPaths.push(segments)
        }

        const extension = path.extname(basename)
        if (!ALLOWED_EXTENSIONS.has(extension)) throw new ThemeMarketClientError('theme_package_extension_forbidden')
        const perFileLimit = TEXT_EXTENSIONS.has(extension) ? MAX_TEXT_BYTES : MAX_RESOURCE_BYTES
        if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0 || entry.uncompressedSize > perFileLimit) {
            throw new ThemeMarketClientError('theme_package_file_too_large')
        }
        if (entry.uncompressedSize > 0) {
            if (entry.compressedSize <= 0 || entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO) {
                throw new ThemeMarketClientError('theme_package_compression_ratio')
            }
        }
        totalSize += entry.uncompressedSize
        if (totalSize > MAX_EXTRACTED_BYTES) throw new ThemeMarketClientError('theme_package_expanded_too_large')
    }
    if (infoPaths.length !== 1 || ![1, 2].includes(infoPaths[0].length)) {
        throw new ThemeMarketClientError('theme_package_info_invalid')
    }
    const prefix = infoPaths[0].length === 2 ? infoPaths[0][0] : ''
    for (const entry of entries) {
        const { segments } = validateEntryName(entry)
        if (prefix && segments[0] !== prefix) throw new ThemeMarketClientError('theme_package_layout_invalid')
    }
    return { prefix, totalSize, fileCount: files }
}

/** @param {import('jszip').JSZipObject} file @returns {import('node:stream').Readable} */
function openEntryStream(file) {
    try {
        return /** @type {import('node:stream').Readable} */ (file.nodeStream('nodebuffer'))
    } catch (error) {
        throw normalizedZipError(error)
    }
}

/**
 * Consume a readable stream chunk by chunk with backpressure. Works with
 * `readable-stream@2` (used internally by JSZip), which lacks async iteration.
 * @param {import('node:stream').Readable} stream
 * @param {(chunk: Buffer) => Promise<void>} onChunk
 * @returns {Promise<void>}
 */
function consumeStream(stream, onChunk) {
    return new Promise((resolve, reject) => {
        let busy = false
        let settled = false
        const cleanup = () => {
            stream.removeListener('data', onData)
            stream.removeListener('error', onError)
            stream.removeListener('end', onEnd)
        }
        /** @param {unknown} error */
        const fail = error => {
            if (settled) return
            settled = true
            cleanup()
            stream.destroy()
            reject(error)
        }
        /** @param {Buffer} chunk */
        const onData = chunk => {
            if (busy || settled) return
            busy = true
            stream.pause()
            Promise.resolve()
                .then(() => onChunk(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
                .then(() => {
                    busy = false
                    if (!settled) stream.resume()
                })
                .catch(fail)
        }
        /** @param {unknown} error */
        const onError = error => fail(error)
        const onEnd = () => {
            if (settled) return
            settled = true
            cleanup()
            resolve()
        }
        stream.on('data', onData)
        stream.on('error', onError)
        stream.on('end', onEnd)
    })
}

/** @param {fs.promises.FileHandle} handle @param {Buffer} chunk @param {number} position */
async function writeChunk(handle, chunk, position) {
    let written = 0
    while (written < chunk.byteLength) {
        const result = await handle.write(chunk, written, chunk.byteLength - written, position + written)
        if (result.bytesWritten <= 0) throw new ThemeMarketClientError('theme_package_extract_failed')
        written += result.bytesWritten
    }
}

/** @param {string} zipPath @param {string} targetDir @param {{prefix:string,totalSize:number,fileCount:number}} layout */
async function extractArchive(zipPath, targetDir, layout) {
    const zip = await loadZip(zipPath)
    let extractedBytes = 0
    let extractedFiles = 0
    for (const name of Object.keys(zip.files)) {
        const file = zip.files[name]
        const entry = toZipEntry(file)
        const { directory, segments } = validateEntryName(entry)
        const relativeSegments = layout.prefix ? segments.slice(1) : segments
        if (!relativeSegments.length) continue
        const output = path.join(targetDir, ...relativeSegments)
        const resolved = path.resolve(output)
        const root = `${path.resolve(targetDir)}${path.sep}`
        if (!resolved.startsWith(root)) throw new ThemeMarketClientError('theme_package_unsafe_path')
        if (directory) {
            await fs.promises.mkdir(resolved, { recursive: true, mode: 0o700 })
            continue
        }
        await fs.promises.mkdir(path.dirname(resolved), { recursive: true, mode: 0o700 })
        const stream = openEntryStream(file)
        const handle = await fs.promises.open(resolved, 'wx', 0o600)
        let fileBytes = 0
        try {
            await consumeStream(stream, async chunk => {
                fileBytes += chunk.byteLength
                extractedBytes += chunk.byteLength
                if (fileBytes > entry.uncompressedSize || extractedBytes > MAX_EXTRACTED_BYTES) {
                    throw new ThemeMarketClientError('theme_package_expanded_too_large')
                }
                await writeChunk(handle, chunk, fileBytes - chunk.byteLength)
            })
            await handle.sync()
        } catch (error) {
            if (error instanceof ThemeMarketClientError) throw error
            throw normalizedZipError(error)
        } finally {
            await handle.close()
        }
        if (fileBytes !== entry.uncompressedSize) throw new ThemeMarketClientError('theme_package_extract_failed')
        extractedFiles++
    }
    if (extractedBytes !== layout.totalSize || extractedFiles !== layout.fileCount) {
        throw new ThemeMarketClientError('theme_package_extract_failed')
    }
}

/** @param {string} themeId @param {{version:string,sha256:string}} download */
export async function isMarketThemeCached(themeId, download) {
    const target = path.join(THEMES_DIR, themeId)
    try {
        const stat = await fs.promises.lstat(target)
        if (!stat.isDirectory() || stat.isSymbolicLink()) return false
        const info = YAML.parse(await fs.promises.readFile(path.join(target, 'info.yaml'), 'utf8'))
        const receipt = await readMarketReceipt(path.join(target, '.phi-market.json'))
        return info?.id === themeId && receipt?.slug === themeId
            && receipt?.version === download.version && receipt?.sha256 === download.sha256
    } catch {
        return false
    }
}

/** @param {string} themeId */
export async function assertMarketInstallTarget(themeId) {
    if (!/^[a-z][a-z0-9_-]{0,119}$/.test(themeId) || RESERVED_IDS.has(themeId)) {
        throw new ThemeMarketClientError('theme_package_reserved_id')
    }
    const target = path.join(THEMES_DIR, themeId)
    const existing = await fs.promises.lstat(target).catch(() => null)
    if (!existing) return { existing: null, marketOwned: false }
    if (!existing.isDirectory() || existing.isSymbolicLink()) {
        throw new ThemeMarketClientError('theme_conflicts_with_local_theme')
    }
    const receiptPath = path.join(target, '.phi-market.json')
    const marker = await fs.promises.lstat(receiptPath).catch(() => null)
    const receipt = await readMarketReceipt(receiptPath)
    if (!marker?.isFile() || (receipt && receipt.slug !== themeId)) {
        throw new ThemeMarketClientError('theme_conflicts_with_local_theme')
    }
    return { existing, marketOwned: true }
}

/** @param {string} themeId @param {{version:string,sha256:string}} download @param {string} zipPath */
async function installMarketArchiveUnlocked(themeId, download, zipPath) {
    let stage = ''
    try {
        const recoveryFailures = await recoverAllMarketInstallsUnlocked()
        if (recoveryFailures.length) throw new ThemeMarketClientError('theme_install_recovery_failed')
        const target = path.join(THEMES_DIR, themeId)
        const { existing } = await assertMarketInstallTarget(themeId)

        const id = crypto.randomUUID()
        stage = path.join(WORK_DIR, `stage-${themeId}-${id}`)
        const backup = path.join(THEMES_DIR, `.phi-market-backup-${themeId}-${id}`)
        let movedOld = false
        let installed = false
        await fs.promises.mkdir(stage, { recursive: false, mode: 0o700 })
        try {
            const entries = await listZipEntries(zipPath)
            const layout = validateArchiveLayout(entries)
            await extractArchive(zipPath, stage, layout)
            const infoPath = path.join(stage, 'info.yaml')
            const info = YAML.parse(await fs.promises.readFile(infoPath, 'utf8'))
            if (!info || typeof info !== 'object' || info.id !== themeId) {
                throw new ThemeMarketClientError('theme_package_id_mismatch')
            }
            const receipt = {
                installedAt: new Date().toISOString(),
                sha256: download.sha256,
                slug: themeId,
                source: 'phi-theme-marketplace',
                version: download.version,
            }
            await fs.promises.writeFile(path.join(stage, '.phi-market.json'), `${JSON.stringify(receipt, null, 2)}\n`, {
                encoding: 'utf8', mode: 0o600, flag: 'wx',
            })
            await assertMarketInstallQuota(themeId, stage)
            if (existing) {
                await fs.promises.rename(target, backup)
                movedOld = true
            }
            await fs.promises.rename(stage, target)
            installed = true
            if (movedOld) await fs.promises.rm(backup, { recursive: true, force: true }).catch(() => {})
            return receipt
        } catch (error) {
            if (!installed && movedOld) {
                const targetNow = await fs.promises.lstat(target).catch(() => null)
                if (!targetNow) await fs.promises.rename(backup, target).catch(() => {})
            }
            throw error
        } finally {
            if (stage) await fs.promises.rm(stage, { recursive: true, force: true }).catch(() => {})
        }
    } finally {
        await fs.promises.rm(zipPath, { force: true }).catch(() => {})
    }
}

/** @param {string} themeId @param {{version:string,sha256:string}} download @param {string} zipPath */
export async function installMarketArchive(themeId, download, zipPath) {
    let entered = false
    try {
        return await withMarketInstallLock(() => {
            entered = true
            return installMarketArchiveUnlocked(themeId, download, zipPath)
        })
    } finally {
        if (!entered) await fs.promises.rm(zipPath, { force: true }).catch(() => {})
    }
}

/** @param {string} themeId */
export function recoverMarketInstall(themeId) {
    return withMarketInstallLock(() => recoverMarketInstallUnlocked(themeId))
}

/** @param {{cleanAllWork?:boolean}} [options] */
export function recoverAllMarketInstalls(options = {}) {
    return withMarketInstallLock(() => recoverAllMarketInstallsUnlocked(options))
}

/** @param {string} fileName */
export function marketWorkPath(fileName) {
    return path.join(WORK_DIR, fileName)
}
