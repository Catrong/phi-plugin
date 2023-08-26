
import fs from 'fs'
import puppeteer from 'puppeteer'
import pet from '../../../lib/puppeteer/puppeteer.js'
import { Data, Version, Plugin_Name, Config } from '../components/index.js'

const _path = process.cwd()
let consvis = false

export default new class newPuppeteer {
    constructor() {
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
    }


    /**
       * @description: 渲染HTML
       * @param {String} path 文件路径
       * @param {Object} params 参数
       * @param {Object} cfg
       */
    async render(path, params, cfg) {
        let { e } = cfg
        if (e.runtime) {
            let layoutPath = process.cwd() + `/plugins/${Plugin_Name}/resources/common/layout/`
            let resPath = `../../../../../plugins/${Plugin_Name}/resources/`
            return e.runtime.render(`${Plugin_Name}/${app}/${tpl}`, path, params, {
                ...cfg,
                beforeRender ({ data }) {
                    return {
                        ...params,
                        Version: Version,
                        _res_path: resPath,
                        _layout_path: layoutPath,
                        defaultLayout: layoutPath + 'default.html',
                        elemLayout: layoutPath + 'elem.html',
                        sys: {
                            scale: `style=transform:scale(${cfg.scale || 1})`,
                            copyright: `Created By Yunzai-Bot<span class="version">${Version.yunzai}</span> & Phi-Plugin<span class="version">${Version.ver}</span>`,
                            createdby: `Created By Phi-Plugin`,
                        },
                        pageGotoParams: {
                            timeout: 10000,
                            waitUntil: 'networkidle0'
                        },
                        quality: Config.getDefOrConfig('config','randerQuality')
                    }
                }
            })
        } else {
            if (!consvis) {
                console.log('未找到e.runtime，请升级至最新版Yunzai，自动选用puppteer')
                consvis = true
            }
            let [app, tpl] = path.split('/')
            let layoutPath = process.cwd() + `/plugins/${Plugin_Name}/resources/common/layout/`
            let resPath = `../../../../../plugins/${Plugin_Name}/resources/`
            Data.createDir(`data/html/${Plugin_Name}/${app}/${tpl}`, 'root')
            let data = {
                ...params,
                _plugin: Plugin_Name,
                saveId: params.saveId || params.save_id || tpl,
                tplFile: `./plugins/${Plugin_Name}/resources/${app}/${tpl}.html`,
                pluResPath: resPath,
                _res_path: resPath,
                _layout_path: layoutPath,
                defaultLayout: layoutPath + 'default.html',
                elemLayout: layoutPath + 'elem.html',
                pageGotoParams: {
                    timeout: 10000,
                    waitUntil: 'networkidle0'
                },
                sys: {
                    scale: `style=transform:scale(${cfg.scale || 1})`,
                    copyright: `Created By Yunzai-Bot<span class="version">${Version.yunzai}</span> & phi-Plugin<span class="version">${Version.ver}</span>`
                },
                Version: Version,
                quality: Config.getDefOrConfig('config','randerQuality')
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
    
            let base64 = await pet.screenshot(`${Plugin_Name}/${app}/${tpl}`, data)
            let ret = true
            if (base64) {
                return base64
            }
            return cfg.retMsgId ? ret : true
        }
        
    }
}()
