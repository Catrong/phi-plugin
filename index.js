import fs from 'node:fs'
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
logger.mark('------φ^_^φ------')

const files = fs.readdirSync('./plugins/phi-plugin/apps').filter(file => file.endsWith('.js'))
let errvis = false
let ret = []

files.forEach((file) => {
    ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

//检查依赖
import { checkPackage } from './components/check.js'
let passed = await checkPackage()
if (!passed) {
    throw '缺少必要的依赖项'
}

let apps = {}
for (let i in files) {
    let name = files[i].replace('.js', '')

    if (ret[i].status != 'fulfilled') {
        logger.error(`[phi-plugin]载入插件错误：${logger.red(name)}`)
        logger.error(ret[i].reason)
        errvis = true
        continue
    }
    apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}

export { apps }

if (!errvis) {
    logger.mark(` phi插件载入成功~`)
    logger.mark(` 本项目云存档功能由 7aGiven/PhigrosLibrary 改写而来，感谢文酱的帮助！`)
}
