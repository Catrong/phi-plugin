import fs from 'node:fs'
import path from 'node:path'
import Save from './Save.js'
import saveHistory from './saveHistory.js'
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
    /** @param {apiUserId | null | undefined} apiId */
    static async getHistoryByApiId(apiId) {
        if (!apiId) return null
        const file = path.join(apiSavePath, apiId, 'history.json')
        if (!fs.existsSync(file)) return null
        return new saveHistory(JSON.parse(await fs.promises.readFile(file, 'utf8')))
    }

    /** @param {apiUserId} apiId @param {saveHistory} history */
    static async putHistoryByApiId(apiId, history) {
        if (!apiId) throw new Error('apiId is undefined')
        const directory = path.join(apiSavePath, apiId)
        fs.mkdirSync(directory, { recursive: true })
        const file = path.join(directory, 'history.json')
        const merged = fs.existsSync(file) ? new saveHistory(JSON.parse(fs.readFileSync(file, 'utf8'))) : new saveHistory()
        merged.add(history)
        const temporary = `${file}.${process.pid}.tmp`
        fs.writeFileSync(temporary, JSON.stringify(merged))
        fs.renameSync(temporary, file)

    }
}
