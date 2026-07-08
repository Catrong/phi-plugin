import Config from './Config.js'
import send from "../model/send.js";
import fCompute from '../model/fCompute.js'
import getInfo from '../model/getInfo.js';
import logger from './Logger.js';
import platform from './platform/index.js';

/** @import {PlatformEvent, PlatformMessageInput, PlatformPluginConfig, PlatformUserId} from './platform/types.js' */

const HostPlugin = platform.PluginBase
const wrappedHandlerSymbol = Symbol('phi.wrappedHandler')


/**
 * @typedef {object} botEventObj
 * @property {string} msg 消息内容
 * @property {PlatformUserId} user_id 发送者ID
 * @property {boolean} isGroup 是否群消息
 * @property {boolean} isPrivate 是否私聊消息 
 */

/**
 * @typedef {object} botEventGroup
 * @property {true} isGroup 是否群消息
 * @property {PlatformUserId} group_id 群ID
 */

/**
 * @typedef {object} botEventPrivate
 * @property {true} isPrivate 是否私聊消息
 */

/**@typedef {PlatformEvent & botEventObj & (botEventGroup | botEventPrivate) & Object.<string, any>} botEvent */

/** 
 * @template {any} T
 * @typedef {Object} waitToChoseSong
 * @property {idString[]} ids 待选择的曲目列表
 * @property {T} options 其他选项
 * @property {mutiNickCallback<T>} callback 选择后的回调函数
 **/

/** @type {Record<string, waitToChoseSong<any>>} */
const wait_to_chose_song = {}

/**
 * @template {any} T
 * @typedef {(e: botEvent, id: idString, options: T) => void} mutiNickCallback
 **/

/**
 * @typedef {object} getMicInfoFromMsgOptionsMap
 * @property {levelKind} rank 难度
 */


export default class phiPluginBase extends HostPlugin {
  /** @type {botEvent} */
  e


  /**
   * @param {PlatformPluginConfig} config 配置项
   */
  constructor({
    name = "your-plugin",
    dsc = "无",
    handler,
    namespace,
    event = "message",
    priority = 5000,
    task = undefined,
    rule = []
  }) {
    super({
      name, dsc, handler, namespace, event, priority, task,
      // @ts-ignore
      rule
    });

    /** @type {botEvent} */
    this.e = platform.wrapEvent({ msg: '', user_id: '', isGroup: false, isPrivate: true }) // 占位用;
    this.wrapPlatformHandlers()

  }

  /** @returns {void} */
  wrapPlatformHandlers() {
    for (const item of this.rule || []) {
      if (item?.fnc) this.wrapPlatformHandler(item.fnc)
    }
  }

  /**
   * @param {string} key
   * @returns {void}
   */
  wrapPlatformHandler(key) {
    const fn = this[key]
    if (typeof fn !== 'function') return
    const typedFn = /** @type {Function & Record<symbol, unknown>} */ (fn)
    if (typedFn[wrappedHandlerSymbol]) return
    const wrapped = (/** @type {any[]} */ ...args) => {
      if (args[0] && typeof args[0] === 'object') {
        args[0] = this.wrapPlatformEvent(args[0])
      } else if (this.e) {
        this.e = this.wrapPlatformEvent(this.e)
      }
      return typedFn.apply(this, args)
    }
    wrapped[wrappedHandlerSymbol] = true
    this[key] = wrapped
  }

  /**
   * @param {botEvent} e
   * @returns {botEvent}
   */
  wrapPlatformEvent(e) {
    this.e = platform.wrapEvent(e)
    return this.e
  }

  /**
   * @param {PlatformMessageInput} [msg]
   * @param {boolean} [quote]
   * @param {Record<string, unknown>} [data]
   */
  reply(msg = '', quote = false, data = {}) {
    return platform.reply(this.e, msg, { quote, ...data })
  }

  /**
   * @param {...any} args
   */
  setContext(...args) {
    if (this.e) this.e = platform.wrapEvent(this.e)
    if (typeof args[0] === 'string') this.wrapPlatformHandler(args[0])
    return super.setContext?.(...args)
  }

  /**
   * @param {...any} args
   */
  finish(...args) {
    return super.finish?.(...args)
  }

