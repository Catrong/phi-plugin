import getInfo from "../getInfo.js"
import Chart from "./Chart.js"

export default class SongsInfo {
    /**
     * @param { } data 原始数据
     */
    constructor(data) {
        if (!data) {
            return {}
        }
        /** @type {idString} id */
        this.id = data.id
        /** @type {string} 曲目 */
        this.song = data.song
        /** @type {string} 小型曲绘 */
        this.illustration = getInfo.getill(data.song)
        /** @type {boolean} 是否不参与猜字母 */
        this.can_t_be_letter = data.can_t_be_letter || false
        /** @type {boolean} 是否不参与猜曲绘 */
        this.can_t_be_guessill = data.can_t_be_guessill || false
        /** @type {string} 章节 */
        this.chapter = data.chapter
        /** @type {string} bpm */
        this.bpm = data.bpm
        /** @type {string} 作曲 */
        this.composer = data.composer
        /** @type {string} 时长 */
        this.length = data.length
        /** @type {string} 画师 */
        this.illustrator = data.illustrator
        /** @type {string} 特殊信息 */
        this.spinfo = data.spinfo
        /**
         * 谱面详情
         * @type {{EZ: Chart,HD: Chart,IN: Chart,AT?: Chart,LEGACY?: Chart}} 
         */
        this.chart = data.chart
        /** @type {boolean} 是否是特殊谱面 */
        this.sp_vis = data.sp_vis
    }
}