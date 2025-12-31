
export default class Chart {
    /**
     * @param {any} data 原始数据
     */
    constructor(data) {
        /** @type {idString} */
        this.id = data?.id

        /** @type {allLevelKind} */
        this.rank = data?.rank

        /** @type {string} */
        this.charter = data.charter

        /** @type {number} */
        this.difficulty = Number(data.difficulty)

        // /** @type {number | undefined} */
        // this.tap = Number(data.tap)

        // /** @type {number | undefined} */
        // this.hold = Number(data.hold)

        // /** @type {number | undefined} */
        // this.flick = Number(data.flick)

        // /** @type {number | undefined} */
        // this.combo = Number(data.combo)

        // /** @type {number | undefined} */
        // this.maxTime = Number(data.maxTime)

        // /** @type {[number,number,number,number,number][]} [tap,drag,hold,flick,tot] */
        // this.distribution = data.distribution

        if (data.tap) {

            this.tap = Number(data.tap)

            this.drag = Number(data.drag)

            this.hold = Number(data.hold)

            this.flick = Number(data.flick)

            this.combo = Number(data.combo)

            /** s */
            this.maxTime = Number(data.maxTime)

            /** @type {[number,number,number,number,number][]} [tap,drag,hold,flick,tot] */
            this.distribution = data.distribution
        }

    }
}