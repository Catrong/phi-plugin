// @ts-nocheck
import Renderer from "../../../lib/renderer/Renderer.js"
import os from "node:os"
import childProcess from "node:child_process"
import lodash from "lodash"
import puppeteer from "puppeteer"
import timers from "node:timers/promises"
import fs from "node:fs/promises"
// 暂时保留对原config的兼容
import cfg from "../../../lib/config/config.js"
import { redisPath } from "./constNum.js"
import { tempPath } from "./path.js"
import logger from "../components/Logger.js"

const _path = process.cwd()
// mac地址（全局只取一次）
let mac = ""

/**
 * 探测宿主（当前 Yunzai 分支）官方 puppeteer 渲染器是否「可被安全复用」。
 *
 * 复用的前提是它支持「按实例命名的 WS 缓存 key 前缀」（wsCacheKeyPrefix），
 * 只有这样插件的渲染器池才能与 Bot 主渲染器互相隔离、互不抢占 / 关闭浏览器。
 * 目前仅特定 Yunzai 的优化版渲染器满足该条件。
 *
 * 其他分支 / 旧版本探测失败时返回 null，回退到本文件的自包含实现，
 * 从而保证插件在任意 Yunzai 分支上都能正常工作（不依赖分支独有特性）。
 *
 * @returns {Promise<Function|null>} 宿主渲染器类或 null
 */
async function detectHostRenderer() {
    try {
        const Host = (await import("../../../renderers/puppeteer/lib/puppeteer.js")).default
        if (typeof Host !== "function") return null
        // 构造一个探针实例（仅设置字段，不会启动浏览器）检测特性是否存在
        const probe = new Host({ wsCacheKeyPrefix: "__phiProbe__", id: "__phiProbe__" })
        if (probe?.wsCacheKeyPrefix === "__phiProbe__" && typeof probe.screenshot === "function") {
            return Host
        }
    } catch {
        // 宿主无该渲染器或结构不同，忽略，走自包含实现
    }
    return null
}

const HostRenderer = await detectHostRenderer()

/**
 * 渲染器实例对外暴露的公共接口（供 picmodle 等消费方做类型推断）
 * @typedef {object} PhiRenderer
 * @property {string} browserId 实例编号
 * @property {(name: string, data?: any) => Promise<any>} screenshot 截图，返回 Buffer / Buffer[] / false
 * @property {() => Promise<any>} browserInit 初始化 / 启动浏览器
 * @property {(force?: boolean) => any} restart 重启浏览器
 */

/** @type {new (config?: any, browserId?: string) => PhiRenderer} */
let Puppeteer

