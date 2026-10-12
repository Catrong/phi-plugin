import { createRequire } from 'node:module'
import platform from '../../components/platform/index.js'

const require = createRequire(import.meta.url)

/** @typedef {{renderer: 'puppeteer' | 'shotium', source?: 'host' | 'local'}} Backend */
/** @typedef {import('./puppeteer.js').PhiRenderer} Renderer */

/** 只检查已选择后端的依赖，不加载另一套渲染器，也不启动引擎。 @param {Backend} backend */
export function validateRendererDependencies(backend) {
    if (backend.renderer === 'shotium' && backend.source === 'host') return
    if (backend.renderer === 'puppeteer' && platform.name === 'koishi' && !platform.hasPuppeteerService?.()) {
        throw new Error('使用 Puppeteer 需要安装并启用 koishi-plugin-puppeteer 服务；也可切换为 Shotium。')
    }
    const dependency = backend.renderer === 'shotium' ? '@pixel.js/shotium' : 'puppeteer'
    try {
        require.resolve(dependency)
    } catch {
        throw new Error(`所选渲染器缺少 ${dependency}，请在宿主目录安装该依赖后重试。`)
    }
}

/** @param {Backend} backend */
async function loadRenderer(backend) {
    if (backend.renderer === 'puppeteer') return (await import('./puppeteer.js')).default
    if (backend.source === 'host') return (await import('./shotium.js')).default
    return (await import('./koishiShotium.js')).default
}

/** 每个槽位只加载它所使用的后端；截图前切换或卸载不会初始化已废弃的槽位。 */
export default class LazyRenderer {
    /** @param {Backend} backend @param {any} config @param {string} browserId */
    constructor(backend, config, browserId) {
        this.backend = backend
        this.config = config
        this.browserId = browserId
        /** @type {Renderer | null} */
        this.instance = null
        /** @type {Promise<Renderer | false> | null} */
        this.initPromise = null
        /** @type {Set<Promise<any>>} */
        this.pending = new Set()
        this.shutdownRequested = false
        /** @type {Promise<void> | null} */
        this.shutdownPromise = null
    }

    async getInstance() {
        if (this.shutdownRequested) return false
        if (this.instance) return this.instance
        if (!this.initPromise) {
            this.initPromise = (async () => {
                validateRendererDependencies(this.backend)
                const RendererClass = await loadRenderer(this.backend)
                if (this.shutdownRequested) return false
                const renderer = new RendererClass(this.config, this.browserId)
                this.instance = renderer
                return renderer
            })().finally(() => { this.initPromise = null })
        }
        return this.initPromise
    }

    async browserInit() {
        const renderer = await this.getInstance()
        return renderer ? renderer.browserInit() : false
    }

    /** @param {string} name @param {any} [data] */
    async screenshot(name, data = {}) {
        if (this.shutdownRequested) return false
        const task = (async () => {
            const renderer = await this.getInstance()
            return renderer && !this.shutdownRequested ? renderer.screenshot(name, data) : false
        })()
        this.pending.add(task)
        try { return await task } finally { this.pending.delete(task) }
    }

    async restart(force = false) {
        return !this.shutdownRequested && this.instance ? this.instance.restart(force) : false
    }

    async shutdown() {
        if (this.shutdownPromise) return this.shutdownPromise
        this.shutdownRequested = true
        this.shutdownPromise = (async () => {
            await Promise.allSettled([...(this.initPromise ? [this.initPromise] : []), ...this.pending])
            await this.instance?.shutdown()
        })()
        return this.shutdownPromise
    }

    forceShutdown() {
        this.shutdownRequested = true
        this.instance?.forceShutdown()
    }
}
