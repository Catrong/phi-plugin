import { redis } from '../../components/platform/index.js'
import { redisPath } from '../game/constNum.js'

/**
 * 生成用户凭证类 Redis 键。
 * @param {string} kind 凭证类型
 * @param {string | number} value 用户 ID或凭证值
 * @returns {string} 带插件命名空间的 Redis 键
 */
function credentialKey(kind, value) {
    return `${redisPath}:${kind}:${String(value)}`
}

class UserCredentialStore {
    /**
     * 按用户 ID读取本地 sessionToken。
     * @param {string | number} userId 平台用户 ID
     * @returns {Promise<phigrosToken>} 已保存的 sessionToken
     */
    async getSessionToken(userId) {
        return /** @type {any} */ (redis.get(credentialKey('userToken', userId)))
    }

    /**
     * 按用户 ID保存本地 sessionToken。
     * @param {string | number} userId 平台用户 ID
     * @param {phigrosToken} sessionToken Phigros sessionToken
     */
    async setSessionToken(userId, sessionToken) {
        return redis.set(credentialKey('userToken', userId), sessionToken)
    }

    /**
     * 删除指定用户的 sessionToken。
     * @param {string | number} userId 平台用户 ID
     */
    async deleteSessionToken(userId) {
        return redis.del(credentialKey('userToken', userId))
    }

    /**
     * 按用户 ID读取本地 API ID。
     * @param {string | number} userId 平台用户 ID
     * @returns {Promise<apiUserId>} 已保存的 API ID
     */
    async getApiId(userId) {
        return /** @type {any} */ (redis.get(credentialKey('userApiId', userId)))
    }

    /**
     * 按用户 ID保存本地 API ID。
     * @param {string | number} userId 平台用户 ID
     * @param {apiUserId} apiId API 用户 ID
     */
    async setApiId(userId, apiId) {
        return redis.set(credentialKey('userApiId', userId), String(apiId))
    }

    /**
     * 删除指定用户的本地 API ID。
     * @param {string | number} userId 平台用户 ID
     */
    async deleteApiId(userId) {
        return redis.del(credentialKey('userApiId', userId))
    }

    /**
     * 删除指定用户的 sessionToken和 API ID。
     * @param {string | number} userId 平台用户 ID
     */
    async clearLocalCredentials(userId) {
        return redis.del(
            credentialKey('userToken', userId),
            credentialKey('userApiId', userId),
        )
    }

    /**
     * 使用 Redis SCAN分页列出全部本地用户 sessionToken，供备份和管理员批量任务使用。
     * @returns {Promise<Map<string, phigrosToken>>} 用户 ID到 sessionToken 的映射
     */
    async listSessionCredentials() {
        /** @type {Map<string, phigrosToken>} */
        const result = new Map()
        const prefix = `${redisPath}:userToken:`
        let cursor = 0
        do {
            const info = await redis.scan(cursor, { MATCH: `${prefix}*`, COUNT: 100 })
            cursor = Number(info.cursor)
            const values = await Promise.all(info.keys.map(key => redis.get(key)))
            info.keys.forEach((key, index) => {
                const value = values[index]
                if (value) result.set(key.slice(prefix.length), /** @type {phigrosToken} */(value))
            })
        } while (cursor !== 0)
        return result
    }

    /**
     * 分页删除旧版派生凭据和别名通知元数据缓存。
     * @returns {Promise<number>} 实际删除的旧缓存键数量
     */
    async deleteLegacyCredentialCaches() {
        const patterns = [`${redisPath}:apiBotBinding:*`, `${redisPath}:aliasBinding:*`]
        let deleted = 0
        for (const pattern of patterns) {
            let cursor = 0
            do {
                const info = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 })
                cursor = Number(info.cursor)
                if (info.keys.length) deleted += Number(await redis.del(...info.keys))
            } while (cursor !== 0)
        }
        return deleted
    }

    /**
     * 将 sessionToken 加入本地禁用列表。
     * @param {phigrosToken} sessionToken 待禁用的 sessionToken
     */
    async banSessionToken(sessionToken) {
        return redis.set(credentialKey('banSessionToken', sessionToken), 1)
    }

    /**
     * 从本地禁用列表移除 sessionToken。
     * @param {phigrosToken} sessionToken 待恢复的 sessionToken
     */
    async allowSessionToken(sessionToken) {
        return redis.del(credentialKey('banSessionToken', sessionToken))
    }

    /**
     * 检查 sessionToken 是否已被禁用；空值直接视为未禁用。
     * @param {phigrosToken | null | undefined} sessionToken 待检查的 sessionToken
     * @returns {Promise<boolean>} Redis 标记；未禁用时为假值
     */
    async isSessionTokenBanned(sessionToken) {
        if (!sessionToken) return false
        return Boolean(await redis.get(credentialKey('banSessionToken', sessionToken)))
    }

    /**
     * 列出全部禁用 sessionToken 的 Redis 键，仅供管理员维护功能使用。
     * @returns {Promise<string[]>} 禁用记录键列表
     */
    async listBannedSessionTokenKeys() {
        return redis.keys(`${redisPath}:banSessionToken:*`)
    }

}

export const userCredentialStore = new UserCredentialStore()
export default userCredentialStore
