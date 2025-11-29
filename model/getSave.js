import path from 'path'
import { savePath, dataPath } from "./path.js"
import readFile from "./getFile.js"
import Save from './class/Save.js'
import fs from 'fs'
import saveHistory from './class/saveHistory.js'
import { redisPath } from './constNum.js'
import getRksRank from './getRksRank.js'
// import { redis } from 'yunzai'

export default class getSave {

    /**添加 user_id 号对应的 Token */
    static async add_user_token(user_id, session) {
        return await redis.set(`${redisPath}:userToken:${user_id}`, session)
    }

    /**获取 user_id 号对应的 Token */
    static async get_user_token(user_id) {
        return await redis.get(`${redisPath}:userToken:${user_id}`)
    }

    /**移除 user_id 对应的 Token */
    static async del_user_token(user_id) {
        return await redis.del(`${redisPath}:userToken:${user_id}`)
    }

    /**
     * 获取 user_id 对应的存档文件
     * @param {String} user_id user_id
     * @returns {Promise<Save>}
     */
    static async getSave(user_id) {
        let Token = await this.get_user_token(user_id)
        if (await this.isBanSessionToken(Token)) {
            throw new Error(`${Token} 已被禁用`)
        }
        let result = Token ? await readFile.FileReader(path.join(savePath, Token, 'save.json')) : null
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
     * 获取 sessionToken 对应的存档文件
     * @param {string} Token 
     * @returns 
     */
    static async getSaveBySessionToken(Token) {
        // console.info(Token)
        if (await this.isBanSessionToken(Token)) {
            throw new Error(`${Token} 已被禁用`)
        }
        let result = Token ? await readFile.FileReader(path.join(savePath, Token, 'save.json')) : null
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
     * 保存 user_id 对应的存档文件
     * @param {String} user_id user_id
     * @param {Save} data 
     */
    static async putSave(user_id, data) {
        let session = data.session
        if (await this.isBanSessionToken(session)) {
            throw new Error(`${session} 已被禁用`)
        }
        this.add_user_token(user_id, session)
        await getRksRank.addUserRks(session, data.saveInfo.summary.rankingScore)
        return readFile.SetFile(path.join(savePath, session, 'save.json'), data)
    }

    /**
     * 获取 user_id 对应的历史记录
     * @param {string} user_id 
     * @returns {Promise<saveHistory>}
     */
    static async getHistory(user_id) {
        let Token = await this.get_user_token(user_id)
        if (await this.isBanSessionToken(Token)) {
            throw new Error(`${Token} 已被禁用`)
        }
        let result = Token ? await readFile.FileReader(path.join(savePath, Token, 'history.json')) : null
        return new saveHistory(result)
    }

    /**
     * 获取 sessionToken 对应的历史记录
     * @param {string} Token
     * @returns {Promise<saveHistory>}
     */
    static async getHistoryBySessionToken(Token) {
        if (await this.isBanSessionToken(Token)) {
            throw new Error(`${Token} 已被禁用`)
        }
        let result = Token ? await readFile.FileReader(path.join(savePath, Token, 'history.json')) : null
        return new saveHistory(result)
    }

    /**
     * 保存 user_id 对应的历史记录
     * @param {String} user_id user_id
     * @param {Object} data 
     */
    static async putHistory(user_id, data) {
        let session = await this.get_user_token(user_id)
        return await readFile.SetFile(path.join(savePath, session, 'history.json'), data)
    }


    /**
     * 获取玩家 Dan 数据
     * @param {string} user_id QQ号
     * @param {boolean} [all=false] 是否返回所有数据
     * @returns {object|Array} Dan数据
     */
    static async getDan(user_id, all = false) {
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
    static async delSave(user_id) {
        let session = await this.get_user_token(user_id)
        if (!session) return false
        let fPath = path.join(savePath, session)
        await readFile.DelFile(path.join(fPath, 'save.json'))
        await readFile.DelFile(path.join(fPath, 'history.json'))
        await getRksRank.delUserRks(session)
        fs.rmSync(path.join(savePath, session), { recursive: true, force: true });
        this.del_user_token(user_id)
        return true
    }

    /**
     * 删除 user_id 对应的存档文件
     * @param {String} user_id user_id
     */
    static async delSaveBySessionToken(Token) {
        let fPath = path.join(savePath, Token)
        await readFile.DelFile(path.join(fPath, 'save.json'))
        await readFile.DelFile(path.join(fPath, 'history.json'))
        await getRksRank.delUserRks(Token)
        fs.rmSync(path.join(savePath, Token), { recursive: true, force: true });
        return true
    }

    static async banSessionToken(token) {
        return await redis.set(`${redisPath}:banSessionToken:${token}`, 1)
    }

    static async allowSessionToken(token) {
        return await redis.del(`${redisPath}:banSessionToken:${token}`)
    }

    static async isBanSessionToken(token) {
        return await redis.get(`${redisPath}:banSessionToken:${token}`)
    }

    static async getGod() {
        return await redis.keys(`${redisPath}:banSessionToken:*`)
    }

}
