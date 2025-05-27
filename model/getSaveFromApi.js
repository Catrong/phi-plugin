import path from 'path'
import { apiSavePath } from "./path.js"
import readFile from "./getFile.js"
import Save from './class/Save.js'
import fs from 'fs'
import saveHistory from './class/saveHistory.js'
import { redisPath } from './constNum.js'
import makeRequest from './makeRequest.js'
import makeRequestFnc from './makeRequestFnc.js'
// import { redis } from 'yunzai'

export default class getSaveFromApi {

    /**添加 user_id 号对应的 apiId */
    static async add_user_apiId(user_id, apiId) {
        return await redis.set(`${redisPath}:userApiId:${user_id}`, apiId)
    }

    /**获取 user_id 号对应的 apiId */
    static async get_user_apiId(user_id) {
        return await redis.get(`${redisPath}:userApiId:${user_id}`)
    }

    /**移除 user_id 对应的 apiId */
    static async del_user_apiId(user_id) {
        return await redis.del(`${redisPath}:userApiId:${user_id}`)
    }

    /**
     * 获取 user_id 对应的存档文件
     * @param {String} user_id user_id
     * @returns {Promise<Save>}
     */
    static async getSave(user_id) {
        let apiId = await this.get_user_apiId(user_id)
        let result = apiId ? await readFile.FileReader(path.join(apiSavePath, apiId, 'save.json')) : null
        if (result) {
            let tem = new Save(result)
            if (tem.saveInfo) {
                await tem.init()
            } else {
                return null
            }
            return tem
        } else {
            return null
        }
    }

    /**
     * 获取 apiId 对应的存档文件
     * @param {apiId} apiId 
     * @returns 
     */
    static async getSaveByApiId(apiId) {
        let result = apiId ? await readFile.FileReader(path.join(apiSavePath, apiId, 'save.json')) : null
        if (result) {
            let tem = new Save(result)
            if (tem.saveInfo) {
                await tem.init()
            } else {
                return null
            }
            return tem
        } else {
            return null
        }
    }

    /**
     * 从 API 获取存档
     * @param {*} e 
     * @returns 
     */
    static async getSaveFromApi(e) {
        let result = new Save(await makeRequest.getCloudSaves(makeRequestFnc.makePlatform(e)))
        await result.init()
        return result
    }

    /**
     * 保存 user_id 对应的存档文件
     * @param {String} user_id user_id
     * @param {Save} data 
     */
    static async putSave(user_id, data) {
        let apiId = data.apiId
        if (!apiId) {
            throw new Error('apiId is undefined')
        }
        this.add_user_apiId(user_id, apiId)
        return readFile.SetFile(path.join(apiSavePath, apiId, 'save.json'), data)
    }

    /**
     * 获取 user_id 对应的历史记录
     * @param {*} e 
     * @param {(keyof saveHistoryObject)[]} request
     * @returns {Promise<saveHistory>}
     */
    static async getHistory(e, request = []) {
        let apiId = await this.get_user_apiId(e.user_id)
        if (!apiId) {
            throw new Error('apiId is undefined')
        }
        let result = await makeRequest.getHistory({ ...makeRequestFnc.makePlatform(e), request })
        return new saveHistory(result)
    }

    static async getSongHistory(e, song_id, difficulty) {
        let apiId = await this.get_user_apiId(e.user_id)
        if (!apiId) {
            throw new Error('apiId is undefined')
        }
        let result = await makeRequest.getHistoryRecord({ ...makeRequestFnc.makePlatform(e), song_id, difficulty })
        return result
    }

    /**
     * 删除 user_id 对应的存档文件
     * @param {*} e e
     */
    static async delSave(e) {
        let apiId = await this.get_user_apiId(e.user_id)
        if (!apiId) return false
        let fPath = path.join(apiSavePath, apiId)
        await readFile.DelFile(path.join(fPath, 'save.json'))
        fs.rmSync(path.join(apiSavePath, apiId), { recursive: true, force: true });
        this.del_user_apiId(e.user_id)
        await makeRequest.unbind({ ...makeRequestFnc.makePlatform(e) })
        return true
    }

}
