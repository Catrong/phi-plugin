import fs from 'node:fs'
import path from 'node:path'
import logger from '../../components/Logger.js'
import platform from '../../components/platform/index.js'

const Renderer = platform.RendererBase
// 一次查询优先取容器；没有容器时才匹配 body，避免缺少 #container 的模板加载两遍。
const CAPTURE_SELECTOR = '#container, body:not(:has(#container))'

/** @typedef {import('./puppeteer.js').ScreenshotData} ScreenshotData */
/** @typedef {import('../../components/platform/types.js').PlatformHostRenderer} HostRenderer */

/**
 * 复用宿主 Shotium 的原始 render 入口。模板及监听器归插件实例所有，
 * 引擎、连接、计数及释放内存策略归宿主所有，实例退出不能关闭宿主。
 */
export default class Shotium extends Renderer {
    /** @param {any} [config] @param {string} [browserId] */
    constructor(config = {}, browserId = '0') {
        super({ id: `phi-shotium-${browserId}`, type: 'image', render: 'screenshot' })
        this.browserId = browserId
        this.timeout = Number(config.puppeteerTimeout) || 0
        this.shutdownRequested = false
        this.sequence = 0
        /** @type {Set<Promise<Buffer | Buffer[] | false>>} */
        this.pending = new Set()
        /** @type {Promise<void> | null} */
        this.shutdownPromise = null
    }

    /** 查找共享实例，不创建或启动另一套引擎。 @returns {Promise<HostRenderer | false>} */
    async browserInit() {
        if (this.shutdownRequested) return false
        const host = await platform.getHostRenderer?.('shotium')
        if (this.shutdownRequested) return false
        if (!host || host.id !== 'shotium' || typeof host.render !== 'function') {
            throw new Error('未找到宿主 Shotium 渲染器，请确认宿主已安装并加载 renderers/shotium。')
        }
        return host
    }

    /** @param {string} name @param {ScreenshotData} [data] @returns {Promise<Buffer | Buffer[] | false>} */
    async screenshot(name, data = {}) {
        if (this.shutdownRequested) return false
        const task = this.renderWithHost(name, data)
        this.pending.add(task)
        try {
            return await task
        } finally {
            this.pending.delete(task)
        }
    }

    /** @param {string} name @param {ScreenshotData} data @returns {Promise<Buffer | Buffer[] | false>} */
    async renderWithHost(name, data) {
        const host = await this.browserInit()
        if (!host || this.shutdownRequested) return false

        const request = {
            ...data,
            saveId: `${data.saveId || name.split('/').pop()}_shotium_${this.browserId}_${++this.sequence}`,
            pageGotoParams: {
                ...(this.timeout > 0 ? { timeout: this.timeout } : {}),
                ...(data.pageGotoParams || {}),
            },
        }
        /** @type {string | undefined} */
        let outputFile
        const canSelectOnce = typeof host.shot === 'function' && typeof host.shotContainer === 'function'
        // 宿主兼容模块可能把 screenshot 包装成 segment.image；render 仍是原始截图方法。
        // 模板与选择器入口属于本次请求；引擎及生命周期方法仍绑定宿主，所有状态写回宿主。
        const receiver = new Proxy(host, {
            get: (target, key) => {
                if (key === 'dealTpl') return (/** @type {string} */ templateName, /** @type {ScreenshotData} */ templateData) => {
                    const file = this.dealTpl(templateName, templateData)
                    if (file) outputFile = path.resolve(file)
                    return file
                }
                if (canSelectOnce && key === 'shotContainer') {
                    return (/** @type {string} */ method, /** @type {Record<string, any>} */ options) =>
                        target.shot(method, { ...options, selector: CAPTURE_SELECTOR })
                }
                const value = Reflect.get(target, key, target)
                // 分页方法内部也要走本次请求的选择器，同时通过 Proxy 将计数写回宿主。
                if (canSelectOnce && key === 'screenshotPages' && typeof value === 'function') return value.bind(receiver)
                return typeof value === 'function' ? value.bind(target) : value
            },
            set: (target, key, value) => Reflect.set(target, key, value, target),
        })
        try {
            const result = await host.render.call(receiver, name, request)
            if (!result) return false
            const images = Array.isArray(result) ? result : [result]
            if (!images.length) return false
            const buffers = images.map(image => {
                if (Buffer.isBuffer(image)) return image
                if (image instanceof Uint8Array) return Buffer.from(image)
                throw new Error('宿主 Shotium 返回了无效的截图数据，应为 Buffer 或 Buffer[]。')
            })
            return data.multiPage ? buffers : buffers[0]
        } finally {
            // 请求使用独立 HTML 防止并发覆盖；引擎返回后清理，避免每张图都永久堆积文件。
            // 用户显式指定的图片保存路径即使与临时 HTML 相同，也必须保留。
            if (outputFile && (!data.path || path.resolve(data.path) !== outputFile)) {
                try {
                    await fs.promises.unlink(outputFile)
                } catch (/** @type {any} */ err) {
                    if (err?.code !== 'ENOENT') logger.warn('[phi-plugin] Shotium 临时 HTML 清理失败', err)
                }
            }
        }
    }

    /** 独立实例的模板输出目录也要兼容缓存命中后的不同 name。 */
    /** @param {string} name @param {ScreenshotData} data */
    dealTpl(name, data) {
        fs.mkdirSync(path.join(String(this.dir || './temp/html'), name), { recursive: true })
        return (/** @type {(name: string, data: ScreenshotData) => string | false} */ (super.dealTpl)).call(this, name, data)
    }

    /** 共享引擎由宿主管理，插件的重启操作不触碰其生命周期。 */
    async restart() {
        return !this.shutdownRequested
    }

    /** 永久停止接单，并且只回收插件自己创建的模板资源。 */
    async shutdown() {
        if (this.shutdownPromise) return this.shutdownPromise
        this.shutdownRequested = true
        this.shutdownPromise = (async () => {
            await Promise.allSettled([...this.pending])
            const watchers = [...new Set(Object.values(
                /** @type {Record<string, import('chokidar').FSWatcher>} */ (this.watcher || {})
            ))]
            this.watcher = {}
            this.html = {}
            this.htmlIdentity = {}
            this.phiTemplateIdentity = {}
            ;(/** @type {Set<string> | undefined} */ (this.phiTemplateWatchers))?.clear()
            const results = await Promise.allSettled(watchers.map(watcher => watcher.close()))
            for (const result of results) {
                if (result.status === 'rejected') logger.error('[phi-plugin] Shotium 模板监听器关闭失败', result.reason)
            }
        })()
        return this.shutdownPromise
    }

    /** exit 阶段只标记实例已关闭，不能关闭宿主引擎或结束宿主进程。 */
    forceShutdown() {
        this.shutdownRequested = true
    }
}
