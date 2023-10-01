import get from "../getdata.js"

export default new class scoreHistory {

    /**
     * 
     * @param {number} acc 
     * @param {number} score 
     * @param {Date} date 
     * @returns []
     */
    create(acc, score, date) {
        return [acc.toFixed(4), score, date]
    }

    extend(song, level, now, old) {
        return {
            song: song,
            rank: level,
            illustration: get.getill(song),
            Rating: Rating(now[1]),
            rks_new: get.getrks(now[0], get.info(song).chart[level].difficulty),
            rks_old: old ? get.getrks(old[0], get.info(song).chart[level].difficulty) : undefined,
            acc_new: now[0],
            acc_old: old ? old[0] : undefined,
            score_new: now[1],
            score_old: old ? old[1] : undefined
        }
    }

    date(data) {
        console.info(data[2])
        return new Date(data[2])
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