if (HostRenderer) {
    logger.info("[phi-plugin] 检测到宿主优化渲染器，复用宿主实现")

    /**
     * 特定 Yunzai 分支适配：直接复用宿主优化渲染器，仅注入「多实例」隔离所需的配置。
     *
     * 自动继承宿主的空闲自动释放 / 关闭超时强杀进程 / 复用前连接校验 /
     * 页面句柄回收 / 断连防重启风暴等优化，并随宿主升级自动获得后续修复，
     * 避免插件与宿主各维护一份逻辑。
     */
    Puppeteer = class extends HostRenderer {
        /**
         * @param {any} config
         * @param {string} browserId 实例编号
         */
        constructor(config = {}, browserId = "0") {
            super({
                ...config,
                // 以下为实例隔离关键字段，放在 config 之后，避免被外部配置意外覆盖
                id: `phi-puppeteer-${browserId}`,
                // 每实例独立 profile 目录，置于插件 temp 下随启动统一清理
                userDataDir: `${tempPath}/puppeteer/${browserId}`,
                // 每实例独立 WS 端点缓存命名空间：与 Bot 主渲染器及其他实例隔离
                wsCacheKeyPrefix: `${redisPath}:browserWSEndpoint:${browserId}`,
            })
            this.browserId = browserId
        }

        /**
         * 截图，按实例隔离模板文件名，避免并行渲染同一模板时 html 互相覆盖
         * @param {string} name
         * @param {any} data
         */
        async screenshot(name, data = {}) {
            data.saveId = `${data.saveId || name.split("/").pop()}_${this.browserId}`
            return super.screenshot(name, data)
        }
    }
} else {
    logger.info("[phi-plugin] 使用插件自包含渲染器")

    /**
     * 自包含实现（可移植到任意 Yunzai 分支）。
     *
     * 仅依赖各分支通用、稳定的 `lib/renderer/Renderer.js` 基类与 puppeteer，
     * 不引用分支独有的渲染器实现；同时内置以下性能 / 内存优化：
     *   - 空闲一段时间后自动关闭浏览器释放内存，下次渲染按需重启
     *   - 关闭超时按 PID 强杀进程树，杜绝孤儿 / 僵尸 Chromium 进程
     *   - 复用 redis 缓存的实例前先校验可用性，避免连到僵死进程
     *   - 页面句柄在 finally 中统一回收，避免出错时泄漏
     *   - 断连时通过 closing 标记防止重启风暴
     *   - 启动失败若因 userDataDir 占用则清理后重试
     *   - 多实例：每实例独立 profile 目录与独立 redis WS 缓存 key，
     *     避免相互覆盖，更避免连接 / 关闭到 Bot 主渲染器的浏览器
     */
    Puppeteer = class extends Renderer {
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
            this.lock = false
            /** 正在主动关闭浏览器，用于抑制 disconnected 触发的重启 */
            this.closing = false
            /**
             * @type {any[]}
             */
            this.shoting = []
            /** 截图数达到时重启浏览器 避免生成速度越来越慢 */
            this.restartNum = config.restartNum || 100
            /** 截图次数 */
            this.renderNum = 0
            /** 空闲多久(ms)后自动关闭浏览器释放资源，0 为不关闭 */
            this.idleTimeout = config.idleTimeout ?? cfg?.bot?.puppeteer_idle ?? 1800000
            /** 空闲定时器 */
            this.idleTimer = null
            /** 关闭浏览器的超时时间(ms)，超时则强制结束进程 */
            this.closeTimeout = config.closeTimeout || 8000
            this.config = {
                // 每实例独立 profile 目录，置于插件 temp 下随启动统一清理
                userDataDir: `${tempPath}/puppeteer/${browserId}`,
                headless: config.headless || "new",
                args: config.args || ["--disable-gpu", "--disable-setuid-sandbox", "--no-sandbox", "--no-zygote"],
            }
            if (config.chromiumPath || cfg?.bot?.chromium_path)
                /** chromium其他路径 */
                this.config.executablePath = config.chromiumPath || cfg?.bot?.chromium_path
            if (config.puppeteerWS || cfg?.bot?.puppeteer_ws)
                /** 连接独立存在的 chromium */
                this.config.wsEndpoint = config.puppeteerWS || cfg?.bot?.puppeteer_ws
            /** puppeteer截图超时时间 */
            this.puppeteerTimeout = config.puppeteerTimeout || cfg?.bot?.puppeteer_timeout || 0
            this.pageGotoParams = config.pageGotoParams || {
                timeout: 120000,
                waitUntil: ["networkidle0", "load", "domcontentloaded"],
            }
        }

        /**
         * 初始化chromium
         */
        async browserInit() {
            if (this.browser) return this.browser
            if (this.lock) return false
            this.lock = true

            logger.info("[phi-plugin] puppeteer Chromium 启动中...")

            let connectFlag = false
            try {
                // 获取Mac地址（全局只取一次）
                if (!mac) mac = await this.getMac()
                // 每实例独立命名空间，避免互相覆盖或连到 Bot 主渲染器
                if (!this.browserMacKey) this.browserMacKey = `${redisPath}:browserWSEndpoint:${this.browserId}:${mac}`
                // 是否有可复用的 browser 实例
                const browserUrl = (await redis.get(this.browserMacKey)) || this.config.wsEndpoint
                if (browserUrl) {
                    let conn
                    try {
                        conn = await puppeteer.connect({ browserWSEndpoint: browserUrl })
                        // 校验实例可用，避免连接到僵死的孤儿进程
                        await Promise.race([
                            conn.version(),
                            timers.setTimeout(5000).then(() => Promise.reject(new Error("连接验证超时"))),
                        ])
                        this.browser = conn
                        connectFlag = true
                        logger.info(`[phi-plugin] puppeteer Chromium 连接成功 ${browserUrl}`)
                    } catch (err) {
                        logger.warn(`[phi-plugin] puppeteer Chromium 复用实例不可用，丢弃缓存：${err.message || err}`)
                        // 断开无效连接，避免残留句柄
                        try {
                            await conn?.disconnect?.()
                        } catch { }
                        await redis.del(this.browserMacKey)
                    }
                }
            } catch { }

            if (!this.browser || !connectFlag) {
                // 如果没有实例，初始化puppeteer
                this.browser = await puppeteer.launch(this.config).catch(async (err, trace) => {
                    const errMsg = err.toString() + (trace ? trace.toString() : "")
                    logger.error(err, trace)
                    if (errMsg.includes("Could not find Chromium")) {
                        logger.error("没有正确安装 Chromium，可以尝试执行安装命令：node node_modules/puppeteer/install.js")
                    } else if (errMsg.includes("cannot open shared object file")) {
                        logger.error("没有正确安装 Chromium 运行库")
                    } else if (errMsg.includes(this.config.userDataDir)) {
                        // userDataDir 被占用 / 残留锁，清理后重试
                        await fs.rm(this.config.userDataDir, { force: true, recursive: true }).catch(() => { })
                        return (this.lock = false)
                    }
                })
                if (this.lock === false) return this.browserInit()
            }

            this.lock = false
            if (!this.browser) {
                logger.error("[phi-plugin] puppeteer Chromium 启动失败")
                return false
            }
            /** 记录主进程 PID，关闭异常时用于强制结束进程树 */
            this.browserPid = this.browser.process()?.pid
            if (!connectFlag) {
                logger.info(`[phi-plugin] puppeteer Chromium 启动成功 ${this.browser.wsEndpoint()}`)
                if (this.browserMacKey) {
                    // 缓存一下实例30天
                    const expireTime = 60 * 60 * 24 * 30
                    await redis.set(this.browserMacKey, this.browser.wsEndpoint(), { EX: expireTime })
                }
            }

            /** 监听Chromium实例是否断开 */
            this.browser.on("disconnected", () => this.onDisconnected())

            return this.browser
        }

        /** 浏览器意外断开处理，主动关闭时不做任何动作 */
        onDisconnected() {
            if (this.closing) return
            logger.warn("[phi-plugin] puppeteer Chromium 连接已断开，将在下次渲染时重新启动")
            this.browser = false
            this.lock = false
            this.clearIdleTimer()
        }

        // 获取Mac地址
        getMac() {
            let mac = "00:00:00:00:00:00"
            try {
                const network = os.networkInterfaces()
                let macFlag = false
                for (const a in network) {
                    for (const i of network[a]) {
                        if (i.mac && i.mac !== mac) {
                            macFlag = true
                            mac = i.mac
                            break
                        }
                    }
                    if (macFlag) {
                        break
                    }
                }
            } catch (e) { }
            mac = mac.replace(/:/g, "")
            return mac
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
         * @param data.path   screenshot参数，截图保存路径。截图图片类型将从文件扩展名推断出来。如果是相对路径，则从当前路径解析。如果没有指定路径，图片将不会保存到硬盘。
         * @param data.multiPage 是否分页截图，默认false
         * @param data.multiPageHeight 分页状态下页面高度，默认4000
         * @param data.pageGotoParams 页面goto时的参数
         * @return img 不做segment包裹
         */
        async screenshot(name, data = {}) {
            /** 进入渲染先停掉空闲定时器，避免渲染途中被关闭 */
            this.clearIdleTimer()
            if (!(await this.browserInit())) return false
            const pageHeight = data.multiPageHeight || 4000

            // 多实例隔离模板文件名，避免并行渲染同一模板时 html 互相覆盖
            data.saveId = `${data.saveId || name.split("/").pop()}_${this.browserId}`

            const savePath = this.dealTpl(name, data)
            if (!savePath) return false

            let buff = ""
            const start = Date.now()

            let ret = []
            this.shoting.push(name)

            const puppeteerTimeout = this.puppeteerTimeout
            let overtime
            if (puppeteerTimeout > 0) {
                // TODO 截图超时处理
                overtime = setTimeout(() => {
                    if (this.shoting.length) {
                        logger.error(`[图片生成][${name}] 截图超时，当前等待队列：${this.shoting.join(",")}`)
                        this.restart(true)
                        this.shoting = []
                    }
                }, puppeteerTimeout)
            }

            let page
            try {
                page = await this.browser.newPage()
                const pageGotoParams = lodash.extend(this.pageGotoParams, data.pageGotoParams || {})
                await page.goto(`file://${_path}${lodash.trim(savePath, ".")}`, pageGotoParams)
                const body = (await page.$("#container")) || (await page.$("body"))

                // 计算页面高度
                const boundingBox = await body.boundingBox()
                // 分页数
                let num = 1

                const randData = {
                    type: data.imgType || "jpeg",
                    omitBackground: data.omitBackground || false,
                    quality: data.quality || 90,
                    path: data.path || "",
                }

                if (data.multiPage) {
                    randData.type = "jpeg"
                    num = Math.round(boundingBox.height / pageHeight) || 1
                }

                if (data.imgType === "png") delete randData.quality

                if (!data.multiPage) {
                    buff = await body.screenshot(randData)
                    if (!Buffer.isBuffer(buff)) buff = Buffer.from(buff)

                    this.renderNum++
                    /** 计算图片大小 */
                    const kb = (buff.length / 1024).toFixed(2) + "KB"
                    logger.mark(`[图片生成][${name}][${this.renderNum}次] ${kb} ${logger.green(`${Date.now() - start}ms`)}`)
                    ret.push(buff)
                } else {
                    // 分片截图
                    if (num > 1) {
                        await page.setViewport({
                            width: boundingBox.width,
                            height: pageHeight + 100,
                        })
                    }
                    for (let i = 1; i <= num; i++) {
                        if (i !== 1 && i === num)
                            await page.setViewport({
                                width: boundingBox.width,
                                height: parseInt(boundingBox.height) - pageHeight * (num - 1),
                            })

                        if (i !== 1 && i <= num)
                            await page.evaluate(pageHeight => window.scrollBy(0, pageHeight), pageHeight)

                        if (num === 1) buff = await body.screenshot(randData)
                        else buff = await page.screenshot(randData)
                        if (!Buffer.isBuffer(buff)) buff = Buffer.from(buff)

                        if (num > 2) await timers.setTimeout(200)

                        this.renderNum++

                        /** 计算图片大小 */
                        const kb = (buff.length / 1024).toFixed(2) + "KB"
                        logger.mark(`[图片生成][${name}][${i}/${num}] ${kb}`)
                        ret.push(buff)
                    }
                    if (num > 1) {
                        logger.mark(`[图片生成][${name}] 处理完成`)
                    }
                }
            } catch (err) {
                logger.error(`[图片生成][${name}] 图片生成失败`, err)
                /** 关闭浏览器 */
                this.restart(true)
                if (overtime) clearTimeout(overtime)
                ret = []
                return false
            } finally {
                /** 无论成功失败都关闭页面，避免页面句柄泄漏 */
                if (page) page.close().catch(err => logger.error(err))
                if (overtime) clearTimeout(overtime)
            }

            this.shoting.pop()

            if (ret.length === 0 || !ret[0]) {
                logger.error(`[图片生成][${name}] 图片生成为空`)
                return false
            }

            this.restart()
            /** 渲染完成后启动空闲定时器 */
            this.resetIdleTimer()
            return data.multiPage ? ret : ret[0]
        }

        /** 重启 */
        restart(force = false) {
            /** 截图超过重启数时，自动关闭重启浏览器，避免生成速度越来越慢 */
            if (!this.browser?.close || this.lock) return
            if (!force) if (this.renderNum % this.restartNum !== 0 || this.shoting.length > 0) return
            logger.info(`[phi-plugin] puppeteer Chromium ${force ? "强制" : ""}关闭重启...`)
            const browser = this.browser
            const pid = this.browserPid
            this.browser = false
            this.closing = true
            /** 关闭旧实例（带超时强杀），不阻塞新实例启动 */
            this.stop(browser, pid).finally(() => {
                this.closing = false
            })
            return this.browserInit()
        }

        /** 空闲定时器：长时间无渲染时关闭浏览器释放资源 */
        resetIdleTimer() {
            this.clearIdleTimer()
            if (!(this.idleTimeout > 0)) return
            this.idleTimer = setTimeout(() => {
                if (this.shoting.length > 0 || !this.browser) return
                logger.info(`[phi-plugin] puppeteer Chromium 空闲超过 ${this.idleTimeout / 1000}s，自动关闭释放资源`)
                this.closeBrowser()
            }, this.idleTimeout)
            /** 不阻止进程退出 */
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
            this.closing = true
            try {
                await this.stop(browser, pid)
                // 已主动销毁，清掉缓存的 WS 端点，避免下次连到死实例
                if (this.browserMacKey) await redis.del(this.browserMacKey).catch(() => { })
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
                logger.error(`[phi-plugin] puppeteer Chromium 正常关闭失败，尝试强制结束进程(${pid})`, err)
                this.killProcess(pid)
            }
        }

        /** 按 PID 强杀进程树（含子渲染进程） */
        killProcess(pid) {
            if (!pid) return
            try {
                if (process.platform === "win32") {
                    childProcess.execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" })
                } else {
                    process.kill(pid, "SIGKILL")
                }
                logger.mark(`[phi-plugin] puppeteer Chromium 进程 ${pid} 已强制结束`)
            } catch (err) {
                // 进程可能已退出，忽略
                logger.debug(`[phi-plugin] puppeteer Chromium 进程 ${pid} 结束失败（可能已退出）：${err.message || err}`)
            }
        }
    }
}

export default Puppeteer