  /**
   * @template {object} T
   * @param {botEvent} e 事件对象
   * @param {idString[]} idList 
   * @param {T} options 
   * @param {mutiNickCallback<T>} callback 
   */
  choseMutiNick(e, idList, options, callback) {
    e = this.wrapPlatformEvent(e)
    if (idList.length === 0) {
      send.send_with_At(e, `未找到相关曲目信息QAQ！如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！`, true)
      return;
    }
    if (idList.length === 1) {
      callback(e, idList[0], options);
      return;
    }
    send.send_with_At(e, fCompute.mutiNick(idList));
    wait_to_chose_song[e.user_id] = {
      ids: idList,
      options,
      callback
    };
    this.setContext('mutiNick', false, Config.getUserCfg('config', 'mutiNickWaitTimeOut'), '操作超时已取消，请注意@BOT进行回复呐！')

  }

  async mutiNick() {
    this.e = this.wrapPlatformEvent(this.e)
    const { msg } = this.e;
    const num = Number(msg.match(/([0-9]+)/)?.[0]);
    const ids = wait_to_chose_song[this.e.user_id]?.ids || [];
    if (!num) {
      send.send_with_At(this.e, `请输入正确的序号哦！`);
    } else if (!ids[num - 1]) {
      send.send_with_At(this.e, `未找到${num}所对应的曲目哦！`);
    } else {
      wait_to_chose_song[this.e.user_id]?.callback(this.e, ids[num - 1], wait_to_chose_song[this.e.user_id]?.options);
      delete wait_to_chose_song[this.e.user_id];
      this.finish('mutiNick', false)
      return true;
    }
  }

  /**
   * 提取消息中的曲目与其他信息
   * @template {keyof getMicInfoFromMsgOptionsMap} T
   * @template {object} T2
   * @param {botEvent} e 事件对象
   * @param {RegExp} fncName 要去掉的命令前缀
   * @param {T[]} params 需要解析的键集合
   * @param {T2} options 其他选项
   * @param {(e: botEvent, id: idString, params: Pick<getMicInfoFromMsgOptionsMap, T> & T2) => void} callback 仅包含声明过的键
   */
  async getMicInfoFromMsg(e, fncName, params = [], options, callback) {
    let msg = e.msg.replace(fncName, '');
    /** @type {Pick<getMicInfoFromMsgOptionsMap, T>} */
    const optObj = /** @type {Pick<getMicInfoFromMsgOptionsMap, T>} */ ({});
    for (let opt of params) {
      switch (opt) {
        case 'rank': {
          let rank = /** @type {levelKind} */((msg.match(/\b(EZ|HD|IN|AT)\b/i)?.[1] || 'IN').toUpperCase())
          optObj[opt] = rank;
          msg = msg.replace(/\b(EZ|HD|IN|AT)\b/i, '')
          break;
        }
      }
    }

    if (!msg) {
      send.send_with_At(e, `请在命令后添加曲目名称或别名哦~`, true);
      return;
    }

    let ids = getInfo.fuzzysongsnick(msg, undefined, true)
    if (!ids.length) {
      send.send_with_At(e, `未找到${msg}的相关曲目信息QAQ！如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！`, true)
      return;
    }

    if (ids.length > 1) {
      this.choseMutiNick(e, ids, { ...optObj, ...options }, (e, id, optObj) => {

        let info = getInfo.info(id, true)
        if (!info) {
          send.send_with_At(e, `未找到${id}的曲目信息QAQ！请回报管理员！`, true)
          logger.error(`phi-plugin错误：未找到曲目ID为${id}的曲目信息！`)
          return;
        }
        if ('rank' in optObj) {
          const { rank } = optObj
          if (!info.chart[/** @type {levelKind} */(rank)]) {
            send.send_with_At(e, `${info.song} 没有 ${rank} 这个难度QAQ！`)
            return;
          }
        }

        callback(e, id, optObj)
      })
    } else {
      const id = ids[0];
      let info = getInfo.info(id, true)
      if (!info) {
        send.send_with_At(e, `未找到${id}的曲目信息QAQ！请回报管理员！`, true)
        logger.error(`phi-plugin错误：未找到曲目ID为${id}的曲目信息！`)
        return;
      }
      if ('rank' in optObj) {
        const { rank } = optObj
        if (!info.chart[/** @type {levelKind} */(rank)]) {
          send.send_with_At(e, `${info.song} 没有 ${rank} 这个难度QAQ！`)
          return;
        }
      }
      callback(e, id, { ...optObj, ...options })
    }
  }

}
