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
      fontsize: info.song.length > 19 ? 24 : Math.min(94.4 - info.song.length * 2.6, 58)
    }
    // 渲染图片
    return await puppeteer.render('atlas/atlas', {
      ...data
    }, {
      e,
      scale: 2.0
    })
  }


  async b19(e, data) {
    return await puppeteer.render('b19/b19', {
      ...data
    }, {
      e,
      scale: 2.0
    })
  }
}


export default new atlas()