import Config from '../components/Config.js'
import getInfo from "../model/getInfo.js";
import send from "../model/send.js";
import picmodle from '../model/picmodle.js'
import getBanGroup from '../model/getBanGroup.js';
import phiPluginBase from '../components/baseClass.js';
import makeRequest from '../model/makeRequest.js';
import logger from '../components/Logger.js';
import makeRequestFnc from '../model/makeRequestFnc.js';
import getSave from '../model/getSave.js';
import { APII18NCN } from '../model/constNum.js'
import { canUseApi, getApiAccessState } from '../model/apiPermission.js'
import platform from '../components/platform/index.js'

/** @import {botEvent} from '../components/baseClass.js' */
/** @import {ChartTagSongRankResponse, ChartTagTreeNode, chartsTagResponseData, chartsTagVoteCountMap} from '../model/makeRequest.js' */

/**
 * @typedef {object} ChartCommandOptions
 * @property {levelKind} rank 谱面难度
 */

/**
 * @typedef {ChartCommandOptions & {
 *   selectedTags: chartsTagString[],
 *   sessionToken: phigrosToken
 * }} SetChartTagOptions
 */

/**
 * @typedef {object} SetTagCategorySelection
 * @property {ChartTagTreeNode} category 分类标签
 * @property {number} index 分类序号
 * @property {string} marker 用户输入中命中的分类标记
 */

/**
 * @typedef {object} SetTagChildSelection
 * @property {ChartTagTreeNode} tag 细分标签
 * @property {number} index 细分标签序号
 * @property {string} marker 用户输入中命中的细分标记
 */

/**
 * @typedef {object} SetTagWaitState
 * @property {idString} id 曲目 ID
 * @property {levelKind} rank 难度
 * @property {phigrosToken} sessionToken 用户 Session Token
 * @property {ChartTagTreeNode[]} [tagTree] 标签树
 * @property {ChartTagTreeNode} [category] 已选分类
 */

/**
 * @typedef {object} ChartTagWord
 * @property {chartsTagString} name 标签名
 * @property {number} value 有效票数
 */

/**
 * @typedef {ChartTagWord & {
 *   children: ChartTagTreeNode[]
 * }} ChartTagCategoryWord
 */

/**
 * @typedef {object} ChartRenderInfo
 * @property {string} illustration 曲绘
 * @property {string} song 曲名
 * @property {string} length 曲目时长
 * @property {levelKind} rank 难度
 * @property {number} difficulty 定数
 * @property {string} charter 谱师
 * @property {number | undefined} tap Tap 数
 * @property {number | undefined} drag Drag 数
 * @property {number | undefined} hold Hold 数
 * @property {number | undefined} flick Flick 数
 * @property {number | undefined} combo Combo 数
 * @property {[number, number, number, number, number][] | undefined} distribution 物量分布
 * @property {string} tip 提示文本
 * @property {string} chartLength 谱面时长
 * @property {ChartTagWord[]} words 谱面标签词云数据
 * @property {number} wordsMaxValue 谱面标签最大有效票数
 */

/**
 * @typedef {phiPluginBase & {
 *   setContext: (name: string, isGroup?: boolean, timeout?: number, timeoutMsg?: string) => unknown,
 *   finish: (name: string, isGroup?: boolean) => unknown
 * }} PhiChartContextHost
 */

/** @type {Record<string, SetTagWaitState>} */
const wait_to_settag = {}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * @param {string} text
 * @param {string} token
 * @returns {boolean}
 */
function hasStandaloneToken(text, token) {
  return new RegExp(`(^|\\s)${escapeRegExp(token)}(?=\\s|$)`).test(text)
}

/**
 * @param {string} text
 * @param {string} token
 * @returns {RegExpMatchArray | null}
 */
function findStandaloneToken(text, token) {
  return text.match(new RegExp(`(^|\\s)(${escapeRegExp(token)})(?=\\s|$)`))
}

/**
 * @param {string} text
 * @param {string} token
 * @returns {string}
 */
function removeStandaloneToken(text, token) {
  return text.replace(new RegExp(`(^|\\s)${escapeRegExp(token)}(?=\\s|$)`), ' ')
}

