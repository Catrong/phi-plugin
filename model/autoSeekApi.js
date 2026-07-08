import chalk from "chalk"
import logger from "../components/Logger.js"
import { APIBASEURL } from "./constNum.js"
import https from 'node:https';
import axios from "axios";
import { Config } from "../components/index.js";



export default new class AutoSeekApi {

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
        logger.error(res)
        logger.mark(chalk.red('API地址测试失败！已自动关闭API功能'))
        this.openPhiPluginApi = false
        this.seekApi()
      } else {
        const resdata = res.data
        logger.mark(chalk.green(`API地址测试成功！${resdata.id} ${resdata.version}`))
        this.openPhiPluginApi = true
        this.seekingApi = false
      }
    } catch (e) {
      // @ts-ignore
      logger.error(e.cause)
      logger.mark(chalk.red('API地址测试失败！已自动关闭API功能'))
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
}();