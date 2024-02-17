import get from "../getdata.js"
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
     * chart: Chart
     * }} data 原始数据
     */
    constructor(data) {
        if(!data) {
            console.error(data)
            return {}
        }
        this.id = data.id //id
        this.song = data.song //曲目
        this.illustration = data.illustration //小型曲绘
        this.illustration_big = get.getill(data.song) //原版曲绘
        this.chapter = data.chapter //章节
        this.bpm = data.bpm //bpm
        this.composer = data.composer //作曲
        this.length = data.length //时长
        this.illustrator = data.illustrator //画师
        this.spinfo = data.spinfo //特殊信息
        this.chart = {}
        /**谱面详情 */
        for (let i in data.chart) {
            this.chart[i] = new Chart(data.chart[i])
        }
    }
}