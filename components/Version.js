
import fs from 'fs'
import { pluginRoot } from '../model/path.js'
import logger from './Logger.js'
import fileWatcherRegistry from './FileWatcherRegistry.js'
import platform from './platform/index.js'
const README_path = `${pluginRoot}/README.md`
const yunzai_ver = `v${platform.getPackageVersion()}`

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

const versionWatcher = fileWatcherRegistry.watch('version:readme', README_path, () => {
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

Object.defineProperty(Version, 'close', {
    value: () => versionWatcher.close(),
    enumerable: false,
})

export default Version
