import get from "../getdata.js"

export default new class scoreHistory {

    /**
     * 
     * @param {number} acc 
     * @param {number} score 
     * @param {Date} date
     * @param {boolean} fc 
     * @returns []
     */
    create(acc, score, date, fc) {
        return [acc.toFixed(4), score, date, fc]
    }

    extend(songsid, level, now, old) {
        let song = get.idgetsong(songsid) || songsid
        now[0] = Number(now[0])
        now[1] = Number(now[1])
        if (old) {
            old[0] = Number(old[0])
            old[1] = Number(old[1])
        }
        if (get.ori_info[song]?.chart[level]?.difficulty) {
            /**有难度信息 */
            return {
                song: song,
                rank: level,
                illustration: get.getill(song),
                Rating: Rating(now[1], now[3]),
                rks_new: get.getrks(now[0], get.ori_info[song].chart[level].difficulty),
                rks_old: old ? get.getrks(old[0], get.ori_info[song].chart[level].difficulty) : undefined,
                acc_new: now[0],
                acc_old: old ? old[0] : undefined,
                score_new: now[1],
                score_old: old ? old[1] : undefined,
                date_new: new Date(now[2]),
                date_old: old ? new Date(old[2]) : undefined
            }
        } else {
            /**无难度信息 */
            return {
                song: song,
                rank: level,
                illustration: get.getill(song),
                Rating: Rating(now[1]),
                acc_new: now[0],
                acc_old: old ? old[0] : undefined,
                score_new: now[1],
                score_old: old ? old[1] : undefined,
                date_new: new Date(now[2]),
                date_old: old ? new Date(old[2]) : undefined
            }
        }
    }

    date(data) {
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