import crypto from 'node:crypto'
import fs from 'node:fs'
import Config from '../../components/Config.js'
import makeRequest from '../api/makeRequest.js'
import { classifyApiConnectionError } from '../api/phiApiErrors.js'

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
const AUTH_ATTEMPTS = 3
const DOWNLOAD_ATTEMPTS = 2
const DOWNLOAD_TIMEOUT_MS = 60_000

export class ThemeMarketClientError extends Error {
    /** @param {string} code @param {number} [status] */
    constructor(code, status = 0) {
        super(code)
        this.name = 'ThemeMarketClientError'
        this.code = code
        this.status = status
    }
}

const SLUG_RE = /^[a-z][a-z0-9_-]{0,119}$/

/** @param {unknown} value */
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * The API has shipped both response-level and theme-level capability fields.
 * Accept either layout, but never guess when the field is absent or conflicts.
 * @param {any} response
 * @param {any} theme
 */
export function resolveBotDownloadAllowed(response, theme) {
    const hasResponseValue = isRecord(response) && Object.hasOwn(response, 'botDownloadAllowed')
    const hasThemeValue = isRecord(theme) && Object.hasOwn(theme, 'botDownloadAllowed')
    const responseValue = hasResponseValue ? response.botDownloadAllowed : undefined
    const themeValue = hasThemeValue ? theme.botDownloadAllowed : undefined
    if (
        hasResponseValue && typeof responseValue !== 'boolean'
        || hasThemeValue && typeof themeValue !== 'boolean'
        || !hasResponseValue && !hasThemeValue
        || hasResponseValue && hasThemeValue && responseValue !== themeValue
    ) {
        throw new ThemeMarketClientError('theme_store_invalid_response', 502)
    }
    return /** @type {boolean} */ (hasThemeValue ? themeValue : responseValue)
}

/** @param {any} theme @param {boolean} botDownloadAllowed */
function validateTheme(theme, botDownloadAllowed) {
    if (!isRecord(theme)
        || typeof theme.slug !== 'string' || !SLUG_RE.test(theme.slug)
        || typeof theme.name !== 'string' || !theme.name.trim() || theme.name.length > 100
        || !['public', 'restricted', 'bot_only'].includes(theme.downloadPolicy)) {
        throw new ThemeMarketClientError('theme_store_invalid_response', 502)
    }
    return { ...theme, name: theme.name.trim(), botDownloadAllowed }
}

export async function getAvailableMarketThemes() {
    const response = await makeRequest.getThemeMarketList()
    if (!isRecord(response) || response.ok !== true || !Array.isArray(response.themes) || response.themes.length > 500) {
        throw new ThemeMarketClientError('theme_store_invalid_response', 502)
    }
    return response.themes.map((/** @type {any} */ theme) => validateTheme(
        theme,
        resolveBotDownloadAllowed(response, theme),
    ))
}

/** @param {string} themeId */
export async function getAvailableMarketTheme(themeId) {
    const response = await makeRequest.getThemeMarketDetail(themeId)
    if (!isRecord(response) || response.ok !== true || !isRecord(response.theme)) {
        throw new ThemeMarketClientError('theme_store_invalid_response', 502)
    }
    const theme = validateTheme(response.theme, resolveBotDownloadAllowed(response, response.theme))
    if (theme.slug !== themeId) throw new ThemeMarketClientError('theme_store_invalid_response', 502)
    if (!theme.botDownloadAllowed) throw new ThemeMarketClientError('theme_not_allowed_by_bot', 403)
    return theme
}

/** @param {number} ms */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/** @param {any} error @param {number} attempt */
function retryDelay(error, attempt) {
    const raw = error?.data?.retryAfter
    if (raw) {
        const seconds = Number(raw)
        const date = Date.parse(raw)
        const value = Number.isFinite(seconds) ? seconds * 1000 : date - Date.now()
        if (Number.isFinite(value)) return Math.max(0, Math.min(value, 15_000))
    }
    return 250 * (2 ** attempt) + Math.floor(Math.random() * 150)
}

/** @param {any} error */
function retryableAuthorization(error) {
    const status = Number(error?.status || 0)
    return status === 0 || [408, 425, 429].includes(status) || status >= 500
}

function configuredDownloadOrigin() {
    const raw = String(Config.getUserCfg('config', 'themeMarketDownloadOrigin') || '').trim()
    let url
    try {
        url = new URL(raw)
    } catch {
        throw new ThemeMarketClientError('theme_market_origin_invalid')
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search || url.pathname !== '/') {
        throw new ThemeMarketClientError('theme_market_origin_invalid')
    }
    return url.origin
}

/** @param {any} value @param {string} themeId */
function validateDownload(value, themeId) {
    const download = value?.download
    let url
    try {
        url = new URL(download?.downloadUrl)
    } catch {
        throw new ThemeMarketClientError('theme_store_invalid_response', 502)
    }
    if (
        value?.ok !== true
        || typeof download?.downloadId !== 'string'
        || download.downloadId.length < 1
        || download.downloadId.length > 128
        || download.themeId !== themeId
        || typeof download.version !== 'string'
        || download.version.length < 1
        || download.version.length > 64
        || typeof download.fileName !== 'string'
        || download.fileName.length < 1
        || download.fileName.length > 255
        || /[\\/\u0000-\u001f\u007f]/.test(download.fileName)
        || download.contentType !== 'application/zip'
        || !Number.isSafeInteger(download.size)
        || download.size <= 0
        || download.size > MAX_ARCHIVE_BYTES
        || !/^[a-f0-9]{64}$/.test(download.sha256)
        || !Number.isFinite(Date.parse(download.expiresAt))
        || Date.parse(download.expiresAt) <= Date.now()
        || url.protocol !== 'https:'
        || url.origin !== configuredDownloadOrigin()
        || url.username
        || url.password
        || url.hash
    ) {
        throw new ThemeMarketClientError('theme_store_invalid_response', 502)
    }
    return {
        downloadId: download.downloadId,
        themeId: download.themeId,
        version: download.version,
        fileName: download.fileName,
        contentType: 'application/zip',
        size: download.size,
        sha256: download.sha256,
        downloadUrl: url.toString(),
        expiresAt: download.expiresAt,
    }
}

