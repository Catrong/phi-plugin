import childProcess from "node:child_process"
import path from "node:path"
import { pathToFileURL } from "node:url"
import puppeteer from "puppeteer"
import timers from "node:timers/promises"
import { tempPath } from "../filesystem/path.js"
import logger from "../../components/Logger.js"
import platform from "../../components/platform/index.js"

const Renderer = platform.RendererBase
const PAGE_CLOSE_TIMEOUT_MS = 3000

/** @typedef {import('puppeteer').Browser} Browser */
/** @typedef {import('puppeteer').Page} Page */
/** @typedef {Record<string, any> & {tplFile?: string, saveId?: string, imgType?: 'jpeg'|'png'|'webp', quality?: number, omitBackground?: boolean, path?: string, multiPage?: boolean, multiPageHeight?: number, pageGotoParams?: Record<string, any>, isRenderTimeout?: boolean}} ScreenshotData */

/**
 * 渲染器实例对外暴露的公共接口（供 picmodle 等消费方做类型推断）
 * @typedef {object} PhiRenderer
 * @property {string} browserId 实例编号
 * @property {(name: string, data?: any) => Promise<any>} screenshot 截图，返回 Buffer / Buffer[] / false
 * @property {() => Promise<any>} browserInit 初始化 / 启动浏览器
 * @property {(force?: boolean) => Promise<any>} restart 重启浏览器
 * @property {() => Promise<void>} shutdown 永久关闭实例
 * @property {() => void} forceShutdown 退出阶段同步结束进程树
 */

/**
 * 插件独立 Puppeteer 渲染器。
 *
 * 不复用宿主渲染器，也不连接外部 WS。每个实例独立启动 Chromium、独立 profile，
 * 避免和 Bot 主渲染器或其他插件互相抢占 / 关闭浏览器。
 *
 * @type {new (config?: any, browserId?: string) => PhiRenderer}
 */
class Puppeteer extends Renderer {
    /**
     * @param {any} config
     * @param {string} browserId 实例编号
     */
    constructor(config = {}, browserId = "0") {
        super({
            id: `phi-puppeteer-${browserId}`,
            type: "image",
            render: "screenshot",
        })
        // 按实例读取当前平台配置，避免重载后仍保留首次导入时的宿主路径。
        const botConfig = platform.getBotConfig()
        this.browserId = browserId
        this.browser = /** @type {Browser | false} */ (false)
        this.browserPid = null
        this.initPromise = /** @type {Promise<Browser | false> | null} */ (null)
        this.closing = false
        this.closingPid = null
        this.closePromise = /** @type {Promise<void> | null} */ (null)
        this.shutdownRequested = false
        /** @type {string[]} */
        this.shoting = []
        /** 截图数达到时重启浏览器 避免生成速度越来越慢 */
        this.restartNum = config.restartNum || 100
        /** 截图次数 */
        this.renderNum = 0
        /** 空闲多久(ms)后自动关闭浏览器释放资源，0 为不关闭 */
        this.idleTimeout = config.idleTimeout ?? botConfig?.puppeteer_idle ?? 1800000
        /** 空闲定时器 */
        this.idleTimer = /** @type {NodeJS.Timeout | null} */ (null)
        /** 关闭浏览器的超时时间(ms)，超时则强制结束进程 */
        this.closeTimeout = config.closeTimeout || 8000
        this.pageCloseTimeout = Number.isFinite(config.pageCloseTimeout) && config.pageCloseTimeout > 0
            ? config.pageCloseTimeout : PAGE_CLOSE_TIMEOUT_MS
        this.templateClosePromise = /** @type {Promise<void> | null} */ (null)
        /** @type {any} */
        this.config = {
            userDataDir: path.resolve(tempPath, "puppeteer", browserId),
            headless: config.headless || "new",
            args: config.args || ["--disable-gpu", "--disable-setuid-sandbox", "--no-sandbox", "--no-zygote"],
            handleSIGINT: false,
            handleSIGTERM: false,
            handleSIGHUP: false,
        }
        if (config.chromiumPath || botConfig?.chromium_path) {
            this.config.executablePath = config.chromiumPath || botConfig?.chromium_path
        }
        /** puppeteer截图超时时间 */
        this.puppeteerTimeout = config.puppeteerTimeout || botConfig?.puppeteer_timeout || 0
        this.pageGotoParams = config.pageGotoParams || {
            timeout: 120000,
            waitUntil: ["networkidle0", "load", "domcontentloaded"],
        }
    }

