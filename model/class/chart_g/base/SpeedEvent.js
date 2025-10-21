export default class SpeedEvent {
    constructor(data) {
        /**
         * 事件开始时刻
         * @type {T}
         */
        this.startTime = data.startTime

        /**
         * 事件结束时刻
         * @type {T}
         */
        this.endTime = data.endTime

        /**
         * 事件的速度
         * @type {number}
         */
        this.value = data.value
    }
}