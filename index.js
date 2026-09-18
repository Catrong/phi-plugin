import { detectEnvironment } from './components/platform/environment.js'
import { getPlatformAdapter } from './components/platform/state.js'

const isKoishi = getPlatformAdapter()?.name === 'koishi' || detectEnvironment() === 'koishi'
const koishi = isKoishi ? await import('./koishi.js') : undefined

export const name = 'phi-plugin'
export const inject = { required: ['database', 'puppeteer'] }
export const Config = koishi?.Config
/** @param {any} ctx @param {any} [config] */
export async function apply(ctx, config) {
    return (await import('./koishi.js')).apply(ctx, config)
}

// Koishi 必须等 apply(ctx) 注入服务后才能加载业务类。
export const apps = isKoishi
    ? {}
    : (await import('./runtime.js')).apps
