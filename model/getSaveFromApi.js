import path from 'path'
import { apiSavePath } from "./path.js"
import readFile from "./getFile.js"
import Save from './class/Save.js'
import fs from 'fs'
import saveHistory from './class/saveHistory.js'
import makeRequest from './makeRequest.js'
import makeRequestFnc from './makeRequestFnc.js'
import userCredentialStore from './userCredentialStore.js'

/**@import {botEvent} from '../components/baseClass.js' */
export default class getSaveFromApi {

    /**
     * 添加 user_id 号对应的 apiId
     * @param {string} user_id user_id
     * @param {apiUserId} apiId apiId
     */
    static async add_user_apiId(user_id, apiId) {
        return userCredentialStore.setApiId(user_id, apiId)
    }

    /**
     * 获取 user_id 号对应的 apiId
     * @param {string} user_id user_id
     */
    static async get_user_apiId(user_id) {
        return userCredentialStore.getApiId(user_id)
    }

    /**
     * 移除 user_id 对应的 apiId 
     * @param {string} user_id user_id
     */
    static async del_user_apiId(user_id) {
        return userCredentialStore.deleteApiId(user_id)
    }

    /**
     * 获取 user_id 对应的存档文件
     * @param {String} user_id user_id
     * @returns {Promise<Save | undefined>}
     */
    static async getSave(user_id) {
        let apiId = await this.get_user_apiId(user_id)
        let result = apiId ? await readFile.FileReader(path.join(apiSavePath, apiId, 'save.json')) : null
        if (result) {
            let tem = new Save(result)
            if (tem.saveInfo) {
                await tem.init()
            } else {
                return undefined
            }
            return tem
        } else {
            return undefined
        }
    }

    /**
     * 获取 apiId 对应的存档文件
     * @param {apiUserId} apiId 
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
        const cloudSave = await makeRequestFnc.requestApi(
            e,
            () => makeRequest.getCloudSaves(makeRequestFnc.makePlatform(e)),
            { logTag: 'getCloudSaves', loggerLevel: 'warn' }
        )
        if (!cloudSave) {
            throw new Error('getCloudSaves failed')
        }
        let result = new Save(cloudSave)
        await result.init()
        return result
    }

    /**
     * 保存 user_id 对应的存档文件
     * @param {string} user_id user_id
     * @param {Partial<oriSave | Save>} data 
     */
    static async putSave(user_id, data) {
        let apiId = data?.apiId
        if (!apiId) {
            throw new Error('apiId is undefined')
        }
        this.add_user_apiId(user_id, apiId)
        return readFile.SetFile(path.join(apiSavePath, apiId, 'save.json'), data)
    }

    /**
     * 获取 user_id 对应的历史记录
     * @template {keyof saveHistoryObject} K
     * @param {botEvent} e 
     * @param {K[]} [request]
     * @param {import('./userCredentials.js').UserCredentials} [credentials]
     * @returns {Promise<saveHistory>}
     */
    static async getHistory(e, request = [], credentials = undefined) {
        let apiId = credentials ? await credentials.getApiId() : await this.get_user_apiId(e.user_id)
        if (!apiId) {
            throw new Error('apiId is undefined')
        }
        const result = await makeRequestFnc.requestApi(
            e,
            () => makeRequest.getHistory({ ...makeRequestFnc.makePlatform(e), request }),
            { logTag: 'getHistory', loggerLevel: 'warn' }
        )
        if (!result) {
            throw new Error('getHistory failed')
        }
        return /**@type {any} */(new saveHistory(result))
    }

    /**
     * @overload
     * @param {botEvent} e
     * @param {idString} song_id
     * @param {levelKind} difficulty
     * @param {import('./userCredentials.js').UserCredentials} [credentials]
     * @returns {Promise<ScoreDetail[]>}
     */
    /**
     * @overload
     * @param {botEvent} e
     * @param {idString} song_id
     * @param {undefined} [difficulty]
     * @param {import('./userCredentials.js').UserCredentials} [credentials]
     * @returns {Promise<songRecordHistory>}
     */
    /**
     * @overload
     * @param {botEvent} e
     * @param {undefined} [song_id]
     * @param {undefined} [difficulty]
     * @param {import('./userCredentials.js').UserCredentials} [credentials]
     * @returns {Promise<scoreHistoryObject>}
     */
    /**
     * 获取用户成绩历史记录
     * @param {botEvent} e
     * @param {idString} [song_id]
     * @param {levelKind} [difficulty]
     * @param {import('./userCredentials.js').UserCredentials} [credentials]
     * @returns {Promise< ScoreDetail[] | songRecordHistory | scoreHistoryObject >}
     */
    static async getSongHistory(e, song_id, difficulty, credentials = undefined) {
        let apiId = credentials ? await credentials.getApiId() : await this.get_user_apiId(e.user_id)
        if (!apiId) {
            throw new Error('apiId is undefined')
        }
        let result;
        if (song_id && difficulty) {
            result = await makeRequestFnc.requestApi(
                e,
                () => makeRequest.getHistoryRecord({ ...makeRequestFnc.makePlatform(e), song_id, difficulty }),
                { logTag: 'getHistoryRecord by song_id+difficulty', loggerLevel: 'warn' }
            )
        } else if (song_id) {
            result = await makeRequestFnc.requestApi(
                e,
                () => makeRequest.getHistoryRecord({ ...makeRequestFnc.makePlatform(e), song_id }),
                { logTag: 'getHistoryRecord by song_id', loggerLevel: 'warn' }
            )
        } else {
            result = await makeRequestFnc.requestApi(
                e,
                () => makeRequest.getHistoryRecord(makeRequestFnc.makePlatform(e)),
                { logTag: 'getHistoryRecord', loggerLevel: 'warn' }
            )
        }
        if (!result) {
            throw new Error('getHistoryRecord failed')
        }
        return result
    }

    /**
     * 删除 user_id 对应的本地 API 存档缓存，不请求 API
     * @param {string} user_id user_id
     */
    static async delLocalSave(user_id) {
        const apiId = await this.get_user_apiId(user_id)
        if (!apiId) return false
        fs.rmSync(path.join(apiSavePath, apiId), { recursive: true, force: true })
        await this.del_user_apiId(user_id)
        return true
    }

}
