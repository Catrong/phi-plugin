import plugin from '../../../lib/plugins/plugin.js'
import os from 'os'
import puppeteer from './puppeteer.js'
import moment from 'moment'
import lodash from 'lodash'


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
            AT: {
                /**定级 */
                level: info.at_level,
                /**物量 */
                combo: info.at_combo,
                /**谱师 */
                charter: info.at_charter
            },
            IN: {
                level: info.in_level,
                combo: info.in_combo,
                charter: info.in_charter
            },
            HD: {
                level: info.hd_level,
                combo: info.hd_combo,
                charter: info.hd_charter
            },
            EZ: {
                level: info.ez_level,
                combo: info.ez_combo,
                charter: info.ez_charter
            }
        }
        // 渲染图片
        await puppeteer.render('atlas/atlas', {
          ...data
        }, {
          e,
          scale: 2.0
        })
        interval = false
    }
}


export default new atlas()