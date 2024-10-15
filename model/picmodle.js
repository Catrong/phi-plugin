import Config from '../components/Config.js'
import common from '../../../lib/common/common.js'
import puppeteer from './puppeteer.js'


class picmodle {

    constructor() {
        /**待使用puppeteer */
        this.queue = []
        /**即将渲染id */
        this.torender = []
        /**渲染中 */
        this.rendering = []
        /**
         * puppeteer队列
         * @param {[puppeteer]} puppeteer
         */
        this.puppeteer = []
        this.tot = 0
    }

    async init() {
        let num = Config.getUserCfg('config', 'renderNum')
        for (let i = 0; i < num; i++) {
            this.puppeteer.push(new puppeteer(i))
            this.puppeteer[i].init(i)
            this.queue.push(i)
        }
    }

    /**曲目图鉴 */
    async picmodle(e, info) {
        return await this.common(e, 'atlas', {
            ...info,
            length: info.length.replace(':', "'") + "''",
        })
    }


    async b19(e, data) {
        return await this.common(e, 'b19', data)
    }

    async arcgros_b19(e, data) {
        return await this.common(e, 'arcgrosB19', data)
    }

    async update(e, data) {
        return await this.common(e, 'update', data)
    }

    async tasks(e, data) {
        return await this.common(e, 'tasks', data)
    }

    /**
     * 个人信息
     * @param {1|2} picversion 版本
     */
    async user_info(e, data, picversion) {
        switch (picversion) {
            case 1: {
                return await this.render('userinfo/userinfo', {
                    ...data,
                    waitUntil: 'networkidle0',
                }, {
                    e,
                    scale: Config.getUserCfg('config', 'renderScale') / 100
                })
            }
            case 2: {
                return await this.render('userinfo/userinfo-old', {
                    ...data,
                    waitUntil: 'networkidle0',
                }, {
                    e,
                    scale: Config.getUserCfg('config', 'renderScale') / 100
                })
            }
            default: {
                return await this.render('userinfo/userinfo', {
                    ...data,
                    waitUntil: 'networkidle0',
                }, {
                    e,
                    scale: Config.getUserCfg('config', 'renderScale') / 100
                })
            }
        }
    }

    async lvsco(e, data) {
        return await this.common(e, 'lvsco', data)
    }

    async list(e, data) {
        return await this.common(e, 'list', data)
    }

    /**
     * 单曲成绩
     * @param {1|2} picversion 版本
     */
    async score(e, data, picversion) {

        switch (picversion) {
            case 1: {
                return await this.render('score/scoreInfo', {
                    ...data,
                    waitUntil: 'networkidle0',
                }, {
                    e,
                    scale: Config.getUserCfg('config', 'renderScale') / 100
                })
            }

            default: {
                return await this.render('score/score', {
                    ...data,
                    waitUntil: 'networkidle0',
                }, {
                    e,
                    scale: Config.getUserCfg('config', 'renderScale') / 100
                })
            }
        }
    }

    async ill(e, data) {
        return await this.common(e, 'ill', data)
    }

    async guess(e, data) {
        return await this.common(e, 'guess', data)
    }

    async rand(e, data) {
        return await this.common(e, 'rand', data)
    }

    async help(e, data) {
        return await this.common(e, 'help', data)
    }

    async chap(e, data) {
        return await this.common(e, 'chap', data)
    }

    /**
     * 
     * @param {*} e 
     * @param {'task'|'b19'|'arcgrosB19'|'update'|'tasks'|'lvsco'|'list'|'ill'|'guess'|'rand'|'help'|'chap'|'rankingList'} kind 
     * @param {*} data
     * @returns 
     */
    async common(e, kind, data) {
        return await this.render(`${kind}/${kind}`, {
            ...data,
            waitUntil: 'networkidle0',

        }, {
            e,
            scale: Config.getUserCfg('config', 'renderScale') / 100,
        })
    }

    async render(path, params, cfg) {
        // return await puppeteer.render(path, params, cfg)

        let id = this.tot++
        this.torender.push(id)
        let ans = null
        let puppeteerNum
        for (let i = 0; i < Config.getUserCfg('config', 'waitingTimeout') / 100; i++) {
            if (this.torender[0] == id && this.queue.length != 0) {
                puppeteerNum = this.queue.shift()
                this.torender.shift()
                try {
                    this.rendering.push(id)
                    ans = await this.puppeteer[puppeteerNum].render(path, params, cfg)
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

}
let result = new picmodle()
result.init()
export default result