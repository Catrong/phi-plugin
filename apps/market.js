import Config from '../components/Config.js'
import logger from '../components/Logger.js'
import segment from '../components/segment.js'
import phiPluginBase from '../components/baseClass.js'
import getBanGroup from '../model/user/getBanGroup.js'
import getNotes from '../model/user/getNotes.js'
import picmodle from '../model/render/picmodle.js'
import themeUseService, { marketThemeErrorMessage } from '../model/theme/useService.js'
import themeManager from '../model/theme/manager.js'
import {
    fetchThemeCatalog,
    fetchThemeDetail,
    getLocalThemeCatalog,
    getLocalThemeDetail,
    isThemeSlug,
} from '../model/theme/catalog.js'
import { sendMessage, butCmd } from '../model/render/message.js'
import { marketMessages } from '../model/render/messages.js'
import { marketQuickMarkdownPart } from '../model/game/markdown.js'
import { isApiConnectionError } from '../model/api/phiApiErrors.js'
import { getThemeInstallRequesterId } from '../model/theme/installGuard.js'
import { isApiCapabilityEnabled } from '../model/user/apiPermission.js'

/** @import {botEvent} from '../components/baseClass.js' */

const SLUG_RE = /^[a-z][a-z0-9_-]{0,119}$/
const MARKET_STATE_TTL_MS = 10 * 60 * 1000
/** @type {Map<string, {query:string,page:number,pageCount:number,localOnly:boolean,updatedAt:number}>} */
const marketPageStates = new Map()

/** @param {botEvent} e */
function marketPageStateKey(e) {
    const userId = String(e.user_id || e.userId || '')
    const chatId = String(e.group_id || e.groupId || e.chatId || userId)
    const adapter = e.bot?.adapter
    const platform = String(e.platform || (typeof adapter === 'object' ? adapter?.name : adapter) || '')
    return `${platform}:${chatId}:${userId}`
}

/** @param {botEvent} e */
function getMarketPageState(e) {
    const key = marketPageStateKey(e)
    const state = marketPageStates.get(key)
    if (!state) return null
    if (state.updatedAt <= Date.now() - MARKET_STATE_TTL_MS) {
        marketPageStates.delete(key)
        return null
    }
    return state
}

/** @param {botEvent} e @param {string} query @param {number} page @param {number} pageCount @param {boolean} localOnly */
function setMarketPageState(e, query, page, pageCount, localOnly) {
    marketPageStates.set(marketPageStateKey(e), { query, page, pageCount, localOnly, updatedAt: Date.now() })
    if (marketPageStates.size > 1000) {
        const expiredBefore = Date.now() - MARKET_STATE_TTL_MS
        for (const [key, state] of marketPageStates) {
            if (state.updatedAt <= expiredBefore) marketPageStates.delete(key)
        }
    }
}

