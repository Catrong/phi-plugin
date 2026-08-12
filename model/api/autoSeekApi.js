import chalk from "chalk"
import logger from "../../components/Logger.js"
import { APIBASEURL } from "../game/constNum.js"
import https from 'node:https';
import axios from "axios";
import { Config } from "../../components/index.js";
import Version from "../../components/Version.js";
import botApiAuth from "./botApiAuth.js";
import { classifyApiConnectionError, getPhiApiUserMessage, isFatalBotIdentityError } from "./phiApiErrors.js";
import {
  compareApiVersion,
  isApiVersionBlocked,
  setApiVersionBlocked,
  SUPPORTED_API_VERSION,
} from './apiVersion.js';



export class AutoSeekApi {

  constructor() {
    //是否在等待API状态测试结果
    this.waitApi = false;
    //是否在轮询检测API状态
    this.seekingApi = false;

    this.openPhiPluginApi = false;
    // 主版本不兼容或版本响应无效时阻止所有 API 业务请求。
    this.remoteApiVersion = '';
  }

  /**
   * 判断当前运行周期是否因 API 协议版本不兼容而被关闭。
   * @returns {boolean}
   */
  isVersionBlocked() {
    return isApiVersionBlocked()
  }

  /**
   * 校验状态接口返回的 API 协议版本并更新运行时开关。
   * @param {unknown} version API 返回的版本号
   * @returns {boolean} 是否允许继续初始化 API 客户端
   */
  validateApiVersion(version) {
    const result = compareApiVersion(version)
    this.remoteApiVersion = result.apiVersion

    if (result.status === 'major_mismatch') {
      setApiVersionBlocked(true)
      this.openPhiPluginApi = false
      this.seekingApi = false
      logger.error(
        `[phi-plugin] API大版本不兼容：API ${result.apiVersion}，插件支持 ${result.supportedVersion}。` +
        '已自动关闭 API 功能，请更新 phi-plugin 后重启。'
      )
      return false
    }

    if (result.status === 'invalid') {
      setApiVersionBlocked(true)
      this.openPhiPluginApi = false
      this.seekingApi = false
      logger.error(
        `[phi-plugin] API未返回有效的协议版本，插件支持 ${SUPPORTED_API_VERSION}。` +
        '已自动关闭 API 功能，请更新 phi-plugin 后重启。'
      )
      return false
    }

    setApiVersionBlocked(false)
    if (result.status === 'minor_mismatch') {
      logger.warn(
        `[phi-plugin] API小版本不一致：API ${result.apiVersion}，插件支持 ${result.supportedVersion}。` +
        '当前仍可继续使用，建议尽快更新 phi-plugin。'
      )
    }
    return true
  }

  async testStatus() {
    if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
      this.openPhiPluginApi = false
      this.waitApi = false
      this.seekingApi = false
      return
    }
    if (this.waitApi) {
      return
    }

    this.waitApi = true

    logger.mark(chalk.yellow(`正在测试API链接...`))
    let url = `${APIBASEURL}/status`
    try {
      const agent = new https.Agent({ rejectUnauthorized: false })
      const res = await axios.get(url, { httpsAgent: agent, timeout: 5000 })
      if (res.status != 200) {
        logger.error(`[phi-plugin] API状态接口返回 HTTP ${res.status}`)
        logger.mark(chalk.red(`API状态接口异常（HTTP ${res.status}），插件将在30秒后重试`))
        this.openPhiPluginApi = false
        this.seekApi()
      } else {
        // 当前接口使用 data 包装；保留对早期扁平响应的读取兼容。
        const resdata = res.data?.data ?? res.data
        if (!this.validateApiVersion(resdata?.version)) {
          this.waitApi = false
          return
        }
        logger.mark(chalk.green(`API地址测试成功！${resdata?.id || 'phi-plugin-api'} ${resdata.version}`))
        this.openPhiPluginApi = true
        try {
          const identity = await botApiAuth.recoverAfterReconnect(Version.ver)
          logger.mark(chalk.green(`API Bot身份已就绪：${identity.clientId}`))
          this.seekingApi = false
        } catch (/** @type {any} */ error) {
          logger[isFatalBotIdentityError(error) ? 'error' : 'warn'](
            `[phi-plugin] API已恢复，但Bot身份恢复失败：${error?.code || getPhiApiUserMessage(error)}`
          )
          if (isFatalBotIdentityError(error)) {
            this.seekingApi = false
          } else {
            this.seekApi()
          }
        }
      }
    } catch (e) {
      const error = classifyApiConnectionError(e)
      logger.error(`[phi-plugin] API连接检测失败：${error.code}`)
      logger.mark(chalk.red(`${getPhiApiUserMessage(error)} 插件将在30秒后重试`))
      this.openPhiPluginApi = false
      this.seekApi()
    }
    this.waitApi = false
  }

  async seekApi() {
    if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
      this.openPhiPluginApi = false
      this.waitApi = false
      this.seekingApi = false
      return
    }
    if (isApiVersionBlocked()) {
      this.openPhiPluginApi = false
      this.seekingApi = false
      return
    }
    if (this.seekingApi) {
      return
    }
    this.seekingApi = true
    while (this.seekingApi) {
      await new Promise(resolve => setTimeout(resolve, 1000 * 30));
      await this.testStatus()
    }
  }
}

export default new AutoSeekApi();
