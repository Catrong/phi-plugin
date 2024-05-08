import path from 'path'
import { savePath, dataPath } from "./path.js"
import readFile from "./Doc.js"
import Save from './class/Save.js'
import fs from 'fs'

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

    /**
     * 获取 user_id 对应的存档文件
     * @param {String} user_id user_id
     * @returns save
     */
    async get_save(user_id) {
        let session = await this.get_user_token(user_id)
        let result = session ? await readFile.FileReader(path.join(savePath, session, 'save.json')) : null
        if (result) {
            return new Save(result)
        } else {
            return null
        }
    }

    /**
     * 保存 user_id 对应的存档文件
     * @param {String} user_id user_id
     * @param {Object} data 
     */
    async putsave(user_id, data) {
        let session = data.session
        this.add_user_token(user_id, session)
        return await readFile.SetFile(path.join(savePath, session, 'save.json'), data)
    }

    /**
     * 删除 user_id 对应的存档文件
     * @param {String} user_id user_id
     */
    async delsave(user_id) {
        let session = await this.get_user_token(user_id)
        let fPath = path.join(savePath, session)
        await readFile.DelFile(path.join(fPath, 'save.json'))
        await readFile.DelFile(path.join(fPath, 'history.json'))
        fs.rmdirSync(path.join(savePath, session), { recursive: true, force: true });
        readFile.del_user_token(user_id)
    }

}()
