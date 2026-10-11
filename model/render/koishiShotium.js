import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import platform from '../../components/platform/index.js'
import logger from '../../components/Logger.js'
import { pluginRoot } from '../filesystem/path.js'
import { dealPvisTemplate } from './pvisTemplate.js'

const Renderer = platform.RendererBase
const CAPTURE_SELECTOR = '#container, body:not(:has(#container))'
const ROOT_ID = createHash('sha256').update(path.resolve(pluginRoot)).digest('hex').slice(0, 20)
const SDK_PACKAGE = '@pixel.js/shotium'

/** @typedef {import('./puppeteer.js').ScreenshotData} ScreenshotData */
/**
 * @typedef {object} ShotiumClient
 * @property {boolean} [closed]
 * @property {(event: string, listener: () => void) => unknown} [once]
 * @property {(options: Record<string, any>) => Promise<{image: Buffer | Uint8Array | null}>} screenshot
 * @property {(options: Record<string, any>) => Promise<{tiles: {image: Buffer | Uint8Array | null}[]}>} screenshotTiles
 * @property {() => void} close
 */
/** @typedef {{daemon: {connect: (options: Record<string, any>) => Promise<ShotiumClient>}}} ShotiumSDK */
/** @typedef {{image: Buffer | Uint8Array | null} | {tiles: {image: Buffer | Uint8Array | null}[]}} CaptureResult */

/** 按需加载，选择 Puppeteer 时无需安装或加载 Shotium 的原生依赖。 */
/** @param {() => Promise<any>} [readModule] */
export async function loadKoishiShotiumSDK(readModule = () => import(SDK_PACKAGE)) {
    try {
        const sdk = /** @type {ShotiumSDK} */ (/** @type {unknown} */ (await readModule()))
        if (typeof sdk?.daemon?.connect !== 'function') {
            throw new Error('当前 SDK 不支持 daemon.connect，请升级 @pixel.js/shotium 至 0.12.2 或更高版本。')
        }
        return sdk
    } catch (/** @type {any} */ err) {
        if (err?.code === 'ERR_MODULE_NOT_FOUND' && String(err.message).includes("Cannot find package '@pixel.js/shotium'")) {
            throw new Error('Koishi Shotium 依赖未安装，请在 Koishi 项目中执行 npm install @pixel.js/shotium（或 pnpm add @pixel.js/shotium）。', { cause: err })
        }
        throw new Error(`Koishi Shotium SDK 加载失败，请检查 @pixel.js/shotium 及当前平台原生依赖的安装：${err?.message || err}`, { cause: err })
    }
}

/**
 * Koishi 独立连接 Shotium SDK 的守护进程，避免进程级 Blink 生命周期影响宿主。
 * 相同插件目录的渲染池与热重载复用同一个 daemon，每个实例仅拥有自己的连接和模板。
 * 永久关闭只 close 客户端；daemon 在全部连接断开且任务完成后自行空闲退出。
 */
export default class KoishiShotium extends Renderer {
    /** @param {any} [config] @param {string} [browserId] */
    constructor(config = {}, browserId = '0') {
        super({ id: `phi-koishi-shotium-${browserId}`, type: 'image', render: 'screenshot' })
        this.browserId = browserId
        this.timeout = Number.isFinite(Number(config.puppeteerTimeout)) && Number(config.puppeteerTimeout) > 0
            ? Number(config.puppeteerTimeout) : 0
        this.sequence = 0
        this.shutdownRequested = false
        /** @type {ShotiumClient | null} */
        this.client = null
        /** @type {Promise<ShotiumClient | false> | null} */
        this.initPromise = null
        /** @type {Promise<boolean> | null} */
        this.restartPromise = null
        /** @type {Promise<void> | null} */
        this.shutdownPromise = null
        /** @type {Set<Promise<Buffer | Buffer[] | false>>} */
        this.pending = new Set()
        /** 用户侧超时后原生任务仍可能排队，保持 HTML 和连接直到原生结果实际返回。 */
        /** @type {Set<Promise<Buffer | Buffer[] | false>>} */
        this.captures = new Set()
        /** @type {Set<Promise<any>>} */
        this.blockedCaptures = new Set()
        // 测试可注入 SDK loader；生产仅从标准 npm 包解析，不查找 Yunzai 目录。
        this.sdkLoader = /** @type {() => Promise<ShotiumSDK>} */ (config.sdkLoader || loadKoishiShotiumSDK)
        this.daemonOptions = {
            name: `phi-koishi-${ROOT_ID}`,
            idleTimeoutMs: 300000,
            ...config.shotiumDaemonOptions,
        }
        // 与 Puppeteer 的默认视窗一致，响应式模板首次布局保持相同断点。
        this.viewport = config.viewport || { width: 800, height: 600 }
        this.scale = Number(config.scale) > 0 && Number(config.scale) <= 8 ? Number(config.scale) : 1
    }

