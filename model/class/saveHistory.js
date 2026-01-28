import { allLevel, LevelNum, MAX_DIFFICULTY } from "../constNum.js"
import Save from "./Save.js"
import fCompute from "../fCompute.js";
import LevelRecordInfo from "./LevelRecordInfo.js";

/**
 * @template T
 * @typedef {object} formatedHistoryBaseObject<T>
 * @property {Date} date - 日期
 * @property {T} value - 值
 */
export default class saveHistory {

    /**
     * 
     * @param { (saveHistoryObject & {version?: number}) } data 
     */
    constructor(data) {

        const ids = fCompute.objectKeys(data?.scoreHistory || {})

        for (const id of ids) {
            const record = data?.scoreHistory?.[id];
            if (!record) continue;
            for (const level of allLevel) {
                if (!record[level]) continue;
                record[level].forEach(item => {
                    //@ts-ignore
                    item[2] = new Date(item[2]);
                })
            }
        }

        /**
         * @type {{[id:idString]: Partial<Record<allLevelKind, ScoreDetail[]>>}}
         * @property {Array<[number, number, Date, boolean]>} [acc, score, date, fc] acc为4位小数，score为整数，date为日期，fc为boolean
         */
        //@ts-ignore
        this.scoreHistory = data?.scoreHistory || {};
        /**
         * @type {formatedHistoryBaseObject<number[]>[]}
         * @description data货币变更记录 
        */
        this.data = [];

        data?.data?.forEach(item => {
            this.data.push({
                date: new Date(item.date),
                value: item.value
            })
        })

        /**
         * @type {formatedHistoryBaseObject<number>[]}
         * @description rks变更记录
         */
        this.rks = [];

        data?.rks?.forEach(item => {
            this.rks.push({
                date: new Date(item.date),
                value: item.value
            })
        });

        /**
         * @type {formatedHistoryBaseObject<number>[]}
         * @description 课题模式成绩
         */
        this.challengeModeRank = [];

        data?.challengeModeRank?.forEach(item => {
            this.challengeModeRank.push({
                date: new Date(item.date),
                value: item.value
            })
        });
        /**v1.0,取消对当次更新内容的存储，取消对task的记录，更正scoreHistory */
        /**v1.1,更正scoreHistory */
        /**v2,由于曲名错误，删除所有记录，曲名使用id记录 */
        /**v3,添加课题模式历史记录 */
        /**历史记录版本号 */
        this.version = data?.version
        /**民间考核 */

        /**检查版本 */
        if (!this.version || this.version < 2) {
            if (this.scoreHistory) {
                for (let i in this.scoreHistory) {
                    if (!i.includes('.0')) {
                        this.scoreHistory = {}
                    }
                    break
                }
            }
            this.version = 2
        }
        if (this.version < 3) {
            this.challengeModeRank = []
            this.version = 3
        }
    }

    /**
     * 合并记录
     * @param {saveHistory} data 另一个 History 存档
     */
    add(data) {
        this.data = merge(this.data, data.data)
        this.rks = merge(this.rks, data.rks)
        this.challengeModeRank = merge(this.challengeModeRank, data.challengeModeRank)
        const ids = fCompute.objectKeys(data.scoreHistory || {})
        for (let id of ids) {
            if (!this.scoreHistory[id]) this.scoreHistory[id] = {}
            for (let dif of allLevel) {
                if (this.scoreHistory[id] && this.scoreHistory[id][dif]) {
                    if (data.scoreHistory[id][dif]) {
                        this.scoreHistory[id][dif] = [...this.scoreHistory[id][dif], ...data.scoreHistory[id][dif]]
                        this.scoreHistory[id][dif].sort((a, b) => {
                            return openHistory(a).date.getTime() - openHistory(b).date.getTime()
                        })
                    }
                } else {
                    this.scoreHistory[id][dif] = data.scoreHistory[id][dif]
                }
                if (!this.scoreHistory[id][dif]) continue
                let i = 1
                while (i < this.scoreHistory[id][dif].length) {
                    let last = openHistory(this.scoreHistory[id][dif][i - 1])
                    let now = openHistory(this.scoreHistory[id][dif][i])
                    if (last.score == now.score && last.acc == now.acc && last.fc == now.fc) {
                        // console.info(last.date.toISOString(), now.date.toISOString())
                        this.scoreHistory[id][dif].splice(i, 1)
                    } else {
                        ++i
                    }
                }
            }
        }
    }

