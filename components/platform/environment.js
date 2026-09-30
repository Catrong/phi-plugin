/**
 * 只检查宿主运行信号，不以安装了 koishi 依赖作为判断依据。
 * @param {any} [ctx]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'koishi' | 'yunzai'}
 */
export function detectEnvironment(ctx, env = process.env) {
    if (typeof ctx?.middleware === 'function' && typeof ctx?.on === 'function') return 'koishi'
    if (env.KOISHI_SHARED || env.KOISHI_CONFIG_FILE) return 'koishi'
    return 'yunzai'
}
