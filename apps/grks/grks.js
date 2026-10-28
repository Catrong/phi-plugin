import fCompute from "../../model/game/fCompute.js";
import LevelRecordInfo from "../../model/game/LevelRecordInfo.js";
import { grksClassWords } from "../../model/render/messages.js";
import logger from "../../components/Logger.js";

/**
 * @typedef {object} grksAnswer
 * @property {number} rks - RKS 值
 * @property {LevelRecordInfo[]} record - 成绩记录对象
 * @property {[clear: number, fc: number, phi: number][]} stats - 成绩统计数组
 * @property {number} challenge - 课题分
 * @property {number} updateAt - 存档最后更新时间戳 ms
 */

/**
 * 已对玩家公开的存档信息（统计、课题、更新时间）。
 * @typedef {object} grksKnownInfo
 * @property {[clear: number, fc: number, phi: number][]} stats 各难度成绩统计
 * @property {number} challenge 课题分
 * @property {number} updateAt 存档最后更新时间戳 ms
 */

/**
 * 已对玩家公开的统计图。
 * @typedef {object} grksKnownSheet
 * @property {[max: number, min: number] | null} range 单曲等效 rks 上下界
 * @property {number[] | null} histogram 30 条成绩的单曲等效 rks
 */

/**
 * `grksClass#getKnownData()` 的返回结构。
 * @typedef {object} grksKnownData
 * @property {(LevelRecordInfo | null)[]} records 已公开的成绩；位置未知时只包含已公开项，不含占位
 * @property {grksKnownInfo | null} info 已公开的存档信息
 * @property {grksKnownSheet} sheet 已公开的统计图
 */

/**
 * @typedef {'pending' | 'correct' | 'wrong' | 'timeout' | 'abandoned'} grksGuessResult
 *
 * @typedef {object} grksGuessEntry
 * @property {number} turn 猜测序号
 * @property {string} hint 本次获得的公开提示
 * @property {number | null} guess 回答数值
 * @property {grksGuessResult} result 回答判定
 */

export class grksClass {

  static MAX_GUESSES = 10;

  /**@type {grksAnswer | null} 当前答案 */
  answer = null;
  /**@type {number} 已使用提示次数 */
  hintCnt = 0;
  /**@type {number[]} 游戏猜测历史 */
  guessHistory = [];
  /** @type {grksGuessEntry[]} 提示与回答记录 */
  history = [];
  /**@type {number} 游戏开始时间 ms*/
  startTime = 0
  /**@type {number} 上次提示时间 ms*/
  lastTipTime = 0
  /**@type {boolean[]} 已知成绩记录数组（按 P3 + B27 顺序） */
  knownRecords = []
  /**@type {boolean} 是否已知统计信息 */
  knownInfo = false
  /**@type {boolean} 是否已知成绩列表顺序 */
  knownOrder = false
  /**@type {''|'histogram'|'range'} 已知直方图类型（空字符串表示未知） */
  knownSheetType = ''

  /**
   * 
   * @param {grksAnswer} answer 
   */
  constructor(answer) {
    this.answer = answer;
    this.startTime = Date.now();
    this.knownRecords = new Array(30).fill(false);
  }

  /**
   * 随机给出一个提示
   */
  randomHint() {
    const previousRecords = this.knownRecords.slice();
    const previousOrder = this.knownOrder;
    /** 记录提示按尚未公开的条数加权，避免全部公开后仍被抽中 */
    const unknownRecordCount = this.knownRecords.filter(known => !known).length;
    /** @type {[value: 'record' | 'info' | 'sheet', weight: number][]} */
    const choices = [
      ['record', unknownRecordCount * 10],
      ['info', this.knownInfo ? 0 : 10],
      ['sheet', this.knownSheetType ? 0 : 10]
    ];
    const random = fCompute.randFromArray(choices);
    switch (random) {
      case 'record':
        this.hintRecord();
        break;
      case 'info':
        this.knownInfo = true;
        break;
      case 'sheet':
        this.knownSheetType = fCompute.randFromArray([['histogram', 1], ['range', 1]]);
        break;
    }
    ++this.hintCnt;
    if (this.hintCnt == 5) {
      // 5 次提示后自动给出成绩列表顺序
      this.knownOrder = true;
    }
    this.lastTipTime = Date.now();
    this.recordHint(this.describeHint(random, previousRecords, !previousOrder && this.knownOrder));
  }

  /**
   * @typedef {object} userHintRecord
   * @property {'record'} type 类型
   * @property {number[]} [value] 翻开的成绩记录索引数组
   *
   * @typedef {object} userHintInfo
   * @property {'info'} type 类型
   * 
   * @typedef {object} userHintSheet
   * @property {'sheet'} type 类型
   * @property {'histogram'|'range'} value 翻开的直方图类型
   * 
   * @typedef {userHintRecord | userHintInfo | userHintSheet} userHint
   */

