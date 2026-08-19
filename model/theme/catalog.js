import { ThemeMarketClientError } from './marketClient.js'

export const THEME_MARKET_API_ORIGIN = 'https://lyh.org.cn:18473'
const API_BASE = `${THEME_MARKET_API_ORIGIN}/api/market/themes`
const SLUG_RE = /^[a-z][a-z0-9_-]{0,119}$/

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

/** @param {any} item */
function normalizeTheme(item) {
    const slug = text(item?.slug || item?.themeId, 120).toLowerCase()
    return {
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
    }
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
    const themes = Array.isArray(data?.themes)
        ? data.themes.map(normalizeTheme).filter((/** @type {{slug:string}} */ theme) => SLUG_RE.test(theme.slug))
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

/** @param {string} slug */
export async function fetchThemeDetail(slug) {
    if (!SLUG_RE.test(slug)) throw new ThemeMarketClientError('theme_slug_invalid', 400)
    const data = /** @type {any} */ (await requestJson(`${API_BASE}/${encodeURIComponent(slug)}`))
    const theme = normalizeTheme(data?.theme || data)
    if (theme.slug !== slug) throw new ThemeMarketClientError('theme_catalog_invalid_response', 502)
    return { ...theme, releaseNotes: text(data?.releaseNotes || data?.theme?.releaseNotes, 3000) }
}

export const isThemeSlug = (/** @type {unknown} */ value) => typeof value === 'string' && SLUG_RE.test(value)
