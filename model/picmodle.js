import common from '../../../lib/common/common.js'
import puppeteer from './puppeteer.js'
import { Data, Version, Plugin_Name, Display_Plugin_Name, Config } from '../components/index.js'
import { _path, pluginResources, imgPath, tempPath } from './path.js'
import fCompute from './fCompute.js'
import fs from 'node:fs'
import logger from '../components/Logger.js'
import segment from '../components/segment.js'

/**@import {botEvent} from '../components/baseClass.js' */

/**
 * @typedef {Object} guessIllData
 * @property {string} illustration 曲绘路径
 * @property {number} width 展示的宽度
 * @property {number} height 展示的高度
 * @property {number} x 展示的X位置
 * @property {number} y 展示的Y位置
 * @property {number} blur 模糊度
 * @property {number} style (0|1)是否全局视野
 */
export default await new class picmodle {

    constructor() {
        /**
         * 待使用puppeteer
         * @type {number[]}
         */
        this.queue = []
        /**
         * 即将渲染id
         * @type {number[]}
         */
        this.torender = []
        /**
         * 渲染中id
         * @type {number[]}
         */
        this.rendering = []
        /**
         * puppeteer队列
         * @type {puppeteer[]}
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
            this.queue.push(i)
        }
        return this;
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
     * @param {guessIllData} data 
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
     * @typedef {'atlas'|'task'|'b19'|'arcgrosB19'|'update'|'tasks'|'lvsco'|'list'|'ill'|'chartInfo'|'guess'|'rand'|'help'|'chap'|'rankingList'|'clg'|'chartImg'|'jrrp'|'newSong'|'setting'|'analyzeSaveHistory'|'historyB30'} picKind
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
        // return await puppeteer.render(path, params, cfg)

        let id = this.tot++
        this.torender.push(id)
        let ans = null
        let puppeteerNum
        for (let i = 0; i < Config.getUserCfg('config', 'waitingTimeout') / 100; i++) {
            if (this.torender[0] == id && this.queue.length != 0) {
                puppeteerNum = this.queue.shift() || 0
                this.torender.shift()
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

                    /**返回图片信息 */
                    this.rendering.push(id)
                    ans = segment.image(await this.puppeteer[puppeteerNum].screenshot(`${Plugin_Name}/${app}/${tpl}`, data))

                } catch (err) {
                    logger.error(`[Phi-Plugin][渲染失败]`, id)
                    logger.error(err)
                    logger.warn(`[Phi-Plugin][渲染器]`, puppeteerNum)
                    logger.warn(`[Phi-Plugin][空闲渲染器队列]`, this.queue)
                    logger.warn(`[Phi-Plugin][渲染队列] `, this.rendering)
                    logger.warn(`[Phi-Plugin][等待队列] `, this.torender)
                    ans = '渲染失败QAQ！\n' + err
                }
                this.rendering.splice(this.rendering.indexOf(id), 1)
                this.queue.push(puppeteerNum)
                break
            }
            await common.sleep(100)
        }

        if (!ans) {
            ans = '等待超时，请稍后重试QAQ！'
            logger.error(`[Phi-Plugin][等待超时]`, id)
            logger.warn(`[Phi-Plugin][空闲渲染器队列]`, this.queue)
            logger.warn(`[Phi-Plugin][渲染队列] `, this.rendering)
            logger.warn(`[Phi-Plugin][等待队列] `, this.torender)
            this.torender.splice(this.torender.indexOf(id), 1)
        }

        return ans

    }

    async restart() {
        let num = Config.getUserCfg('config', 'renderNum')
        for (let i = 0; i < num; i++) {
            this.puppeteer[i].restart(true)
        }
    }

}().init()