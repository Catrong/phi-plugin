export class JudgeLineEvent {
    /**
     * 
     * @param {any} data 
     */
    constructor(data) {
        /**
         * 事件开始时刻
         * @type {chartTick}
         */
        this.startTime = data.startTime;

        /**
         * 事件结束时刻
         * @type {chartTick}
         */
        this.endTime = data.endTime;
    }
}

export class judgeLineMoveEvent extends JudgeLineEvent {
    /**
     * 
     * @param {any} data 
     */
    constructor(data) {
        super(data);

        /**
         * 事件开始时刻的水平位置 0-1W
         * @type {number}
         */
        this.start = data.start;

        /**
         * 事件结束时刻的水平位置 0-1W
         * @type {number}
         */
        this.end = data.end;

        /**
         * 事件开始时刻的垂直位置 0-1H
         * @type {number}
         */
        this.start2 = data.start2;

        /**
         * 事件结束时刻的垂直位置 0-1H
         * @type {number}
         */
        this.end2 = data.end2;
    }
}

export class judgeLineRotateEvent extends JudgeLineEvent {
    /**
     * 
     * @param {any} data 
     */
    constructor(data) {
        super(data);

        /** @typedef {number} Rotate 值表示逆时针旋转的角度（单位：度） */

        /**
         * 事件开始时刻的旋转角度
         * @type {Rotate}
         */
        this.start = data.start;

        /**
         * 事件结束时刻的旋转角度
         * @type {Rotate}
         */
        this.end = data.end;
    }
}

export class judgeLineDisappearEvent extends JudgeLineEvent {
    /**
     * 
     * @param {any} data 
     */
    constructor(data) {
        super(data);

        /**
         * 事件开始时刻的不透明度 0-1
         * @type {number}
         */
        this.start = data.start;

        /**
         * 事件结束时刻的不透明度 0-1
         * @type {number}
         */
        this.end = data.end;
    }
}