/**
 * @param {string} themeId
 * @param {string} [requestId]
 */
export async function authorizeThemeDownload(themeId, requestId = crypto.randomUUID()) {
    for (let attempt = 0; attempt < AUTH_ATTEMPTS; attempt++) {
        try {
            const response = await makeRequest.requestThemeDownload({ requestId, themeId })
            return validateDownload(response, themeId)
        } catch (error) {
            if (!retryableAuthorization(error) || attempt + 1 >= AUTH_ATTEMPTS) throw error
            await sleep(retryDelay(error, attempt))
        }
    }
    throw new ThemeMarketClientError('theme_store_unavailable', 503)
}

/** @param {fs.promises.FileHandle} handle @param {Uint8Array} chunk @param {number} position */
async function writeChunk(handle, chunk, position) {
    let written = 0
    while (written < chunk.byteLength) {
        const result = await handle.write(chunk, written, chunk.byteLength - written, position + written)
        if (result.bytesWritten <= 0) throw new ThemeMarketClientError('theme_download_write_failed')
        written += result.bytesWritten
    }
}

/**
 * @param {ReturnType<typeof validateDownload>} download
 * @param {string} targetPath
 * @param {{fetchImpl?:typeof fetch}} [options]
 */
export async function downloadThemeArchive(download, targetPath, options = {}) {
    const fetchImpl = options.fetchImpl || fetch
    let lastError = null
    for (let attempt = 0; attempt < DOWNLOAD_ATTEMPTS; attempt++) {
        if (Date.parse(download.expiresAt) <= Date.now()) {
            throw new ThemeMarketClientError('theme_download_url_expired', 410)
        }
        await fs.promises.rm(targetPath, { force: true }).catch(() => {})
        let handle
        try {
            const url = new URL(download.downloadUrl)
            if (url.origin !== configuredDownloadOrigin() || url.protocol !== 'https:' || url.username || url.password || url.hash) {
                throw new ThemeMarketClientError('theme_download_url_untrusted')
            }
            let response
            try {
                response = await fetchImpl(url, {
                    method: 'GET',
                    headers: { Accept: 'application/zip' },
                    redirect: 'error',
                    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
                })
            } catch (error) {
                throw classifyApiConnectionError(error)
            }
            if ([401, 403, 410].includes(response.status)) {
                await response.body?.cancel()
                throw new ThemeMarketClientError('theme_download_url_expired', response.status)
            }
            if (!response.ok) {
                await response.body?.cancel()
                const error = new ThemeMarketClientError('theme_download_unavailable', response.status)
                // @ts-ignore response headers are deliberately reduced to the one retry hint
                error.retryAfter = response.headers.get('retry-after')
                throw error
            }
            if (!response.body) throw new ThemeMarketClientError('theme_download_empty')
            const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim()
            const contentLength = response.headers.get('content-length')
            if (contentType !== 'application/zip' || (contentLength !== null && contentLength !== String(download.size))) {
                await response.body.cancel()
                throw new ThemeMarketClientError('theme_package_integrity_failed')
            }

            handle = await fs.promises.open(targetPath, 'wx', 0o600)
            const reader = response.body.getReader()
            const hash = crypto.createHash('sha256')
            let total = 0
            while (true) {
                let chunk
                try {
                    chunk = await reader.read()
                } catch (error) {
                    throw classifyApiConnectionError(error)
                }
                const { done, value } = chunk
                if (done) break
                if (!value) continue
                total += value.byteLength
                if (total > download.size || total > MAX_ARCHIVE_BYTES) {
                    await reader.cancel()
                    throw new ThemeMarketClientError('theme_package_integrity_failed')
                }
                await writeChunk(handle, value, total - value.byteLength)
                hash.update(value)
            }
            await handle.sync()
            await handle.close()
            handle = undefined
            if (total !== download.size || hash.digest('hex') !== download.sha256) {
                throw new ThemeMarketClientError('theme_package_integrity_failed')
            }
            return targetPath
        } catch (error) {
            lastError = error
            await handle?.close().catch(() => {})
            await fs.promises.rm(targetPath, { force: true }).catch(() => {})
            const caught = /** @type {any} */ (error)
            const status = Number(caught?.status || 0)
            const retryable = !(error instanceof ThemeMarketClientError)
                || error.code === 'theme_download_unavailable' && ([408, 425, 429].includes(status) || status >= 500)
            if (!retryable || attempt + 1 >= DOWNLOAD_ATTEMPTS) throw error
            const rawRetryAfter = caught?.retryAfter
            const delay = rawRetryAfter && Number.isFinite(Number(rawRetryAfter))
                ? Math.min(Number(rawRetryAfter) * 1000, 15_000)
                : 250 * (2 ** attempt) + Math.floor(Math.random() * 150)
            await sleep(delay)
        }
    }
    throw lastError || new ThemeMarketClientError('theme_download_unavailable')
}
