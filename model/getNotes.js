import readFile from './Doc.js'
import path from 'path'
import { pluginDataPath, savePath } from './path.js'
import getSave from './getSave.js'
export default new class money {

    /**
     * 获取QQ号对应的娱乐数据
     * @param {String} user_id 
     * @returns save
     */
    async getPluginData(user_id) {
        let session = await getSave.get_user_token(user_id)
        if (session) {
            return {
                ... await readFile.FileReader(path.join(pluginDataPath, `${user_id}_.json`)),
                ... await readFile.FileReader(path.join(savePath, session, 'history.json'))
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
            let history = { data: data.data, rks: data.rks, scoreHistory: data.scoreHistory, dan: data.dan }
            delete data.data
            delete data.rks
            delete data.scoreHistory
            delete data.dan

            await readFile.SetFile(path.join(savePath, session, 'history.json'), history)
        }
        console.info(path.join(pluginDataPath, `${user_id}_.json`), data)
        await readFile.SetFile(path.join(pluginDataPath, `${user_id}_.json`), data)
    }

    /**
     * 获取并初始化用户数据
     * @param {string} user_id 
     */
    async getMoneyData(user_id) {
        let data = await readFile.FileReader(path.join(pluginDataPath, `${user_id}_.json`))
        if (!data) {
            data = {
                version: 1.2,
                plugin_data: {
                    money: 0,
                    CLGMOD: [],
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

    /**
     * 获取玩家 Dan 数据
     * @param {string} user_id QQ号
     * @param {boolean} [all=false] 是否返回所有数据
     * @returns {object|Array} Dan数据
     */
    async getDan(user_id, all = false) {
        let plugindata = await this.getPluginData(user_id)

        let dan = plugindata?.plugin_data?.CLGMOD

        if (dan && Object.prototype.toString.call(dan) != '[object Array]') {
            dan = [dan]
        }
        return dan ? (all ? dan : dan[0]) : undefined
    }



}()
