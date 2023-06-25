import puppeteer from './puppeteer.js'
import Config from '../components/Config.js'


class atlas {

    async atlas(e, info) {
        try {
            var config = Config.getConfig("config")
        } catch {
            var config = Config.getdefSet("config")
        }
        // 渲染数据
        let data = {
            ...info,
            /**曲名 */
            song: info.song,
            /**曲绘 */
            illustration: info.illustration_big,
            /**章节 */
            chapter: info.chapter,
            /**bpm */
            bpm: info.bpm,
            /**曲师 */
            composer: info.composer,
            /**时长 */
            length: info.length.replace(':', "'") + "''",
            /**画师 */
            illustrator: info.illustrator,
            /**谱面 */
            or: info.chart.or,
            SP: info.chart.SP,
            AT: info.chart.AT,
            IN: info.chart.IN,
            HD: info.chart.HD,
            EZ: info.chart.EZ,
            /**其他消息（备注） */
            othermsg: info.othermsg,
            /**预处理曲名字号 */
            fontsize: Math.min(555 / fLenB(info.song) * 2, 58)
        }
        // 渲染图片
        return await puppeteer.render('atlas/atlas', {
            ...data
        }, {
            e,
            scale: config.renderScale / 100
        })
    }


    async b19(e, data) {
        try {
            var config = Config.getConfig("config")
        } catch {
            var config = Config.getdefSet("config")
        }


        if (data.phi) {
            data.phi.size = fLenB(data.phi.song)
        }

        for (var i in data.b19_list) {

            data.b19_list[i].size = fLenB(data.b19_list[i].song)
        }

        return await puppeteer.render('b19/b19', {
            ...data
        }, {
            e,
            scale: config.renderScale / 100
        })
    }
}
//20 - 30
//39 - 19    
/**计算字符大小 */
function fLenB(character) {
    /**判断字符长度 */
    var count = 0;
    character = String(character)
    for (var i = 0; i < character.length; i++) {
        if ((character.charCodeAt(i) > 0 && character.charCodeAt(i) < 127)
            || (character.charCodeAt(i) > 65376 && character.charCodeAt(i) < 65440)) {
            count++;
        } else {
            count += 2;
        }
    }

    /**计算字符大小 */
    var max_num = 39
    var min_size = 19
    var min_num = 20
    var max_size = 30
    var single = (max_size - min_size) / (max_num - min_num)
    return Math.min(max_size, max_num * single - count * single + min_size)
}

export default new atlas()