    /** 并发初始化共享同一次连接，不创建进程内引擎。 @returns {Promise<ShotiumClient | false>} */
    async browserInit() {
        if (this.restartPromise) await this.restartPromise
        // 超时不是取消原生截图：先排空该实例超时的任务，避免槽位归还后不断堆积 daemon 队列。
        while (this.blockedCaptures.size) await Promise.allSettled([...this.blockedCaptures])
        if (this.shutdownRequested) return false
        if (this.client && !this.client.closed) return this.client
        if (this.initPromise) return this.initPromise
        this.initPromise = this.connectDaemon().finally(() => { this.initPromise = null })
        return this.initPromise
    }

    /** @returns {Promise<ShotiumClient | false>} */
    async connectDaemon() {
        const sdk = await this.sdkLoader()
        if (this.shutdownRequested) return false
        if (typeof sdk?.daemon?.connect !== 'function') {
            throw new Error('当前 Shotium SDK 不支持 daemon.connect，请升级 @pixel.js/shotium 至 0.12.2 或更高版本。')
        }
        const client = await sdk.daemon.connect(this.daemonOptions)
        if (this.shutdownRequested) {
            client.close()
            return false
        }
        this.client = client
        client.once?.('close', () => {
            if (this.client === client) this.client = null
        })
        return client
    }

    /** @param {string} name @param {ScreenshotData} [data] @returns {Promise<Buffer | Buffer[] | false>} */
    async screenshot(name, data = {}) {
        if (this.shutdownRequested) return false
        const task = this.renderWithClient(name, data)
        this.pending.add(task)
        try {
            return await task
        } finally {
            this.pending.delete(task)
        }
    }

    /** @param {string} name @param {ScreenshotData} data @returns {Promise<Buffer | Buffer[] | false>} */
    async renderWithClient(name, data) {
        const client = await this.browserInit()
        if (!client || this.shutdownRequested) return false
        const request = {
            ...data,
            saveId: `${data.saveId || name.split('/').pop()}_shotium_${this.browserId}_${++this.sequence}`,
        }
        const file = this.dealTpl(name, request)
        if (!file) return false
        const outputFile = path.resolve(file)
        const capture = this.captureAndClean(client, outputFile, data).finally(() => {
            this.captures.delete(capture)
            this.blockedCaptures.delete(capture)
        })
        this.captures.add(capture)
        return this.withTimeout(capture)
    }

    /** @param {ShotiumClient} client @param {string} outputFile @param {ScreenshotData} data @returns {Promise<Buffer | Buffer[] | false>} */
    async captureAndClean(client, outputFile, data) {
        try {
            const options = this.captureOptions(outputFile, data)
            /** @type {Promise<CaptureResult>} */
            const capture = data.multiPage
                ? client.screenshotTiles({ ...options, tile: { height: Math.min(32000, Math.max(1, Math.round(Number(data.multiPageHeight) || 4000))) } })
                : client.screenshot(options)
            const result = await capture
            const images = 'tiles' in result ? result.tiles.map(tile => tile.image) : [result.image]
            if (!images.length || images.some(image => !image)) return false
            const buffers = images.map(image => {
                if (Buffer.isBuffer(image)) return image
                if (image instanceof Uint8Array) return Buffer.from(image)
                throw new Error('Koishi Shotium 返回了无效的截图数据，应为 Buffer 或 Buffer[]。')
            })
            // 与现有渲染器保持一致：path 保存首图，同时仍返回原始 Buffer / Buffer[]。
            if (data.path) {
                const imageFile = path.resolve(data.path)
                await fs.promises.mkdir(path.dirname(imageFile), { recursive: true })
                await fs.promises.writeFile(imageFile, buffers[0])
            }
            return data.multiPage ? buffers : buffers[0]
        } finally {
            if (!data.path || path.resolve(data.path) !== outputFile) {
                try {
                    await fs.promises.unlink(outputFile)
                } catch (/** @type {any} */ err) {
                    if (err?.code !== 'ENOENT') logger.warn('[phi-plugin] Koishi Shotium 临时 HTML 清理失败', err)
                }
            }
        }
    }

