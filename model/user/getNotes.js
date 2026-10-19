import readFile from '../filesystem/getFile.js'
import path from 'path'
import { pluginDataPath } from '../filesystem/path.js'
import fs from 'fs'
import PluginData from './pluginData.js'
import logger from '../../components/Logger.js'

export default class getNotes {

    /**
     * 获取并初始化用户数据
     * @param {string} user_id
     * @returns {Promise<PluginData>} 娱乐数据
     */
    static async getNotesData(user_id) {
        const filePath = path.join(pluginDataPath, `${user_id}_.json`)
        let data = await readFile.FileReader(filePath)
        if (!data) {
            data = {
                money: 0,
                sign_in: "Wed Apr 03 2024 23:03:52 GMT+0800 (中国标准时间)",
                task_time: "Wed Apr 03 2024 23:03:52 GMT+0800 (中国标准时间)",
                task: [],
                theme: "common"
            }
        }
        if (data.plugin_data) {
            data = data.plugin_data;
        }
        const pluginData = new PluginData(data);
        // 读取时自愈：Note 出现过浮点等脏数据（如旧版转账漏洞写入的 0.896400000000001），
        // PluginData 内已就近取整，此处将规整结果立即回写，避免脏数据长期残留
        if (Number(data.money) !== pluginData.money) {
            logger.info(`[phi-plugin] 用户 ${user_id} 的 Note 存在脏数据（${data.money}），已自愈为 ${pluginData.money}`)
            await readFile.SetFile(filePath, pluginData)
        }
        return pluginData
    }

    /**
     * 获取并初始化用户数据
     * @param {string} user_id 
     * @param {PluginData} data 
     */
    static putNotesData(user_id, data) {
        return readFile.SetFile(path.join(pluginDataPath, `${user_id}_.json`), data)
    }

    /**
     * 删除用户数据
     * @param {string} user_id 
     */
    static delNotesData(user_id) {
        return fs.rmSync(path.join(pluginDataPath, `${user_id}_.json`), { recursive: true, force: true });
    }

}
