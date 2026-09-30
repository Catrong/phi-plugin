
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

import themeManager from '../theme/manager.js'

/**
 * 内置主题列表（兼容旧版 /theme；新代码请使用 themeManager.getThemeList()）
 * @type {{id: string, src: string}[]}
 */
export const themeList = [{ id: "default", src: "默认" }, { id: "snow", src: "寒冬" }, { id: "star", src: "使一颗心免于哀伤" }, { id: "dss2", src: "大师赛2" }]

const BUILTIN_THEME_IDS = new Set(themeList.map(theme => theme.id))
const THEME_ID_RE = /^[a-zA-Z0-9_-]{1,120}$/

/** @param {unknown} themeId */
function normalizeThemePreference(themeId) {
  if (themeId === 'common') return 'default'
  return typeof themeId === 'string' && THEME_ID_RE.test(themeId) ? themeId : 'default'
}

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

    /** @type {string} 持久化的用户主题偏好；策略临时禁用或主题暂时缺失时仍保留。 */
    this.themePreference = 'default'
    /** @type {string} 本次运行实际可用于渲染的主题标识。 */
    this.theme = 'default'
    this.setThemePreference(data?.theme)

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

    /**@type {boolean} 是否允许使用在线API功能 */
    this.allowApiUsage = data?.allowApiUsage !== false

    /**@type {boolean} 是否展示 B30 统计分析 */
    this.showB30Analysis = data?.showB30Analysis !== false
  }

  /**
   * 更新用户偏好，并根据当前本地注册表与 Bot 策略计算实际渲染主题。
   * @param {unknown} themeId
   */
  setThemePreference(themeId) {
    const requested = normalizeThemePreference(themeId)
    this.themePreference = requested
    this.theme = BUILTIN_THEME_IDS.has(requested)
      || (themeManager.isCustomTheme(requested) && themeManager.isThemeAvailable(requested))
      ? requested
      : 'default'
    return this.theme
  }

  /** 保持旧版存储结构：偏好继续写入 theme，不额外落盘运行时字段。 */
  toJSON() {
    const { themePreference, ...data } = this
    return { ...data, theme: themePreference }
  }
}
