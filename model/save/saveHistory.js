import { allLevel, MAX_DIFFICULTY } from "../game/constNum.js"
import Save from "./Save.js"
import fCompute from "../game/fCompute.js";
import dateValue from "./dateVaule.js";
import getInfo from "../game/getInfo.js";

/**
 * @template T
 * @typedef {object} formatedHistoryBaseObject<T>
 * @property {Date} date - 日期
 * @property {T} value - 值
 */
/**
 * @template T
 * @typedef {Array<[date: Date, value: T]>} formatedHistoryArray
 */
export default class saveHistory {


    /**v1.0,取消对当次更新内容的存储，取消对task的记录，更正scoreHistory */
    /**v1.1,更正scoreHistory */
    /**v2,由于曲名错误，删除所有记录，曲名使用id记录 */
    /**v3,添加课题模式历史记录 */
    /**v4,更改运行时scoreHistory结构，拒绝v2及以前的格式，使用更紧凑的序列化结构，消除0608坏档影响 */
    /**历史记录版本号 */
    version = 4

    /**@type {Record<idString, Partial<Record<allLevelKind, dateValue<[acc: number, score: number, fc: 0|1]>>>>} */
    scoreHistory = {}

    /**@type {dateValue<[number, number, number, number, number]>} */
    data = new dateValue();

    /**@type {dateValue<number>} */
    challengeModeRank = new dateValue();

    /**@type {dateValue<number>} */
    rks = new dateValue();

    /**
     * 生成该历史记录的运行环境 UTC 偏移（+HH:MM）。
     * 仅作来源元信息，日期分量始终按 UTC 读写；为 null 时在序列化时补当前环境值。
     * @type {string | null}
     */
    timezone = null

    /**
     * 
     * @param {Partial<saveHistoryObjectV3 | saveHistoryObjectV4> | null} [oridata] 
     */
    constructor(oridata) {
        if (!oridata) return

        /**
         * 版本判定：历史数据的 version 曾用 4 表示旧结构（与现在的 v4 紧凑结构同名不同义），
         * 因此按结构优先识别；显式声明 v1 及以前的记录以曲名为 key，结构不可靠，直接跳过
         */
        //@ts-ignore
        if (oridata?.version == 4) oridata.version = detectHistoryVersion(oridata);

        switch (oridata?.version) {
            case 2:
            case 3:
                /**初始化时区偏移 */
                this.timezone = fCompute.timezoneOffset()
                /**导入 v2/v3 版本逻辑 */
                if (oridata.data) {
                    /**data货币 */
                    for (const item of oridata.data) {
                        this.data.push(new Date(item.date), item.value)
                    }
                    this.data.sort();
                }
                if (oridata.scoreHistory) {
                    /**详细分数 */
                    const ids = fCompute.objectKeys(oridata?.scoreHistory || {})
                    for (const id of ids) {
                        const record = oridata?.scoreHistory?.[id];
                        if (!record) continue;
                        // 初始化分数历史
                        this.scoreHistory[id] = {}
                        for (const level of allLevel) {
                            if (!record[level]) continue;
                            // 初始化该难度的分数历史
                            this.scoreHistory[id][level] = new dateValue();
                            for (const item of record[level]) {
                                // item[2] = new Date(item[2])
                                this.scoreHistory[id][level].push(
                                    new Date(item[2]),
                                    createHistoryV4(item[0], item[1], item[3])
                                );
                            }
                            this.scoreHistory[id][level].sort();
                        }
                    }
                }
                if (oridata.challengeModeRank) {
                    /**课题模式成绩 */
                    for (const item of oridata.challengeModeRank) {
                        this.challengeModeRank.push(new Date(item.date), item.value)
                    }
                    this.challengeModeRank.sort();
                }
                if (oridata.rks) {
                    /**rks历史记录，仅保留4位小数 */
                    for (const item of oridata.rks) {
                        this.rks.push(new Date(item.date), Number(Number(item.value).toFixed(4)))
                    }
                    this.rks.sort();
                }
                this.version = 4
                break;
            case 4:
                /**初始化时区偏移 */
                if (oridata.timezone) {
                    this.timezone = oridata.timezone
                }
                /**导入 v4 版本逻辑 */
                if (oridata.data) {
                    /**data货币 */
                    this.data.fromJson(oridata.data)
                }
                if (oridata.challengeModeRank) {
                    /**课题模式成绩 */
                    this.challengeModeRank.fromJson(oridata.challengeModeRank)
                }
                if (oridata.rks) {
                    /**rks历史记录 */
                    this.rks.fromJson(oridata.rks)
                }
                if (oridata.scoreHistory) {
                    /**详细分数 */
                    const ids = fCompute.objectKeys(oridata?.scoreHistory || {})
                    for (const id of ids) {
                        const record = oridata?.scoreHistory?.[id];
                        if (!record) continue;
                        // 初始化分数历史
                        this.scoreHistory[id] = {}
                        for (const level of allLevel) {
                            if (!record[level]) continue;
                            // 初始化该难度的分数历史
                            this.scoreHistory[id][level] = new dateValue();
                            this.scoreHistory[id][level].fromJson(record[level])
                        }
                    }
                }

        }
        this.version = 4
    }

