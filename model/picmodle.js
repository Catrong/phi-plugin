import puppeteer from './puppeteer.js'
import Config from '../components/Config.js'
import common from '../../../lib/common/common.js'
import { Plugin_Path } from '../components/index.js'


class atlas {

    constructor() {
        this.queue = []
        this.randering = []
        this.tot = 0
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
        if (data.nnum != 21) {
            /**锁质量 */
            return await this.render('b19/b19', {
                ...data,
                size: 0.5,
            }, {
                e,
                scale: 0.5
            })

        }
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

    async render(path, params, cfg) {
        // return await puppeteer.render(path, params, cfg)

        const id = this.tot++
        this.queue.push(id)


        let cnt = 0
        while (this.randering.length >= 1 || this.queue[0] != id) {
            await common.sleep(500)
            ++cnt
            if (cnt * 500 >= Config.getDefOrConfig('config', 'waitingTimeout')) {


                this.queue.splice(this.queue.indexOf(id), 1)
                logger.error(`[Phi-Plugin] 渲染等待超时 id ${id}`)
                logger.info(`[Phi-Plugin][等待渲染队列] ${this.queue}`)
                logger.info(`[Phi-Plugin][渲染队列] ${this.randering}`)
                return '等待超时，请重试QAQ！'
            }
        }

        this.queue.shift()
        this.randering.push(id)


        let result



        try {

            setTimeout(() => {
                puppeteer.restart()
                this.randering.splice(this.randering.indexOf(id), 1)
            }, Config.getDefOrConfig('config', 'timeout'));

            result = await puppeteer.render(path, params, cfg)


        } catch (err) {
            logger.error(err)
            logger.error(`[Phi-Plugin][渲染失败] id ${id}`)
            logger.info(`[Phi-Plugin][等待渲染队列] ${this.queue}`)
            logger.info(`[Phi-Plugin][渲染队列] ${this.randering}`)
        }

        this.randering.splice(this.randering.indexOf(id), 1)

        result = result || '渲染失败，请重试QAQ！'

        return result

    }

    async restart() {
        await puppeteer.restart(true)
    }

}


export default new atlas()