    /**
     * 初始化chromium。并发调用会等待同一个启动 Promise，避免首帧撞上启动锁直接失败。
     * @returns {Promise<Browser | false>}
     */
    async browserInit() {
        if (this.closePromise) await this.closePromise
        if (this.shutdownRequested) return false
        if (this.browser) return this.browser
        if (this.initPromise) return this.initPromise

        this.initPromise = this.launchBrowser().finally(() => {
            this.initPromise = null
        })
        return this.initPromise
    }

    /** @returns {Promise<Browser | false>} */
    async launchBrowser() {
        logger.info(`[phi-plugin] puppeteer Chromium(${this.browserId}) 启动中...`)

        const launched = await puppeteer.launch(this.config).catch(async (/** @type {any} */ err) => {
            const errMsg = String(err)
            logger.error(err)
            if (errMsg.includes("Could not find Chromium")) {
                logger.error("没有正确安装 Chromium，可以尝试执行安装命令：node node_modules/puppeteer/install.js")
            } else if (errMsg.includes("cannot open shared object file")) {
                logger.error("没有正确安装 Chromium 运行库")
            } else if (errMsg.includes(this.config.userDataDir)) {
                logger.warn(`[phi-plugin] puppeteer profile 启动失败，保留目录及锁，请检查占用进程：${this.config.userDataDir}`)
            }
            return false
        })
        const browser = /** @type {Browser | false} */ (launched)

        if (!browser) {
            logger.error(`[phi-plugin] puppeteer Chromium(${this.browserId}) 启动失败`)
            return false
        }

        if (this.shutdownRequested) {
            this.closingPid = browser.process()?.pid
            await this.stop(browser, browser.process()?.pid)
            this.closingPid = null
            return false
        }

        this.browser = browser
        this.browserPid = browser.process()?.pid
        logger.info(`[phi-plugin] puppeteer Chromium(${this.browserId}) 启动成功 ${browser.wsEndpoint()}`)

        browser.once("disconnected", () => this.onDisconnected(browser))
        this.resetIdleTimer()
        return browser
    }

    /** 浏览器意外断开处理，主动关闭时不做任何动作 */
    /** @param {Browser} browser */
    onDisconnected(browser) {
        if (this.closing || this.browser !== browser) return
        logger.warn(`[phi-plugin] puppeteer Chromium(${this.browserId}) 连接已断开，将在下次渲染时重新启动`)
        void this.closeBrowser().catch(err => logger.error(err))
    }

    /**
     * `chromium` 截图
     * @param {string} name
     * @param {ScreenshotData} data 模板参数
     * @return img 不做segment包裹
     */
    async screenshot(name, data = {}) {
        this.clearIdleTimer()
        const jobName = `${name}#${Date.now()}`
        this.shoting.push(jobName)
        const start = Date.now()
        /** @type {Page | undefined} */
        let page
        /** @type {Browser | undefined} */
        let pageBrowser

        try {
            if (!(await this.browserInit())) return false
            data.saveId = `${data.saveId || name.split("/").pop()}_${this.browserId}`
            const resolvedPath = (/** @type {any} */ (this.dealTpl))(name, data)
            if (!resolvedPath) return false
            const savePath = String(resolvedPath)
            const renderPromise = (async () => {
                const browser = this.browser
                if (!browser) throw new Error('浏览器未启动')
                pageBrowser = browser
                page = await browser.newPage()
                return this.renderPage(page, name, savePath, data, start)
            })()
            const ret = await this.withTimeout(renderPromise, this.puppeteerTimeout, async () => {
                logger.error(`[图片生成][${name}] 截图超时，当前等待队列：${this.shoting.join(",")}`)
                await this.restart(true)
            })

            this.removeJob(jobName)

            if (ret.length === 0 || !ret[0]) {
                logger.error(`[图片生成][${name}] 图片生成为空`)
                return false
            }

            await this.restart()
            return data.multiPage ? ret : ret[0]
        } catch (/** @type {any} */ err) {
            logger.error(`[图片生成][${name}] 图片生成失败`, err)
            if (!err?.isRenderTimeout) await this.restart(true).catch(closeErr => logger.error(closeErr))
            return false
        } finally {
            try {
                if (page && !page.isClosed()) await this.closePage(page, pageBrowser)
            } finally {
                this.removeJob(jobName)
                this.resetIdleTimer()
            }
        }
    }

