import puppeteer from './puppeteer.js'
import { Data, Version, Plugin_Name, Display_Plugin_Name, Config } from '../../components/index.js'
import { _path, pluginResources, imgPath, tempPath } from '../filesystem/path.js'
import fCompute from '../game/fCompute.js'
import themeManager from '../theme/manager.js'
import fs from 'node:fs'
import logger from '../../components/Logger.js'
import segment from '../../components/segment.js'
import path from 'node:path'
import platform from '../../components/platform/index.js'
import { registerProcessCleanup } from '../../components/ProcessCleanup.js'
import RenderPressureHistory from './renderPressureHistory.js'
import { renderDefaultB30Canvas } from './b30CanvasRenderer.js'

/**@import {botEvent} from '../../components/baseClass.js' */

export default await new class picmodle {

    constructor() {
        /**
         * 空闲渲染器下标
         * @type {number[]}
         */
        this.idle = []
        /**
         * 等待空闲渲染器的请求队列（事件驱动，无需轮询）
         * @type {{settled: boolean, done: (idx: number) => void, timer: any}[]}
         */
        this.waiters = []
        /**
         * 渲染中的请求 id（仅用于诊断日志）
         * @type {Set<number>}
         */
        this.rendering = new Set()
        /**
         * puppeteer实例池
         * @type {import('./puppeteer.js').PhiRenderer[]}
         */
        this.puppeteer = []
        this.tot = 0
        this.pressureWindowStartedAt = new Date().toISOString()
        this.pressureCompleted = 0
        this.pressureFailed = 0
        this.pressureTimedOut = 0
        this.pressureMaxActive = 0
        this.pressureMaxQueued = 0
        this.pressureHistory = new RenderPressureHistory()
        this.shuttingDown = false
        this.closePromise = null
        registerProcessCleanup(() => this.close(), () => this.forceClose())
    }

    async init() {
        /** 清理临时文件 */
        try {
            fs.rmSync(tempPath, { force: true, recursive: true })
        } catch (err) {
            logger.error(`[Phi-Plugin][清理临时文件失败]`)
            logger.error(err)
        }
        /** 初始化渲染器槽位；Chromium 在非 Canvas 页面首次渲染时按需启动。 */
        let num = Config.getUserCfg('config', 'renderNum')
        for (let i = 0; i < num; i++) {
            this.puppeteer.push(new puppeteer({
                puppeteerTimeout: Config.getUserCfg('config', 'timeout')
            }, `${i}`))
            this.idle.push(i)
        }
        return this;
    }

    /**
     * 获取一个空闲渲染器下标；超时返回 -1
     * 事件驱动，替代原本每 100ms 轮询一次的忙等
     * @param {number} timeout 等待超时时间 ms
     * @returns {Promise<number>}
     */
    acquire(timeout) {
        if (this.shuttingDown) return Promise.resolve(-1)
        if (this.idle.length) return Promise.resolve(/** @type {number} */(this.idle.shift()))
        /** @type {Promise<number>} */
        const p = new Promise(resolve => {
            /** @type {{ settled: boolean, timer: any, done: (idx: number) => void }} */
            const waiter = {
                settled: false,
                timer: null,
                done: (idx) => {
                    if (waiter.settled) return
                    waiter.settled = true
                    clearTimeout(waiter.timer)
                    resolve(idx)
                },
            }
            waiter.timer = setTimeout(() => {
                const i = this.waiters.indexOf(waiter)
                if (i >= 0) this.waiters.splice(i, 1)
                waiter.done(-1)
            }, timeout)
            waiter.timer.unref?.()
            this.waiters.push(waiter)
            this.pressureMaxQueued = Math.max(this.pressureMaxQueued, this.waiters.length)
        })
        return p
    }

    /**
     * 归还渲染器：优先直接移交给等待队列中的下一个请求，否则放回空闲池
     * @param {number} idx
     */
    release(idx) {
        if (this.shuttingDown) return
        while (this.waiters.length) {
            const waiter = this.waiters.shift()
            if (!waiter || waiter.settled) continue
            waiter.done(idx)
            return
        }
        this.idle.push(idx)
    }

    /**
     * 曲目图鉴
     * @param {any} e
     * @param {any} info
     */
    async alias(e, info) {
        return await this.common(e, 'atlas', {
            ...info,
            length: info.length ? info.length.replace(':', "'") + "''" : "-",
        })
    }


    /**
     * 
     * @param {any} e 
     * @param {any} data 
     * @returns 
     */
    async b19(e, data) {
        if (data?.theme === 'default') {
            return this.renderDefaultB30(data, {
                e,
                scale: Config.getUserCfg('config', 'renderScale') / 100,
            })
        }
        return await this.common(e, 'b19', data)
    }

    /**
     * 默认 B30 使用原生 Canvas，避免启动 Chromium。
     * @param {any} params
     * @param {any} cfg
     */
    async renderDefaultB30(params, cfg) {
        const id = this.tot++
        const rendererNum = await this.acquire(Config.getUserCfg('config', 'waitingTimeout'))
        if (rendererNum < 0) {
            this.pressureTimedOut += 1
            logger.error(`[Phi-Plugin][Canvas等待超时]`, id)
            return '等待超时，请稍后重试QAQ！'
        }

        this.rendering.add(id)
        this.pressureMaxActive = Math.max(this.pressureMaxActive, this.rendering.size)
        const startedAt = Date.now()
        try {
            const image = await renderDefaultB30Canvas(params, {
                scale: cfg.scale || 1,
                pluginName: Display_Plugin_Name,
                version: Version.ver,
                quality: 90,
            })
            this.pressureCompleted += 1
            logger.mark(`[图片生成][b19/canvas] ${(image.length / 1024).toFixed(2)}KB ${logger.green(`${Date.now() - startedAt}ms`)}`)
            return segment.image(image)
        } catch (err) {
            this.pressureFailed += 1
            logger.error(`[Phi-Plugin][Canvas渲染失败]`, id)
            logger.error(err)
            return '渲染失败QAQ！\n' + err
        } finally {
            this.rendering.delete(id)
            this.release(rendererNum)
        }
    }

    /**
     * 
     * @param {any} e 
     * @param {any} data 
     * @returns 
     */
    async arcgros_b19(e, data) {
        return await this.common(e, 'arcgrosB19', data)
    }

    /**
     * 
     * @param {any} e 
     * @param {any} data 
     * @returns 
     */
    async update(e, data) {
        return await this.common(e, 'update', data)
    }

    /**
     * 
     * @param {any} e 
     * @param {any} data 
     * @returns 
     */
    async tasks(e, data) {
        return await this.common(e, 'tasks', data)
    }

    /**
     * 个人信息
     * @param {any} e 
     * @param {any} data 
     * @param {1|2|number} picversion 版本
     */
    async user_info(e, data, picversion) {
        switch (picversion) {
            case 1: {
                return await this.render('userinfo/userinfo', {
                    ...data,
                }, {
                    e,
                    scale: Config.getUserCfg('config', 'renderScale') / 100
                })
            }
            case 2: {
                return await this.render('userinfo/userinfo-old', {
                    ...data,
                }, {
                    e,
                    scale: Config.getUserCfg('config', 'renderScale') / 100
                })
            }
            default: {
                return await this.render('userinfo/userinfo', {
                    ...data,
                }, {
                    e,
                    scale: Config.getUserCfg('config', 'renderScale') / 100
                })
            }
        }
    }

    /**
     * 
     * @param {any} e 
     * @param {any} data 
     * @returns 
     */
    async lvsco(e, data) {
        return await this.common(e, 'lvsco', data)
    }

    /**
     * 
     * @param {any} e 
     * @param {any} data 
     * @returns 
     */
    async list(e, data) {
        return await this.common(e, 'list', data)
    }

    /**
     * 单曲成绩
     * @param {any} e 
     * @param {any} data
     * @param {1|2} picversion 版本
     */
    async score(e, data, picversion) {

        switch (picversion) {
            case 1: {
                return await this.render('score/score', {
                    ...data,
                }, {
                    e,
                    scale: Config.getUserCfg('config', 'renderScale') / 100
                })
            }

            default: {
                return await this.render('score/scoreOld', {
                    ...data,
                }, {
                    e,
                    scale: Config.getUserCfg('config', 'renderScale') / 100
                })
            }
        }
    }

    /**
     * 
     * @param {any} e 
     * @param {any} data 
     * @returns 
     */
    async ill(e, data) {
        return await this.common(e, 'ill', data)
    }


    /**
     * 
     * @param {any} e 
     * @param {import('../../apps/guessGame/guessIll.js').guessIllData | import('../../apps/guessGame/guessTips.js').guessIllDataLite} data 
     * @returns 
     */
    async guess(e, data) {
        return await this.common(e, 'guess', data)
    }

    /**
     * 
     * @param {any} e 
     * @param {any} data 
     * @returns 
     */
    async rand(e, data) {
        return await this.common(e, 'rand', data)
    }

    /**
     * 
     * @param {any} e 
     * @param {any} data 
     * @returns 
     */
    async help(e, data) {
        return await this.common(e, 'help', data)
    }

    /** 主题市场目录页 */
    async market(/** @type {any} */ e, /** @type {any} */ data) {
        return await this.common(e, 'market', data)
    }

    /** 主题市场详情页 */
    async marketDetail(/** @type {any} */ e, /** @type {any} */ data) {
        return await this.common(e, 'market', data, 'detail')
    }

    /**
     * 
     * @param {any} e 
     * @param {any} data 
     * @returns 
     */
    async chap(e, data) {
        return await this.common(e, 'chap', data)
    }

    /**
     * 
     * @param {botEvent} e 
     * @param {{stats: import('../save/analyzeSaveHistory.js').AnalyzeSaveHistoryResult} & {background: string}} data 
     * @returns 
     */
    async analyzeSaveHistory(e, data) {
        return await this.common(e, 'analyzeSaveHistory', data)
    }

    /** 
     * @typedef {'atlas'|'task'|'b19'|'arcgrosB19'|'update'|'tasks'|'sign'|'lvsco'|'list'|'suggest'|
     * 'ill'|'chartInfo'|'guess'|'rand'|'help'|'chap'|'rankingList'|'clg'|'chartImg'|'jrrp'|'newSong'|'market'|
     * 'setting'|'analyzeSaveHistory'|'historyB30'|'table'|'newnotice'|'difficultyHistory'
     * } picKind
     */

    /**
     * 
     * @param {*} e 
     * @param {picKind} kind 
     * @param {*} data
     * @param {string} [tplName] 模板名称，默认为kind
     * @returns 
     */
    async common(e, kind, data, tplName = kind) {
        return await this.render(`${kind}/${tplName}`, {
            ...data,
        }, {
            e,
            scale: Config.getUserCfg('config', 'renderScale') / 100,
        })
    }

    /**
     * 
     * @param {string} renderPath 
     * @param {any} params 
     * @param {any} cfg 
     * @returns 
     */
    async render(renderPath, params, cfg) {
        const id = this.tot++
        const waitingTimeout = Config.getUserCfg('config', 'waitingTimeout')

        /** 事件驱动地等待一个空闲渲染器，替代原本每 100ms 轮询一次的忙等 */
        const puppeteerNum = await this.acquire(waitingTimeout)
        if (puppeteerNum < 0) {
            this.pressureTimedOut += 1
            logger.error(`[Phi-Plugin][等待超时]`, id)
            logger.warn(`[Phi-Plugin][空闲渲染器]`, this.idle)
            logger.warn(`[Phi-Plugin][渲染中] `, [...this.rendering])
            logger.warn(`[Phi-Plugin][等待数量] `, this.waiters.length)
            return '等待超时，请稍后重试QAQ！'
        }

        this.rendering.add(id)
        this.pressureMaxActive = Math.max(this.pressureMaxActive, this.rendering.size)
        try {
            let [app, tpl] = renderPath.split('/')
            let layoutPath = pluginResources.replace(/\\/g, '/') + `/html/common/layout/`
            let resPath = pluginResources.replace(/\\/g, '/') + `/`

            Data.createDir(`data/html/${Plugin_Name}/${app}/${tpl}`, 'root')

            /** 主题解析：自定义模板仅作用于 B19，页面样式与公共主题信息由 themeInfo 注入布局。 */
            let tplFile = path.join(pluginResources, 'html', app, `${tpl}.art`).replace(/\\/g, '/')
            let themeInfo = null
            const themeId = params.theme
            if (themeId) {
                const t = themeManager.getRenderInfo(themeId, resPath, renderPath)
                if (t?.tplFile && renderPath === 'b19/b19') tplFile = t.tplFile
                if (t?.themeInfo) themeInfo = t.themeInfo
            }

            let data = {
                ...params,
                themeInfo,
                saveId: (params.saveId || params.save_id || tpl),
                tplFile,
                pluResPath: resPath,
                _res_path: resPath,
                _imgPath: imgPath + '/',
                _layout_path: layoutPath,
                defaultLayout: layoutPath + 'default.art',
                elemLayout: layoutPath + 'elem.art',
                pageGotoParams: {
                    timeout: Config.getUserCfg('config', 'timeout'),
                },
                sys: {
                    scale: `style="transform:scale(${cfg.scale || 1})"`,
                    copyright: `Created By ${platform.name}<span class="version">${Version.yunzai}</span> & phi-Plugin<span class="version">${Version.ver}</span>`
                },
                Version: { ...Version },
                _plugin: Display_Plugin_Name,
                Math,
                fCompute,
            }

            /** 返回图片信息 */
            const img = await this.puppeteer[puppeteerNum].screenshot(`${Plugin_Name}/${app}/${tpl}`, data)
            if (!img) throw new Error('截图返回为空')
            this.pressureCompleted += 1
            return segment.image(img)
        } catch (err) {
            this.pressureFailed += 1
            logger.error(`[Phi-Plugin][渲染失败]`, id)
            logger.error(err)
            logger.warn(`[Phi-Plugin][渲染器]`, puppeteerNum)
            logger.warn(`[Phi-Plugin][空闲渲染器]`, this.idle)
            logger.warn(`[Phi-Plugin][渲染中] `, [...this.rendering])
            logger.warn(`[Phi-Plugin][等待数量] `, this.waiters.length)
            return '渲染失败QAQ！\n' + err
        } finally {
            this.rendering.delete(id)
            this.release(puppeteerNum)
        }
    }

    /**
     * 取得当前绘图压力窗口，并从当前并发状态开始新的统计窗口。
     * 仅包含队列和计数，不包含用户、命令、模板或绘图内容。
     */
    takeRenderPressureSnapshot() {
        const endedAt = new Date().toISOString()
        const snapshot = {
            windowStartedAt: this.pressureWindowStartedAt,
            capacity: Math.max(1, this.puppeteer.length),
            active: this.rendering.size,
            queued: this.waiters.length,
            maxActive: Math.max(this.pressureMaxActive, this.rendering.size),
            maxQueued: Math.max(this.pressureMaxQueued, this.waiters.length),
            completed: this.pressureCompleted,
            failed: this.pressureFailed,
            timedOut: this.pressureTimedOut,
        }
        const history = this.pressureHistory.record(snapshot, endedAt)
        this.pressureWindowStartedAt = endedAt
        this.pressureCompleted = 0
        this.pressureFailed = 0
        this.pressureTimedOut = 0
        this.pressureMaxActive = this.rendering.size
        this.pressureMaxQueued = this.waiters.length
        return { ...snapshot, history }
    }

    async restart() {
        if (this.shuttingDown) return
        let num = Config.getUserCfg('config', 'renderNum')
        const tasks = []
        for (let i = 0; i < num; i++) {
            if (this.puppeteer[i]) tasks.push(this.puppeteer[i].restart(true))
        }
        await Promise.allSettled(tasks)
    }

    /** 停止接单、清空等待队列并关闭全部 Chromium 实例。 */
    async close() {
        if (this.closePromise) return this.closePromise
        this.shuttingDown = true
        this.idle = []
        while (this.waiters.length) this.waiters.shift()?.done(-1)
        this.closePromise = Promise.allSettled(this.puppeteer.map(renderer => renderer.shutdown()))
            .then(() => undefined)
        return this.closePromise
    }

    /** 进程 exit 阶段的同步兜底。 */
    forceClose() {
        this.shuttingDown = true
        this.idle = []
        for (const renderer of this.puppeteer) renderer.forceShutdown()
    }

}().init()
