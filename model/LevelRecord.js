import get from './getdata.js'
import Info from './Info.js'

class LevelRecord {
    /**
     * 
     * @param {Object} data 原始数据 附加id rank
     */
    constructor(data) {
        this.fc = data.fc;
        this.score = data.score;
        this.acc = data.acc;

        var info = new Info(get.idgetsong(data.id))

        this.song = info.song //曲名
        this.rank = data.rank //AT IN HD EZ
        this.difficulty = info['chart'][this.rank]['difficulty'] //难度
        this.rks = get.getrks(this.acc, this.difficulty) //等效rks
        this.rating = Rating(this.score, this.fc) //V S A 
        this.illustration = get.getill(this.song) //曲绘链接

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

export default LevelRecord