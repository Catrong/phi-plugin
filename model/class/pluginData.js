
/**
 * @typedef {object} taskObj 任务对象
 * @property {idString} song 歌曲ID
 * @property {number} reward 奖励 notes 数量
 * @property {boolean} finished 任务是否完成
 * @property {object} request 任务要求
 * @property {string} request.type 任务类型 acc / score
 * @property {levelKind} request.rank 难度
 * @property {number} request.value 任务要求数值
 */

export const themeList = [{ id: "default", src: "默认" }, { id: "snow", src: "寒冬" }, { id: "star", src: "使一颗心免于哀伤" }, { id: "dss2", src: "大师赛2" }]

export default class PluginData {
  /**
   * @param {any} data 初始化数据
   */
  constructor(data) {
    this.money = isNaN(data?.money) ? 0 : data.money
    this.sign_in = data?.sign_in || "Wed Apr 03 2024 23:03:52 GMT+0800 (中国标准时间)"
    /**
     * 签到记录（YYYY-MM-DD），用于渲染签到日历与累计签到天数
     * @type {string[]}
     */
    this.sign_history = Array.isArray(data?.sign_history) ? data.sign_history : []
    this.task_time = data?.task_time || "Wed Apr 03 2024 23:03:52 GMT+0800 (中国标准时间)"
    /**@type {taskObj[]} */
    this.task = Array.isArray(data?.task) ? data.task : []

    /**@type {number} */
    this.noticeCode = isNaN(data?.noticeCode) ? 0 : data.noticeCode

    /**@type {"default" | "snow" | "star" | "dss2"} */
    this.theme = "default"
    switch (data?.theme) {
      case "default":
      case "snow":
      case "star":
      case "dss2":
        this.theme = data.theme
    }

    /**@type {"all" | "b30" | "top"} */
    this.b30AvgKind = "all"
    switch (data?.b30AvgKind) {
      case "all":
      case "b30":
      case "top":
      case "none":
        this.b30AvgKind = data.b30AvgKind
    }

    /**@type {"red" | "gold" | "blue" | "green"} avg条的主题色*/
    this.b30AvgColor = "blue"
    switch (data?.b30AvgColor) {
      case "red":
      case "gold":
      case "blue":
      case "green":
        this.b30AvgColor = data.b30AvgColor
    }
  }
}