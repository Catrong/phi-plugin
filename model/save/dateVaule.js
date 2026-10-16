
// 原始数据格式：
// [
//   [new Date("2026-10-15T10:00:00Z"), 10],
//   [new Date("2026-10-15T11:00:00Z"), 20],
//   [new Date("2026-10-16T12:00:00Z"), 30],
// ]

// 输出结构：
// [
//   [2026, [
//     [10, [
//       [15, [[36000000, 10], [39600000, 20]]],
//       [16, [[43200000, 30]]]
//     ]]
//   ]]
// ]

// 日期分组统一按 UTC 分量读写，序列化结果与运行环境时区无关。
/**
 * 规范化日期输入
 * @param {Date | string | number} date 
 * @returns {Date}
 */
function toDate(date) {
  return date instanceof Date ? date : new Date(date);
}

/**
 * 取日期对应的时间戳
 * @param {Date | string | number} date 
 * @returns {number}
 */
function toTime(date) {
  return date instanceof Date ? date.getTime() : new Date(date).getTime();
}

/**
 * @template T
 */
export default class dateValue {


  /**@type {[date: Date, value: T][]} */
  data = [];
  /**
   * 构造函数
   * @param {[date: Date, value: T][]} data 
   */
  constructor(data = []) {
    /**@type {[date: Date, value: T][]} */
    const sorted =
      // 确保数据按照时间升序排列，且不改动传入的数组
      /**@type {[date: Date, value: T][]} */([...(data || [])].map(item => [toDate(item[0]), item[1]])).sort((a, b) => a[0].getTime() - b[0].getTime());

    this.data = sorted;
  }

  /**
  * 将分组后的 JSON 结构还原为 [Date, value][]
  * @param {dateValueJSON<T>} json
  * @returns {[Date, T][]}
  */
  fromJson(json) {
    /**@type {[Date, any][]} */
    const result = [];

    for (const [year, months] of json || []) {
      for (const [month, days] of months) {
        for (const [day, points] of days) {
          for (const [time, value] of points) {
            const date = new Date(Date.UTC(year, month - 1, day));

            // 将当天毫秒偏移量还原为具体时间
            date.setTime(date.getTime() + time);

            result.push([date, value]);
          }
        }
      }
    }

    this.data = result.sort((a, b) => a[0].getTime() - b[0].getTime());
    return this.data;
  }


  /**
   * @returns {dateValueJSON<T>}
   */
  toJson() {
    // 如果未传入参数，则序列化实例自身的数据
    /**@type {[Date | string | number, any][]} */
    const source = this.data ?? [];
    // 按时间升序排列，避免相同年月日被拆分
    const sorted = [...source].sort(
      (a, b) => toTime(a[0]) - toTime(b[0])
    );

    /**@type {dateValueJSON<any>} */
    const result = [];

    for (const [rawDate, value] of sorted) {
      const date = toDate(rawDate);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();

      // 当天的毫秒偏移量，精确到毫秒
      const time =
        date.getUTCHours() * 3600000 +
        date.getUTCMinutes() * 60000 +
        date.getUTCSeconds() * 1000 +
        date.getUTCMilliseconds();

      // 获取或创建年份节点
      let yearNode = result[result.length - 1];

      if (!yearNode || yearNode[0] !== year) {
        yearNode = [year, []];
        result.push(yearNode);
      }

      const months = yearNode[1];

      // 获取或创建月份节点
      let monthNode = months[months.length - 1];

      if (!monthNode || monthNode[0] !== month) {
        monthNode = [month, []];
        months.push(monthNode);
      }

      const days = monthNode[1];

      // 获取或创建日期节点
      let dayNode = days[days.length - 1];

      if (!dayNode || dayNode[0] !== day) {
        dayNode = [day, []];
        days.push(dayNode);
      }

      // 保存当天具体时间及对应的值
      dayNode[1].push([time, value]);
    }

    return result;
  }

  /**
   * JSON.stringify 钩子：输出紧凑的分组结构
   * @returns {dateValueJSON<T>}
   */
  toJSON() {
    return this.toJson();
  }

  /**
   * 对数据进行排序
   */
  sort() {
    return this.data = this.data.sort((a, b) => toTime(a[0]) - toTime(b[0]));
  }

  /**
   * 添加新的数据项（不排序）
   * @param {Date | string | number} date 
   * @param {T} value 
   **/
  push(date, value) {
    this.data.push([toDate(date), value]);
  }

  /**
   * 合并另一个数据实例，同一时间戳仅保留后加入的数据
   * @param {dateValue<T>} other 
   */
  merge(other) {
    if (!other?.data?.length) return
    const merged = this.data.concat(other.data)
    merged.sort((a, b) => toTime(a[0]) - toTime(b[0]))
    /**@type {[date: Date, value: T][]} */
    const result = []
    for (const item of merged) {
      const last = result[result.length - 1]
      /**排序后同时间戳的两条记录相邻，other 作为后加入的一方覆盖旧值 */
      if (last && toTime(last[0]) === toTime(item[0])) {
        result[result.length - 1] = item
        continue
      }
      result.push(item)
    }
    this.data = result
  }

  /**
   * 二分查找并添加或更新新的数据项
   * @param {Date | string | number} date 
   * @param {T} value 
   */
  add(date, value) {
    const index = this.findIndex(date);
    if (index === undefined) {
      /**早于所有已有记录，插入到最前 */
      this.data.unshift([toDate(date), value]);
      return;
    }
    if (toTime(this.data[index][0]) === toTime(date)) {
      /**同一时间戳，覆盖为新值 */
      this.data[index][1] = value;
      return;
    }
    /**index 为最后一个 <= date 的位置，插入到其后 */
    this.data.splice(index + 1, 0, [toDate(date), value]);
  }

  /**
   * 查找指定日期前(<=)第一个数据位置
   * @param {Date | string | number} target 
   */
  findIndex(target) {
    const targetTime = toTime(target);
    let left = 0;
    let right = this.data.length;

    // 查找第一个日期 > target 的位置
    while (left < right) {
      const mid = left + Math.floor((right - left) / 2);

      if (toTime(this.data[mid][0]) <= targetTime) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    // left - 1 即最后一个日期 <= target 的位置
    return left > 0 ? left - 1 : undefined;
  }

  /**
   * 查找指定日期前(<=)第一个数据
   * @param {Date | string | number} target 
   * @returns {[Date, T] | undefined}
   */
  find(target) {
    const index = this.findIndex(target);
    if (index === undefined) return undefined;
    return this.data[index];
  }

  get length() {
    return this.data.length;
  }

  get end() {
    return this.data[this.data.length - 1];
  }
}