    toJSON() {
        /**@type {Record<idString, Partial<Record<allLevelKind, dateValueJSON<[acc: number, score: number, fc: 0|1]>>>>} */
        const scoreHistory = {}
        for (const id of fCompute.objectKeys(this.scoreHistory)) {
            scoreHistory[id] = {}
            for (const level of allLevel) {
                if (!this.scoreHistory[id][level]) continue
                scoreHistory[id][level] = this.scoreHistory[id][level].toJson()
            }
        }
        return {
            version: this.version,
            /**来源元信息缺失时补当前运行环境时区 */
            timezone: this.timezone || fCompute.timezoneOffset(),
            rks: this.rks.toJson(),
            data: this.data.toJson(),
            challengeModeRank: this.challengeModeRank.toJson(),
            scoreHistory
        }
    }

    /**
     * 该历史记录用于展示的时区偏移（+HH:MM）
     * 未记录来源时区时使用运行环境时区
     * @returns {string}
     */
    getTimezone() {
        return this.timezone || fCompute.timezoneOffset()
    }

    /**
     * 合并记录
     * @param {saveHistory} data 另一个 History 存档
     */
    add(data) {
        /**自身没有来源时区时，采用被合并方的来源时区 */
        if (!this.timezone && data?.timezone) this.timezone = data.timezone
        this.data.merge(data.data)
        this.challengeModeRank.merge(data.challengeModeRank)
        this.rks.merge(data.rks)
        for (const id of fCompute.objectKeys(data.scoreHistory || {})) {
            if (!this.scoreHistory[id]) this.scoreHistory[id] = {}
            for (let dif of allLevel) {
                if (!data.scoreHistory[id][dif]) continue
                if (!this.scoreHistory[id][dif]) this.scoreHistory[id][dif] = new dateValue()
                this.scoreHistory[id][dif].merge(data.scoreHistory[id][dif])
            }
        }
    }

    /**
     * 检查新存档中的变更并记录
     * @param {Save} save 新存档
     */
    update(save) {
        /**
         * 存档时间缺失或畸形时（例如云存档不返回 modifiedAt，或为 0/null）不记录任何历史点：
         * Invalid Date 会被序列化成 null 分量、回读时归一化成 1899-11-30，0 则变成 1970 年
         */
        const newDate = new Date(save.saveInfo?.modifiedAt?.iso)
        if (!Number.isFinite(newDate.getTime()) || newDate.getUTCFullYear() < 2000) {
            return
        }
        /**更新单曲成绩 */
        const ids = fCompute.objectKeys(save.gameRecord || {})
        for (const id of ids) {
            if (!this.scoreHistory[id]) this.scoreHistory[id] = {}
            for (let i in save.gameRecord[id]) {
                /**难度映射 */
                let level = allLevel[i]
                /**提取成绩 */
                const newRecord = save.gameRecord[id][i];
                /**新存档该难度无成绩 */
                if (!newRecord) continue
                /**历史记录仅保留4位小数 */
                const newDetail = createHistoryV4(newRecord.acc, newRecord.score, newRecord.fc)
                /**本地无记录 */
                if (!this.scoreHistory[id][level] || !this.scoreHistory[id][level].length) {
                    this.scoreHistory[id][level] = new dateValue()
                    this.scoreHistory[id][level].push(newDate, newDetail)
                    continue
                }
                /**成绩未变化则不记录 */
                addHistoryIfChanged(this.scoreHistory[id][level], newDate, newDetail, isSameScoreDetail)
            }
        }
        /**更新data记录 */
        addHistoryIfChanged(this.data, newDate, save.gameProgress.money)

        /**更新课题模式记录 */
        addHistoryIfChanged(this.challengeModeRank, newDate, save.saveInfo.summary.challengeModeRank)

        /**更新rks记录，仅保留4位小数 */
        addHistoryIfChanged(this.rks, newDate, Number(Number(save.saveInfo.summary.rankingScore).toFixed(4)), isSameNumber)
    }

