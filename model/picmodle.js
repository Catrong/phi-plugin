import puppeteer from './puppeteer.js'
import Config from '../components/Config.js'


class atlas {

    async atlas(e, info) {
        // 渲染数据
        let data = {
            ...info,
            length: info.length.replace(':', "'") + "''",
        }
        // 渲染图片
        return await puppeteer.render('atlas/atlas', {
            ...data,
            waitUntil: 'networkidle0'
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }


    async b19(e, data) {

        if (data.phi) {
            data.phi.size = fLenB(data.phi.song, 39, 19, 20, 30)
        }

        for (var i in data.b19_list) {

            data.b19_list[i].size = fLenB(data.b19_list[i].song, 39, 19, 20, 30)
        }

        return await puppeteer.render('b19/b19', {
            ...data,
            size: Config.getDefOrConfig('config', 'b19size') / 100,
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async update(e, data) {
        return await puppeteer.render('update/update', {
            ...data,
            size: Config.getDefOrConfig('config', 'b19size') / 100,
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async tasks(e, data) {
        return await puppeteer.render('tasks/tasks', {
            ...data,
            size: Config.getDefOrConfig('config', 'b19size') / 100,
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async user_info(e, data) {
        return await puppeteer.render('userinfo/userinfo', {
            ...data,
            size: Config.getDefOrConfig('config', 'b19size') / 100,
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async lvsco(e, data) {
        return await puppeteer.render('lvsco/lvsco', {
            ...data
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async score(e, data) {
        return await puppeteer.render('score/score', {
            ...data
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async ill(e, data) {
        return await puppeteer.render('ill/ill', {
            ...data,
            waitUntil: 'networkidle0'
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async guess(e, data) {
        return await puppeteer.render('guess/guess', {
            ...data,
            waitUntil: 'networkidle0'
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100
        })
    }

    async rand(e, data) {
        return await puppeteer.render('rand/rand', {
            ...data,
            waitUntil: 'networkidle0'
        }, {
            e,
            scale: Config.getDefOrConfig('config', 'renderScale') / 100,
        })
    }
}



export default new atlas()
