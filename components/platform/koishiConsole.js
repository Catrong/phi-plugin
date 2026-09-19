import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { createGitUpdater } from './koishiUpdater.js'
import { pluginRoot, originalIllPath } from '../../model/filesystem/path.js'
import { getHostSettings } from '../settings/host.js'
import { defaultShortcutCommands, defaultShortcutCategories } from './koishiCommandNames.js'

// 跨配置重载保留正在运行的任务，避免重载期间重复启动 Git。
const updater = createGitUpdater({ pluginDir: pluginRoot, artworkDir: originalIllPath, readConfig: getHostSettings })

/** @param {any} ctx @param {ReturnType<typeof createGitUpdater>} [updates] @param {import('./koishi.js').KoishiRegisterOptions} [config] */
export function registerKoishiConsole(ctx, updates = updater, config = {}) {
    ctx.inject(['console'], (/** @type {any} */ scope) => {
        let directory = fileURLToPath(new URL('../../client-dist', import.meta.url))
        // Console 的静态资源限制要求文件位于 node_modules；保留安装器建立的符号链接路径。
        const linked = path.join(scope.get?.('loader')?.baseDir || process.cwd(), 'node_modules', 'phi-plugin', 'client-dist')
        if (fs.existsSync(linked) && fs.realpathSync(linked) === fs.realpathSync(directory)) directory = linked
        const entry = scope.console.addEntry(directory)
        const event = `phi-plugin/update/${entry.id}`
        const listeners = scope.console.listeners
        entry.data = () => ({ event, shortcuts: config.koishiShortcuts ?? [
            ...(config.koishiShortcutCategories ?? defaultShortcutCategories).map(key => `category:${key}`),
            ...(config.koishiShortcutCommands ?? defaultShortcutCommands).map(key => `command:${key}`),
        ] })
        let disposed = false
        /** @param {unknown} action @param {unknown} target */
        function listener(action, target) {
            if (disposed) throw new Error('插件已卸载，请刷新页面。')
            if (action === 'status') return updates.status()
            if (action === 'start') return updates.start(target)
            throw new Error('未知操作。')
        }
        scope.console.addListener(event, listener, { authority: 4 })
        scope.on('dispose', () => {
            disposed = true
            if (listeners[event]?.callback === listener) delete listeners[event]
        })
    })
}
