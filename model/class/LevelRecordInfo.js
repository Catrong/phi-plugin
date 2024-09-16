import fCompute from '../fCompute.js';
import getInfo from '../getInfo.js';

export default class LevelRecordInfo {
    /**
     * @param {{fc:boolean, score:number, acc: number}} data 原始数据
     * @param {string} id 曲目id
     * @param {number} rank 难度
     */
    constructor(data, id, rank) {
        this.fc = data.fc;
        this.score = data.score;
        this.acc = data.acc;

        let info = getInfo.info(getInfo.idgetsong(id), true)

        if (!info) {
            return
        }

        this.rank = getInfo.Level[rank] //AT IN HD EZ LEGACY 
        this.song = info.song //曲名
        this.illustration = getInfo.getill(this.song) //曲绘链接
        this.Rating = Rating(this.score, this.fc) //V S A 


        if (info.chart && info.chart[this.rank]?.difficulty) {
            this.difficulty = info.chart[this.rank]['difficulty'] //难度
            this.rks = fCompute.rks(this.acc, this.difficulty) //等效rks
        } else {
            this.difficulty = 0
            this.rks = 0
        }


    }
}

function Rating(score, fc) {
    if (score >= 1000000)
        return 'phi'
    else if (fc)
        return 'FC'
    else if (!score) 
        return 'NEW'
    else if (score < 700000)
        return 'F'
    else if (score < 820000)
        return 'C'
    else if (score < 880000)
        return 'B'
    else if (score < 920000)
        return 'A'
    else if (score < 960000)
        return 'S'
    else
        return 'V'
}
