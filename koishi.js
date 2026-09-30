import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
export const Config = require('./components/settings/koishi.cjs').Config

export const name = 'phi-plugin'
export const inject = { required: ['database', 'puppeteer'] }

/**
 * 由 Koishi 提供 Context 后，先绑定平台，再加载共享业务入口。
 * @param {any} ctx
 * @param {import('./components/platform/koishi.js').KoishiAdapterOptions & import('./components/platform/koishi.js').KoishiRegisterOptions & Record<string, any>} [config]
 */
export async function apply(ctx, config = {}) {
    const { getPlatformAdapter } = await import('./components/platform/state.js')
    if (getPlatformAdapter()?.name === 'yunzai') {
        throw new Error('[phi-plugin] Yunzai 业务已加载，不能在同一进程切换到 Koishi；请使用 koishi.cjs 入口。')
    }
    // 与 Koishi 4 宿主使用同一 CJS 导出，避开 loader 的 ESM/CJS 默认导出互操作问题。
    const { h } = require('koishi')
    const { useKoishiAdapter, registerKoishiApps } = await import('./components/platform/koishi.js')
    const adapter = useKoishiAdapter(ctx, { ...config, h })
    const { registerKoishiConsole } = await import('./components/platform/koishiConsole.js')
    registerKoishiConsole(ctx, undefined, config)
    const { bindHostSettings, updateHostSettings } = await import('./components/settings/host.js')
    const unbind = bindHostSettings(config, values => {
        if (typeof ctx.scope?.update !== 'function') throw new Error('[phi-plugin] 宿主不支持保存插件配置')
        ctx.scope.update({ ...ctx.scope.config, ...values })
    })
    // API 签发/轮换凭据时只更新配置，不在初始化过程中重启插件。
    ctx.accept?.(['apiBotClientId', 'apiBotClientSecret', 'apiBotSecretVersion'], updateHostSettings)
    let disposed = false
    ctx.on?.('dispose', () => { disposed = true; unbind() })
    try {
        const { apps } = await import('./runtime.js')
        if (!disposed) registerKoishiApps(ctx, apps, adapter, config)
    } catch (error) {
        unbind()
        throw error
    }
}
