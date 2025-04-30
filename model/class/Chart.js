
export default class Chart {

    constructor(data) {
        /** @type {idString} */
        this.id = data?.id

        /** @type {allLevelKind} */
        this.rank = data?.rank

        /** @type {string} */
        this.charter = data.charter

        /** @type {number} */
        this.difficulty = Number(data.difficulty)

        /** @type {number} */
        this.tap = Number(data.tap)

        /** @type {number} */
        this.drag = Number(data.drag)

        /** @type {number} */
        this.hold = Number(data.hold)

        /** @type {number} */
        this.flick = Number(data.flick)

        /** @type {number} */
        this.combo = Number(data.combo)
    }
}