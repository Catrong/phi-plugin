import puppeteer from './puppeteer.js'
import { Data, Version, Plugin_Name, Display_Plugin_Name, Config } from '../components/index.js'
import { _path, pluginResources, imgPath, tempPath } from './path.js'
import fCompute from './fCompute.js'
import fs from 'node:fs'
import logger from '../components/Logger.js'
import segment from '../components/segment.js'

/**@import {botEvent} from '../components/baseClass.js' */

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
    }

    async init() {
        /** 清理临时文件 */
        try {
            fs.rmSync(tempPath, { force: true, recursive: true })
        } catch (err) {
            logger.error(`[Phi-Plugin][清理临时文件失败]`)
            logger.error(err)
        }
        /** 初始化puppeteer实例 */
        let num = Config.getUserCfg('config', 'renderNum')
        for (let i = 0; i < num; i++) {
            this.puppeteer.push(new puppeteer({
                puppeteerTimeout: Config.getUserCfg('config', 'timeout')
            }, `${i}`))
            this.puppeteer[i].browserInit()
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
        })
        return p
    }

    /**
     * 归还渲染器：优先直接移交给等待队列中的下一个请求，否则放回空闲池
     * @param {number} idx
     */
    release(idx) {
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
        if(data.theme == 'dss2') {
            return await this.common(e, 'b19', data, 'dss2');
        }
        return await this.common(e, 'b19', data)
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
     * @param {import('../apps/guessGame/guessIll.js').guessIllData | import('../apps/guessGame/guessTips.js').guessIllDataLite} data 
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
     * @param {{stats: import('./analyzeSaveHistory.js').AnalyzeSaveHistoryResult} & {background: string}} data 
     * @returns 
     */
    async analyzeSaveHistory(e, data) {
        return await this.common(e, 'analyzeSaveHistory', data)
    }

    /** 
     * @typedef {'atlas'|'task'|'b19'|'arcgrosB19'|'update'|'tasks'|'sign'|'lvsco'|'list'|'suggest'|'ill'|'chartInfo'|'guess'|'rand'|'help'|'chap'|'rankingList'|'clg'|'chartImg'|'jrrp'|'newSong'|'setting'|'analyzeSaveHistory'|'historyB30'|'table'|'newnotice'} picKind
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
     * @param {string} path 
     * @param {any} params 
     * @param {any} cfg 
     * @returns 
     */
    async render(path, params, cfg) {
        const id = this.tot++
        const waitingTimeout = Config.getUserCfg('config', 'waitingTimeout')

        /** 事件驱动地等待一个空闲渲染器，替代原本每 100ms 轮询一次的忙等 */
        const puppeteerNum = await this.acquire(waitingTimeout)
        if (puppeteerNum < 0) {
            logger.error(`[Phi-Plugin][等待超时]`, id)
            logger.warn(`[Phi-Plugin][空闲渲染器]`, this.idle)
            logger.warn(`[Phi-Plugin][渲染中] `, [...this.rendering])
            logger.warn(`[Phi-Plugin][等待数量] `, this.waiters.length)
            return '等待超时，请稍后重试QAQ！'
        }

        this.rendering.add(id)
        try {
            let [app, tpl] = path.split('/')
            let layoutPath = pluginResources.replace(/\\/g, '/') + `/html/common/layout/`
            let resPath = pluginResources.replace(/\\/g, '/') + `/`

            Data.createDir(`data/html/${Plugin_Name}/${app}/${tpl}`, 'root')
            let data = {
                ...params,
                saveId: (params.saveId || params.save_id || tpl),
                tplFile: `./plugins/${Plugin_Name}/resources/html/${app}/${tpl}.art`,
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
                    copyright: `Created By Yunzai-Bot<span class="version">${Version.yunzai}</span> & phi-Plugin<span class="version">${Version.ver}</span>`
                },
                Version: { ...Version },
                _plugin: Display_Plugin_Name,
                Math,
                fCompute,
            }

            /** 返回图片信息 */
            const img = await this.puppeteer[puppeteerNum].screenshot(`${Plugin_Name}/${app}/${tpl}`, data)
            if (!img) throw new Error('截图返回为空')
            return segment.image(img)
        } catch (err) {
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

    async restart() {
        let num = Config.getUserCfg('config', 'renderNum')
        for (let i = 0; i < num; i++) {
            this.puppeteer[i].restart(true)
        }
    }

}().init()