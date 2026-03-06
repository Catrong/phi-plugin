
import fs from 'fs'
import cfg from '../../../lib/config/config.js'
import { pluginRoot } from '../model/path.js'
import logger from './Logger.js'
import chokidar from 'chokidar'
const README_path = `${pluginRoot}/README.md`
const yunzai_ver = `v${cfg.package.version}`

let currentVersion = ''
let phigrosVer = ''
let phigrosVerNum = 0

try {
    if (fs.existsSync(README_path)) {
        const logs = fs.readFileSync(README_path, 'utf8')
        currentVersion = 'v' + (/插件版本\-([0-9\.]+)/.exec(logs)?.[1] ?? '')
        phigrosVer = /Phigros\-([0-9\.]+)/.exec(logs)?.[1] ?? ''
        phigrosVerNum = Number(/PhigrosVer\-([0-9]+)/.exec(logs)?.[1] ?? 0)
    }
} catch (e) {
    logger.error(e)
    // do nth
}

let Version = {
    ver: currentVersion,
    phigros: phigrosVer,
    phigrosVerNum: phigrosVerNum,
    yunzai: yunzai_ver,
};

chokidar.watch(README_path).on('change', () => {
    try {
        const logs = fs.readFileSync(README_path, 'utf8')
        currentVersion = 'v' + (/插件版本\-([0-9\.]+)/.exec(logs)?.[1] ?? '')
        phigrosVer = /Phigros\-([0-9\.]+)/.exec(logs)?.[1] ?? ''
        phigrosVerNum = Number(/PhigrosVer\-([0-9]+)/.exec(logs)?.[1] ?? 0)
        Version.ver = currentVersion
        Version.phigros = phigrosVer
        Version.phigrosVerNum = phigrosVerNum
    } catch (e) {
        logger.error(e)
    }
})

export default Version
