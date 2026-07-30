import crypto from 'node:crypto'
import { redis } from '../components/platform/index.js'
import { redisPath } from './constNum.js'

/** @typedef {{bindingId: string, apiUserId: string, bindingCredential: string, credentialVersion: number, credentialFingerprint: string, updatedAt: string}} CachedBotBinding */

/**
 * 生成用户凭证类 Redis 键。
 * @param {string} kind 凭证类型
 * @param {string | number} value 用户 ID或凭证值
 * @returns {string} 带插件命名空间的 Redis 键
 */
function credentialKey(kind, value) {
    return `${redisPath}:${kind}:${String(value)}`
}

/**
 * 生成 Bot独立平台绑定缓存键，平台用户 ID只以摘要形式进入键名。
 * @param {string} clientId API 签发的 Bot clientId
 * @param {string} platform 平台名称
 * @param {string | number} platformId 平台用户 ID
 * @returns {string} bindingCredential 缓存键
 */
function bindingKey(clientId, platform, platformId) {
    const digest = crypto.createHash('sha256').update(`${platform}\n${platformId}`).digest('hex')
    return `${redisPath}:apiBotBinding:${clientId}:${digest}`
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
     * 删除指定用户的 sessionToken，并可同步删除依赖该凭证的别名通知绑定。
     * @param {string | number} userId 平台用户 ID
     * @param {boolean} [deleteAliasBinding=true] 是否删除别名通知绑定
     */
    async deleteSessionToken(userId, deleteAliasBinding = true) {
        const keys = [credentialKey('userToken', userId)]
        if (deleteAliasBinding) keys.push(credentialKey('aliasBinding', userId))
        return redis.del(...keys)
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
     * @param {apiUserId | string | number} apiId API 用户 ID
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
     * 删除指定用户的 sessionToken、API ID及别名通知绑定。
     * @param {string | number} userId 平台用户 ID
     */
    async clearLocalCredentials(userId) {
        return redis.del(
            credentialKey('userToken', userId),
            credentialKey('userApiId', userId),
            credentialKey('aliasBinding', userId),
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
                if (value) result.set(key.slice(prefix.length), /** @type {phigrosToken} */ (value))
            })
        } while (cursor !== 0)
        return result
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
     * @returns {Promise<unknown | false>} Redis 标记；未禁用时为假值
     */
    async isSessionTokenBanned(sessionToken) {
        if (!sessionToken) return false
        return redis.get(credentialKey('banSessionToken', sessionToken))
    }

    /**
     * 列出全部禁用 sessionToken 的 Redis 键，仅供管理员维护功能使用。
     * @returns {Promise<string[]>} 禁用记录键列表
     */
    async listBannedSessionTokenKeys() {
        return redis.keys(`${redisPath}:banSessionToken:*`)
    }

    /**
     * 读取指定 Bot与平台用户的 bindingCredential 缓存；损坏数据会被自动删除。
     * @param {string} clientId API 签发的 Bot clientId
     * @param {string} platform 平台名称
     * @param {string | number} platformId 平台用户 ID
     * @returns {Promise<CachedBotBinding | null>} 有效绑定缓存；不存在时返回 `null`
     */
    async getBotBinding(clientId, platform, platformId) {
        const key = bindingKey(clientId, platform, platformId)
        const raw = await redis.get(key)
        if (!raw) return null
        try {
            const value = /** @type {CachedBotBinding} */ (typeof raw === 'string' ? JSON.parse(raw) : raw)
            if (value?.bindingCredential && value?.apiUserId && value?.bindingId) return value
        } catch { /* remove malformed credential cache below */ }
        await redis.del(key)
        return null
    }

    /**
     * 保存指定 Bot与平台用户的 bindingCredential 缓存。
     * @param {string} clientId API 签发的 Bot clientId
     * @param {string} platform 平台名称
     * @param {string | number} platformId 平台用户 ID
     * @param {any} value API 返回的绑定信息
     * @returns {Promise<CachedBotBinding>} 规范化后的缓存内容
     */
    async setBotBinding(clientId, platform, platformId, value) {
        const stored = {
            bindingId: value.bindingId,
            apiUserId: String(value.apiUserId),
            bindingCredential: value.bindingCredential,
            credentialVersion: Number(value.credentialVersion),
            credentialFingerprint: String(value.credentialFingerprint || ''),
            updatedAt: new Date().toISOString(),
        }
        await redis.set(bindingKey(clientId, platform, platformId), JSON.stringify(stored))
        return stored
    }

    /**
     * 删除指定 Bot与平台用户的 bindingCredential 缓存，使旧凭据不再被本地复用。
     * @param {string} clientId API 签发的 Bot clientId
     * @param {string} platform 平台名称
     * @param {string | number} platformId 平台用户 ID
     */
    async deleteBotBinding(clientId, platform, platformId) {
        if (!clientId || !platform || !platformId) return 0
        return redis.del(bindingKey(clientId, platform, platformId))
    }
}

export const userCredentialStore = new UserCredentialStore()
export default userCredentialStore
