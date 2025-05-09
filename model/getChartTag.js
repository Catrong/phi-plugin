import getFile from "./getFile.js";
import path from 'path'
import { otherDataPath } from "./path.js";

const dataPath = path.join(otherDataPath, 'chartTagData.json')


export default new class getChartTag {

    /**
     * @typedef {Object} tagObject 评论对象
     * @property {string[]} agree userId
     * @property {string[]} disagree userId
     */

    constructor() {
        /**
         * 评论数据
         * @type {{[id:idString]: {[levelKind:string]: {[x: string]: tagObject}}}}}
         */
        this.data = getFile.FileReader(dataPath);
        if (!this.data) {
            this.data = {};
            getFile.SetFile(dataPath, this.data)
        }
    }

    /**
     * 获取对应曲目的所有tag
     * @param {idString} songId id
     * @param {levelKind} rank 难度
     * @param {boolean} all 是否返回value为负的标签
     */
    get(songId, rank, all = false) {
        let d = this.data?.[songId]?.[rank];
        if (!d) {
            return [];
        }
        let arr = [];
        let keys = Object.keys(d);
        for (let i = 0; i < keys.length; ++i) {
            let key = keys[i];
            let obj = d[key];
            if (!all && obj.agree.length - obj.disagree.length <= 0) continue
            arr.push({
                name: key,
                value: obj.agree.length - obj.disagree.length,
            });
        }
        console.info(keys)
        console.info(arr)

        return arr;
    }

    /**
     * 添加tag
     * @param {idString} id id
     * @param {string} tag tag
     * @param {levelKind} rank 难度
     * @param {boolean} agree 是否同意
     * @param {string} userId userId
     */
    add(id, tag, rank, agree, userId) {
        if (!this.data[id]) {
            this.data[id] = {};
        }
        if (!this.data[id][rank]) {
            this.data[id][rank] = {};
        }
        if (!this.data[id][rank][tag]) {
            this.data[id][rank][tag] = {
                agree: [],
                disagree: [],
            };
        }

        if (agree) {
            /**加入agree */
            if (!this.data[id][rank][tag].agree.includes(userId)) {
                this.data[id][rank][tag].agree.push(userId);
            }
            /**删除disagree */
            if (this.data[id][rank][tag].disagree.includes(userId)) {
                this.data[id][rank][tag].disagree.splice(
                    this.data[id][rank][tag].disagree.indexOf(userId),
                    1
                );
            }
        } else {
            /**加入disagree */
            if (!this.data[id][rank][tag].disagree.includes(userId)) {
                this.data[id][rank][tag].disagree.push(userId);
            }
            /**删除agree */
            if (this.data[id][rank][tag].agree.includes(userId)) {
                this.data[id][rank][tag].agree.splice(
                    this.data[id][rank][tag].agree.indexOf(userId),
                    1
                );
            }
        }
        return getFile.SetFile(dataPath, this.data)
    }

    /**
     * 取消tag
     * @param {idString} id id
     * @param {string} tag tag
     * @param {levelKind} rank 难度
     * @param {string} userId userId
     */
    cancel(id, tag, rank, userId) {
        if (!this.data[id]) {
            this.data[id] = {};
        }
        if (!this.data[id][rank][tag]) {
            this.data[id][rank][tag] = {
                agree: [],
                disagree: [],
            };
        }
        /**删除agree */
        if (this.data[id][rank][tag].agree.includes(userId)) {
            this.data[id][rank][tag].agree.splice(
                this.data[id][rank][tag].agree.indexOf(userId),
                1
            );
        }
        /**删除disagree */
        if (this.data[id][rank][tag].disagree.includes(userId)) {
            this.data[id][rank][tag].disagree.splice(
                this.data[id][rank][tag].disagree.indexOf(userId),
                1
            );
        }
        if(!this.data[id][rank][tag].agree.length && !this.data[id][rank][tag].disagree.length) {
            delete this.data[id][rank][tag]
        }
        return getFile.SetFile(dataPath, this.data)
    }
}()