/**
 * @param {string} text
 * @param {ChartTagTreeNode[]} tagTree
 * @returns {SetTagCategorySelection | null}
 */
function findCategorySelection(text, tagTree) {
  for (let index = 0; index < tagTree.length; index++) {
    const category = tagTree[index]
    if (hasStandaloneToken(text, category.name)) {
      return { category, index, marker: category.name }
    }
  }

  const tokens = text.trim().split(/\s+/).filter(Boolean)
  for (const token of tokens) {
    if (!/^\d+$/.test(token)) continue
    const index = Number(token) - 1
    if (tagTree[index]) {
      return { category: tagTree[index], index, marker: token }
    }
  }

  return null
}

/**
 * @param {string} text
 * @param {string} marker
 * @returns {string}
 */
function getTextAfterMarker(text, marker) {
  const match = findStandaloneToken(text, marker)
  if (!match || match.index === undefined) return ''
  return text.slice(match.index + match[0].length)
}

/**
 * @param {string} text
 * @param {ChartTagTreeNode} category
 * @returns {SetTagChildSelection[]}
 */
function findChildSelections(text, category) {
  /** @type {SetTagChildSelection[]} */
  const selected = []
  /** @type {Set<chartsTagString>} */
  const seen = new Set()
  const children = category.children || []

  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    if (hasStandaloneToken(text, child.name)) {
      selected.push({ tag: child, index, marker: child.name })
      seen.add(child.name)
    }
  }

  const tokens = text.trim().split(/\s+/).filter(Boolean)
  for (const token of tokens) {
    if (!/^\d+$/.test(token)) continue
    const index = Number(token) - 1
    const child = children[index]
    if (child && !seen.has(child.name)) {
      selected.push({ tag: child, index, marker: token })
      seen.add(child.name)
    }
  }

  return selected
}

/**
 * @param {string} message
 * @param {SetTagCategorySelection} categorySelection
 * @param {SetTagChildSelection[]} childSelections
 * @returns {string}
 */
function removeSelectedTagTokens(message, categorySelection, childSelections) {
  let cleaned = message
  cleaned = removeStandaloneToken(cleaned, categorySelection.marker)
  if (categorySelection.marker !== categorySelection.category.name) {
    cleaned = removeStandaloneToken(cleaned, categorySelection.category.name)
  }

  for (const childSelection of childSelections) {
    cleaned = removeStandaloneToken(cleaned, childSelection.marker)
    if (childSelection.marker !== childSelection.tag.name) {
      cleaned = removeStandaloneToken(cleaned, childSelection.tag.name)
    }
  }

  return cleaned.replace(/\s+/g, ' ').trim()
}

/**
 * @param {ChartTagTreeNode[]} tagTree
 * @returns {string}
 */
function formatTagCategoryMenu(tagTree) {
  return [
    '请选择标签分类：',
    ...tagTree.map((category, index) => `-${index + 1}. ${category.name}${category.description ? `：${category.description}` : ''}`),
    '示例：/settag <曲名> <难度> 读谱',
  ].join('\n')
}

/**
 * @param {ChartTagTreeNode} category
 * @returns {string}
 */
function formatTagChildMenu(category) {
  return [
    `请选择「${category.name}」下的细分标签：`,
    ...(category.children || []).map((tag, index) => `-${index + 1}. ${tag.name}${tag.description ? `：${tag.description}` : ''}`),
    `示例：/settag <曲名> <难度> ${category.name} 1`,
  ].join('\n')
}

/**
 * @param {ChartTagTreeNode[]} tagTree
 * @returns {{words: ChartTagWord[], wordsMaxValue: number}}
 */
function makeCategoryWords(tagTree) {
  /** @type {ChartTagWord[]} */
  const words = []
  let wordsMaxValue = 0

  for (const category of tagTree || []) {
    const value = Number(category.voteCount || 0)
    words.push({ name: category.name, value })
    wordsMaxValue = Math.max(wordsMaxValue, value)
  }

  return { words, wordsMaxValue: Math.max(wordsMaxValue, 1) }
}

/**
 * @param {phiPluginBase} host
 * @param {string} name
 * @param {boolean} isGroup
 * @param {number} timeout
 * @param {string} timeoutMsg
 */
