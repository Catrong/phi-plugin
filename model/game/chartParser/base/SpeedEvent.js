export default class SpeedEvent {
    /**
     * 
     * @param {any} data 
     */
    constructor(data) {
        /**
         * 事件开始时刻
         * @type {chartTick}
         */
        this.startTime = data.startTime

        /**
         * 事件结束时刻
         * @type {chartTick}
         */
        this.endTime = data.endTime

        /**
         * 事件的速度
         * @type {number}
         */
        this.value = data.value
    }
}