    /**
     * 检查新存档中的变更并记录
     * @param {Save} save 新存档
     */
    update(save) {
        /**更新单曲成绩 */
        const ids = fCompute.objectKeys(save.gameRecord || {})
        for (let id of ids) {
            if (!this.scoreHistory[id]) this.scoreHistory[id] = {}
            for (let i in save.gameRecord[id]) {
                /**难度映射 */
                let level = allLevel[i]
                /**
                 * 提取成绩
                 * @type {LevelRecordInfo & {date?: Date} | null}
                 */
                let now = save.gameRecord[id][i]
                if (!now) continue
                now.date = save.saveInfo.modifiedAt.iso
                /**本地无记录 */
                if (!this.scoreHistory[id][level] || !this.scoreHistory[id][level].length) {
                    this.scoreHistory[id][level] = [createHistory(now.acc, now.score, save.saveInfo.modifiedAt.iso, now.fc)];
                    continue
                }
                /**新存档该难度无成绩 */
                if (!save.gameRecord[id][i]) continue
                /**本地记录日期为递增 */
                for (let i = this.scoreHistory[id][level].length - 1; i >= 0; --i) {
                    /**第i项记录 */
                    let old = openHistory(this.scoreHistory[id][level][i])
                    // console.info(old.date.toISOString(), new Date(now.date).toISOString(), old.date.toISOString() == new Date(now.date).toISOString())
                    /**日期完全相同则认为已存储 */
                    if (old.score == now.score && old.acc == now.acc && old.fc == now.fc) {
                        /**标记已处理 */
                        now = null
                        break
                    }
                    /**找到第一个日期小于新成绩的日期 */
                    if (old.date < new Date(now.date)) {
                        /**历史记录acc仅保存4位，检查是否与第一个小于该日期的记录一致 */
                        if (old.acc != Number(now.acc.toFixed(4)) || old.score != now.score || old.fc != now.fc) {
                            /**不一致在第i项插入 */
                            this.scoreHistory[id][level].splice(i, 0, createHistory(now.acc, now.score, save.saveInfo.modifiedAt.iso, now.fc))
                        }
                        /**标记已处理 */
                        now = null
                        break
                    }
                }
                /**未被处理，有该难度记录，说明日期早于本地记录 */
                if (now) {
                    // console.info(11)
                    this.scoreHistory[id][level].unshift(createHistory(now.acc, now.score, save.saveInfo.modifiedAt.iso, now.fc))
                }
                /**查重 */
                let j = 1
                while (j < this.scoreHistory[id][level].length) {
                    let last = openHistory(this.scoreHistory[id][level][j - 1])
                    let now = openHistory(this.scoreHistory[id][level][j])
                    if (last.score == now.score && last.acc == now.acc && last.fc == now.fc) {
                        // console.info(last.date.toISOString(), now.date.toISOString())
                        this.scoreHistory[id][level].splice(j, 1)
                    } else {
                        ++j
                    }
                }
            }
        }
        /**更新rks记录 */
        for (let i = this.rks.length - 1; i >= 0; i--) {
            if (save.saveInfo.modifiedAt.iso > new Date(this.rks[i].date)) {
                if (!this.rks[i + 1] || (this.rks[i].value != save.saveInfo.summary.rankingScore || this.rks[i + 1]?.value != save.saveInfo.summary.rankingScore)) {
                    this.rks.splice(i + 1, 0, {
                        date: save.saveInfo.modifiedAt.iso,
                        value: save.saveInfo.summary.rankingScore
                    })
                }
                break
            }
        }
        if (!this.rks.length) {
            this.rks.push({
                date: save.saveInfo.modifiedAt.iso,
                value: save.saveInfo.summary.rankingScore
            })
        }
        /**更新data记录 */
        for (let i = this.data.length - 1; i >= 0; i--) {
            if (save.saveInfo.modifiedAt.iso > new Date(this.data[i].date)) {
                if (!this.data[i + 1] || (checkValue(this.data[i].value, save.gameProgress.money) && checkValue(this.data[i + 1]?.value, save.gameProgress.money))) {
                    this.data.splice(i + 1, 0, {
                        date: save.saveInfo.modifiedAt.iso,
                        value: save.gameProgress.money
                    })
                }
                break
            }
        }
        if (!this.data.length) {
            this.data.push({
                date: save.saveInfo.modifiedAt.iso,
                value: save.gameProgress.money
            })
        }
        /**更新课题模式记录 */
        for (let i = this.challengeModeRank.length - 1; i >= 0; i--) {
            if (save.saveInfo.modifiedAt.iso > new Date(this.challengeModeRank[i].date)) {
                let clg = save.saveInfo.summary.challengeModeRank
                if (clg != this.challengeModeRank[i].value && (this.challengeModeRank[i + 1]?.value != clg)) {
                    this.challengeModeRank.splice(i + 1, 0, {
                        date: save.saveInfo.modifiedAt.iso,
                        value: save.saveInfo.summary.challengeModeRank
                    })
                }
                break
            }
        }
        if (!this.challengeModeRank.length) {
            this.challengeModeRank.push({
                date: save.saveInfo.modifiedAt.iso,
                value: save.saveInfo.summary.challengeModeRank
            })
        }
    }

