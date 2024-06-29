import path from 'path'
import { savePath, dataPath } from "./path.js"
import readFile from "./getFile.js"
import Save from './class/Save.js'
import fs from 'fs'
import saveHistory from './class/saveHistory.js'

export default new class getSave {

    constructor() {
        this.user_token = {}
    }

    /**添加 user_id 号对应的 Token */
    async add_user_token(user_id, session) {
        this.user_token[user_id] = session
        await readFile.SetFile(path.join(dataPath, 'user_token.json'), this.user_token)
    }

    /**获取 user_id 号对应的 Token */
    async get_user_token(user_id) {
        return this.user_token[user_id]
    }

    /**移除 user_id 对应的 Token */
    async del_user_token(user_id) {
        delete this.user_token[user_id]
        await readFile.SetFile(path.join(dataPath, 'user_token.json'), this.user_token)
    }

    /**进行一次 Token 保存 */
    async save_user_token() {
        await readFile.SetFile(path.join(dataPath, 'user_token.json'), this.user_token)
    }

    /**
     * 获取 user_id 对应的存档文件
     * @param {String} user_id user_id
     * @returns {Promise<Save>}
     */
    async getSave(user_id) {
        let session = await this.get_user_token(user_id)
        let result = session ? await readFile.FileReader(path.join(savePath, session, 'save.json')) : null
        if (result) {
            let tem = new Save(result)
            await tem.init()
            return tem
        } else {
            return null
        }
    }

    /**
     * 保存 user_id 对应的存档文件
     * @param {String} user_id user_id
     * @param {Object} data 
     */
    async putSave(user_id, data) {
        let session = data.session
        this.add_user_token(user_id, session)
        // console.info(path.join(savePath, session, 'save.json'), data)
        return await readFile.SetFile(path.join(savePath, session, 'save.json'), data)
    }

    /**
     * 获取 user_id 对应的历史记录
     * @param {string} user_id 
     * @returns {Promise<saveHistory>}
     */
    async getHistory(user_id) {
        let session = await this.get_user_token(user_id)
        let result = session ? await readFile.FileReader(path.join(savePath, session, 'history.json')) : null
        return new saveHistory(result)
    }

    /**
     * 保存 user_id 对应的历史记录
     * @param {String} user_id user_id
     * @param {Object} data 
     */
    async putHistory(user_id, data) {
        let session = await this.get_user_token(user_id)
        return await readFile.SetFile(path.join(savePath, session, 'history.json'), data)
    }


    /**
     * 获取玩家 Dan 数据
     * @param {string} user_id QQ号
     * @param {boolean} [all=false] 是否返回所有数据
     * @returns {object|Array} Dan数据
     */
    async getDan(user_id, all = false) {
        let history = await this.getHistory(user_id)

        let dan = history?.dan

        if (dan && Object.prototype.toString.call(dan) != '[object Array]') {
            dan = [dan]
        }
        return dan ? (all ? dan : dan[0]) : undefined
    }

    /**
     * 删除 user_id 对应的存档文件
     * @param {String} user_id user_id
     */
    async delSave(user_id) {
        let session = await this.get_user_token(user_id)
        if (!session) return false
        let fPath = path.join(savePath, session)
        await readFile.DelFile(path.join(fPath, 'save.json'))
        await readFile.DelFile(path.join(fPath, 'history.json'))
        fs.rmSync(path.join(savePath, session), { recursive: true, force: true });
        this.del_user_token(user_id)
        return true
    }

}()
