
import fs from 'fs'
import puppeteer from 'puppeteer'
import { Data, Version, Plugin_Name, Display_Plugin_Name, Config } from '../components/index.js'
import { segment } from 'oicq';
import { _path, pluginResources, imgPath } from './path.js';
import fCompute from './fCompute.js';




let consvis = false

export default class newPuppeteer {
    constructor(e) {
        this.devices = {
            QQTheme: {
                name: 'QQTheme',
                userAgent: 'Mozilla/5.0 (Linux; Android 12; M2012K11AC Build/SKQ1.220303.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/98.0.4758.102 MQQBrowser/6.2 TBS/046317 Mobile Safari/537.36 V1_AND_SQ_8.9.10_3296_YYB_D A_8091000 QQ/8.9.10.9145 NetType/WIFI WebP/0.3.0 Pixel/1080 StatusBarHeight/80 SimpleUISwitch/0 QQTheme/1000 InMagicWin/0 StudyMode/0 CurrentMode/0 CurrentFontScale/1.0 GlobalDensityScale/0.98181814 AppId/537135947',
                viewport: {
                    width: 375,
                    height: 667,
                    deviceScaleFactor: 2,
                    isMobile: true,
                    hasTouch: true,
                    isLandscape: false
                }
            },
            ...puppeteer.devices
        }
        this.num = e
        this.pet = {}
    }

    async init() {
        try {
            let tem = new (await import("../../../renderers/puppeteer/lib/puppeteer.js")).default({ puppeteerTimeout: Config.getDefOrConfig('config', 'timeout') });
            this.pet = tem;
            logger.mark("[Phi-Plugin]导入新版puppteer");
        } catch (err) {
            logger.error(`[Phi-Plugin]新版puppteer导入失败 ${err}`)
        }

        if (!this.pet) {
            try {
                let tem = (await import("../../../lib/puppeteer/puppeteer.js")).default;
                this.pet = tem;
                logger.mark("[Phi-Plugin]导入旧版puppteer，/repu将不可用");
            } catch (err) {
                logger.error(`[Phi-Plugin]导入puppeteer失败`);
                logger.error(err);
                this.pet = {};
            }
        }

    }



    /**
       * @description: 渲染HTML
       * @param {String} path 文件路径
       * @param {Object} params 参数
       * @param {Object} cfg
       */
    async render(path, params, cfg) {
        let { e } = cfg
        let [app, tpl] = path.split('/')
        let layoutPath = pluginResources + `/html/common/layout/`
        let resPath = pluginResources + `/`


        Data.createDir(`data/html/${Plugin_Name}/${app}/${tpl}`, 'root')
        let data = {
            ...params,
            _plugin: Display_Plugin_Name,
            saveId: params.saveId || params.save_id || tpl,
            tplFile: `./plugins/${Plugin_Name}/resources/html/${app}/${tpl}.html`,
            pluResPath: resPath,
            _res_path: resPath,
            _imgPath: imgPath + '/',
            _layout_path: layoutPath,
            defaultLayout: layoutPath + 'default.html',
            elemLayout: layoutPath + 'elem.html',
            pageGotoParams: {
                waitUntil: params.waitUntil || 'networkidle2',
                timeout: Config.getDefOrConfig('config', 'timeout'),
            },
            sys: {
                scale: `style=transform:scale(${cfg.scale || 1})`,
                copyright: `Created By Yunzai-Bot<span class="version">${Version.yunzai}</span> & phi-Plugin<span class="version">${Version.ver}</span>`
            },
            Version: Version,
            quality: Config.getDefOrConfig('config', 'randerQuality'),
            Math,
            fCompute,
        }

        if (process.argv.includes('web-debug')) {
            // debug下保存当前页面的渲染数据，方便模板编写与调试
            // 由于只用于调试，开发者只关注自己当时开发的文件即可，暂不考虑app及plugin的命名冲突
            let saveDir = _path + '/data/ViewData/'
            if (!fs.existsSync(saveDir)) {
                fs.mkdirSync(saveDir)
            }
            let file = saveDir + tpl + '.json'
            data._app = app
            fs.writeFileSync(file, JSON.stringify(data))
        }

        /**返回图片信息 */

        let base64 = await this.pet.screenshot(`${Plugin_Name}/${app}/${tpl}`, data)
        let ret = true
        return base64 ? segment.image(base64) : base64
        // if (base64) {
        //     return base64
        // }
        // return cfg.retMsgId ? ret : true
    }

    async restart() {
        await this.pet.restart()
    }

}
