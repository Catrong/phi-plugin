import puppeteer from './puppeteer.js'


let interval = false
class atlas {

    async atlas(e, info) {
        // 渲染数据
        let data = {
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
            length: info.length,
            /**画师 */
            illustrator: info.illustrator,
            /**谱面 */
            SP: info.chart.SP,
            AT: info.chart.AT,
            IN: info.chart.IN,
            HD: info.chart.HD,
            EZ: info.chart.EZ
        }
        // 渲染图片
        return await puppeteer.render('atlas/atlas', {
          ...data
        }, {
          e,
          scale: 2.0
        })
    }
}


export default new atlas()