    /** 页面关闭也必须有独立截止时间；失败时回收所属浏览器，不能误关重启后的新实例。
     * @param {Page} page @param {Browser | undefined} browser
     */
    async closePage(page, browser) {
        let timeoutId
        try {
            await Promise.race([
                page.close(),
                new Promise((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error('page.close 超时')), this.pageCloseTimeout)
                }),
            ])
        } catch (err) {
            logger.error(`[phi-plugin] 页面关闭失败，回收所属浏览器(${this.browserId})`, err)
            if (browser && this.browser === browser) {
                await this.closeBrowser().catch(closeErr => logger.error(closeErr))
            } else if (this.closePromise) {
                await this.closePromise.catch(closeErr => logger.error(closeErr))
            }
        } finally {
            clearTimeout(timeoutId)
        }
    }

    /** @param {string} tplFile */
    watch(tplFile) {
        if (this.shutdownRequested) return
        return (/** @type {((file: string) => void) | undefined} */ (super.watch))?.call(this, tplFile)
    }

    /** 模板 watcher 属于渲染器实例；仅永久关闭时释放，普通 Chromium 重启继续复用。 */
    closeTemplateResources() {
        if (this.templateClosePromise) return this.templateClosePromise
        const watchers = [...new Set(Object.values(
            /** @type {Record<string, import('chokidar').FSWatcher>} */ (this.watcher || {})
        ))]
        this.watcher = {}
        this.html = {}
        this.htmlIdentity = {}
        this.phiTemplateIdentity = {}
        ;(/** @type {Set<string> | undefined} */ (this.phiTemplateWatchers))?.clear()
        this.templateClosePromise = Promise.allSettled(watchers.map(watcher =>
            Promise.resolve().then(() => watcher.close())
        )).then(results => {
            for (const result of results) {
                if (result.status === 'rejected') logger.error('[phi-plugin] 模板监听器关闭失败', result.reason)
            }
        })
        return this.templateClosePromise
    }

    /** @param {string} jobName */
    removeJob(jobName) {
        const idx = this.shoting.indexOf(jobName)
        if (idx >= 0) this.shoting.splice(idx, 1)
    }

    /** @param {Page} page @param {string} name @param {string} savePath @param {ScreenshotData} data @param {number} start */
    async renderPage(page, name, savePath, data, start) {
        const pageHeight = Math.max(1, Number(data.multiPageHeight) || 4000)
        const pageGotoParams = { ...this.pageGotoParams, ...(data.pageGotoParams || {}) }
        await page.goto(pathToFileURL(path.resolve(savePath)).href, pageGotoParams)

        const body = (await page.$("#container")) || (await page.$("body"))
        if (!body) throw new Error("未找到可截图的页面节点")

        const boundingBox = await body.boundingBox()
        if (!boundingBox || boundingBox.width <= 0 || boundingBox.height <= 0) {
            throw new Error("页面尺寸为空，无法截图")
        }

        /** @type {any} */
        const screenshotOptions = {
            type: data.imgType || "jpeg",
            omitBackground: data.omitBackground || false,
            quality: data.quality || 90,
        }
        if (data.path) screenshotOptions.path = data.path
        if (data.multiPage) screenshotOptions.type = "jpeg"
        if (screenshotOptions.type === "png") delete screenshotOptions.quality

        if (!data.multiPage) {
            const buff = await this.toBuffer(body.screenshot(screenshotOptions))
            this.renderNum++
            const kb = (buff.length / 1024).toFixed(2) + "KB"
            logger.mark(`[图片生成][${name}][${this.renderNum}次] ${kb} ${logger.green(`${Date.now() - start}ms`)}`)
            return [buff]
        }

        const totalHeight = Math.ceil(boundingBox.height)
        const viewportWidth = Math.max(1, Math.ceil(boundingBox.width))
        const num = Math.max(1, Math.ceil(totalHeight / pageHeight))
        const ret = []

        if (num > 1) {
            await page.setViewport({
                width: viewportWidth,
                height: Math.min(pageHeight, totalHeight) + 100,
            })
        }

        for (let i = 0; i < num; i++) {
            const remainHeight = totalHeight - pageHeight * i
            const currentHeight = Math.max(1, Math.min(pageHeight, remainHeight))
            if (num > 1) {
                await page.setViewport({
                    width: viewportWidth,
                    height: currentHeight + (i === num - 1 ? 0 : 100),
                })
                await page.evaluate(`window.scrollTo(0, ${pageHeight * i})`)
            }

            const buff = await this.toBuffer(num === 1 ? body.screenshot(screenshotOptions) : page.screenshot(screenshotOptions))
            if (num > 2) await timers.setTimeout(200)
            this.renderNum++

            const kb = (buff.length / 1024).toFixed(2) + "KB"
            logger.mark(`[图片生成][${name}][${i + 1}/${num}] ${kb}`)
            ret.push(buff)
        }

        if (num > 1) logger.mark(`[图片生成][${name}] 处理完成`)
        return ret
    }

    /** @param {Promise<Uint8Array | Buffer | string>} promise */
    async toBuffer(promise) {
        const buff = await promise
        return Buffer.isBuffer(buff) ? buff : Buffer.from(buff)
    }

    /** @template T @param {Promise<T>} promise @param {number} timeout @param {() => Promise<void>} onTimeout @returns {Promise<T>} */
    async withTimeout(promise, timeout, onTimeout) {
        if (!(timeout > 0)) return promise

        let timeoutId
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(async () => {
                try {
                    await onTimeout()
                } catch (err) {
                    logger.error(err)
                }
                const err = Object.assign(new Error(`截图超时(${timeout}ms)`), { isRenderTimeout: true })
                reject(err)
            }, timeout)
            timeoutId.unref?.()
        })

        try {
            return await Promise.race([promise, timeoutPromise])
        } finally {
            clearTimeout(timeoutId)
        }
    }

    /** 重启 */
    async restart(force = false) {
        if (this.shutdownRequested) return false
        if (!this.browser && !this.closePromise && !this.initPromise) return false
        if (!force && (this.renderNum % this.restartNum !== 0 || this.shoting.length > 0)) return false

        logger.info(`[phi-plugin] puppeteer Chromium(${this.browserId}) ${force ? "强制" : ""}关闭重启...`)
        await this.closeBrowser()
        return this.browserInit()
    }

    /** 空闲定时器：长时间无渲染时关闭浏览器释放资源 */
    resetIdleTimer() {
        this.clearIdleTimer()
        if (this.shutdownRequested || !this.browser || this.shoting.length > 0 || !(this.idleTimeout > 0)) return
        this.idleTimer = setTimeout(() => {
            if (this.shoting.length > 0 || !this.browser) return
            logger.info(`[phi-plugin] puppeteer Chromium(${this.browserId}) 空闲超过 ${this.idleTimeout / 1000}s，自动关闭释放资源`)
            void this.closeBrowser().catch(err => logger.error(err))
        }, this.idleTimeout)
        this.idleTimer.unref?.()
    }

    clearIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer)
            this.idleTimer = null
        }
    }

    /** 主动关闭浏览器且不重启，下次渲染时按需重新启动 */
    async closeBrowser() {
        if (this.closePromise) return this.closePromise
        if (this.initPromise) {
            await this.initPromise
            if (this.closePromise) return this.closePromise
        }
        if (!this.browser) return
        this.clearIdleTimer()
        const browser = this.browser
        const pid = this.browserPid
        this.closingPid = pid
        this.browser = false
        this.browserPid = null
        this.closing = true
        // Publish the barrier before stop can emit disconnected. On failure retain
        // both the barrier and PID: launching another browser would lose ownership.
        this.closePromise = Promise.resolve().then(() => this.stop(browser, pid)).then(() => {
            this.closingPid = null
            this.closing = false
            this.closePromise = null
        })
        return this.closePromise
    }

    /** 永久关闭实例；退出清理后不允许再次拉起 Chromium。 */
    async shutdown() {
        this.shutdownRequested = true
        this.clearIdleTimer()
        await this.closeTemplateResources()
        if (this.initPromise) {
            await this.initPromise.catch(() => false)
        }
        await this.closeBrowser()
    }

    /** 退出事件中只能做同步操作，按最后记录的 PID 强制结束进程树。 */
    forceShutdown() {
        this.shutdownRequested = true
        this.clearIdleTimer()
        const pid = this.browserPid || this.closingPid || (this.browser ? this.browser.process()?.pid : undefined)
        this.browser = false
        this.browserPid = null
        this.closingPid = null
        this.killProcess(pid)
    }

    /**
     * 关闭浏览器实例，close 超时则按 PID 强制结束进程树，杜绝孤儿/僵尸进程
     * @param browser 浏览器实例
     * @param pid 浏览器主进程 PID，缺省时取 browser.process()
     */
    /** @param {Browser} browser @param {number | null | undefined} pid */
    async stop(browser, pid) {
        if (!browser) return
        const browserProcess = browser.process()
        pid = pid ?? browserProcess?.pid
        let timeoutId
        try {
            await Promise.race([
                browser.close(),
                new Promise((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error("close 超时")), this.closeTimeout)
                }),
            ])
        } catch (err) {
            logger.error(`[phi-plugin] puppeteer Chromium(${this.browserId}) 正常关闭失败，尝试强制结束进程(${pid})`, err)
            this.killProcess(pid)
        } finally {
            clearTimeout(timeoutId)
        }
        // A disconnected transport may resolve close before the OS process exits.
        if (browserProcess && browserProcess.exitCode === null && browserProcess.signalCode === null) {
            this.killProcess(pid)
            const deadline = Date.now() + this.closeTimeout
            while (browserProcess.exitCode === null && browserProcess.signalCode === null) {
                if (Date.now() >= deadline) throw new Error(`Chromium(${pid}) 强制关闭后仍未退出，停止重新启动`)
                await timers.setTimeout(25)
            }
        }
    }

    /** 按 PID 强杀进程树（含子渲染进程） */
    /** @param {number | null | undefined} pid */
    killProcess(pid) {
        if (!pid) return
        try {
            if (process.platform === "win32") {
                childProcess.execFileSync("taskkill", ["/pid", `${pid}`, "/T", "/F"], { stdio: "ignore" })
            } else {
                // Puppeteer's POSIX launcher uses detached=true: PID is the
                // dedicated process group leader, never the bot's process group.
                process.kill(-pid, "SIGKILL")
            }
            logger.mark(`[phi-plugin] puppeteer Chromium(${this.browserId}) 进程 ${pid} 已强制结束`)
        } catch (/** @type {any} */ err) {
            logger.debug(`[phi-plugin] puppeteer Chromium(${this.browserId}) 进程 ${pid} 结束失败（可能已退出）：${err.message || err}`)
        }
    }
}

export default Puppeteer
