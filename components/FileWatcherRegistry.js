import path from 'node:path'
import chokidar from 'chokidar'

const registrySymbol = Symbol.for('phi-plugin.fileWatcherRegistry')
const globalStore = /** @type {Record<symbol, any>} */ (globalThis)

/**
 * @typedef {object} FileWatcherLease
 * @property {import('chokidar').FSWatcher} watcher
 * @property {Promise<void>} ready
 * @property {() => Promise<void>} close
 */

export class FileWatcherRegistry {
    constructor() {
        /** @type {Map<string, {file: string, watcher: import('chokidar').FSWatcher, ready: Promise<void>, onChange: (...args: any[]) => void, lease: FileWatcherLease}>} */
        this.entries = new Map()
    }

    /**
     * 同一个 key 在热重载后复用 watcher，只替换回调以释放旧模块引用。
     * @param {string} key
     * @param {string} file
     * @param {(...args: any[]) => void} onChange
     * @param {string[]} [events=['change']] 需要监听的 chokidar 事件（change/add/unlink/addDir/unlinkDir…）
     * @param {import('chokidar').ChokidarOptions} [watchOptions]
     * @returns {FileWatcherLease}
     */
    watch(key, file, onChange, events = ['change'], watchOptions = {}) {
        const normalizedFile = path.resolve(file)
        const current = this.entries.get(key)
        if (current?.file === normalizedFile) {
            current.onChange = onChange
            current.lease = this.createLease(key, current.watcher, current.ready)
            return current.lease
        }

        if (current) {
            this.entries.delete(key)
            void current.watcher.close()
        }

        /** @type {{file: string, watcher: import('chokidar').FSWatcher, ready: Promise<void>, onChange: (...args: any[]) => void, lease: FileWatcherLease}} */
        const entry = {
            file: normalizedFile,
            watcher: /** @type {any} */ (null),
            ready: /** @type {any} */ (null),
            onChange,
            lease: /** @type {any} */ (null),
        }
        entry.watcher = chokidar.watch(normalizedFile, watchOptions)
        entry.ready = new Promise(resolve => entry.watcher.once('ready', () => resolve()))
        const watcher = /** @type {any} */ (entry.watcher)
        for (const event of events) {
            watcher.on(event, /** @type {(...args: any[]) => void} */ ((...args) => entry.onChange(...args)))

        }
        entry.lease = this.createLease(key, entry.watcher, entry.ready)
        this.entries.set(key, entry)
        return entry.lease
    }

    /**
     * @param {string} key
     * @param {import('chokidar').FSWatcher} watcher
     * @param {Promise<void>} ready
     * @returns {FileWatcherLease}
     */
    createLease(key, watcher, ready) {
        /** @type {FileWatcherLease} */
        const lease = {
            watcher,
            ready,
            close: () => this.close(key, lease),
        }
        return lease
    }

    /**
     * @param {string} key
     * @param {FileWatcherLease} [expectedLease]
     */
    async close(key, expectedLease) {
        const entry = this.entries.get(key)
        if (!entry) return
        if (expectedLease && entry.lease !== expectedLease) return
        this.entries.delete(key)
        await entry.watcher.close()
    }

    async closeAll() {
        const entries = [...this.entries.values()]
        this.entries.clear()
        await Promise.allSettled(entries.map(entry => entry.watcher.close()))
    }
}

const fileWatcherRegistry = /** @type {FileWatcherRegistry} */ (
    globalStore[registrySymbol] ||= new FileWatcherRegistry()
)

export default fileWatcherRegistry
