export default class Note {
    constructor(data) {
        /** 1: tap,
         *  2: drag,
         *  3: hold,
         *  4: flick
         *  @type {1|2|3|4} */
        this.type = data.type;

        /**
         * 1 / 32 拍
         * @type {T}
         */
        this.time = data.time;

        /** 
         * X坐标
         * @type {X}
         */
        this.positionX = data.positionX;

        /**
         * 长条时间 1 / 32 拍
         * @type {T}
         */
        this.holdTime = data.holdTime;

        /**
         * 流速倍率
         * @type {number}
         */
        this.speed = data.speed;

        /**
         * 音符距离判定线中心的初始垂直位置
         * @type {number}
         */
        this.floorPosition = data.floorPosition;
    }
}