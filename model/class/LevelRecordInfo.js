import get from '../getdata.js'

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

        let info = get.init_info(get.idgetsong(id), true)

        this.rank = get.Level[rank] //AT IN HD EZ LEGACY 
        this.song = info.song //曲名
        this.illustration = get.getill(this.song) //曲绘链接
        this.Rating = Rating(this.score, this.fc) //V S A 
        

        if (info.chart && info.chart[this.rank]?.difficulty) {
            this.difficulty = info.chart[this.rank]['difficulty'] //难度
            this.rks = get.getrks(this.acc, this.difficulty) //等效rks
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