import fCompute from "../game/fCompute.js"
import getInfo from "../game/getInfo.js"
import dateValue from "./dateVaule.js"


/**
 * @typedef {object} extendedScoreHistoryDetail
 * @property {idString|object} song 曲目id或曲目对象
 * @property {allLevelKind} rank 难度
 * @property {string} illustration 插画链接
 * @property {string} Rating 该成绩的Rating
 * @property {number} [rks_new] 新成绩的RKS
 * @property {number} [rks_old] 旧成绩的RKS
 * @property {number} acc_new 新成绩的准确率
 * @property {number} [acc_old] 旧成绩的准确率
 * @property {number} score_new 新成绩的分数
 * @property {number} [score_old] 旧成绩的分数
 * @property {Date} date_new 新成绩的日期
 * @property {Date} [date_old] 旧成绩的日期
 */
export default class ScoreHistory {

    /**
     * 生成成绩记录数组
     * @param {number} acc 
     * @param {number} score 
     * @param {Date} date
     * @param {boolean} fc 
     * @returns []
     */
    static create(acc, score, date, fc) {
        return [acc.toFixed(4), score, date, fc]
    }

    /**
     * 扩充信息
     * @param {idString} songId 曲目id
     * @param {allLevelKind} level 难度
     * @param {ScoreDetail} now 
     * @param {ScoreDetail} [old=undefined]
     * @param {'common'|'low'} [illustrationKind='common'] 展示曲绘清晰度
     * @returns {extendedScoreHistoryDetail} 扩展后的成绩信息
     */
    static extend(songId, level, now, old = undefined, illustrationKind = 'common') {
        let song = getInfo.idgetsong(songId) || songId
        let nowAcc = Number(now[0])
        let oldAcc = old ? Number(old[0]) : undefined
        const info = getInfo.info(songId, true)
        if (info?.chart[level]?.difficulty) {
            /**有难度信息 */
            return {
                song: song,
                rank: level,
                illustration: getInfo.getill(songId, illustrationKind, level),
                Rating: fCompute.rate(now[1], now[3]),
                rks_new: fCompute.rks(nowAcc, info.chart[level].difficulty),
                rks_old: oldAcc ? fCompute.rks(oldAcc, info.chart[level].difficulty) : undefined,
                acc_new: nowAcc,
                acc_old: old ? oldAcc : undefined,
                score_new: now[1],
                score_old: old ? old[1] : undefined,
                date_new: new Date(now[2]),
                date_old: old ? new Date(old[2]) : undefined
            }
        } else {
            /**无难度信息 */
            return {
                song: song,
                rank: level,
                illustration: getInfo.getill(songId, illustrationKind, level),
                Rating: fCompute.rate(now[1], now[3]),
                acc_new: nowAcc,
                acc_old: old ? oldAcc : undefined,
                score_new: now[1],
                score_old: old ? old[1] : undefined,
                date_new: new Date(now[2]),
                date_old: old ? new Date(old[2]) : undefined
            }
        }
    }

    /**
     * 展开信息
     * @param {ScoreDetail} data 历史成绩
     */
    static open(data) {
        return {
            acc: Number(data[0]),
            score: data[1],
            date: new Date(data[2]),
            fc: Boolean(data[3])
        }
    }

    /**
     * 获取该成绩记录的日期
     * @param {ScoreDetail} data 成绩记录
     * @returns {Date} 该成绩的日期
     */
    static date(data) {
        return new Date(data[2])
    }

    /**
     * 展开 v4 成绩历史（dateValue 实例或 dateValueJSON）为 ScoreDetail 数组 [acc, score, date, fc]
     * 输入来自已判定的 v4 历史，直接信任其结构
     * @param {any} levelData 单曲单难度的历史记录
     * @returns {ScoreDetail[]}
     */
    static toScoreDetails(levelData) {
        if (!levelData) return []
        if (Array.isArray(levelData.data)) {
            return /**@type {ScoreDetail[]} */(levelData.data.map(([date, detail]) => [
                detail[0], detail[1], date, Boolean(detail[2])
            ]))
        }
        return new dateValue().fromJson(levelData).map(([date, detail]) => [
            detail[0], detail[1], date, Boolean(detail[2])
        ])
    }
}