  /**
   * @param {userHint} option
   * @description 用户请求提示
   */
  userHint(option) {
    const previousRecords = this.knownRecords.slice();
    const previousOrder = this.knownOrder;
    switch (option.type) {
      case 'record':
        const target = option.value ?? [];
        this.hintRecord(target);
        break;
      case 'info':
        this.knownInfo = true;
        break;
      case 'sheet':
        this.knownSheetType = option.value;
        break;
    }
    ++this.hintCnt;
    if (this.hintCnt == 5) {
      // 5 次提示后自动给出成绩列表顺序
      this.knownOrder = true;
    }
    this.lastTipTime = Date.now();
    this.recordHint(this.describeHint(option.type, previousRecords, !previousOrder && this.knownOrder));
  }

  /** @param {'record' | 'info' | 'sheet'} type @param {boolean[]} previousRecords @param {boolean} orderRevealed @returns {string} */
  describeHint(type, previousRecords, orderRevealed) {
    const indices = type === 'record'
      ? this.knownRecords.flatMap((known, index) => known && !previousRecords[index] ? [index] : []) : [];
    return grksClassWords.hint.summary({
      type, indices, orderKnown: this.knownOrder,
      sheetKind: this.knownSheetType, orderRevealed,
    });
  }

  /** @param {string} hint */
  recordHint(hint) {
    const current = this.history.at(-1);
    if (current?.result === 'pending') {
      current.hint = grksClassWords.hint.append(current.hint, hint);
      return;
    }
    this.history.push({ turn: this.history.length + 1, hint, guess: null, result: 'pending' });
  }

  /** @param {number | null} guess @param {Exclude<grksGuessResult, 'pending'>} result */
  recordGuess(guess, result) {
    let current = this.history.at(-1);
    if (!current || current.result !== 'pending') {
      this.recordHint(grksClassWords.hint.noNew);
      current = this.history.at(-1);
    }
    if (!current) throw new Error(grksClassWords.hint.missingHistory);
    current.guess = guess;
    current.result = result;
    if (guess !== null) this.guessHistory.push(guess);
  }

  /**
   * 是否还有可以交给玩家的系统提示。
   * @returns {boolean}
   */
  hasUnknownHint() {
    return this.knownRecords.includes(false) || !this.knownInfo || !this.knownSheetType;
  }

  /**
   * 检查指定索引的成绩记录是否已知。
   * @param {number[]} target 
   */
  checkRecordTarget(target) {
    for (let i = 0; i < target.length; i++) {
      if (this.knownRecords[target[i]]) {
        return true;
      }
    }
    return false;
  }

  /**
   * 翻开指定索引的成绩记录。
   * @param {number[]} [target] 已校验过的索引数组，若未指定则随机翻开若干条未知记录。
   */
  hintRecord(target = []) {
    if (!target.length) {
      const num = fCompute.randFromArray([[2, 50], [1, 10], [3, 10]]);
      /**@type {number[]} */
      let unknownIndices = [];
      for (let i = 0; i < this.knownRecords.length; i++) {
        if (!this.knownRecords[i]) {
          unknownIndices.push(i);
        }
      }

      if (unknownIndices.length === 0) {
        logger.error(`[phi-grks][hintRecord] ${this.knownRecords} ${this.answer?.record}`);
        throw new Error(grksClassWords.hintRecord.noUnKnown);
      }

      unknownIndices = fCompute.randArray(unknownIndices);
      target = unknownIndices.slice(0, Math.min(num, unknownIndices.length));
    }

    for (let i = 0; i < target.length; i++) {
      this.knownRecords[target[i]] = true;
    }
  }

  /**
   * 获取当前已对玩家公开的题目数据。
   * @returns {grksKnownData}
   */
  getKnownData() {
    if (!this.answer) {
      throw new Error(grksClassWords.getKnownData.noAnswer);
    }
    const answer = this.answer;
    const record = answer.record
    /** @type {grksKnownData} */
    const data = {
      /**@type {(LevelRecordInfo | null)[]} */
      records: [],
      info: this.knownInfo ? {
        stats: answer.stats,
        challenge: answer.challenge,
        updateAt: answer.updateAt
      } : null,
      sheet: {
        range: this.knownSheetType === 'range' ? [Math.max(record[2].rks, record[3].rks), record[29].rks] : null,
        histogram: this.knownSheetType === 'histogram' ? record.map(r => r.rks) : null
      },
    }
    if (this.knownOrder) {
      for (let i = 0; i < record.length; i++) {
        if (this.knownRecords[i]) {
          data.records[i] = record[i];
        } else {
          data.records[i] = null;
        }
      }
    } else {
      data.records = record.filter((_, index) => this.knownRecords[index])
    }
    return data;
  }

}
