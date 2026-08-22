import { resolveBotDownloadAllowed, ThemeMarketClientError } from './marketClient.js'
import makeRequest from '../api/makeRequest.js'
import themeManager from './manager.js'

export const THEME_MARKET_API_ORIGIN = 'https://lyh.org.cn:18473'
const SLUG_RE = /^[a-z][a-z0-9_-]{0,119}$/
const PINNED_LOCAL_THEME_ID = 'milthm'
const MAX_MARKET_THEMES = 500
export const THEME_MARKET_PAGE_SIZE = 6

/** @param {unknown} value */
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function invalidCatalogResponse() {
    return new ThemeMarketClientError('theme_store_invalid_response', 502)
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
        botDownloadAllowed,
        local: false,
        pinnedLocal: false,
    }
}

/** @param {any[]} themes @param {string} query @param {number} page @param {boolean} localOnly */
function paginateThemes(themes, query, page, localOnly) {
    const needle = text(query, 80).toLocaleLowerCase()
    const filtered = needle
        ? themes.filter((/** @type {any} */ theme) => [theme.slug, theme.name, theme.author, theme.summary, theme.description, ...theme.tags]
            .some((/** @type {string} */ value) => value.toLocaleLowerCase().includes(needle)))
        : themes
    if (!localOnly) {
        filtered.sort((/** @type {any} */ a, /** @type {any} */ b) => Number(b.pinnedLocal) - Number(a.pinnedLocal)
            || Number(b.featured) - Number(a.featured)
            || b.updatedAt.localeCompare(a.updatedAt))
    }
    const total = filtered.length
    const pageCount = Math.max(1, Math.ceil(total / THEME_MARKET_PAGE_SIZE))
    const currentPage = Number.isSafeInteger(page) ? Math.min(Math.max(page, 1), pageCount) : 1
    const start = (currentPage - 1) * THEME_MARKET_PAGE_SIZE
    return {
        themes: filtered.slice(start, start + THEME_MARKET_PAGE_SIZE),
        query: needle,
        page: currentPage,
        pageCount,
        total,
        localOnly,
    }
}

/** @param {any} theme */
function normalizeLocalTheme(theme) {
    return {
        slug: theme.id,
        themeId: theme.id,
        name: theme.name || theme.id,
        author: theme.author || '',
        summary: theme.description || '',
        description: theme.description || '',
        cover: '',
        tags: [theme.marketInstalled ? '已下载' : '本地主题'],
        version: theme.marketVersion || '',
        downloadPolicy: 'local',
        compatibility: '本地已安装',
        downloads: 0,
        updatedAt: '',
        featured: false,
        size: 0,
        botDownloadAllowed: themeManager.isThemeAvailable(theme.id),
        local: true,
        pinnedLocal: theme.id === PINNED_LOCAL_THEME_ID,
    }
}

/**
 * 返回当前进程已注册的本地自定义主题目录，不访问网络。
 * @param {string} [query]
 * @param {number} [page]
 */
export function getLocalThemeCatalog(query = '', page = 1) {
    const themes = themeManager.getCustomThemes().map(normalizeLocalTheme)
    return { demo: false, ...paginateThemes(themes, query, page, true) }
}

/** @param {string} themeId */
export function getLocalThemeDetail(themeId) {
    const theme = themeManager.getTheme(themeId)
    if (!theme || !themeManager.isCustomTheme(themeId)) return null
    return { ...normalizeLocalTheme(theme), releaseNotes: '' }
}

/** @param {any} response @param {any} item */
function validateCatalogTheme(response, item) {
    if (!isRecord(item)
        || typeof item.slug !== 'string' || !SLUG_RE.test(item.slug)
        || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100
        || Object.hasOwn(item, 'downloadPolicy') && !['public', 'restricted', 'bot_only'].includes(item.downloadPolicy)
        || Object.hasOwn(item, 'tags') && (!Array.isArray(item.tags) || item.tags.some((/** @type {unknown} */ tag) => typeof tag !== 'string'))) {
        throw invalidCatalogResponse()
    }
    const botDownloadAllowed = resolveBotDownloadAllowed(response, item)
    return normalizeMarketTheme(item, botDownloadAllowed)
}

/**
 * @param {string} [query]
 * @param {number} [page]
 */
export async function fetchThemeCatalog(query = '', page = 1) {
    const data = /** @type {any} */ (await makeRequest.getThemeMarketList())
    if (!isRecord(data)
        || data.ok !== true
        || !Array.isArray(data.themes)
        || data.themes.length > MAX_MARKET_THEMES
        || Object.hasOwn(data, 'demo') && typeof data.demo !== 'boolean') {
        throw invalidCatalogResponse()
    }
    const seen = new Set()
    const onlineThemes = []
    for (const item of data.themes) {
        const theme = validateCatalogTheme(data, item)
        if (seen.has(theme.slug)) continue
        seen.add(theme.slug)
        onlineThemes.push(theme)
    }
    const pinnedLocalTheme = getLocalThemeDetail(PINNED_LOCAL_THEME_ID)
    const themes = pinnedLocalTheme
        ? [pinnedLocalTheme, ...onlineThemes.filter((/** @type {{slug:string}} */ theme) => theme.slug !== PINNED_LOCAL_THEME_ID)]
        : onlineThemes
    return {
        demo: data?.demo === true,
        ...paginateThemes(themes, query, page, false),
    }
}

/** @param {string} slug */
export async function fetchThemeDetail(slug) {
    if (!SLUG_RE.test(slug)) throw new ThemeMarketClientError('theme_slug_invalid', 400)
    const data = /** @type {any} */ (await makeRequest.getThemeMarketDetail(slug))
    if (!isRecord(data) || data.ok !== true || !isRecord(data.theme)) throw invalidCatalogResponse()
    if (Object.hasOwn(data, 'releaseNotes') && typeof data.releaseNotes !== 'string'
        || Object.hasOwn(data.theme, 'releaseNotes') && typeof data.theme.releaseNotes !== 'string') {
        throw invalidCatalogResponse()
    }
    const theme = validateCatalogTheme(data, data.theme)
    if (theme.slug !== slug) throw invalidCatalogResponse()
    return { ...theme, releaseNotes: text(data?.releaseNotes || data?.theme?.releaseNotes, 3000) }
}

export const isThemeSlug = (/** @type {unknown} */ value) => typeof value === 'string' && SLUG_RE.test(value)
