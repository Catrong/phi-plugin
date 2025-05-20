import chalk from 'chalk';
import fs from 'node:fs'
import getInfo from './model/getInfo.js'
import Version from './components/Version.js'
if (!global.segment) {
    try {
        global.segment = (await import("icqq")).segment
    } catch {
        global.segment = (await import("oicq")).segment
    }
}


//插件作者QQ号：1436375503
//曲绘资源来源于网络
//由于我没学过js，这个插件是一点一点照着其他大佬的插件抄的，如果有什么地方写的不对欢迎提出意见或做出修改
//如果有什么好的建议也欢迎提出
logger.mark(chalk.rgb(255, 255, 0)('-------φ^_^φ-------'))
logger.mark('正在载入phi插件...')

const files = fs.readdirSync('./plugins/phi-plugin/apps').filter(file => file.endsWith('.js'))
let errvis = false
let ret = []

files.forEach((file) => {
    ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
    let name = files[i].replace('.js', '')

    if (ret[i].status != 'fulfilled') {
        // console.error(ret[i])
        throw new Error(ret[i].reason)
    }
    apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}

export { apps }

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
