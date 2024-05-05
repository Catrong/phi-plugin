export default class saveHistory {

    /**
     * 
     * @param {{
     * data:[{date:Date,value:[number,number,number,number,number]}],
     * rks:[{date:Date,value:number}],
     * scoreHistory:{song:{dif:[[number,number,Date,boolean]]}}
     * }
     * } data 
     */
    constructor(data) {
        this.data = data.data || {}
        this.rks = data.rks || {}
        this.scoreHistory = data.scoreHistory || {}
    }

    /**
     * 合并记录
     * @param {saveHistory} data 另一个存档
     */
    add(data) {
        merge(this.data, data.data)
        merge(this.rks, data.rks)
        for (let song in data.scoreHistory) {
            if (!this.scoreHistory[song]) this.scoreHistory[song] = {}
            for (let dif in data.scoreHistory[song]) {
                if (this.scoreHistory[song] && this.scoreHistory[song][dif]) {
                    merge(this.scoreHistory[song][dif], data.scoreHistory[song][dif])
                } else {
                    this.scoreHistory[song][dif] = data.scoreHistory[song][dif]
                }
            }
        }
    }
}

/**
 * 数组合并并按照 date 排序去重
 * @param {Array} a 
 * @param {Array} b 
 */
function merge(m, n) {
    m = m.concat(n)
    m.sort((a, b) => {
        return a.date - b.date
    })
    for (let i = 1; i <= m.length; ++i) {
        if (m[i].date == m[i - 1].date) {
            m.splice(i, 1)
        }
    }
}
