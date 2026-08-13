import fs from 'node:fs';
import https from 'node:https';
import axios from 'axios';

// 这个加载是为了提前初始化信息
import getInfo from './model/game/getInfo.js'

import Version from './components/Version.js'
import Config from './components/Config.js';
import logger from './components/Logger.js';
import { APIBASEURL } from './model/game/constNum.js';
import chalk from 'chalk';
import autoSeekApi from './model/api/autoSeekApi.js';
import userCredentialStore from './model/user/userCredentialStore.js';

await getInfo.init();


// const agent = new https.Agent({
//     rejectUnauthorized: Config.getUserCfg('config', 'rejectPhiPluginApi'), // 忽略证书错误
// });

//插件作者QQ号：1436375503
//曲绘资源来源于网络
//由于我没学过js，这个插件是一点一点照着其他大佬的插件抄的，如果有什么地方写的不对欢迎提出意见或做出修改
//如果有什么好的建议也欢迎提出
logger.mark(chalk.rgb(255, 255, 0)('-------φ^_^φ-------'))
logger.mark('正在载入phi插件...')

const appsDir = new URL('./apps/', import.meta.url)
const files = fs.readdirSync(appsDir).filter(file => file.endsWith('.js'))
let errvis = false
/**
 * @type {Promise<unknown>[]}
 */
let pend = []

files.forEach((file) => {
    pend.push(import(`./apps/${file}`))
})

let ret = await Promise.allSettled(pend)

/**
 * @type {Record<string, any>}
 */
let apps = {}
for (let i in files) {
    let name = files[i].replace('.js', '')

    if (ret[i].status != 'fulfilled') {
        console.error(files[i])
        throw new Error(ret[i].reason)
    }
    // @ts-ignore
    apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}

export { apps }

// 在后台异步清理旧版凭据缓存，避免阻塞插件加载
;(async () => {
    try {
        const deleted = await userCredentialStore.deleteLegacyCredentialCaches()
        if (deleted > 0) logger.info(`[phi-plugin] 已清理 ${deleted} 条旧版凭据缓存`)
    } catch (error) {
        logger.warn('[phi-plugin] 旧版 Bot 平台绑定缓存清理失败，将在下次启动重试', error)
    }
})()

if (Config.getUserCfg('config', 'openPhiPluginApi')) {
    // 先校验 API 协议版本，兼容后再由连接检测恢复或注册 Bot 身份。
    await autoSeekApi.testStatus();
}

if (!errvis) {
    logger.mark(chalk.rgb(178, 233, 250)('--------------------------------------'))
    logger.mark(chalk.rgb(0, 183, 240)(`|phi插件${Version.ver}载入完成~`))
    logger.mark(`|作者：@Cartong`)
    logger.mark(chalk.rgb(0, 183, 240)(`|仓库地址：`))
    logger.mark(`|https://github.com/Catrong/phi-plugin`)
    logger.mark((chalk.rgb(0, 183, 240)`|本项目云存档功能由 7aGiven/PhigrosLibrary 改写而来`))
    logger.mark(`|感谢文酱的帮助！`)
    logger.mark(chalk.rgb(178, 233, 250)('--------------------------------------'))
}