    /**
     * 获取歌曲最新的历史记录
     * @param {idString} id 曲目id
     * @returns 
     */
    async getSongsLastRecord(id) {
        let t = { ...this.scoreHistory[id] }
        /**
         * @type {Partial<Record<allLevelKind, LevelRecordInfo & {date?: Date}>>}
         */
        const result = {}
        for (let level of allLevel) {
            if (!t[level]) continue
            const lastRecord = t[level] ? openHistory(t[level][t[level].length - 1]) : null
            if (!lastRecord) continue
            let date = lastRecord?.date
            result[level] = new LevelRecordInfo(lastRecord, id, LevelNum[level])
            result[level].date = date
        }
        return result
    }

    /**
     * @typedef {Object} rksAndDataLineObject
     * @property {Array<Array<number>>} rks_history - RKS历史折线数据点集合
     * @property {number[]} rks_range - RKS值域范围 [min, max]
     * @property {number[]} rks_date - RKS时间戳范围 [最早, 最晚]
     * @property {number[][]} data_history - 数据历史折线数据点集合
     * @property {(number | string)[]} data_range - 数据值域范围，可能为数值数组 [min, max] 或格式化字符串数组，如 ['1MiB', '4GiB']
     * @property {number[]} data_date - 数据时间戳范围 [最早, 最晚]
     */

    /**
     * 折线图数据
     * @returns {rksAndDataLineObject}
     */
    getRksAndDataLine() {
        let rks = this.getRksLine()
        let data = this.getDataLine()
        return { ...rks, ...data }
    }

    getRksLine() {

        /**@type {formatedHistoryBaseObject<number>[]} */
        let rks_history_ = []
        let user_rks_data = this.rks
        let rks_range = [MAX_DIFFICULTY, 0]
        /** @type {[dateBegin: number, dateAfter: number]} */
        let rks_date = [0, 0];
        let rks_history = []

        if (user_rks_data.length) {
            rks_date = [new Date(user_rks_data[0].date).getTime(), 0]
            user_rks_data.forEach((item, i) => {
                item.date = new Date(item.date)
                if (i <= 1 || item.value != rks_history_[rks_history_.length - 2].value) {
                    rks_history_.push(item)
                    rks_range[0] = Math.min(rks_range[0], item.value)
                    rks_range[1] = Math.max(rks_range[1], item.value)
                } else {
                    rks_history_[rks_history_.length - 1].date = item.date
                }
                rks_date[1] = item.date.getTime()
            })

            rks_history_.forEach((item, i) => {

                i = Number(i)

                if (!rks_history_[i + 1]) return
                let x1 = fCompute.range(item.date.getTime(), rks_date)
                let y1 = fCompute.range(item.value, rks_range)
                let x2 = fCompute.range(rks_history_[i + 1].date.getTime(), rks_date)
                let y2 = fCompute.range(rks_history_[i + 1].value, rks_range)
                rks_history.push([x1, y1, x2, y2])
            });
            if (!rks_history.length) {
                rks_history.push([0, 50, 100, 50])
            }
        }


        return {
            rks_history,
            rks_range,
            rks_date,
        }
    }

