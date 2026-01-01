import Config from '../components/Config.js'
import getInfo from "../model/getInfo.js";
import send from "../model/send.js";
import picmodle from '../model/picmodle.js'
import getBanGroup from '../model/getBanGroup.js';
import phiPluginBase from '../components/baseClass.js';
import makeRequest from '../model/makeRequest.js';
import logger from '../components/Logger.js';
import makeRequestFnc from '../model/makeRequestFnc.js';
import fCompute from '../model/fCompute.js';
import getSave from '../model/getSave.js';
import { APII18NCN } from '../model/constNum.js'


/**@import {botEvent} from '../components/baseClass.js' */
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
   * 
   * @param {botEvent} e 事件对象
   * @returns 
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
   * 
   * @param {botEvent} e 
   * @returns 
   */
  async tag(e) {
    if (await getBanGroup.get(e, 'tag')) {
      send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
      return false
    }

    if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
      send.send_with_At(e, '这里没有连接查分平台哦！')
      return false
    }

    this.getMicInfoFromMsg(e, /[#/](.*?)(tag)(\s*)/, ['rank'], {}, async (e, id, optObj) => {
      await getChartTags(e, id, optObj)
    })

    return true
  }

  /**
   * 
   * @param {botEvent} e
   */
  async settag(e) {
    if (await getBanGroup.get(e, 'tag')) {
      send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
      return false
    }

    if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
      send.send_with_At(e, '这里没有连接查分平台哦！')
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

    const chartsTagList = await makeRequest.getChartsTagsName();
    /**@type {chartsTagString[]} */
    const selectedTags = [];
    chartsTagList.forEach((tag, index) => {
      if (msg.match(new RegExp(`\\s(${tag}|${index + 1})(\\s|$)`))) {
        selectedTags.push(tag);
      }
    })

    if (!selectedTags.length) {
      send.send_with_At(e, `请在命令后添加要投票的标签哦！可选标签有：\n${chartsTagList.map((tag, index) => `-${index + 1}. ${tag}`).join('\n')}\n可以使用序号，每个标签之间请用空格分隔哦~`, true);
      return true;
    }

    this.getMicInfoFromMsg(e, new RegExp(`([#/](.*?)(settag)(\\s*)|${chartsTagList.join('|')})`, 'g'), ['rank'], { selectedTags, sessionToken }, async (e, id, optObj) => {
      await setChartTags(e, id, optObj)
    })
  }
}


/**
 * @param {botEvent} e
 * @param {idString} id 
 * @param {object} options
 * @param {levelKind} options.rank
 * @returns 
 */
async function getChartImg(e, id, options) {
  const { rank } = options
  let info = getInfo.info(id, true)
  if (!info || !info.chart[rank]) {
    return;
  }

  let chart = info.chart[rank]

  // let allowChartTag = await Config.getUserCfg('config', 'allowChartTag')

  /**@type {{name: string, value: any}[]} */
  const words = []
  let wordsMaxValue = 0

  if (Config.getUserCfg('config', 'openPhiPluginApi')) {
    const apiChartTag = await makeRequest.getChartsTagbySongRank({ song_id: info.id, rank })
    for (const tag of fCompute.objectKeys(apiChartTag)) {
      words.push({ name: tag, value: apiChartTag[tag] })
      wordsMaxValue = Math.max(wordsMaxValue, apiChartTag[tag])
    }
  }

  let chartInfo = {
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
 * @param {object} options
 * @param {levelKind} options.rank
 * @returns 
 */
async function getChartTags(e, id, options) {
  const { rank } = options
  let info = getInfo.info(id, true)
  if (!info || !info.chart[rank]) {
    return;
  }

  let chart = info.chart[rank]

  // let allowChartTag = await Config.getUserCfg('config', 'allowChartTag')

  /**@type {{name: string, value: any, vis: boolean}[]} */
  const words = []
  let wordsMaxValue = 0

  const apiChartTag = await makeRequest.getChartsTagbySongRank({ song_id: info.id, rank })
  let usersVote;
  try {
    usersVote = await makeRequest.getChartsUsersVote({ ...makeRequestFnc.makePlatform(e), data: [{ song_id: info.id, rank: [rank] }] })

  } catch (/**@type {any}*/ err) {
    if (err.message != APII18NCN.userNotFound) {
      logger.error(`获取用户投票信息失败，ERROR:\n${err.message}`);
    }
  }
  for (const tag of fCompute.objectKeys(apiChartTag)) {
    words.push({ name: tag, value: apiChartTag[tag], vis: usersVote?.[0]?.tags?.includes(tag) ?? false })
    wordsMaxValue = Math.max(wordsMaxValue, apiChartTag[tag])
  }

  const resMsg = [];
  resMsg.push(`${info.song}`);
  resMsg.push(`by ${info.composer}`);
  resMsg.push(`${rank} - ${chart.difficulty}`);
  resMsg.push(`谱师：${chart.charter}`);
  resMsg.push(`标签：`);
  words.forEach((tag, index) => {
    resMsg.push(`-${index + 1}. ${tag.name}：${tag.value} ${tag.vis ? '(✓)' : ''}`);
  });

  await send.send_with_At(e, resMsg.join('\n'));
}

/**
 * @param {botEvent} e
 * @param {idString} id 
 * @param {object} options
 * @param {levelKind} options.rank
 * @param {chartsTagString[]} options.selectedTags
 * @param {phigrosToken} options.sessionToken
 * @returns 
 */
async function setChartTags(e, id, options) {
  const { rank, selectedTags, sessionToken } = options;
  let info = getInfo.info(id, true)
  if (!info || !info.chart[rank]) {
    return;
  }

  try {
    await makeRequest.setChartsTag({ ...makeRequestFnc.makePlatform(e), token: sessionToken, song_id: id, rank, content: selectedTags });
  } catch (/**@type {any}*/ err) {
    send.send_with_At(e, `投票失败QAQ！ERROR:\n${err.message}`);
    logger.error(`投票失败，token：${sessionToken}\nERROR:\n${err.message} `);
  }

  getChartTags(e, id, { rank });
}