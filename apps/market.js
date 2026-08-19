import crypto from 'node:crypto'
import Config from '../components/Config.js'
import logger from '../components/Logger.js'
import phiPluginBase from '../components/baseClass.js'
import getBanGroup from '../model/user/getBanGroup.js'
import getNotes from '../model/user/getNotes.js'
import send from '../model/render/send.js'
import picmodle from '../model/render/picmodle.js'
import themeManager from '../model/theme/manager.js'
import {
    authorizeThemeDownload,
    downloadThemeArchive,
    ThemeMarketClientError,
} from '../model/theme/marketClient.js'
import {
    installMarketArchive,
    isMarketThemeCached,
    marketWorkPath,
    recoverMarketInstall,
    withMarketInstallLock,
} from '../model/theme/installer.js'
import { getPhiApiUserMessage, hasPhiApiUserMessage } from '../model/api/phiApiErrors.js'
import { fetchThemeCatalog, fetchThemeDetail, isThemeSlug } from '../model/theme/catalog.js'

/** @import {botEvent} from '../components/baseClass.js' */

const SLUG_RE = /^[a-z][a-z0-9_-]{0,119}$/

function escapedCommandHead() {
    return String(Config.getUserCfg('config', 'cmdhead') || 'phi').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** @param {string} themeId */
async function waitForThemeRegistration(themeId) {
    themeManager.scan()
    for (let attempt = 0; attempt < 20; attempt++) {
        const theme = themeManager.getTheme(themeId)
        if (theme?.marketInstalled) return theme
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new ThemeMarketClientError('theme_registry_refresh_failed')
}

/** @param {string} themeId */
async function installLatestTheme(themeId) {
    return withMarketInstallLock(async () => {
        await recoverMarketInstall(themeId)
        for (let authorizationCycle = 0; authorizationCycle < 2; authorizationCycle++) {
            const requestId = crypto.randomUUID()
            const download = await authorizeThemeDownload(themeId, requestId)
            if (await isMarketThemeCached(themeId, download)) {
                const theme = await waitForThemeRegistration(themeId)
                return { cached: true, version: download.version, theme }
            }

            const archivePath = marketWorkPath(`download-${themeId}-${requestId}.zip`)
            try {
                await downloadThemeArchive(download, archivePath)
                await installMarketArchive(themeId, download, archivePath)
                const theme = await waitForThemeRegistration(themeId)
                return { cached: false, version: download.version, theme }
            } catch (error) {
                if (/** @type {any} */ (error)?.code === 'theme_download_url_expired' && authorizationCycle === 0) continue
                throw error
            }
        }
        throw new ThemeMarketClientError('theme_download_url_expired')
    })
}

/** @param {any} error */
function userErrorMessage(error) {
    if (hasPhiApiUserMessage(error)) return getPhiApiUserMessage(error)
    /** @type {Record<string, string>} */
    const local = {
        theme_market_origin_invalid: '主题市场下载来源配置无效，请联系 Bot 主人。',
        theme_download_url_expired: '主题下载链接已失效，请稍后重试。',
        theme_download_url_untrusted: '主题商店返回了不受信任的下载地址。',
        theme_download_unavailable: '主题包暂时无法下载，请稍后重试。',
        theme_package_integrity_failed: '主题包完整性校验失败，已停止安装。',
        theme_package_reserved_id: '该主题 ID 与插件内置主题冲突，无法安装。',
        theme_conflicts_with_local_theme: '同名本地主题不是市场安装版本，已拒绝覆盖。',
        theme_install_busy: '主题安装队列繁忙，请稍后重试。',
        theme_registry_refresh_failed: '主题已写入，但注册表刷新失败，请联系 Bot 主人检查。',
    }
    return local[String(error?.code || '')] || '主题安装失败，主题包未被启用。'
}

export class phiMarket extends phiPluginBase {
    constructor() {
        const commandHead = escapedCommandHead()
        super({
            name: 'phi-theme-market',
            dsc: 'phi-plugin 主题市场',
            event: 'message',
            priority: 999,
            rule: [{
                reg: `^[#/]${commandHead}\\s+market(?:\\s+.*)?$`,
                fnc: 'market',
            }],
        })
    }

    /** @param {botEvent} e */
    async market(e) {
        if (await getBanGroup.get(e, 'theme')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }
        const commandHead = String(Config.getUserCfg('config', 'cmdhead') || 'phi')
        const match = new RegExp(`^[#/]${escapedCommandHead()}\\s+market(?:\\s+(.+))?$`, 'i').exec(e.msg.trim())
        const raw = match?.[1]?.trim() || ''
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
                const catalog = await fetchThemeCatalog(query, page)
                const pluginData = await getNotes.getNotesData(e.user_id)
                send.send_with_At(e, await picmodle.market(e, {
                    ...catalog,
                    currentTheme: pluginData?.theme || 'default',
                    commandHead,
                }))
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

        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, '主题安装依赖联合查分 API，请先由 Bot 主人启用该功能。')
            return true
        }

        send.send_with_At(e, `正在获取并校验主题 ${themeId}，请稍候。`)
        try {
            const result = await installLatestTheme(themeId)
            const pluginData = await getNotes.getNotesData(e.user_id)
            pluginData.theme = themeId
            try {
                await getNotes.putNotesData(e.user_id, pluginData)
            } catch {
                throw new ThemeMarketClientError('theme_user_setting_save_failed')
            }
            const cacheText = result.cached ? '（已命中本地安全缓存）' : ''
            send.send_with_At(e, `主题设置成功：${result.theme.name} ${result.version}${cacheText}`)
            return true
        } catch (error) {
            const caught = /** @type {any} */ (error)
            const code = typeof caught?.code === 'string' && /^[a-z0-9_]{1,80}$/.test(caught.code)
                ? caught.code : 'theme_install_failed'
            logger.warn(`[phi-plugin][主题市场] ${themeId} 安装失败：${code}`)
            if (code === 'theme_user_setting_save_failed') {
                send.send_with_At(e, '主题已安装到全局缓存，但保存你的主题选择失败，请稍后重试。')
            } else {
                send.send_with_At(e, userErrorMessage(error))
            }
            return true
        }
    }
}
