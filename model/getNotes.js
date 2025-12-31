import readFile from './getFile.js'
import path from 'path'
import { pluginDataPath, savePath } from './path.js'
import getSave from './getSave.js'
import fs from 'fs'

/**
 * @typedef {object} taskObj 任务对象
 * @property {idString} song 歌曲ID
 * @property {number} reward 奖励 notes 数量
 * @property {boolean} finished 任务是否完成
 * @property {object} request 任务要求
 * @property {string} request.type 任务类型 acc / score
 * @property {levelKind} request.rank 难度
 * @property {number} request.value 任务要求数值
 */

/**
 * @typedef {object} pluginData 娱乐数据
 * @property {number} money notes 
 * @property {string} sign_in 签到时间
 * @property {string} task_time 任务刷新时间
 * @property {taskObj[]} task 任务列表
 * @property {string} theme 主题
 */
export default class getNotes {

    /**
     * 获取并初始化用户数据
     * @param {string} user_id 
     * @returns {Promise<pluginData>} 娱乐数据
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
        return data
    }

    /**
     * 获取并初始化用户数据
     * @param {string} user_id 
     * @param {pluginData} data 
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
