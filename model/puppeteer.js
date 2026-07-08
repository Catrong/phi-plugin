// @ts-nocheck
import childProcess from "node:child_process"
import path from "node:path"
import { pathToFileURL } from "node:url"
import puppeteer from "puppeteer"
import timers from "node:timers/promises"
import fs from "node:fs/promises"
import { tempPath } from "./path.js"
import logger from "../components/Logger.js"
import platform from "../components/platform/index.js"

const Renderer = platform.RendererBase
const botConfig = platform.getBotConfig()

/**
 * 渲染器实例对外暴露的公共接口（供 picmodle 等消费方做类型推断）
 * @typedef {object} PhiRenderer
 * @property {string} browserId 实例编号
 * @property {(name: string, data?: any) => Promise<any>} screenshot 截图，返回 Buffer / Buffer[] / false
 * @property {() => Promise<any>} browserInit 初始化 / 启动浏览器
 * @property {(force?: boolean) => Promise<any>} restart 重启浏览器
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
        this.browserId = browserId
        this.browser = false
        this.browserPid = null
        this.initPromise = null
        this.closing = false
        this.shoting = []
        /** 截图数达到时重启浏览器 避免生成速度越来越慢 */
        this.restartNum = config.restartNum || 100
        /** 截图次数 */
        this.renderNum = 0
        /** 空闲多久(ms)后自动关闭浏览器释放资源，0 为不关闭 */
        this.idleTimeout = config.idleTimeout ?? botConfig?.puppeteer_idle ?? 1800000
        /** 空闲定时器 */
        this.idleTimer = null
        /** 关闭浏览器的超时时间(ms)，超时则强制结束进程 */
        this.closeTimeout = config.closeTimeout || 8000
        this.config = {
            userDataDir: path.resolve(tempPath, "puppeteer", browserId),
            headless: config.headless || "new",
            args: config.args || ["--disable-gpu", "--disable-setuid-sandbox", "--no-sandbox", "--no-zygote"],
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
     */
    async browserInit() {
        if (this.browser) return this.browser
        if (this.initPromise) return this.initPromise

        this.initPromise = this.launchBrowser().finally(() => {
            this.initPromise = null
        })
        return this.initPromise
    }

    async launchBrowser() {
        logger.info(`[phi-plugin] puppeteer Chromium(${this.browserId}) 启动中...`)

        let browser = await puppeteer.launch(this.config).catch(async (err, trace) => {
            const errMsg = err.toString() + (trace ? trace.toString() : "")
            logger.error(err, trace)
            if (errMsg.includes("Could not find Chromium")) {
                logger.error("没有正确安装 Chromium，可以尝试执行安装命令：node node_modules/puppeteer/install.js")
            } else if (errMsg.includes("cannot open shared object file")) {
                logger.error("没有正确安装 Chromium 运行库")
            } else if (errMsg.includes(this.config.userDataDir)) {
                logger.warn(`[phi-plugin] puppeteer profile 被占用，清理后重试：${this.config.userDataDir}`)
                await fs.rm(this.config.userDataDir, { force: true, recursive: true }).catch(() => { })
                return puppeteer.launch(this.config).catch(retryErr => {
                    logger.error(retryErr)
                    return false
                })
            }
            return false
        })

        if (!browser) {
            logger.error(`[phi-plugin] puppeteer Chromium(${this.browserId}) 启动失败`)
            return false
        }

        this.browser = browser
        this.browserPid = browser.process()?.pid
        logger.info(`[phi-plugin] puppeteer Chromium(${this.browserId}) 启动成功 ${browser.wsEndpoint()}`)

        browser.once("disconnected", () => this.onDisconnected(browser))
        return browser
    }

    /** 浏览器意外断开处理，主动关闭时不做任何动作 */
    onDisconnected(browser) {
        if (this.closing || this.browser !== browser) return
        logger.warn(`[phi-plugin] puppeteer Chromium(${this.browserId}) 连接已断开，将在下次渲染时重新启动`)
        this.browser = false
        this.browserPid = null
        this.clearIdleTimer()
    }

    /**
     * `chromium` 截图
     * @param name
     * @param data 模板参数
     * @param data.tplFile 模板路径，必传
     * @param data.saveId  生成html名称，为空name代替
     * @param data.imgType  screenshot参数，生成图片类型：jpeg，png
     * @param data.quality  screenshot参数，图片质量 0-100，jpeg是可传，默认90
     * @param data.omitBackground  screenshot参数，隐藏默认的白色背景，背景透明。默认不透明
     * @param data.path   screenshot参数，截图图片类型将从文件扩展名推断出来。如果是相对路径，则从当前路径解析。
     * @param data.multiPage 是否分页截图，默认false
     * @param data.multiPageHeight 分页状态下页面高度，默认4000
     * @param data.pageGotoParams 页面goto时的参数
     * @return img 不做segment包裹
     */
    async screenshot(name, data = {}) {
        this.clearIdleTimer()
        if (!(await this.browserInit())) return false

        data.saveId = `${data.saveId || name.split("/").pop()}_${this.browserId}`
        const savePath = this.dealTpl(name, data)
        if (!savePath) return false

        const jobName = `${name}#${Date.now()}`
        this.shoting.push(jobName)
        const start = Date.now()
        let page

        try {
            const renderPromise = (async () => {
                page = await this.browser.newPage()
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
            this.resetIdleTimer()
            return data.multiPage ? ret : ret[0]
        } catch (err) {
            logger.error(`[图片生成][${name}] 图片生成失败`, err)
            if (!err?.isRenderTimeout) await this.restart(true)
            return false
        } finally {
            this.removeJob(jobName)
            if (page && !page.isClosed()) {
                await page.close().catch(err => logger.error(err))
            }
        }
    }

    removeJob(jobName) {
        const idx = this.shoting.indexOf(jobName)
        if (idx >= 0) this.shoting.splice(idx, 1)
    }

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
                await page.evaluate(y => window.scrollTo(0, y), pageHeight * i)
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

    async toBuffer(promise) {
        const buff = await promise
        return Buffer.isBuffer(buff) ? buff : Buffer.from(buff)
    }

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
                const err = new Error(`截图超时(${timeout}ms)`)
                err.isRenderTimeout = true
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
        if (!this.browser?.close) return false
        if (!force && (this.renderNum % this.restartNum !== 0 || this.shoting.length > 0)) return false

        logger.info(`[phi-plugin] puppeteer Chromium(${this.browserId}) ${force ? "强制" : ""}关闭重启...`)
        const browser = this.browser
        const pid = this.browserPid
        this.browser = false
        this.browserPid = null
        this.clearIdleTimer()
        this.closing = true
        try {
            await this.stop(browser, pid)
        } finally {
            this.closing = false
        }
        return this.browserInit()
    }

    /** 空闲定时器：长时间无渲染时关闭浏览器释放资源 */
    resetIdleTimer() {
        this.clearIdleTimer()
        if (!(this.idleTimeout > 0)) return
        this.idleTimer = setTimeout(() => {
            if (this.shoting.length > 0 || !this.browser) return
            logger.info(`[phi-plugin] puppeteer Chromium(${this.browserId}) 空闲超过 ${this.idleTimeout / 1000}s，自动关闭释放资源`)
            this.closeBrowser()
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
        if (!this.browser) return
        this.clearIdleTimer()
        const browser = this.browser
        const pid = this.browserPid
        this.browser = false
        this.browserPid = null
        this.closing = true
        try {
            await this.stop(browser, pid)
        } finally {
            this.closing = false
        }
    }

    /**
     * 关闭浏览器实例，close 超时则按 PID 强制结束进程树，杜绝孤儿/僵尸进程
     * @param browser 浏览器实例
     * @param pid 浏览器主进程 PID，缺省时取 browser.process()
     */
    async stop(browser, pid) {
        if (!browser) return
        pid = pid ?? browser.process()?.pid
        try {
            await Promise.race([
                browser.close(),
                timers.setTimeout(this.closeTimeout).then(() => Promise.reject(new Error("close 超时"))),
            ])
        } catch (err) {
            logger.error(`[phi-plugin] puppeteer Chromium(${this.browserId}) 正常关闭失败，尝试强制结束进程(${pid})`, err)
            this.killProcess(pid)
        }
    }

    /** 按 PID 强杀进程树（含子渲染进程） */
    killProcess(pid) {
        if (!pid) return
        try {
            if (process.platform === "win32") {
                childProcess.execFileSync("taskkill", ["/pid", `${pid}`, "/T", "/F"], { stdio: "ignore" })
            } else {
                process.kill(pid, "SIGKILL")
            }
            logger.mark(`[phi-plugin] puppeteer Chromium(${this.browserId}) 进程 ${pid} 已强制结束`)
        } catch (err) {
            logger.debug(`[phi-plugin] puppeteer Chromium(${this.browserId}) 进程 ${pid} 结束失败（可能已退出）：${err.message || err}`)
        }
    }
}

export default Puppeteer
