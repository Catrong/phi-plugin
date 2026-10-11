import { createRequire } from 'node:module'
import { acceptKoishiSettings, createKoishiRenderLifecycle, koishiRenderConfigKeys } from './components/platform/koishiRenderLifecycle.js'

const require = createRequire(import.meta.url)
export const Config = require('./components/settings/koishi.cjs').Config

export const name = 'phi-plugin'
export const inject = { required: ['database'], optional: ['puppeteer', 'shotium'] }

/**
 * 由 Koishi 提供 Context 后，先绑定平台，再加载共享业务入口。
 * @param {any} ctx
 * @param {import('./components/platform/koishi.js').KoishiAdapterOptions & import('./components/platform/koishi.js').KoishiRegisterOptions & Record<string, any>} [config]
 */
export async function apply(ctx, config = {}) {
    const { getPlatformAdapter, clearPlatformAdapter } = await import('./components/platform/state.js')
    if (getPlatformAdapter()?.name === 'yunzai') {
        throw new Error('[phi-plugin] Yunzai 业务已加载，不能在同一进程切换到 Koishi；请使用 koishi.cjs 入口。')
    }
    // 与 Koishi 4 宿主使用同一 CJS 导出，避开 loader 的 ESM/CJS 默认导出互操作问题。
    const { h } = require('koishi')
    const { useKoishiAdapter, registerKoishiApps } = await import('./components/platform/koishi.js')
    const { bindHostSettings, getHostSettings, updateHostSettings } = await import('./components/settings/host.js')
    /** @type {ReturnType<typeof useKoishiAdapter> | undefined} */
    let adapter
    /** @type {import('./model/render/picmodle.js').PicModel | undefined} */
    let pool
    /** @type {(() => void) | undefined} */
    let unbind
    /** @type {Record<string, any>} */
    const resources = {}
    const reportError = (/** @type {unknown} */ error) => (adapter?.logger || console).error('[phi-plugin] Koishi 资源回收失败', error)
    const lifecycle = createKoishiRenderLifecycle({
        ctx,
        async initialize(owner, disposed) {
            adapter = useKoishiAdapter(ctx, { ...config, h })
            unbind = bindHostSettings(config, values => {
                if (typeof ctx.scope?.update !== 'function') throw new Error('[phi-plugin] 宿主不支持保存插件配置')
                ctx.scope.update({ ...ctx.scope.config, ...values })
            })
            // 从首个共享模块开始就保留清理入口，后续 import 抛错也能回收已建立的监听。
            resources.watchers = (await import('./components/FileWatcherRegistry.js')).default
            resources.Config = (await import('./components/Config.js')).default
            resources.Config.config = {}
            resources.Config.initCfg()
            resources.Version = (await import('./components/Version.js')).default
            resources.Version.reopen()
            resources.info = (await import('./model/game/getInfo.js')).default
            if (disposed()) return
            pool = (await import('./model/render/picmodle.js')).default
            if (disposed()) return
            pool.validateRendererSettings()
            await pool.beginSession(owner)
            if (disposed()) return
            resources.themes = (await import('./model/theme/manager.js')).default
            if (!resources.watchers.entries.has('b19:themes')) await resources.themes.init()
            if (disposed()) return
            // API 签发凭据时只更新对应字段，不能越过渲染器预检写入完整配置。
            const credentialKeys = ['apiBotClientId', 'apiBotClientSecret', 'apiBotSecretVersion']
            acceptKoishiSettings(ctx, credentialKeys, updateHostSettings)
            acceptKoishiSettings(ctx, koishiRenderConfigKeys, values => lifecycle.update(values))
            // ESM 业务模块会被宿主缓存；重新打开曲库监听并读取停用期间的变更。
            if (resources.info.versionHistoryLoaded) await resources.info.init()
            const { apps } = await import('./runtime.js')
            if (disposed()) return
            const { registerKoishiConsole } = await import('./components/platform/koishiConsole.js')
            if (disposed()) return
            registerKoishiConsole(ctx, undefined, config)
            registerKoishiApps(ctx, apps, adapter, config)
        },
        validateConfig(values) { pool?.validateRendererSettings({ ...getHostSettings(), ...values }) },
        commitConfig(values) {
            updateHostSettings(values)
            pool?.refreshRenderers()
        },
        stop() { adapter?.stop() },
        async dispose() {
            try {
                // 业务在途请求可能尚未进入绘图；先等它们使用旧平台和旧设置完成。
                await adapter?.drain()
                await pool?.endSession(lifecycle.owner)
            } finally {
                const closers = [
                    () => adapter?.close(),
                    () => resources.info?.close(),
                    () => resources.Config?.close(),
                    () => resources.Version?.close(),
                    () => resources.watchers?.closeAll(),
                ]
                for (const close of closers) {
                    try { await close() } catch (error) { reportError(error) }
                }
                unbind?.()
                if (adapter) clearPlatformAdapter(adapter)
            }
        },
        onError: reportError,
    })
    try {
        await lifecycle.start()
    } catch (error) {
        await lifecycle.close()
        throw error
    }
}
