import fCompute from '../fCompute.js';
import getInfo from '../getInfo.js';
import { LevelNum } from '../constNum.js';


/**
 * @typedef {object} LevelRecordInfoWithoutInfo 曲目成绩信息
 * @property {boolean} fc 是否满分
 * @property {number} score 分数
 * @property {number} acc 准确率
 * @property {idString} id 曲目id
 * @property {allLevelKind} rank 难度
 * @property {ratingKind} Rating 评级
 * @property {number} rks 等效rks
 * @property {number} difficulty 难度
 */

/**
 * @typedef {object} LevelRecordInfoWithInfo 曲目成绩信息
 * @extends LevelRecordInfoWithoutInfo
 * @property {songString} song 曲名
 * @property {string} illustration 曲绘链接
 */

/**@type {LevelRecordInfoWithoutInfo | LevelRecordInfoWithInfo} */
export default class LevelRecordInfo {
    /**
     * @param {{fc:boolean | number, score:number, acc: number}} data 原始数据
     * @param {idString} id 曲目id
     * @param {number} rank 难度
     * @param {string} [ver] 版本号
     */
    constructor(data, id, rank, ver) {
        this.fc = Boolean(data.fc);
        this.score = data.score;
        this.acc = data.acc;
        /** @type {idString} */
        this.id = id;

        let info = getInfo.info(id, true)

        /** @type {allLevelKind} */
        this.rank = getInfo.allLevel[rank] //AT IN HD EZ LEGACY

        /** @type {ratingKind} */
        this.Rating = Rating(this.score, this.fc) //V S A 

        if (!info) {
            this.id = id;
            this.difficulty = 0;
            this.rks = 0;
            return
        }
        /** @type {songString} */
        this.song = info.song //曲名
        this.illustration = getInfo.getill(id) //曲绘链接

        if (!ver || this.rank == 'LEGACY') {
            //未指定版本或难度为LGC，使用当前版本信息
            const difficulty = info?.chart?.[this.rank]?.difficulty
            if (difficulty) {
                this.difficulty = difficulty //难度
                this.rks = fCompute.rks(this.acc, this.difficulty) //等效rks
            } else {
                this.difficulty = 0
                this.rks = 0
            }
        } else {
            //使用指定版本信息
            const difficulty = getInfo.historyDifficultyBySongId[id]?.[ver]?.[this.rank]
            if (difficulty) {
                this.difficulty = difficulty //难度
                this.rks = fCompute.rks(this.acc, this.difficulty) //等效rks
            } else {
                this.difficulty = 0
                this.rks = 0
            }
        }


    }
}

/**@typedef { "phi" | "FC" | "NEW" | "F" | "C" | "B" | "A" | "S" | "V" } ratingKind */

/**
 * 
 * @param {number} score 
 * @param {boolean| number} fc 
 * @returns {ratingKind} 评级
 */
function Rating(score, fc) {
    if (score >= 1000000)
        return 'phi'
    else if (fc)
        return 'FC'
    else if (!score)
        return 'NEW'
    else if (score < 700000)
        return 'F'
    else if (score < 820000)
        return 'C'
    else if (score < 880000)
        return 'B'
    else if (score < 920000)
        return 'A'
    else if (score < 960000)
        return 'S'
    else
        return 'V'
}
