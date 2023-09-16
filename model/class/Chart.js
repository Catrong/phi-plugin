export default class Chart {

    /**
     * @param {{level:string, difficulty:string, combo:string, charter: string}} data 
     */
    constructor(data) {
        this.level = Number(data.level)
        this.difficulty = Number(data.difficulty)
        this.combo = Number(data.combo)
        this.charter = data.charter
    }
}