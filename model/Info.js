import get from "./getdata.js"

class Info {
    /**
     * 
     * @param {Object} data 原始数据
     */
    constructor(data) {
        // console.info(data)
        this.song = data.song //曲目
        this.illustration = data.illustration //小型曲绘
        this.illustration_big = get.getill(data.song) //原版曲绘
        this.chapter = data.chapter //章节
        this.bpm = data.bpm //bpm
        this.composer = data.composer //作曲
        this.length = data.length //时长
        this.illustrator = data.illustrator //画师
        this.chart = data.chart //谱面详情
        this.spinfo = data.spinfo //特殊信息
    }
}

export default Info