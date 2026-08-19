import { ThemeMarketClientError } from './marketClient.js'

export const THEME_MARKET_API_ORIGIN = 'https://lyh.org.cn:18473'
const API_BASE = `${THEME_MARKET_API_ORIGIN}/api/market/themes`
const SLUG_RE = /^[a-z][a-z0-9_-]{0,119}$/
const DENIED_CACHE_TTL_MS = 5 * 60 * 1000
const deniedThemeCache = new Map()

/** @param {string} slug */
function cachedBotDownloadAllowed(slug) {
    const expiresAt = deniedThemeCache.get(slug)
    if (!expiresAt) return null
    if (expiresAt <= Date.now()) {
        deniedThemeCache.delete(slug)
        return null
    }
    return false
}

/**
 * Record a definitive denial returned by the authenticated download flow.
 * The public catalog cannot expose this field without the server-side store credential.
 * @param {string} slug
 */
export function markThemeDownloadDenied(slug) {
    if (SLUG_RE.test(slug)) deniedThemeCache.set(slug, Date.now() + DENIED_CACHE_TTL_MS)
}

/** @param {string} slug */
export function clearThemeDownloadDenied(slug) {
    deniedThemeCache.delete(slug)
}

/** @param {any} theme */
function applyCachedBotDownloadCapability(theme) {
    if (typeof theme.botDownloadAllowed === 'boolean') return theme
    const cached = cachedBotDownloadAllowed(theme.slug)
    return cached === null ? theme : { ...theme, botDownloadAllowed: cached }
}

/** @param {unknown} value @param {number} limit */
function text(value, limit) {
    return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

/** @param {unknown} value */
function safeCover(value) {
    if (!value) return ''
    try {
        const url = new URL(String(value))
        return url.protocol === 'https:' && url.origin === THEME_MARKET_API_ORIGIN ? url.toString() : ''
    } catch {
        return ''
    }
}

/**
 * @param {any} item
 * @param {boolean|null} [inheritedBotDownloadAllowed]
 */
export function normalizeMarketTheme(item, inheritedBotDownloadAllowed = null) {
    const slug = text(item?.slug || item?.themeId, 120).toLowerCase()
    const botDownloadAllowed = typeof item?.botDownloadAllowed === 'boolean'
        ? item.botDownloadAllowed
        : inheritedBotDownloadAllowed
    return applyCachedBotDownloadCapability({
        slug,
        themeId: text(item?.themeId || slug, 120),
        name: text(item?.name || slug, 100) || slug,
        author: text(item?.author, 80),
        summary: text(item?.summary, 180),
        description: text(item?.description, 1200),
        cover: safeCover(item?.cover),
        tags: Array.isArray(item?.tags) ? item.tags.filter((/** @type {unknown} */ tag) => typeof tag === 'string').slice(0, 8).map((/** @type {string} */ tag) => tag.slice(0, 24)) : [],
        version: text(item?.version, 64),
        downloadPolicy: ['public', 'restricted', 'bot_only'].includes(item?.downloadPolicy) ? item.downloadPolicy : 'restricted',
        compatibility: text(item?.compatibility, 100),
        downloads: Number.isSafeInteger(item?.downloads) && item.downloads >= 0 ? item.downloads : 0,
        updatedAt: text(item?.updatedAt, 40),
        featured: item?.featured === true,
        size: Number.isSafeInteger(item?.size) && item.size > 0 ? item.size : 0,
        botDownloadAllowed,
    })
}

/** @param {string} url */
async function requestJson(url) {
    let response
    try {
        response = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            redirect: 'error',
            signal: AbortSignal.timeout(10_000),
        })
    } catch {
        throw new ThemeMarketClientError('theme_catalog_unavailable')
    }
    if (!response.ok) {
        if (response.body) await response.body.cancel().catch(() => {})
        throw new ThemeMarketClientError('theme_catalog_unavailable', response.status)
    }
    try {
        return /** @type {any} */ (await response.json())
    } catch {
        throw new ThemeMarketClientError('theme_catalog_invalid_response', 502)
    }
}

/** @param {string} [query] */
export async function fetchThemeCatalog(query = '') {
    const data = /** @type {any} */ (await requestJson(API_BASE))
    const inheritedBotDownloadAllowed = typeof data?.botDownloadAllowed === 'boolean' ? data.botDownloadAllowed : null
    const themes = Array.isArray(data?.themes)
        ? data.themes.map((/** @type {any} */ item) => applyCachedBotDownloadCapability(normalizeMarketTheme(item, inheritedBotDownloadAllowed))).filter((/** @type {{slug:string}} */ theme) => SLUG_RE.test(theme.slug))
        : []
    const needle = text(query, 80).toLocaleLowerCase()
    const filtered = needle
        ? themes.filter((/** @type {any} */ theme) => [theme.slug, theme.name, theme.author, theme.summary, ...theme.tags]
            .some((/** @type {string} */ value) => value.toLocaleLowerCase().includes(needle)))
        : themes
    filtered.sort((/** @type {any} */ a, /** @type {any} */ b) => Number(b.featured) - Number(a.featured) || b.updatedAt.localeCompare(a.updatedAt))
    return {
        demo: data?.demo === true,
        themes: filtered.slice(0, 60),
        query: needle,
    }
}

/**
 * @param {string} slug
 * @param {string} [botClientId] 已完成 Bot HMAC 认证的公开 Bot ID，不是商店凭据
 */
export async function fetchThemeDetail(slug, botClientId = '') {
    if (!SLUG_RE.test(slug)) throw new ThemeMarketClientError('theme_slug_invalid', 400)
    const clientId = /^pbc_[a-zA-Z0-9_-]{1,128}$/.test(botClientId) ? botClientId : ''
    const query = clientId ? `?botClientId=${encodeURIComponent(clientId)}` : ''
    const data = /** @type {any} */ (await requestJson(`${API_BASE}/${encodeURIComponent(slug)}${query}`))
    const theme = normalizeMarketTheme(data?.theme || data, typeof data?.botDownloadAllowed === 'boolean' ? data.botDownloadAllowed : null)
    if (theme.slug !== slug) throw new ThemeMarketClientError('theme_catalog_invalid_response', 502)
    return { ...applyCachedBotDownloadCapability(theme), releaseNotes: text(data?.releaseNotes || data?.theme?.releaseNotes, 3000) }
}

export const isThemeSlug = (/** @type {unknown} */ value) => typeof value === 'string' && SLUG_RE.test(value)
