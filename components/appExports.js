import phiPluginBase from './baseClass.js'

/**
 * 从 apps 模块的导出中挑选宿主插件类。
 * ESM 命名空间按导出名排序，直接取第一个导出会命中同文件里的辅助函数
 * （如 grks.js 的 parseHintArgs），实例化后没有 task 字段，
 * Yunzai 收集定时任务时会抛 "Cannot read properties of undefined (reading 'cron')"。
 * @param {Record<string, any> | null | undefined} mod 模块命名空间对象
 * @returns {any} 插件类；模块没有可用导出时返回 undefined
 */
export function pickAppClass(mod) {
    if (!mod) return undefined
    if (typeof mod.default === 'function') return mod.default
    const candidates = Object.values(mod).filter(value => typeof value === 'function')
    return candidates.find(value => value.prototype instanceof phiPluginBase) ?? candidates[0]
}
