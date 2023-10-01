import get from "../getdata.js"

class scoreHistory {
    create(acc, score, date) {
        return [acc, score, date]
    }

    extend(song, data) {
        return {
            song: song,
            acc: data[0],
            score: data[1],
            date: new Date(data[2]),
            illustration: get.getill(song)
        }
    }
}

export default new scoreHistory