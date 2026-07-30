import chalk from "chalk"
import logger from "../components/Logger.js"
import { APIBASEURL } from "./constNum.js"
import https from 'node:https';
import axios from "axios";
import { Config } from "../components/index.js";
import Version from "../components/Version.js";
import botApiAuth, { classifyApiConnectionError, getPhiApiUserMessage, isFatalBotIdentityError } from "./botApiAuth.js";



export class AutoSeekApi {

  constructor() {
    //是否在等待API状态测试结果
    this.waitApi = false;
    //是否在轮询检测API状态
    this.seekingApi = false;

    this.openPhiPluginApi = false;
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
        const resdata = res.data
        logger.mark(chalk.green(`API地址测试成功！${resdata.id} ${resdata.version}`))
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
