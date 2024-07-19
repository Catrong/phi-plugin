import Config from '../components/Config.js'
import common from '../../../lib/common/common.js'
import puppeteer from './puppeteer.js'


class atlas {

    constructor() {
        /**待使用puppeteer */
        this.queue = []
        /**即将渲染id */
        this.torender = 0
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
        let num = Config.getDefOrConfig('config', 'renderNum')
        for (let i = 0; i < num; i++) {
            this.puppeteer.push(new puppeteer(i))
            this.puppeteer[i].init()
            this.queue.push(i)
        }
    }

    async atlas(e, info) {
        // 渲染数据
        let data = {
            ...info,
            length: info.length.replace(':', "'") + "''",
        }
        // 渲染图片
        return await this.render('atlas/atlas', {
            ...data,
            waitUntil: 'networkidle0'
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }


    async b19(e, data) {
        return await this.render('b19/b19', {
            ...data,
            size: Config.getDefOrConfig('config', 'b19size') / 100,
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async update(e, data) {
        return await this.render('update/update', {
            ...data,
            size: Config.getDefOrConfig('config', 'b19size') / 100,
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async tasks(e, data) {
        return await this.render('tasks/tasks', {
            ...data,
            size: Config.getDefOrConfig('config', 'b19size') / 100,
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async user_info(e, data, kind) {
        switch (kind) {
            case 2:
                return await this.render('userinfo/userinfo-old', {
                    ...data,
                    size: Config.getDefOrConfig('config', 'b19size') / 100,
                }, {
                    e,
                    scale: Config.getDefOrConfig('config', 'renderScale') / 100
                })
            default:
                return await this.render('userinfo/userinfo', {
                    ...data,
                    size: Config.getDefOrConfig('config', 'b19size') / 100,
                }, {
                    e,
                    scale: Config.getDefOrConfig('config', 'renderScale') / 100
                })
        }
    }

    async lvsco(e, data) {
        return await this.render('lvsco/lvsco', {
            ...data
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async list(e, data) {
        return await this.render('list/list', {
            ...data
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
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
                    size: Config.getDefOrConfig('config', 'b19size') / 100,
                }, {
                    e,
                    scale: Config.getDefOrConfig('config', 'renderScale') / 100
                })
            }

            default: {
                return await this.render('score/score', {
                    ...data
                }, {
                    e,
                    scale: Config.getDefOrConfig('config', 'renderScale') / 100
                })
            }
        }
    }

    async ill(e, data) {
        return await this.render('ill/ill', {
            ...data,
            waitUntil: 'networkidle0'
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async guess(e, data) {
        return await this.render('guess/guess', {
            ...data,
            waitUntil: 'networkidle0'
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async rand(e, data) {
        return await this.render('rand/rand', {
            ...data,
            waitUntil: 'networkidle0'
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100,
        })
    }

    async help(e, data) {
        return await this.render('help/help', {
            ...data,
            waitUntil: 'networkidle0'
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100,
        })
    }

    /**
     * 
     * @param {*} e 
     * @param {'task'|'b19'|'update'|'lvsco'|'list'|'ill'|'guess'|'rand'|'help'|'chap'} kind 
     * @param {*} data
     * @returns 
     */
    async common(e, kind, data) {
        return await this.render(`${kind}/${kind}`, {
            ...data,
            waitUntil: 'networkidle0'
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100,
        })
    }

    async render(path, params, cfg) {
        // return await puppeteer.render(path, params, cfg)

        let id = this.tot++
        let ans = null
        for (let i = 0; i < Config.getDefOrConfig('config', 'waitingTimeout') / 100; i++) {
            if (this.torender == id && this.queue.length != 0) {
                let puppeteerNum = this.queue.shift()
                // console.info(this.torender, id, puppeteerNum, this.queue)
                ++this.torender
                try {
                    setTimeout(() => {
                        if (this.rendering.indexOf(id) == -1) return
                        this.puppeteer[puppeteerNum].restart()
                    }, Config.getDefOrConfig('config', 'timeout'));
                    this.rendering.push(id)
                    ans = await this.puppeteer[puppeteerNum].render(path, params, cfg)
                    this.rendering.splice(this.rendering.indexOf(id), 1)
                    this.queue.push(puppeteerNum)

                } catch (err) {
                    logger.error(`[Phi-Plugin][渲染失败]`, id)
                    logger.error(err)
                    logger.warn(`[Phi-Plugin][渲染器]`, puppeteerNum)
                    logger.warn(`[Phi-Plugin][空闲渲染器队列]`, this.queue)
                    logger.warn(`[Phi-Plugin][渲染队列] `, this.rendering)
                    logger.warn(`[Phi-Plugin][等待队列] `, this.tot - 1)
                    ans = '渲染失败QAQ！\n' + err
                }
                break
            }
            await common.sleep(100)
        }

        if (!ans) ans = '等待超时，请稍后重试QAQ！'

        return ans

    }

    async restart() {
        await puppeteer.restart(true)
    }

}
let result = new atlas()
result.init()
export default result