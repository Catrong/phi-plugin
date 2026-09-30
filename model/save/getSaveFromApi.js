import fs from 'node:fs'
import path from 'node:path'
import Save from './Save.js'
import readFile from '../filesystem/getFile.js'
import { apiSavePath } from '../filesystem/path.js'

/**
 * API ID 本地存档缓存仓库。
 * 只处理文件，不读取用户凭证，也不发起 API 请求。
 */
export default class ApiSaveCacheRepository {
    /**
     * 读取 API ID对应的本地存档缓存。
     * @param {apiUserId | null | undefined} apiId API 用户 ID
     * @returns {Promise<Save | undefined>} 已初始化的缓存存档
     */
    static async getSaveByApiId(apiId) {
        if (!apiId) return undefined
        const data = await readFile.FileReader(path.join(apiSavePath, apiId, 'save.json'))
        if (!data?.saveInfo) return undefined
        const save = new Save(data)
        await save.init()
        return save
    }

    /**
     * 保存 API ID对应的本地存档缓存。
     * @param {apiUserId} apiId API 用户 ID
     * @param {Partial<oriSave | Save>} data 存档数据
     */
    static async putSaveByApiId(apiId, data) {
        if (!apiId) throw new Error('apiId is undefined')
        return readFile.SetFile(path.join(apiSavePath, apiId, 'save.json'), data)
    }

    /**
     * 删除 API ID对应的本地存档缓存。
     * @param {apiUserId | null | undefined} apiId API 用户 ID
     * @returns {boolean} 是否执行了删除
     */
    static deleteSaveByApiId(apiId) {
        if (!apiId) return false
        fs.rmSync(path.join(apiSavePath, apiId), { recursive: true, force: true })
        return true
    }
}
