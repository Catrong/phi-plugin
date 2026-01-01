import plugin from '../../../lib/plugins/plugin.js'
import Config from './Config.js'
import send from "../model/send.js";
import fCompute from '../model/fCompute.js'
import getInfo from '../model/getInfo.js';
import logger from './Logger.js';

/**@typedef {{msg: string} & Object.<string, any>} botEvent */

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


export default class phiPluginBase extends plugin {

  /**
   * @param {object} config 配置项
   * @param {string} [config.name="your-plugin"] 插件名称
   * @param {string} [config.dsc="无"] 插件描述
   * @param {object} [config.handler] handler配置
   * @param {string} [config.handler.key] handler支持的事件key
   * @param {function} [config.handler.fn] handler的处理func
   * @param {string} [config.namespace] namespace，设置handler时建议设置
   * @param {string} [config.event="message"] 执行事件，默认message
   * @param {number} [config.priority=5000] 优先级，数字越小优先级越高
   * @param {object[]} [config.rule=[]] 命令配置
   * @param {string} config.rule[].reg 命令正则
   * @param {string} config.rule[].fnc 命令执行方法
   * @param {string} [config.rule[].event] 执行事件，默认message
   * @param {boolean} [config.rule[].log] false时不显示执行日志
   * @param {string} [config.rule[].permission] 权限 master,owner,admin,all
   * @param {object} [config.task] 定时任务配置
   * @param {string} config.task.name 定时任务名称
   * @param {string} config.task.cron 定时任务cron表达式
   * @param {string} config.task.fnc 定时任务方法名
   * @param {boolean} config.task.log false时不显示执行日志
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
    this.e = { msg: '' } // 占位用;

  }

  /**
   * @template {object} T
   * @param {botEvent} e 事件对象
   * @param {idString[]} idList 
   * @param {T} options 
   * @param {mutiNickCallback<T>} callback 
   */
  choseMutiNick(e, idList, options, callback) {
    send.send_with_At(e, fCompute.mutiNick(idList));
    wait_to_chose_song[e.user_id] = {
      ids: idList,
      options,
      callback
    };
    this.setContext('mutiNick', false, Config.getUserCfg('config', 'mutiNickWaitTimeOut'), '操作超时已取消，请注意@BOT进行回复呐！')

  }

  async mutiNick() {
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
