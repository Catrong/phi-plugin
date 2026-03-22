import readFile from './getFile.js'
import path from 'path'
import { pluginDataPath, savePath } from './path.js'
import getSave from './getSave.js'
import fs from 'fs'
import PluginData from './class/pluginData.js'

export default class getNotes {

    /**
     * 获取并初始化用户数据
     * @param {string} user_id 
     * @returns {Promise<PluginData>} 娱乐数据
     */
    static async getNotesData(user_id) {
        let data = await readFile.FileReader(path.join(pluginDataPath, `${user_id}_.json`))
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
        return new PluginData(data);
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
