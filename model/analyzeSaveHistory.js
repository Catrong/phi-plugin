/**
 * saveHistory 分析器
 *
 * 约定：
 * - “哪天”以本地日期（年-月-日）统计（避免 UTC 跨天偏移）
 * - “更新次数”按所有历史记录中出现的时间戳去重统计（同一次 update 可能同时写入 score/rks/data）
 * - “新纪录”按同一曲目+难度的「历史最好成绩」判断：score 更高，或 score 相同但 acc 更高
 * - “AP”按 acc≈1 或 acc≈100 判断（兼容不同 acc 表示法）
 */

import fCompute from './fCompute.js';
import getInfo from './getInfo.js';

/**
 * @typedef {import('./class/saveHistory.js').default} SaveHistory
 */

/**
 * @typedef {Object} DayStat
 * @property {string} day YYYY-MM-DD（本地）
 * @property {string} count
 */

/**
 * @typedef {Object} AnalyzeSaveHistoryResult
 * @property {number} totalDays 发生过事件的总天数（score/rks/data/challenge 任一）
 * @property {number} totalUpdates 发生过事件的总“更新次数”（按时间戳去重）
 * @property {{id: string, count: string}[]} mostPlayedSongsTop3 打得最多的谱 TOP3（按曲目 id 的 score 记录条数）
 * @property {{day: string, delta: string}} rksMaxUpDay 哪天 rks 上升最多（按天累计增量）
 * @property {{day: string, delta: string}} rksMaxDownDay 哪天 rks 下降最多（按天累计减量，为负数）
 * @property {DayStat[]} mostNewRecordsDaysTop3 新纪录最多 TOP3（按天累计）
 * @property {{up: {day: string, deltaBytes: string}, down: {day: string, deltaBytes: string}}} dataMaxUpDownDay 哪天 data 上升/下降最多（按天累计字节变化）
 * @property {{day: string, time: string}[]} latestPushScoreDaysTop3 推分最晚 TOP3（按“每天最晚时间”降序）
 * @property {DayStat[]} mostApDaysTop3 AP 最多 TOP3（按“新 AP”事件计数）
 * @property {{count: string, tap: string, drag: string, hold: string, flick: string, combo: string, time: string}} resTotalScoreRecords 总新纪录数，总note数
 */

/**
 * @param {any} value
 * @returns {Date | null}
 */
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  // Invalid Date
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * 本地日期 key：YYYY-MM-DD
 * @param {Date} d
 */
function dayKeyLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {number} acc
 */
function isAP(acc) {
  // 兼容 1.0（0~1）或 100.0（0~100）两种
  return acc >= 100;
}

/**
 * @param {any} value
 * @returns {number | null}
 */
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {any} value
 * @returns {number | null}
 */
function dataArrayToBytes(value) {
  if (!Array.isArray(value) || value.length < 5) return null;
  const parts = value.map((v) => Number(v));
  if (parts.some((v) => !Number.isFinite(v))) return null;
  // 与 saveHistory.getDataLine() 同逻辑
  return (((parts[4] * 1024 + parts[3]) * 1024 + parts[2]) * 1024 + parts[1]) * 1024 + parts[0];
}

/**
 * @template T
 * @param {Map<string, T>} map
 * @param {(a: T, b: T) => number} compare
 * @returns {{key: string, value: T} | null}
 */
function pickBest(map, compare) {
  /** @type {{key: string, value: T} | null} */
  let best = null;
  for (const [key, value] of map.entries()) {
    if (!best) {
      best = { key, value };
      continue;
    }
    if (compare(value, best.value) > 0) {
      best = { key, value };
    }
  }
  return best;
}

/**
 * @param {Map<string, number>} map
 * @param {number} n
 * @returns {{key: string, value: number}[]}
 */
function topNNumberMap(map, n) {
  return Array.from(map.entries())
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return String(a.key).localeCompare(String(b.key));
    })
    .slice(0, n);
}

/**
 * @param {SaveHistory} history
 * @returns {AnalyzeSaveHistoryResult}
 */
