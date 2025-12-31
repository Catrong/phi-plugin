import chalk from 'chalk';
import fs from 'node:fs';
import https from 'node:https';
import axios from 'axios';

// 这个加载是为了提前初始化信息
import getInfo from './model/getInfo.js'

import Version from './components/Version.js'
import Config from './components/Config.js';
import logger from './components/Logger.js';
import segment from './components/segment.js';
import { APIBASEURL } from './model/constNum.js';

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

const files = fs.readdirSync('./plugins/phi-plugin/apps').filter(file => file.endsWith('.js'))
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

if (Config.getUserCfg('config', 'autoOpenApi')) {
    logger.mark(chalk.yellow(`正在测试API链接...`))
    let url = `${APIBASEURL}/status`
    try {
        const agent = new https.Agent({ rejectUnauthorized: false })
        axios.get(url, { httpsAgent: agent }).then((res) => {

            // console.log(res)
            if (res.status != 200) {
                logger.error(res)
                logger.mark(chalk.red('API地址测试失败！已自动关闭API功能'))
                Config.modify('config', 'openPhiPluginApi', false)
            } else {
                res = res.data
                logger.mark(chalk.green(`API地址测试成功！${res.data.id} ${res.data.version}`))
                Config.modify('config', 'openPhiPluginApi', true)
            }
        })
    } catch (e) {
        // @ts-ignore
        logger.error(e.cause)
        logger.mark(chalk.red('API地址测试失败！已自动关闭API功能'))
        Config.modify('config', 'openPhiPluginApi', false)
    }
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
