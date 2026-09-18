// Koishi 4 的加载器使用 require，不能直接加载含顶层 await 的 ESM 入口。
exports.name = 'phi-plugin'
exports.inject = { required: ['database', 'puppeteer'] }
exports.Config = require('./components/settings/koishi.cjs').Config
/** @param {any} ctx @param {any} [config] */
exports.apply = async (ctx, config) => {
    const plugin = await import('./koishi.js')
    return plugin.apply(ctx, config)
}
