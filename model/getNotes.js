import readFile from './getFile.js'
import path from 'path'
import { pluginDataPath, savePath } from './path.js'
import getSave from './getSave.js'
export default new class getNotes {

    /**
     * 获取QQ号对应的娱乐数据
     * @param {String} user_id 
     * @returns save
     */
    async getPluginData(user_id) {
        let session = await getSave.get_user_token(user_id)
        if (session) {
            return {
                ... await this.getNotesData(user_id),
                ... await getSave.getHistory(user_id)
            }
        } else {
            return null
        }
    }

    /**
     * 保存 user_id 对应的娱乐数据
     * @param {String} user_id user_id
     * @param {Object} data 
     */
    async putPluginData(user_id, data) {
        let session = await getSave.get_user_token(user_id)
        if (data.rks) {
            /**分流 */
            let history = { data: data.data, rks: data.rks, scoreHistory: data.scoreHistory, dan: data.plugin_data.CLGMOD,version: data.version }
            delete data.data
            delete data.rks
            delete data.scoreHistory
            delete data.plugin_data.CLGMOD
            delete data.version

            await readFile.SetFile(path.join(savePath, session, 'history.json'), history)
        }
        await readFile.SetFile(path.join(pluginDataPath, `${user_id}_.json`), data)
    }

    /**
     * 获取并初始化用户数据
     * @param {string} user_id 
     * @returns {{plugin_data:{money:number,sign_in:string,task_time:string,task:Array<object>,theme:string}}}
     */
    async getNotesData(user_id) {
        let data = await readFile.FileReader(path.join(pluginDataPath, `${user_id}_.json`))
        if (!data||!data.plugin_data) {
            data = {
                plugin_data: {
                    money: 0,
                    sign_in: "Wed Apr 03 2024 23:03:52 GMT+0800 (中国标准时间)",
                    task_time: "Wed Apr 03 2024 23:03:52 GMT+0800 (中国标准时间)",
                    task: [],
                    theme: "common"
                }
            }
        }
        return data
    }

    async putMoneyData(user_id, data) {
        return await readFile.SetFile(path.join(pluginDataPath, `${user_id}_.json`), data)
    }

}()
