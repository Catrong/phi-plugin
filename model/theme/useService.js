import crypto from 'node:crypto'
import themeManager from './manager.js'
import {
    authorizeThemeDownload,
    downloadThemeArchive,
    getAvailableMarketTheme,
    ThemeMarketClientError,
} from './marketClient.js'
import {
    installMarketArchive,
    isMarketThemeCached,
    marketWorkPath,
    recoverMarketInstall,
    withMarketInstallLock,
} from './installer.js'
import { getPhiApiUserMessage, hasPhiApiUserMessage } from '../api/phiApiErrors.js'

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

/**
 * Authorize and install the latest compatible release. The authorization is
 * still required on a cache hit so revoked Bot/theme access cannot be bypassed.
 * @param {string} themeId
 */
export async function installLatestMarketTheme(themeId) {
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

export class ThemeUseService {
    /**
     * @param {{getTheme?:typeof getAvailableMarketTheme, install?:typeof installLatestMarketTheme}} [dependencies]
     */
    constructor(dependencies = {}) {
        this.getTheme = dependencies.getTheme || getAvailableMarketTheme
        this.install = dependencies.install || installLatestMarketTheme
    }

    /** Use an allowed registered theme offline, otherwise validate and install it online. @param {string} themeId */
    async use(themeId) {
        const localTheme = themeManager.getTheme(themeId)
        if (localTheme && themeManager.isCustomTheme(themeId)) {
            if (!themeManager.isThemeAvailable(themeId)) {
                throw new ThemeMarketClientError('theme_not_allowed_by_bot', 403)
            }
            return {
                cached: true,
                local: true,
                version: localTheme.marketVersion || '',
                theme: localTheme,
                detail: null,
            }
        }
        if (!SLUG_RE.test(themeId)) throw new ThemeMarketClientError('theme_slug_invalid', 400)
        const detail = await this.getTheme(themeId)
        const result = await this.install(themeId)
        return { ...result, local: false, detail }
    }
}

/** @param {any} error */
export function marketThemeErrorMessage(error) {
    if (hasPhiApiUserMessage(error)) return getPhiApiUserMessage(error)
    /** @type {Record<string, string>} */
    const local = {
        theme_slug_invalid: '主题 slug 格式无效。',
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
    return local[String(error?.code || '')] || '主题下载或启用失败，请稍后重试。'
}

export default new ThemeUseService()
