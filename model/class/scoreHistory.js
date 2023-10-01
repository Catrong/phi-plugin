import get from "../getdata.js"

class scoreHistory {
    create(acc, score, date, Rating) {
        return [acc, score, date, Rating]
    }

    extend(song, level, now, old) {
        return {
            song: song,
            rank: level,
            illustration: get.getill(song),
            Rating: now[3],
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

export default new scoreHistory