    getDataLine() {

        /**@type {formatedHistoryBaseObject<number>[]} */
        let data_history_ = []
        let user_data_data = this.data
        const data_range_num = [1e16, 0]
        const data_range = ['', '']
        /** @type {[dateBegin: number, dateAfter: number] | []} */
        let data_date = []
        /** @type {[x1: number, y1: number, x2: number, y2: number][]} */
        let data_history = []

        if (user_data_data.length) {
            data_date = [new Date(user_data_data[0].date).getTime(), 0]
            user_data_data.forEach((item, i) => {
                const value = item.value
                const totValue = (((value[4] * 1024 + value[3]) * 1024 + value[2]) * 1024 + value[1]) * 1024 + value[0]
                item.date = new Date(item.date)
                const temObj = {
                    date: item.date,
                    value: totValue
                }
                if (i <= 1 || temObj.value != data_history_[data_history_.length - 2].value) {
                    data_history_.push(temObj)
                    data_range_num[0] = Math.min(data_range_num[0], totValue)
                    data_range_num[1] = Math.max(data_range_num[1], totValue)
                } else {
                    data_history_[data_history_.length - 1].date = item.date
                }
                data_date[1] = item.date.getTime()
            })

            data_history_.forEach((item, i) => {

                i = Number(i)

                if (!data_history_[i + 1]) return
                let x1 = fCompute.range(item.date.getTime(), data_date)
                let y1 = fCompute.range(item.value, data_range_num)
                let x2 = fCompute.range(data_history_[i + 1].date.getTime(), data_date)
                let y2 = fCompute.range(data_history_[i + 1].value, data_range_num)
                data_history.push([x1, y1, x2, y2])
            })
            if (!data_history.length) {
                data_history.push([0, 50, 100, 50])
            }


            let unit = ["KiB", "MiB", "GiB", "TiB", "Pib"]



            for (const i of [4, 3, 2, 1, 0]) {
                if (data_range_num[0] / (Math.pow(1024, i)) < 1024) {
                    data_range[0] = `${Math.floor(data_range_num[0] / (Math.pow(1024, i)))}${unit[i]}`
                    break;
                }
            }

            for (const i of [4, 3, 2, 1, 0]) {
                if (data_range_num[1] / (Math.pow(1024, i)) < 1024) {
                    data_range[1] = `${Math.floor(data_range_num[1] / (Math.pow(1024, i)))}${unit[i]}`
                    break;
                }
            }
        }

        return {
            data_history,
            data_range: data_range_num,
            data_date
        }
    }

}

/**
 * 数组合并按照 date 排序并去重
 * @param {formatedHistoryBaseObject<any>[]} m 
 * @param {formatedHistoryBaseObject<any>[]} n 
 */
function merge(m, n) {
    let t = m.concat(n)
    t.sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
    let i = 1
    while (i < t.length - 1) {
        /**因绘制折线图需要，需要保留同一值两端 */
        if (checkValue(t[i].value, t[i - 1].value) && checkValue(t[i].value, t[i + 1].value)) {
            t.splice(i, 1)
        } else {
            ++i
        }
    }
    return t
}

/**
 * 
 * @param {number} acc 
 * @param {number} score 
 * @param {Date} date 
 * @param {boolean} fc 
 * @returns {ScoreDetail}
 */
function createHistory(acc, score, date, fc) {
    return [acc.toFixed(4), score, date.toISOString(), fc]
}


/**
 * 展开信息
 * @param {ScoreDetail} data 历史成绩
 */
function openHistory(data) {
    return {
        acc: Number(data[0]),
        score: Number(data[1]),
        date: new Date(data[2]),
        fc: Boolean(data[3])
    }
}

/**
 * 比较两个数组
 * @param {any} a 
 * @param {any} b 
 * @returns {boolean}
 */
function checkValue(a, b) {
    /**非数组 */
    if (Object.prototype.toString.call(a) != '[object Array]') {
        return a == b
    }
    if (!a || !b) {
        return false
    }
    /**数组 */
    for (let i in a) {
        if (a[i] != b[i]) return false
    }
    return true
}
