import picmodle from "./picmodle.js"
import getInfo from "./getInfo.js"
import { imgPath } from "./path.js"
import segment from "../components/segment.js"
import logger from "../components/Logger.js"

/**@import {botEvent} from "../components/baseClass.js" */

export default new class pic {

    /**
     * 获取歌曲图鉴，曲名为原名
     * @param {botEvent} e 消息
     * @param {idString} id 曲名
     * @param {any} data 自定义数据
     * @returns 
     */
    async GetSongsInfoAtlas(e, id, data = undefined) {
        data = data || getInfo.info(id)
        if (data) {
            data.illustration = getInfo.getill(id)
            return await picmodle.alias(e, data)
        } else {
            /**未找到曲目 */
            return `未找到${id}的相关曲目信息!QAQ`
        }
    }

    /**
     * 获取曲绘图鉴
     * @param {botEvent} e 消息e
     * @param {idString} id 原曲名称
     * @param { {illustration:string, illustrator:string} } [data] 自定义数据
     * @returns 
     */
    async GetSongsIllAtlas(e, id, data = undefined) {
        if (data) {
            return await picmodle.ill(e, { illustration: data.illustration, illustrator: data.illustrator })
        } else {
            return await picmodle.ill(e, { illustration: getInfo.getill(id), illustrator: getInfo.info(id)?.illustrator })
        }
    }

    /**
     * 
     * @param {botEvent} e 
     * @param {*} data 
     * @returns 
     */
    async GetChap(e, data) {
        return await picmodle.chap(e, data)
    }

    /**
     * 获取本地图片，文件格式默认png
     * @param {string} img 文件名
     * @param {string} style 文件格式，默认为png
     */
    getimg(img, style = 'png') {
        // name = 'phi'
        let url = `${imgPath}/${img}.${style}`
        if (url) {
            return segment.image(url)
        }
        logger.info('未找到 ' + `${img}.${style}`)
        return false
    }

    /**
     * 获取曲绘，返回地址，原名
     * @param {idString} id 原名
     * @param {'common'|'blur'|'low'} [kind='common'] 清晰度
     * @return {string} 网址或文件地址
     */
    getIll(id, kind = 'common') {
        return segment.image(getInfo.getill(id, kind))
    }

}()