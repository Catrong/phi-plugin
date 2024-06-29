import getInfo from "../getInfo.js"
import Chart from "./Chart.js"

export default class SongsInfo {
    /**
     * @param {{
     * song:string,
     * illustration:string,
     * illustration_big:string,
     * chapter:string,
     * bpm:string,
     * composer:string,
     * length:string,
     * illustrator:string,
     * spinfo:string,
     * chart: Chart,
     * can_t_be_letter: boolean,
     * can_t_be_guessill: boolean,
     * }} data 原始数据
     */
    constructor(data) {
        if (!data) {
            return {}
        }
        /**id */
        this.id = data.id
        /**曲目 */
        this.song = data.song 
        /**小型曲绘 */
        this.illustration = data.illustration 
        /**原版曲绘 */
        this.illustration_big = getInfo.getill(data.song) 
        /**是否不参与猜字母 */
        this.can_t_be_letter = data.can_t_be_letter || false 
        /**是否不参与猜曲绘 */
        this.can_t_be_guessill = data.can_t_be_guessill || false 
        /**章节 */
        this.chapter = data.chapter 
        /**bpm */
        this.bpm = data.bpm 
        /**作曲 */
        this.composer = data.composer 
        /**时长 */
        this.length = data.length 
        /**画师 */
        this.illustrator = data.illustrator 
        /**特殊信息 */
        this.spinfo = data.spinfo 
        /**谱面详情 */
        this.chart = data.chart
    }
}