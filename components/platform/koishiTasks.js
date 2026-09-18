/**
 * 注册带有固定周期的共享任务。ctx.setInterval 会随插件作用域销毁而清理。
 * @param {any} ctx
 * @param {any[]} instances
 * @param {import('./types.js').PlatformLogger} logger
 */
export function registerKoishiTasks(ctx, instances, logger) {
    for (const instance of instances) {
        const task = instance.task
        if (!task) continue
        const handler = typeof task.fnc === 'string' ? instance[task.fnc] : task.fnc
        if (!Number.isFinite(task.interval) || task.interval <= 0 || typeof handler !== 'function') {
            logger.warn(`[phi-plugin] 未注册 Koishi 定时任务：${task.name || instance.name}，需要有效的 interval 和 fnc`)
            continue
        }
        let running = false
        let disposed = false
        ctx.on('dispose', () => { disposed = true })
        ctx.setInterval(async () => {
            if (disposed || running) return
            running = true
            try {
                await handler.call(instance)
            } catch (error) {
                logger.warn(`[phi-plugin] Koishi 定时任务失败：${task.name || instance.name}`, error)
            } finally {
                running = false
            }
        }, task.interval)
    }
}