export class phiMarket extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-theme-market',
            dsc: 'phi-plugin 主题市场查看与使用',
            event: 'message',
            priority: 999,
            rule: [{
                reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)market(\\s+.*)?$`,
                fnc: 'market',
            }, {
                reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(nx|pr|上一页|下一页)$`,
                fnc: 'marketPage',
            }],
        })
    }

    /** @param {botEvent} e @param {string} query @param {number} page @param {boolean} [forceLocal] */
    async renderMarketCatalog(e, query, page, forceLocal = false) {
        const commandHead = `${Config.getUserCfg('config', 'cmdhead')}`
        let catalog
        if (!forceLocal && isApiCapabilityEnabled('customTheme')) {
            try {
                catalog = await fetchThemeCatalog(query, page)
            } catch (/** @type {any} */ error) {
                logger.warn(`[phi-plugin][主题市场] 在线目录不可用，已切换本地目录：${error?.code || 'unknown'}`)
            }
        }
        catalog ||= getLocalThemeCatalog(query, page)
        const pluginData = await getNotes.getNotesData(e.user_id)
        await sendMessage(e, {
            image: await picmodle.market(e, {
                ...catalog,
                currentTheme: pluginData?.theme || 'default',
                commandHead,
            }),
            ...marketQuickMarkdownPart(catalog.themes, catalog),
        }, { at: true, requireOfficialBot: false })
        setMarketPageState(e, query, catalog.page, catalog.pageCount, catalog.localOnly === true)
    }

    /** @param {botEvent} e */
    async marketPage(e) {
        if (await getBanGroup.get(e, 'theme')) {
            sendMessage(e, marketMessages.marketPage.banned, { at: true })
            return false
        }
        const commandHead = `${Config.getUserCfg('config', 'cmdhead')}`
        const action = e.msg.replace(new RegExp(`^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)`, 'i'), '').trim().toLowerCase()
        const state = getMarketPageState(e)
        if (!state) {
            sendMessage(e, marketMessages.marketPage.openFirst(), { at: true })
            return true
        }
        const next = ['nx', '下一页'].includes(action)
        const targetPage = state.page + (next ? 1 : -1)
        if (targetPage < 1 || targetPage > state.pageCount) {
            sendMessage(e, targetPage < 1 ? marketMessages.marketPage.firstPage : marketMessages.marketPage.lastPage, { at: true })
            return true
        }
        try {
            await this.renderMarketCatalog(e, state.query, targetPage, state.localOnly)
        } catch (/** @type {any} */ error) {
            logger.warn(`[phi-plugin][主题市场] 翻页加载失败：${error?.code || 'unknown'}`)
            sendMessage(e, marketMessages.catalog.unavailable, { at: true })
        }
        return true
    }

    /** @param {botEvent} e */
    async market(e) {
        if (await getBanGroup.get(e, 'theme')) {
            sendMessage(e, marketMessages.marketPage.banned, { at: true })
            return false
        }
        const commandHead = `${Config.getUserCfg('config', 'cmdhead')}`
        const raw = e.msg.replace(
            new RegExp(`^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)market(\\s*)`, 'i'),
            '',
        ).trim()
        const args = raw ? raw.split(/\s+/) : []

        // 优先读取在线目录；API 关闭或请求失败时由渲染层降级为本地自定义主题目录。
        if (!args.length || args[0].toLowerCase() === 'list' || (args.length === 1 && /^\d+$/.test(args[0]))) {
            const listArgs = args[0]?.toLowerCase() === 'list' ? args.slice(1) : args
            let page = 1
            const lastArg = listArgs.at(-1)
            if (lastArg && /^\d+$/.test(lastArg)) page = Number(lastArg)
            const queryArgs = lastArg && /^\d+$/.test(lastArg) ? listArgs.slice(0, -1) : listArgs
            const query = queryArgs.join(' ')
            try {
                await this.renderMarketCatalog(e, query, page)
            } catch (/** @type {any} */ error) {
                logger.warn(`[phi-plugin][主题市场] 目录加载失败：${error?.code || 'unknown'}`)
                sendMessage(e, marketMessages.catalog.unavailable, { at: true })
            }
            return true
        }

        // 详情优先读取在线市场，请求不可用时回退到已注册的本地主题信息。
        if (['detail', 'info', '详情'].includes(args[0].toLowerCase())) {
            const requestedThemeId = args[1] || ''
            const exactLocalDetail = getLocalThemeDetail(requestedThemeId)
            const themeId = exactLocalDetail ? requestedThemeId : requestedThemeId.toLowerCase()
            const localDetail = exactLocalDetail || getLocalThemeDetail(themeId)
            if (!localDetail && !isThemeSlug(themeId)) {
                sendMessage(e, marketMessages.market.detailUsage(), { at: true })
                return true
            }
            try {
                const localTheme = localDetail ? themeManager.getTheme(themeId) : null
                let detail = localDetail
                const shouldFetchOnline = isApiCapabilityEnabled('customTheme')
                    && isThemeSlug(themeId)
                    && (!localDetail || localTheme?.marketInstalled)
                if (shouldFetchOnline) {
                    try {
                        detail = await fetchThemeDetail(themeId)
                    } catch (/** @type {any} */ error) {
                        if (!localDetail || !isApiConnectionError(error)) throw error
                        logger.warn(`[phi-plugin][主题市场] 在线详情连接失败，已使用本地详情 ${themeId}：${error?.code || 'unknown'}`)
                        detail = localDetail
                    }
                }
                if (!detail) throw new Error('local_theme_not_found')
                const pluginData = await getNotes.getNotesData(e.user_id)
                sendMessage(e, {
                    image: await picmodle.marketDetail(e, {
                        theme: pluginData?.theme || 'default',
                        detail,
                        commandHead,
                    }),
                    button: [[
                        butCmd(`market ${themeId}`, '使用主题'),
                        butCmd(`market detail ${themeId}`, '查看详情'),
                        butCmd(`market`, '返回列表'),
                    ]],
                }, { at: true })
            } catch (/** @type {any} */ error) {
                logger.warn(`[phi-plugin][主题市场] 详情加载失败 ${themeId}：${error?.code || 'unknown'}`)
                sendMessage(e, marketMessages.market.detailNotFound, { at: true })
            }
            return true
        }

        if (args.length !== 1 || /\s/.test(raw)) {
            sendMessage(e, marketMessages.market.usage(), { at: true })
            return true
        }
        const requestedThemeId = args[0]
        const localTheme = themeManager.isCustomTheme(requestedThemeId)
            ? themeManager.getTheme(requestedThemeId)
            : null
        const themeId = localTheme ? requestedThemeId : requestedThemeId.toLowerCase()
        if (!localTheme && !SLUG_RE.test(themeId)) {
            sendMessage(e, marketMessages.market.invalidSlug, { at: true })
            return true
        }
        if (!localTheme && !isApiCapabilityEnabled('customTheme')) {
            sendMessage(e, marketMessages.market.offline, { at: true })
            return true
        }

        try {
            sendMessage(e, localTheme && !localTheme.marketInstalled
                ? marketMessages.market.preparingLocal(themeId)
                : marketMessages.market.preparing(themeId), { at: true })
            const result = await themeUseService.use(themeId, { requesterId: getThemeInstallRequesterId(e) })
            const pluginData = await getNotes.getNotesData(e.user_id)
            if (typeof pluginData.setThemePreference === 'function') pluginData.setThemePreference(themeId)
            else pluginData.theme = themeId
            if (!getNotes.putNotesData(e.user_id, pluginData)) {
                sendMessage(e, marketMessages.market.saveFailed, { at: true })
                return true
            }
            sendMessage(e, marketMessages.market.enabled(result), { at: true })
            return true
        } catch (error) {
            const caught = /** @type {any} */ (error)
            const code = typeof caught?.code === 'string' && /^[a-z0-9_]{1,80}$/.test(caught.code)
                ? caught.code : 'theme_install_failed'
            logger.warn(`[phi-plugin][主题市场] ${themeId} 启用失败：${code}`)
            sendMessage(e, marketMessages.themeError(marketThemeErrorMessage(error)), { at: true })
            return true
        }
    }
}

