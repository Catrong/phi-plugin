import Note from "./base/Note.js";
import SpeedEvent from "./base/SpeedEvent.js";
import { judgeLineDisappearEvent, judgeLineMoveEvent, judgeLineRotateEvent } from "./base/JudgeLineEvent.js";

export default class JudgeLine {
    /**
     * 
     * @param {any} data 
     */
    constructor(data) {
        /** @type {number} BPM */
        this.bpm = data.bpm;

        /**
         * 判定线上方的音符
         * @type {Note[]}
         */
        this.notesAbove = data.notesAbove.map(/** @param {any} e */(e) => new Note(e));

        /**
         * 判定线下方的音符
         * @type {Note[]}
         */
        this.notesBelow = data.notesBelow.map(/** @param {any} e */(e) => new Note(e));

        /** @type {SpeedEvent[]} 速度事件 */
        this.speedEvents = data.speedEvents.map(/** @param {any} e */(e) => new SpeedEvent(e));

        /** @type {judgeLineMoveEvent[]} 移动事件 */
        this.judgeLineMoveEvents = data.judgeLineMoveEvents.map(/** @param {any} e */(e) => new judgeLineMoveEvent(e));

        /** @type {judgeLineRotateEvent[]} 角度事件 */
        this.judgeLineRotateEvents = data.judgeLineRotateEvents.map(/** @param {any} e */(e) => new judgeLineRotateEvent(e));

        /** @type {judgeLineDisappearEvent[]} 透明度事件 */
        this.judgeLineDisappearEvents = data.judgeLineDisappearEvents.map(/** @param {any} e */(e) => new judgeLineDisappearEvent(e));
    }
}