    /** @param {string} file @param {ScreenshotData} data @returns {Record<string, any>} */
    captureOptions(file, data) {
        const type = data.multiPage ? 'jpeg' : data.imgType || 'jpeg'
        const params = data.pageGotoParams || {}
        const waits = Array.isArray(params.waitUntil) ? params.waitUntil : [params.waitUntil]
        const requestedTimeout = Number(params.timeout)
        const timeout = Number.isFinite(requestedTimeout) && requestedTimeout >= 0
            ? requestedTimeout : this.timeout > 0 ? this.timeout : 30000
        const options = {
            file: pathToFileURL(file).href,
            type,
            selector: CAPTURE_SELECTOR,
            viewport: { ...this.viewport },
            scale: this.scale,
            allowFileAccess: true,
            pageGotoParams: {
                waitUntil: waits.some(wait => String(wait).startsWith('networkidle')) ? 'networkidle' : 'load',
                timeout,
            },
        }
        if (type !== 'png') {
            const quality = Number(data.quality)
            Object.assign(options, { quality: Number.isFinite(quality) && quality >= 1 && quality <= 100 ? Math.round(quality) : 90 })
        }
        if (data.omitBackground && type !== 'jpeg') Object.assign(options, { omitBackground: true })
        return options
    }

    /** 总截图超时只结束用户侧等待；连接与 HTML 要保留到原生任务实际完成。 */
    /** @template T @param {Promise<T>} capture @returns {Promise<T>} */
    async withTimeout(capture) {
        if (!(this.timeout > 0)) return capture
        /** @type {NodeJS.Timeout | undefined} */
        let timer
        try {
            return await Promise.race([
                capture,
                new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        this.blockedCaptures.add(capture)
                        reject(Object.assign(new Error(`Koishi Shotium 截图超时(${this.timeout}ms)`), { isRenderTimeout: true }))
                    }, this.timeout)
                    timer.unref?.()
                }),
            ])
        } finally {
            clearTimeout(timer)
        }
    }

    /** 缓存命中后的新 name 也需要输出目录。 @param {string} name @param {ScreenshotData} data */
    dealTpl(name, data) {
        fs.mkdirSync(path.join(String(this.dir || './temp/html'), name), { recursive: true })
        return dealPvisTemplate(this, name, data, /** @type {(name: string, data: ScreenshotData) => string | false} */ (super.dealTpl))
    }

    /** @param {string} file */
    watch(file) {
        if (this.shutdownRequested) return
        return (/** @type {((file: string) => void) | undefined} */ (super.watch))?.call(this, file)
    }

    /** 重启仅更新连接，下次渲染再连上原守护进程，等待现有截图完成。 */
    /** @param {boolean} [_force] */
    async restart(_force = false) {
        if (this.shutdownRequested) return false
        if (this.restartPromise) return this.restartPromise
        const pending = [...this.pending]
        const captures = [...this.captures]
        const initializing = this.initPromise
        this.restartPromise = (async () => {
            await Promise.allSettled([...pending, ...captures, ...(initializing ? [initializing] : [])])
            this.closeClient()
            return !this.shutdownRequested
        })().finally(() => { this.restartPromise = null })
        return this.restartPromise
    }

    closeClient() {
        const client = this.client
        this.client = null
        client?.close()
    }

    /** 永久停止接单，等待当前任务并释放本实例连接、监听器及模板缓存。 */
    async shutdown() {
        if (this.shutdownPromise) return this.shutdownPromise
        this.shutdownRequested = true
        this.shutdownPromise = (async () => {
            await Promise.allSettled([
                ...this.pending,
                ...this.captures,
                ...(this.initPromise ? [this.initPromise] : []),
                ...(this.restartPromise ? [this.restartPromise] : []),
            ])
            this.closeClient()
            const watchers = [...new Set(Object.values(
                /** @type {Record<string, import('chokidar').FSWatcher>} */ (this.watcher || {})
            ))]
            this.watcher = {}
            this.html = {}
            this.htmlIdentity = {}
            this.phiTemplateIdentity = {}
            ;(/** @type {Set<string> | undefined} */ (this.phiTemplateWatchers))?.clear()
            const results = await Promise.allSettled(watchers.map(watcher => Promise.resolve().then(() => watcher.close())))
            for (const result of results) {
                if (result.status === 'rejected') logger.error('[phi-plugin] Koishi Shotium 模板监听器关闭失败', result.reason)
            }
        })()
        return this.shutdownPromise
    }

    /** 退出阶段同步断开自己的连接，不停止 daemon，不影响其他实例。 */
    forceShutdown() {
        this.shutdownRequested = true
        this.closeClient()
    }
}