    /**
     * 根据给定日期还原该日期前最新的存档状态
     * @param {Date} targetDate 目标日期
     * @returns {{ gameRecord: Record<idString, (ori_record | null)[]>, money: [number, number, number, number, number], rks: number, challengeModeRank: number, version: number }}
     */
    restoreToDate(targetDate) {

        /** @type {Record<idString, (ori_record | null)[]>} */
        const gameRecord = {}
        const ids = fCompute.objectKeys(this.scoreHistory)

        // 1. 还原每首歌每个难度在目标日期前最新的成绩
        for (const id of ids) {
            const songHistory = this.scoreHistory[id]
            gameRecord[id] = []

            for (let levelIdx = 0; levelIdx < allLevel.length; levelIdx++) {
                const level = allLevel[levelIdx]
                const records = songHistory[level]
                if (!records || !records.length) {
                    gameRecord[id][levelIdx] = null
                    continue
                }

                // 查找目标日期前最新的成绩
                const selected = records.find(targetDate);

                if (selected) {
                    gameRecord[id][levelIdx] = {
                        acc: selected[1][0],
                        score: selected[1][1],
                        fc: selected[1][2] === 1
                    }
                } else {
                    gameRecord[id][levelIdx] = null
                }
            }
        }

        // 2. 还原 data 货币数量
        let money = this.data.find(targetDate)?.[1]
        if (!money) money = [0, 0, 0, 0, 0]

        // 3. 还原 challengeModeRank
        let challengeModeRank = this.challengeModeRank.find(targetDate)?.[1]
        if (!challengeModeRank) challengeModeRank = 0

        // 4. 按目标日期对应的历史版本定数计算 RKS（仅保留4位小数）
        const versionInfo = getInfo.getVersionDifficultyByDate(targetDate)
        const rks = Number(fCompute.getB30(gameRecord, versionInfo).rks.toFixed(4))

        return {
            gameRecord,
            money,
            rks,
            challengeModeRank,
            version: this.version
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
         * @type {Partial<Record<allLevelKind, ori_record & {date?: Date}>>}
         */
        const result = {}
        for (let level of allLevel) {
            if (!t[level]) continue
            const lastRecord = t[level].end
            if (!lastRecord) continue
            let date = lastRecord[0];
            result[level] = openHistoryV4(lastRecord[1]);
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
        let user_rks_data = this.rks.data
        let rks_range = [MAX_DIFFICULTY, 0]
        /** @type {[dateBegin: number, dateAfter: number]} */
        let rks_date = [0, 0];
        let rks_history = []

        if (user_rks_data.length) {
            rks_date = [new Date(user_rks_data[0][0]).getTime(), 0]
            user_rks_data.forEach((item, i) => {
                if (i <= 1 || item[1] != rks_history_[rks_history_.length - 2].value) {
                    rks_history_.push({
                        date: item[0],
                        value: item[1]
                    })
                    rks_range[0] = Math.min(rks_range[0], item[1])
                    rks_range[1] = Math.max(rks_range[1], item[1])
                } else {
                    rks_history_[rks_history_.length - 1].date = item[0]
                }
                rks_date[1] = item[0].getTime()
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
        let user_data_data = this.data.data
        const data_range_num = [1e16, 0]
        const data_range = ['', '']
        /** @type {[dateBegin: number, dateAfter: number] | []} */
        let data_date = []
        /** @type {[x1: number, y1: number, x2: number, y2: number][]} */
        let data_history = []

        if (user_data_data.length) {
            data_date = [new Date(user_data_data[0][0]).getTime(), 0]
            user_data_data.forEach((item, i) => {
                const value = item[1]
                const totValue = (((value[4] * 1024 + value[3]) * 1024 + value[2]) * 1024 + value[1]) * 1024 + value[0]
                const temObj = {
                    date: item[0],
                    value: totValue
                }
                if (i <= 1 || temObj.value != data_history_[data_history_.length - 2].value) {
                    data_history_.push(temObj)
                    data_range_num[0] = Math.min(data_range_num[0], totValue)
                    data_range_num[1] = Math.max(data_range_num[1], totValue)
                } else {
                    data_history_[data_history_.length - 1].date = item[0]
                }
                data_date[1] = item[0].getTime()
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
 * v4 成绩历史记录：acc 仅保留4位小数
 * @param {number|string} acc 
 * @param {number} score 
 * @param {boolean | number} fc 
 * @returns {[acc: number, score: number, fc: 0 | 1]}
 */
function createHistoryV4(acc, score, fc) {
    return [Number(Number(acc).toFixed(4)), score, fc ? 1 : 0]
}

/**
 * 
 * @param {[acc: number, score: number, fc: number]} data 
 * @returns {ori_record}
 */
function openHistoryV4(data) {
    return {
        acc: Number(data[0]),
        score: Number(data[1]),
        fc: Boolean(data[2])
    }
}

/**
 * 通过数据结构特征判断历史记录版本（唯一判定入口）
 * 不能只看 version：旧版的 4 表示「删除 DAN」，结构仍是 v3。
 * 特征（scoreHistory 每条记录逐项计票，有序序列取首元素）：
 * - v4：[年份, [月份, [日, [当天毫秒, 值]]]]、[日期, 值]
 * - v3：[acc, score, date, fc]、{ date, value }
 * @param {any} data 
 * @returns {3|4|0} 识别出的版本号，无法识别时为 0
 */
function detectHistoryVersion(data) {
    if (!data) return 0
    let v4 = 0
    let v3 = 0

    const scoreHistory = data.scoreHistory
    if (scoreHistory && typeof scoreHistory === 'object') {
        for (const id of fCompute.objectKeys(scoreHistory)) {
            const record = scoreHistory[id]
            if (!record || typeof record !== 'object') continue
            for (const level of fCompute.objectKeys(record)) {
                const first = record[level]?.[0]
                if (!Array.isArray(first)) continue
                if (typeof first[0] === 'number' && Array.isArray(first[1])) v4++
                else if (first.length >= 3) v3++
            }
        }
    }

    for (const key of ['rks', 'data', 'challengeModeRank']) {
        const series = data[key]
        if (!Array.isArray(series) || !series.length) continue
        const first = series[0]
        if (Array.isArray(first)) v4++
        else if (first && typeof first === 'object') v3++
    }

    if (v4 && !v3) return 4
    if (v3 && !v4) return 3
    // 理论上不会混用；出现混合时取票数多的一方
    if (v4 && v3) return v4 >= v3 ? 4 : 3
    return 0
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

/**
 * 仅在值发生变化时记录历史点，避免同一值反复堆积
 * @template T
 * @param {dateValue<T>} series 目标序列
 * @param {Date | string} date 记录时间
 * @param {T} value 当前值
 * @param {(a: T, b: T) => boolean} [isEqual] 相等判断，默认按值比较
 */
function addHistoryIfChanged(series, date, value, isEqual = checkValue) {
    const index = series.findIndex(date)
    /**同一时间戳：仅在值变化时覆盖 */
    if (index !== undefined && new Date(series.data[index][0]).getTime() === new Date(date).getTime()) {
        if (!isEqual(series.data[index][1], value)) series.data[index][1] = value
        return
    }
    /**与相邻记录的值相同则不记录 */
    if (index !== undefined && isEqual(series.data[index][1], value)) return
    const next = index === undefined ? series.data[0] : series.data[index + 1]
    if (next && isEqual(next[1], value)) return
    series.add(date, value)
}

/**
 * 数值是否相同（历史记录仅保留 4 位小数）
 * @param {number} a 
 * @param {number} b 
 * @returns {boolean}
 */
function isSameNumber(a, b) {
    return Number(Number(a).toFixed(4)) === Number(Number(b).toFixed(4))
}

/**
 * 单曲成绩是否相同（历史记录的 acc 仅保留 4 位小数）
 * @param {[acc: number, score: number, fc: number]} a 
 * @param {[acc: number, score: number, fc: number]} b 
 * @returns {boolean}
 */
function isSameScoreDetail(a, b) {
    return isSameNumber(a[0], b[0])
        && Number(a[1]) === Number(b[1])
        && Boolean(a[2]) === Boolean(b[2])
}