function setContext(host, name, isGroup, timeout, timeoutMsg) {
  return /** @type {PhiChartContextHost} */ (host).setContext(name, isGroup, timeout, timeoutMsg)
}

/**
 * @param {phiPluginBase} host
 * @param {string} name
 * @param {boolean} isGroup
 */
function finishContext(host, name, isGroup) {
  return /** @type {PhiChartContextHost} */ (host).finish(name, isGroup)
}

export class phihelp extends phiPluginBase {
  constructor() {
    super({
      name: 'phi-chart',
      dsc: 'phigros谱面图片生成',
      event: 'message',
      priority: 1000,
      rule: [
        {
          reg: `^[#/]((${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(chart).*$`,
          fnc: 'chart'
        },
        {
          reg: `^[#/]((${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(tag).*$`,
          fnc: 'tag'
        },
        {
          reg: `^[#/]((${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(settag).*$`,
          fnc: 'settag'
        }
      ]
    })

  }

  /**
   * 生成谱面图片
   * @param {botEvent} e 事件对象
   * @returns {Promise<boolean>}
   */
  async chart(e) {

    if (await getBanGroup.get(e, 'chart')) {
      send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
      return false
    }

    this.getMicInfoFromMsg(e, /[#/](.*?)(chart)(\s*)/, ['rank'], {}, async (e, id, optObj) => {
      await getChartImg(e, id, optObj)
    })

    return true
  }

  /**
   * 查询谱面标签
   * @param {botEvent} e 事件对象
   * @returns {Promise<boolean>}
   */
  async tag(e) {
    if (await getBanGroup.get(e, 'tag')) {
      send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
      return false
    }

    const apiAccess = await getApiAccessState(e)
    if (!apiAccess.enabled) {
      send.send_with_At(e, apiAccess.globalEnabled ? '你已在本地用户设置中禁用 API 功能，可在 /myset 中重新开启。' : '这里没有连接查分平台哦！')
      return false
    }

    this.getMicInfoFromMsg(e, /[#/](.*?)(tag)(\s*)/, ['rank'], {}, async (e, id, optObj) => {
      await getChartTags(e, id, optObj)
    })

    return true
  }

