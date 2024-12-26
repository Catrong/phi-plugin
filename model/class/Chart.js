export default class Chart {

    /**
     * @param {} data 
     */
    constructor(data) {
        this.id = data?.id
        this.rank = data?.rank
        this.charter = data.charter
        this.difficulty = Number(data.difficulty)
        this.tap = Number(data.tap)
        this.drag = Number(data.drag)
        this.hold = Number(data.hold)
        this.flicke = Number(data.flicke)
        this.combo = Number(data.combo)
    }
}