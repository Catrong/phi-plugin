import JudgeLine from "./judgeLine.js"

export default class Chart {
    constructor(data) {
        this.formatVersion = data.formatVersion

        /**
         * 谱面偏移（单位：秒）
         * @type {number}
         */
        this.offset = data.offset

        /**
         * 判定线列表
         * @type {JudgeLine[]}
         */
        this.judgeLineList = data.judgeLineList.map((e) => new JudgeLine(e));
    }
}