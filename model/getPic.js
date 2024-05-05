import atlas from "./picmodle.js"
import info from "./getInfo.js"

export default new class pic {

    /**
     * 获取歌曲图鉴，曲名为原名
     * @param {any} e 消息
     * @param {string} name 曲名
     * @param {any} data 自定义数据
     * @returns 
     */
    GetSongsInfoAtlas(e, name, data = undefined) {

        data = data ? data : info.info(name)
        if (data) {
            data.illustration = info.getill(name)
            return atlas.atlas(e, data)
        } else {
            /**未找到曲目 */
            return `未找到${name}的相关曲目信息!QAQ`
        }
    }

    /**
     * 获取曲绘图鉴
     * @param {*} e 消息e
     * @param {string} name 原曲名称
     * @param { {illustration:string, illustrator:string} } data 自定义数据
     * @returns 
     */
    async GetSongsIllAtlas(e, name, data = undefined) {
        if (data) {
            return await atlas.ill(e, { illustration: data.illustration, illustrator: data.illustrator })
        } else {
            return await atlas.ill(e, { illustration: info.getill(name), illustrator: info.info(name).illustrator })
        }
    }

}()