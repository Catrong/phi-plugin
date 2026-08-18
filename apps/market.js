import crypto from 'node:crypto'
import Config from '../components/Config.js'
import logger from '../components/Logger.js'
import phiPluginBase from '../components/baseClass.js'
import getBanGroup from '../model/user/getBanGroup.js'
import send from '../model/render/send.js'
import themeManager from '../model/theme/manager.js'
import {
    authorizeThemeDownload,
    downloadThemeArchive,
    getAvailableMarketTheme,
    getAvailableMarketThemes,
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

/** @import {botEvent} from '../components/baseClass.js' */

const SLUG_RE = /^[a-z][a-z0-9_-]{0,119}$/

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
        super({
            name: 'phi-theme-market',
            dsc: 'phi-plugin 主题市场安装',
            event: 'message',
            priority: 999,
            rule: [{
                reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)market(\\s+.*)?$`,
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
        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, '主题市场依赖联合查分 API，请先由 Bot 主人启用该功能。')
            return true
        }
        const raw = e.msg.replace(
            new RegExp(`^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)market(\\s*)`, 'i'),
            '',
        ).trim()
        if (!raw) {
            try {
                const themes = await getAvailableMarketThemes()
                if (!themes.length) {
                    send.send_with_At(e, '当前 Bot 暂无可用的市场主题。')
                    return true
                }
                const lines = themes.slice(0, 30).map((/** @type {any} */ theme) => `${theme.slug} · ${theme.name}${theme.version ? ` · ${theme.version}` : ''}`)
                const suffix = themes.length > lines.length ? `\n另有 ${themes.length - lines.length} 个主题未展示。` : ''
                send.send_with_At(e, `当前 Bot 可用的市场主题：\n${lines.join('\n')}${suffix}`)
            } catch (error) {
                send.send_with_At(e, userErrorMessage(error))
            }
            return true
        }
        if (/\s/.test(raw)) {
            send.send_with_At(e, `用法：/${commandHead} market [主题slug]`)
            return true
        }
        const themeId = raw.toLowerCase()
        if (!SLUG_RE.test(themeId)) {
            send.send_with_At(e, '主题 slug 格式无效。')
            return true
        }

        try {
            const detail = await getAvailableMarketTheme(themeId)
            if (!e.isMaster) {
                const installed = themeManager.getTheme(themeId)?.marketInstalled === true
                send.send_with_At(e, [
                    `${detail.name}（${detail.slug}）`,
                    detail.author ? `作者：${detail.author}` : '',
                    detail.version ? `版本：${detail.version}` : '',
                    detail.summary || detail.description || '',
                    installed ? `该主题已安装，请使用 /${commandHead} theme 选择。` : '该主题尚未安装，请联系 Bot 主人。',
                ].filter(Boolean).join('\n'))
                return true
            }
            send.send_with_At(e, `正在获取并校验主题 ${themeId}，请稍候。`)
            const result = await installLatestTheme(themeId)
            const cacheText = result.cached ? '（已命中本地安全缓存）' : ''
            send.send_with_At(e, `主题安装成功：${result.theme.name} ${result.version}${cacheText}\n用户可通过 /${commandHead} theme 离线选择。`)
            return true
        } catch (error) {
            const caught = /** @type {any} */ (error)
            const code = typeof caught?.code === 'string' && /^[a-z0-9_]{1,80}$/.test(caught.code)
                ? caught.code : 'theme_install_failed'
            logger.warn(`[phi-plugin][主题市场] ${themeId} 安装失败：${code}`)
            send.send_with_At(e, userErrorMessage(error))
            return true
        }
    }
}