  /**
   * 为谱面标签投票
   * @param {botEvent} e 事件对象
   * @returns {Promise<boolean | undefined>}
   */
  async settag(e) {
    if (await getBanGroup.get(e, 'tag')) {
      send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
      return false
    }

    const apiAccess = await getApiAccessState(e)
    if (!apiAccess.enabled) {
      send.send_with_At(e, apiAccess.globalEnabled ? '你已在本地用户设置中禁用 API 功能，可在 /myset 中重新开启。' : '这里没有连接查分平台哦！')
      return false
    }

    const save = await send.getsave_result(e);

    if (!save) {
      return true;
    }

    const sessionToken = await getSave.get_user_token(e.user_id);
    if (!sessionToken) {
      send.send_with_At(e, '权限不足，请尝试扫码登录或使用sessionToken进行绑定哦~', true);
      return false;
    }

    const msg = e.msg.replace(/[#/](.*?)(settag)(\s*)/, '');

    /** @type {ChartTagTreeNode[] | null} */
    const tagTree = await makeRequestFnc.requestApi(
      e,
      () => makeRequest.getChartsTagsTree(),
      { errorPrefix: '获取标签列表失败', notifyUser: true, logTag: 'getChartsTagsTree', loggerLevel: 'warn' }
    );
    if (!tagTree) {
      return true;
    }

    const categorySelection = findCategorySelection(msg, tagTree)
    if (!categorySelection) {
      this.getMicInfoFromMsg(e, /[#/](.*?)(settag)(\s*)/, ['rank'], { sessionToken, tagTree }, async (e, id, optObj) => {
        wait_to_settag[e.user_id] = { id, rank: optObj.rank, sessionToken, tagTree }
        send.send_with_At(e, formatTagCategoryMenu(tagTree), true);
        setContext(this, 'settagCategory', false, Config.getUserCfg('config', 'mutiNickWaitTimeOut'), '操作超时已取消，请重新使用 /settag。')
      })
      return true;
    }

    const childText = getTextAfterMarker(msg, categorySelection.marker)
    const childSelections = findChildSelections(childText, categorySelection.category)
    if (!childSelections.length) {
      const cleanEvent = platform.cloneEvent(e, { msg: removeSelectedTagTokens(e.msg, categorySelection, []) })
      this.getMicInfoFromMsg(cleanEvent, /[#/](.*?)(settag)(\s*)/, ['rank'], { sessionToken }, async (e, id, optObj) => {
        wait_to_settag[e.user_id] = { id, rank: optObj.rank, sessionToken, category: categorySelection.category }
        send.send_with_At(e, formatTagChildMenu(categorySelection.category), true);
        setContext(this, 'settagChild', false, Config.getUserCfg('config', 'mutiNickWaitTimeOut'), '操作超时已取消，请重新使用 /settag。')
      })
      return true;
    }

    /** @type {chartsTagString[]} */
    const selectedTags = childSelections.map(selection => /** @type {chartsTagString} */ (selection.tag.name));
    const cleanEvent = platform.cloneEvent(e, { msg: removeSelectedTagTokens(e.msg, categorySelection, childSelections) })

    this.getMicInfoFromMsg(cleanEvent, /[#/](.*?)(settag)(\s*)/, ['rank'], { selectedTags, sessionToken }, async (e, id, optObj) => {
      await setChartTags(e, id, optObj)
    })
  }

  /**
   * 处理二级菜单中的分类选择
   * @returns {Promise<boolean>}
   */
  async settagCategory() {
    const state = wait_to_settag[this.e.user_id]
    if (!state) {
      finishContext(this, 'settagCategory', false)
      return true
    }

    const categorySelection = findCategorySelection(this.e.msg, state.tagTree ?? [])
    if (!categorySelection) {
      send.send_with_At(this.e, formatTagCategoryMenu(state.tagTree ?? []), true)
      return false
    }

    state.category = categorySelection.category
    send.send_with_At(this.e, formatTagChildMenu(categorySelection.category), true)
    finishContext(this, 'settagCategory', false)
    setContext(this, 'settagChild', false, Config.getUserCfg('config', 'mutiNickWaitTimeOut'), '操作超时已取消，请重新使用 /settag。')
    return true
  }

  /**
   * 处理二级菜单中的细分标签选择
   * @returns {Promise<boolean>}
   */
  async settagChild() {
    const state = wait_to_settag[this.e.user_id]
    if (!state?.category) {
      delete wait_to_settag[this.e.user_id]
      finishContext(this, 'settagChild', false)
      return true
    }

    const childSelections = findChildSelections(this.e.msg, state.category)
    if (!childSelections.length) {
      send.send_with_At(this.e, formatTagChildMenu(state.category), true)
      return false
    }

    /** @type {chartsTagString[]} */
    const selectedTags = childSelections.map(selection => /** @type {chartsTagString} */ (selection.tag.name))
    delete wait_to_settag[this.e.user_id]
    finishContext(this, 'settagChild', false)
    await setChartTags(this.e, state.id, { rank: state.rank, selectedTags, sessionToken: state.sessionToken })
    return true
  }
}


/**
 * @param {botEvent} e
 * @param {idString} id
 * @param {ChartCommandOptions} options
 * @returns {Promise<void>}
 */
async function getChartImg(e, id, options) {
  const { rank } = options
  const info = getInfo.info(id, true)
  if (!info || !info.chart[rank]) {
    return;
  }

  const chart = info.chart[rank]

  // let allowChartTag = await Config.getUserCfg('config', 'allowChartTag')

  /** @type {ChartTagWord[]} */
  const words = []
  let wordsMaxValue = 0

  if (await canUseApi(e)) {
    /** @type {ChartTagSongRankResponse | null} */
    const apiChartTag = await makeRequestFnc.requestApi(
      e,
      () => makeRequest.getChartsTagbySongRankWithTree({ song_id: info.id, rank }),
      { logTag: 'getChartsTagbySongRank', loggerLevel: 'warn' }
    )
    if (apiChartTag) {
      const categoryWords = makeCategoryWords(apiChartTag.tree)
      words.push(...categoryWords.words)
      wordsMaxValue = categoryWords.wordsMaxValue
    }
  }

  /** @type {ChartRenderInfo} */
  const chartInfo = {
    illustration: info.illustration,
    song: info.song,
    length: info.length,
    rank: rank,
    difficulty: chart.difficulty,
    charter: chart.charter,
    tap: chart.tap,
    drag: chart.drag,
    hold: chart.hold,
    flick: chart.flick,
    combo: chart.combo,
    distribution: chart.distribution,
    tip: '',
    chartLength: `${Math.floor((chart.maxTime || 0) / 60)}:${Math.floor((chart.maxTime || 0) % 60).toString().padStart(2, '0')}`,
    words,
    wordsMaxValue
  }

  const img = await picmodle.common(e, 'chartImg', {
    ...chartInfo,
    chartImg: getInfo.getChartImg(info.id, rank),
  });

  await send.send_with_At(e, [img, `${info.song} - ${rank}\n谱师：${info.chart[rank].charter}`])
  return;
}

/**
 * @param {botEvent} e
 * @param {idString} id
 * @param {ChartCommandOptions} options
 * @returns {Promise<void>}
 */
async function getChartTags(e, id, options) {
  const { rank } = options
  const info = getInfo.info(id, true)
  if (!info || !info.chart[rank]) {
    return;
  }

  const chart = info.chart[rank]

  // let allowChartTag = await Config.getUserCfg('config', 'allowChartTag')

  /** @type {ChartTagCategoryWord[]} */
  const words = []
  let wordsMaxValue = 0

  /** @type {ChartTagSongRankResponse | null} */
  const apiChartTag = await makeRequestFnc.requestApi(
    e,
    () => makeRequest.getChartsTagbySongRankWithTree({ song_id: info.id, rank }),
    { errorPrefix: '获取谱面标签失败', notifyUser: true, logTag: 'getChartsTagbySongRank', loggerLevel: 'warn' }
  )
  if (!apiChartTag) {
    return
  }
  /** @type {chartsTagResponseData[] | null} */
  let usersVote = null;
  usersVote = await makeRequestFnc.requestApi(
    e,
    () => makeRequest.getChartsUsersVote({ ...makeRequestFnc.makePlatform(e), data: [{ song_id: info.id, rank: [rank] }] }),
    {
      logTag: 'getChartsUsersVote',
      loggerLevel: 'error',
      ignoreMessages: [APII18NCN.userNotFound]
    }
  )
  if (!usersVote) {
    usersVote = []
  }
  for (const category of apiChartTag.tree || []) {
    words.push({ name: category.name, value: category.voteCount, children: category.children || [] })
    wordsMaxValue = Math.max(wordsMaxValue, category.voteCount)
  }

  /** @type {string[]} */
  const resMsg = [];
  resMsg.push(`${info.song}`);
  resMsg.push(`by ${info.composer}`);
  resMsg.push(`${rank} - ${chart.difficulty}`);
  resMsg.push(`谱师：${chart.charter}`);
  resMsg.push(`标签：`);
  words.forEach((category, index) => {
    resMsg.push(`-${index + 1}. ${category.name}：${category.value}`);
    category.children.forEach((tag, childIndex) => {
      const voted = usersVote?.[0]?.tags?.includes(tag.name) ?? false
      resMsg.push(`  ${index + 1}.${childIndex + 1} ${tag.name}：${tag.voteCount} ${voted ? '(✓)' : ''}`);
    })
  });

  await send.send_with_At(e, resMsg.join('\n'));
}

/**
 * @param {botEvent} e
 * @param {idString} id
 * @param {SetChartTagOptions} options
 * @returns {Promise<void>}
 */
async function setChartTags(e, id, options) {
  const { rank, selectedTags, sessionToken } = options;
  const info = getInfo.info(id, true)
  if (!info || !info.chart[rank]) {
    return;
  }

  const setResult = await makeRequestFnc.requestApi(
    e,
    () => makeRequest.setChartsTag({ ...makeRequestFnc.makePlatform(e), token: sessionToken, song_id: id, rank, content: selectedTags }),
    { errorPrefix: '投票失败QAQ！ERROR', notifyUser: true, logTag: 'setChartsTag', loggerLevel: 'error' }
  )
  if (!setResult) {
    return
  }

  getChartTags(e, id, { rank });
}