export function analyzeSaveHistory(history) {
  // console.info(history);
  /**
   * score 事件：按曲目+难度展开
   * @type {{id: idString, level: allLevelKind, acc: number, score: number, fc: boolean, date: Date}[]}
   */
  const scoreEvents = [];

  const scoreHistory = history?.scoreHistory || {};
  for (const id of fCompute.objectKeys(scoreHistory)) {
    const perSong = scoreHistory[id] || {};
    for (const level of fCompute.objectKeys(perSong)) {
      const arr = perSong[level];
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (!Array.isArray(item) || item.length < 4) continue;
        const acc = toNumber(item[0]);
        const score = toNumber(item[1]);
        const date = toDate(item[2]);
        const fc = Boolean(item[3]);
        if (acc == null || score == null || !date) continue;
        scoreEvents.push({ id, level, acc, score, fc, date });
      }
    }
  }
  scoreEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  /**
   * rks/data/challenge 事件（用于更新次数、天数、增减统计）
   */
  const rksEvents = (Array.isArray(history?.rks) ? history.rks : [])
    .map((x) => ({ date: toDate(x?.date), value: toNumber(x?.value) }))
    .filter((x) => x.date && x.value != null)
    .map((x) => /** @type {{date: Date, value: number}} */({ date: x.date, value: x.value }));
  rksEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  const dataEvents = (Array.isArray(history?.data) ? history.data : [])
    .map((x) => ({ date: toDate(x?.date), bytes: dataArrayToBytes(x?.value) }))
    .filter((x) => x.date && x.bytes != null)
    .map((x) => /** @type {{date: Date, bytes: number}} */({ date: x.date, bytes: x.bytes }));
  dataEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  const challengeEvents = (Array.isArray(history?.challengeModeRank) ? history.challengeModeRank : [])
    .map((x) => ({ date: toDate(x?.date), value: toNumber(x?.value) }))
    .filter((x) => x.date && x.value != null)
    .map((x) => /** @type {{date: Date, value: number}} */({ date: x.date, value: x.value }));
  challengeEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  // 1) 一共查分有多少天（发生过任一事件的天数）
  const daySet = new Set();
  for (const e of scoreEvents) daySet.add(dayKeyLocal(e.date));
  for (const e of rksEvents) daySet.add(dayKeyLocal(e.date));
  for (const e of dataEvents) daySet.add(dayKeyLocal(e.date));
  for (const e of challengeEvents) daySet.add(dayKeyLocal(e.date));
  const totalDays = daySet.size;

  // 2) 一共更新了多少次（按时间戳去重）
  const updateSet = new Set();
  for (const e of scoreEvents) updateSet.add(e.date.getTime());
  for (const e of rksEvents) updateSet.add(e.date.getTime());
  for (const e of dataEvents) updateSet.add(e.date.getTime());
  for (const e of challengeEvents) updateSet.add(e.date.getTime());
  const totalUpdates = updateSet.size;

  // 3) 哪张谱打的最多（按曲目 id 的 score 记录条数）
  const songCount = new Map();
  for (const e of scoreEvents) {
    songCount.set(`${safeText(getInfo.idgetsong(e.id) || e.id)} - ${e.level}`, (songCount.get(e.id) || 0) + 1);
  }
  // @ts-ignore
  const mostPlayedSongsTop3 = topNNumberMap(songCount, 3).map((x) => ({ id: x.key, count: safeText(x.value) }));

  // 4/5) 哪天 rks 上升/下降最多（按天累计 delta，delta 归于“变化后”的那条记录日期）
  /** @type {Map<string, number>} */
  const rksDeltaByDay = new Map();
  for (let i = 1; i < rksEvents.length; i++) {
    const prev = rksEvents[i - 1];
    const cur = rksEvents[i];
    const delta = cur.value - prev.value;
    if (!Number.isFinite(delta) || delta === 0) continue;
    const day = dayKeyLocal(cur.date);
    rksDeltaByDay.set(day, (rksDeltaByDay.get(day) || 0) + delta);
  }
  const rksMaxUp = pickBest(rksDeltaByDay, (a, b) => a - b);
  const rksMaxDown = pickBest(rksDeltaByDay, (a, b) => (b - a)); // 最负者

  const rksMaxUpDay = rksMaxUp && rksMaxUp.value > 0
    ? { day: safeText(rksMaxUp.key), delta: fmtSigned(rksMaxUp.value, 4) }
    : { day: '--', delta: '--' };

  const rksMaxDownDay = rksMaxDown && rksMaxDown.value < 0
    ? { day: safeText(rksMaxDown.key), delta: fmtSigned(rksMaxDown.value, 4) }
    : { day: '--', delta: '--' };

  // 6) 哪天新纪录最多（按 scoreEvents 判断“新纪录”）
  /** @type {Map<string, {bestScore: number, bestAcc: number}>} */
  const bestByChart = new Map();
  /** @type {Map<string, number>} */
  const newRecordByDay = new Map();

  for (const e of scoreEvents) {
    const key = `${e.id}::${e.level}`;
    const best = bestByChart.get(key);
    const isNew = !best || e.score > best.bestScore || (e.score === best.bestScore && e.acc > best.bestAcc);
    if (isNew) {
      const day = dayKeyLocal(e.date);
      newRecordByDay.set(day, (newRecordByDay.get(day) || 0) + 1);
      bestByChart.set(key, { bestScore: e.score, bestAcc: e.acc });
    }
  }

  const mostNewRecordsDaysTop3 = topNNumberMap(newRecordByDay, 3).map((x) => ({ day: safeText(x.key), count: safeText(x.value) }));

  // 7) 哪天 data 上升/下降最多（按天累计字节变化）
  /** @type {Map<string, number>} */
  const dataDeltaByDay = new Map();
  for (let i = 1; i < dataEvents.length; i++) {
    const prev = dataEvents[i - 1];
    const cur = dataEvents[i];
    const delta = cur.bytes - prev.bytes;
    if (!Number.isFinite(delta) || delta === 0) continue;
    const day = dayKeyLocal(cur.date);
    dataDeltaByDay.set(day, (dataDeltaByDay.get(day) || 0) + delta);
  }
  const dataMaxUp = pickBest(dataDeltaByDay, (a, b) => a - b);
  const dataMaxDown = pickBest(dataDeltaByDay, (a, b) => (b - a));

  const dataMaxUpDownDay = {
    up: dataMaxUp && dataMaxUp.value > 0 ? { day: safeText(dataMaxUp.key), deltaBytes: fmtBytes(dataMaxUp.value) } : { day: '--', deltaBytes: fmtBytes(0) },
    down: dataMaxDown && dataMaxDown.value < 0 ? { day: safeText(dataMaxDown.key), deltaBytes: fmtBytes(dataMaxDown.value) } : { day: '--', deltaBytes: fmtBytes(0) },
  };

  // 8) 哪天推分最晚（score 事件中：每一天取最晚时间，取其最大）
  /** @type {Map<string, Date>} */
  const latestScoreTimeByDay = new Map();
  for (const e of scoreEvents) {
    const day = dayKeyLocal(e.date);
    const prev = latestScoreTimeByDay.get(day);
    if (!prev || e.date.getTime() > prev.getTime()) {
      latestScoreTimeByDay.set(day, e.date);
    }
  }
  const latestPushScoreDaysTop3 = Array.from(latestScoreTimeByDay.entries())
    .map(([day, date]) => ({ day: safeText(day), date }))
    .sort((a, b) => toChinaTime(b.date) - toChinaTime(a.date))
    .slice(0, 3)
    .map((x) => ({ day: x.day, time: safeText(x.date.toLocaleTimeString('zh-CN', { hour12: false })) }));

  // 9) 哪天 AP 最多（按“新 AP”事件：同一曲目+难度首次达到 AP）
  /** @type {Set<string>} */
  const apAchieved = new Set();
  /** @type {Map<string, number>} */
  const apByDay = new Map();

  for (const e of scoreEvents) {
    if (!isAP(e.acc)) continue;
    const key = `${e.id}::${e.level}`;
    if (apAchieved.has(key)) continue;
    apAchieved.add(key);
    const day = dayKeyLocal(e.date);
    apByDay.set(day, (apByDay.get(day) || 0) + 1);
  }

  const mostApDaysTop3 = topNNumberMap(apByDay, 3).map((x) => ({ day: safeText(x.key), count: safeText(x.value) }));

  // 10) 总新纪录数，总note数

  const totalScoreRecords = {
    tap: 0,
    drag: 0,
    hold: 0,
    flick: 0,
    combo: 0,
    time: 0,
  }

  for (const e of scoreEvents) {
    // @ts-ignore
    const info = getInfo.info(e.id);
    if (!info || !info.chart) {
      continue;
    }
    // @ts-ignore
    const chart = info.chart[e.level];

    if (!chart?.tap) {
      continue;
    }

    totalScoreRecords.tap += chart.tap || 0;
    totalScoreRecords.drag += chart.drag || 0;
    totalScoreRecords.hold += chart.hold || 0;
    totalScoreRecords.flick += chart.flick || 0;
    totalScoreRecords.combo += chart.combo || 0;
    totalScoreRecords.time += chart.maxTime || 0;
  }

  const resTotalScoreRecords = {
    count: safeText(scoreEvents.length),
    tap: safeText(totalScoreRecords.tap),
    drag: safeText(totalScoreRecords.drag),
    hold: safeText(totalScoreRecords.hold),
    flick: safeText(totalScoreRecords.flick),
    combo: safeText(totalScoreRecords.combo),
    time: sToHMS(totalScoreRecords.time),
  }

  return {
    totalDays,
    totalUpdates,
    mostPlayedSongsTop3,
    rksMaxUpDay,
    rksMaxDownDay,
    mostNewRecordsDaysTop3,
    dataMaxUpDownDay,
    latestPushScoreDaysTop3,
    mostApDaysTop3,
    resTotalScoreRecords
  };
}

export default analyzeSaveHistory;

/**
 * 字符串安全输出
 * @param {any} v 
 * @returns 
 */
function safeText(v) {
  if (v === null || v === undefined) return '--';
  var t = String(v);
  return t.length ? t : '--';
}

/**
 * 
 * @param {number} n 
 * @param {number} digits 
 * @returns 
 */
function fmtSigned(n, digits) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '--'
  var x = Number(n)
  var s = x > 0 ? '+' : ''
  if (digits === undefined) return s + x
  return s + x.toFixed(digits)
}

/**
 * 
 * @param {number} n 
 * @returns 
 */
function fmtBytes(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '--'
  var x = Math.abs(Number(n))
  var sign = Number(n) < 0 ? '-' : ''
  var units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  var u = 0
  while (x >= 1024 && u < units.length - 1) { x /= 1024; u++; }
  var v = (u === 0) ? Math.round(x) : Math.round(x * 100) / 100
  return sign + v + units[u]
}

/**
 * 
 * @param {Date} date 
 */
function toChinaTime(date) {
  return (date.getTime() + 8 * 60 * 60 * 1000) % (24 * 60 * 60 * 1000);
}

/**
 * 
 * @param {number} s 
 */
function sToHMS(s) {
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  s = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}