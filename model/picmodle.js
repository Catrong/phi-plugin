import puppeteer from './puppeteer.js'
import Config from '../components/Config.js'
import common from '../../../lib/common/common.js'
import { Plugin_Path } from '../components/index.js'

const queue = []
const randering = []
var tot = 0

class atlas {

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

    async user_info(e, data) {
        return await this.render('userinfo/userinfo', {
            ...data,
            size: Config.getDefOrConfig('config', 'b19size') / 100,
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async lvsco(e, data) {
        return await this.render('lvsco/lvsco', {
            ...data
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async score(e, data) {
        return await this.render('score/score', {
            ...data
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
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

        const id = tot++
        queue.push(id)


        var cnt = 0
        while (randering.length >= Config.getDefOrConfig('config', 'maxRandering') || queue[0] != id) {
            await common.sleep(500)
            ++cnt
            if (cnt * 500 >= Config.getDefOrConfig('config', 'waitingTimeout')) {

                
                queue.splice(queue.indexOf(id), 1)
                logger.error(`[Phi-Plugin] 渲染等待超时 id ${id}`)
                logger.info(`[Phi-Plugin][等待渲染队列] ${queue}`)
                logger.info(`[Phi-Plugin][渲染队列] ${randering}`)
                return '等待超时，请重试QAQ！'
            }
        }

        queue.shift()
        randering.push(id)


        var result
        
        try {
            result = await puppeteer.render(path, params, cfg)
        } catch (err) {
            logger.error(err)
            logger.error(`[Phi-Plugin][渲染失败] id ${id}`)
            logger.info(`[Phi-Plugin][等待渲染队列] ${queue}`)
            logger.info(`[Phi-Plugin][渲染队列] ${randering}`)
        }

        randering.splice(randering.indexOf(id), 1)
        

        return result

    }
}


export default new atlas()
