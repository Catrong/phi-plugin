/*
 * @Author: Temmie0125 1179755948@qq.com
 * @Date: 2025-11-29 00:47:13
 * @LastEditors: Temmie0125 1179755948@qq.com
 * @LastEditTime: 2026-03-10 16:49:38
 * @FilePath: \实验与作业e:\bot\Yunzai\plugins\phi-plugin\model\class\SongsInfo.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import getInfo from "../getInfo.js"
import Chart from "./Chart.js"

export default class SongsInfo {
    /**
     * @param {any} data 原始数据
     */
    constructor(data) {
        if (!data) {
            //@ts-ignore
            return {}
        }
        /** @type {idString} id */
        this.id = data.id
        /** @type {songString} 曲目 */
        this.song = data.song
        /** @type {string} 曲绘 */
        this.illustration = getInfo.getill(data.id)
        /** @type {boolean} 是否不参与猜字母 */
        this.can_t_be_letter = data.can_t_be_letter || false
        /** @type {boolean} 是否不参与猜曲绘 */
        this.can_t_be_guessill = data.can_t_be_guessill || false
        /** @type {string} 章节 */
        this.chapter = data.chapter
        /** @type {string} bpm */
        this.bpm = data.bpm
        /** @type {string} 作曲 */
        this.composer = data.composer
        /** @type {string} 时长 */
        this.length = data.length
        /** @type {string} 画师 */
        this.illustrator = data.illustrator
        /** @type {string} 特殊信息 */
        this.spinfo = data.spinfo
        /** @type {boolean} 独占曲标记 */
        this.isOriginal = data.isOriginal
        /**
         * 谱面详情
         * @type {Partial<Record<allLevelKind, Chart>>} 
         */
        this.chart = data.chart
        /** @type {boolean} 是否是特殊谱面 */
        this.sp_vis = data.sp_vis
    }
}