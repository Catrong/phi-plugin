import Config from '../components/Config.js'
import logger from '../components/Logger.js'
import segment from '../components/segment.js'
import phiPluginBase from '../components/baseClass.js'
import getBanGroup from '../model/user/getBanGroup.js'
import getNotes from '../model/user/getNotes.js'
import send from '../model/render/send.js'
import picmodle from '../model/render/picmodle.js'
import themeUseService, { marketThemeErrorMessage } from '../model/theme/useService.js'
import { fetchThemeCatalog, fetchThemeDetail, isThemeSlug } from '../model/theme/catalog.js'
import { sendMarketQuickCommands } from '../model/game/markdown.js'

/** @import {botEvent} from '../components/baseClass.js' */

const SLUG_RE = /^[a-z][a-z0-9_-]{0,119}$/
const MARKET_STATE_TTL_MS = 10 * 60 * 1000
/** @type {Map<string, {query:string,page:number,pageCount:number,updatedAt:number}>} */
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

/** @param {botEvent} e @param {string} query @param {number} page @param {number} pageCount */
function setMarketPageState(e, query, page, pageCount) {
    marketPageStates.set(marketPageStateKey(e), { query, page, pageCount, updatedAt: Date.now() })
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

    /** @param {botEvent} e @param {string} query @param {number} page */
    async renderMarketCatalog(e, query, page) {
        const commandHead = `${Config.getUserCfg('config', 'cmdhead')}`
        const catalog = await fetchThemeCatalog(query, page)
        const pluginData = await getNotes.getNotesData(e.user_id)
        await send.send_with_At(e, await picmodle.market(e, {
            ...catalog,
            currentTheme: pluginData?.theme || 'default',
            commandHead,
        }))
        setMarketPageState(e, query, catalog.page, catalog.pageCount)
        await sendMarketQuickCommands(e, catalog.themes, catalog)
    }

    /** @param {botEvent} e */
    async marketPage(e) {
        if (await getBanGroup.get(e, 'theme')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }
        const commandHead = `${Config.getUserCfg('config', 'cmdhead')}`
        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, '主题市场依赖联合查分 API，请先由 Bot 主人启用该功能。')
            return true
        }
        const action = e.msg.replace(new RegExp(`^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)`, 'i'), '').trim().toLowerCase()
        const state = getMarketPageState(e)
        if (!state) {
            send.send_with_At(e, `请先使用 /${commandHead} market 打开主题市场。`)
            return true
        }
        const next = ['nx', '下一页'].includes(action)
        const targetPage = state.page + (next ? 1 : -1)
        if (targetPage < 1 || targetPage > state.pageCount) {
            send.send_with_At(e, targetPage < 1 ? '已经是主题市场第一页了。' : '已经是主题市场最后一页了。')
            return true
        }
        try {
            await this.renderMarketCatalog(e, state.query, targetPage)
        } catch (/** @type {any} */ error) {
            logger.warn(`[phi-plugin][主题市场] 翻页加载失败：${error?.code || 'unknown'}`)
            send.send_with_At(e, '主题市场目录暂时不可用，请稍后重试。')
        }
        return true
    }

    /** @param {botEvent} e */
    async market(e) {
        if (await getBanGroup.get(e, 'theme')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }
        const commandHead = `${Config.getUserCfg('config', 'cmdhead')}`
        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, '主题市场依赖联合查分 API，请先由 Bot 主人启用该功能。')
            return true
        }
        const raw = e.msg.replace(
            new RegExp(`^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)market(\\s*)`, 'i'),
            '',
        ).trim()
        const args = raw ? raw.split(/\s+/) : []

        // 无参数、页码或 list 子命令通过 phi-plugin-api 获取当前 Bot 可见目录。
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
                send.send_with_At(e, '主题市场目录暂时不可用，请稍后重试。')
            }
            return true
        }

        // detail/info 通过 phi-plugin-api 获取当前 Bot 策略过滤后的详情。
        if (['detail', 'info', '详情'].includes(args[0].toLowerCase())) {
            const themeId = args[1]?.toLowerCase() || ''
            if (!isThemeSlug(themeId)) {
                send.send_with_At(e, `用法：/${commandHead} market detail <主题slug>`)
                return true
            }
            try {
                const detail = await fetchThemeDetail(themeId)
                const pluginData = await getNotes.getNotesData(e.user_id)
                send.send_with_At(e, await picmodle.marketDetail(e, {
                    theme: pluginData?.theme || 'default',
                    detail,
                    commandHead,
                }))
            } catch (/** @type {any} */ error) {
                logger.warn(`[phi-plugin][主题市场] 详情加载失败 ${themeId}：${error?.code || 'unknown'}`)
                send.send_with_At(e, '未找到该主题，或主题市场暂时不可用。')
            }
            return true
        }

        if (args.length !== 1 || /\s/.test(raw)) {
            send.send_with_At(e, `用法：/${commandHead} market [list [关键词] [页码] | detail <主题slug> | <主题slug>]`)
            return true
        }
        const themeId = args[0].toLowerCase()
        if (!SLUG_RE.test(themeId)) {
            send.send_with_At(e, '主题 slug 格式无效。')
            return true
        }

        try {
            send.send_with_At(e, `正在校验并启用主题 ${themeId}，首次使用时会自动下载，请稍候。`)
            const result = await themeUseService.use(themeId)
            const pluginData = await getNotes.getNotesData(e.user_id)
            pluginData.theme = themeId
            if (!getNotes.putNotesData(e.user_id, pluginData)) {
                send.send_with_At(e, '主题已准备完成，但你的主题设置保存失败，请稍后重试。')
                return true
            }
            const actionText = result.cached ? '已使用本地安全缓存' : '已自动下载并完成安全校验'
            send.send_with_At(e, `主题已启用：${result.theme.name} ${result.version}（${actionText}）`)
            return true
        } catch (error) {
            const caught = /** @type {any} */ (error)
            const code = typeof caught?.code === 'string' && /^[a-z0-9_]{1,80}$/.test(caught.code)
                ? caught.code : 'theme_install_failed'
            logger.warn(`[phi-plugin][主题市场] ${themeId} 启用失败：${code}`)
            send.send_with_At(e, marketThemeErrorMessage(error))
            return true
        }
    }
}
