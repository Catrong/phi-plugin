import logger from '../components/Logger.js'
import botApiAuth from './botApiAuth.js'
import getSave from './getSave.js'
import getSaveFromApi from './getSaveFromApi.js'
import makeRequestFnc from './makeRequestFnc.js'
import { requestPhiApi } from './phiApiClient.js'
import userCredentialStore from './userCredentialStore.js'
import { APII18NCN } from './constNum.js'

/** @typedef {(path: string, params?: any, method?: 'POST' | 'GET') => Promise<any>} ApiClient */
/** @typedef {{bind(params: any): Promise<any>, ensureBinding(params: any, allowMigration?: boolean): Promise<any>, invalidateBinding?(params: any): Promise<void>}} BotAuthClient */
/** @typedef {{platform_name: string, platform_id: string, create_at: string, update_at: string, authentication: number, authentication_label?: string, binding_type?: 'bot'|'legacy', bot_display_name?: string, migration_notice?: string|null}} PlatformBindingInfo */
/** @typedef {{data: any, user_id: number, phigros_token: string, api_token: string, create_at: string, update_at: string, platform_data: PlatformBindingInfo[]}} PlatformBindingsResponse */

/**
 * 单个平台事件用户的凭证与存档操作入口。
 * 业务处理器应通过 `UserCredentials.fromEvent(e)` 创建实例，实例方法不得操作其他用户。
 */
export class UserCredentials {
    /**
     * 创建绑定到单个用户 ID 的凭证实例。
     * @param {string | number} userId 当前事件的用户 ID
     * @param {{event?: any, apiClient?: ApiClient, botAuth?: BotAuthClient, store?: typeof userCredentialStore}} [dependencies] 测试或内部注入的依赖
     */
    constructor(userId, { event = undefined, apiClient = requestPhiApi, botAuth = botApiAuth, store = userCredentialStore } = {}) {
        const normalizedUserId = String(userId ?? '').trim()
        if (!normalizedUserId) throw new TypeError('UserCredentials requires e.userId')
        this.userId = normalizedUserId
        this.event = event
            ? { ...event, user_id: normalizedUserId, userId: normalizedUserId }
            : undefined
        this.apiClient = apiClient
        this.botAuth = botAuth
        this.store = store
    }

    /**
     * 根据平台事件创建用户凭证实例，优先读取标准字段 `e.userId`，并兼容旧字段 `e.user_id`。
     * @param {any} e 当前平台事件
     * @param {{apiClient?: ApiClient, botAuth?: BotAuthClient, store?: typeof userCredentialStore}} [dependencies] 测试或内部注入的依赖
     * @returns {UserCredentials} 仅能操作当前事件用户的凭证实例
     */
    static fromEvent(e, dependencies = {}) {
        const userId = e?.userId ?? e?.user_id
        return new UserCredentials(userId, { ...dependencies, event: e })
    }

    /**
     * 获取实例关联的平台事件；需要平台上下文的方法在事件缺失时直接拒绝执行。
     * @returns {any} 当前平台事件
     */
    requireEvent() {
        if (!this.event) throw new TypeError('This UserCredentials operation requires an event')
        return this.event
    }

    /**
     * 生成当前 Bot 平台用户的 API 身份参数。
     * @returns {import('./makeRequest.js').platformAuth} 平台名称、平台用户 ID和本地用户键
     */
    platformParams() {
        return makeRequestFnc.makePlatform(this.requireEvent())
    }

    /**
     * 执行用户 API 操作并统一处理错误提示、日志及可忽略错误。
     * @template T
     * @param {() => Promise<T>} request 实际 API 操作
     * @param {{errorPrefix?: string, notifyUser?: boolean, logTag?: string, loggerLevel?: 'warn'|'error', ignoreMessages?: string[]}} [options] 错误处理策略
     * @returns {Promise<T | null>} 成功结果；失败并完成错误处理后返回 `null`
     */
    async requestApi(request, options = {}) {
        return makeRequestFnc.requestApi(this.requireEvent(), request, options)
    }

    /** @returns {Promise<phigrosToken>} 当前用户本地保存的 sessionToken */
    async getSessionToken() {
        return this.store.getSessionToken(this.userId)
    }

    /**
     * 保存当前用户的 sessionToken。
     * @param {phigrosToken} sessionToken 待保存的 Phigros sessionToken
     */
    async setSessionToken(sessionToken) {
        return this.store.setSessionToken(this.userId, sessionToken)
    }

    /**
     * 删除当前用户的 sessionToken，并可同时删除依赖该凭证的别名通知绑定。
     * @param {boolean} [deleteAliasBinding=true] 是否同步删除别名通知绑定
     */
    async deleteSessionToken(deleteAliasBinding = true) {
        return this.store.deleteSessionToken(this.userId, deleteAliasBinding)
    }

    /** @returns {Promise<apiUserId>} 当前用户本地保存的 API ID */
    async getApiId() {
        return this.store.getApiId(this.userId)
    }

    /**
     * 保存当前用户的 API ID。
     * @param {apiUserId | string | number} apiId API 用户 ID
     */
    async setApiId(apiId) {
        return this.store.setApiId(this.userId, apiId)
    }

    /** 删除当前用户本地保存的 API ID。 */
    async deleteApiId() {
        return this.store.deleteApiId(this.userId)
    }

    /**
     * 一次读取当前用户的本地 sessionToken 与 API ID。
     * @returns {Promise<{sessionToken: phigrosToken, apiId: apiUserId}>} 本地凭证快照
     */
    async getLocalCredentials() {
        const [sessionToken, apiId] = await Promise.all([
            this.getSessionToken(),
            this.getApiId(),
        ])
        return { sessionToken, apiId }
    }

    /** 删除当前用户的 sessionToken、API ID及别名通知绑定。 */
    async clearLocalCredentials() {
        return this.store.clearLocalCredentials(this.userId)
    }

    /**
     * 丢弃当前 Bot平台用户的本地 bindingCredential 缓存，不修改 API 数据。
     * 本地绑定变化后必须调用，避免继续使用 API 中残留的旧绑定。
     */
    async forgetCachedPlatformBinding() {
        try {
            await this.botAuth.invalidateBinding?.(this.platformParams())
        } catch (error) {
            logger.warn('[phi-plugin] 清理本地平台绑定凭据缓存失败', error)
        }
    }

    /**
     * 切换为本地 sessionToken 身份，并清除可能冲突的 API ID。
     * @param {phigrosToken} sessionToken 新的 sessionToken
     */
    async useLocalSessionToken(sessionToken) {
        await this.forgetCachedPlatformBinding()
        await this.setSessionToken(sessionToken)
        await this.deleteApiId()
    }

    /**
     * 将当前用户切换为本地 API ID身份，并清除可能冲突的 sessionToken。
     * @param {apiUserId | string | number} apiId 新的 API ID
     */
    async useLocalApiId(apiId) {
        await this.forgetCachedPlatformBinding()
        await this.setApiId(apiId)
        await this.deleteSessionToken()
    }

    /**
     * 使用 API ID为当前 Bot平台账号建立首次绑定，并在方法内部完成错误处理。
     * @param {apiUserId | string | number} apiId 目标 API ID
     * @returns {Promise<any | null>} 绑定结果；失败返回 `null`
     */
    async bindWithApiId(apiId) {
        return this.requestApi(
            () => this.bindPlatform({ api_user_id: apiId }),
            {
                logTag: 'API错误 bind by api_user_id',
                loggerLevel: 'error',
                ignoreMessages: [APII18NCN.userNotFound, 'binding_not_found'],
            },
        )
    }

    /**
     * 使用 sessionToken 为当前 Bot平台账号建立或迁移绑定，并在方法内部完成错误处理。
     * @param {phigrosToken} sessionToken Phigros sessionToken
     * @param {boolean} [isGlobal] 是否使用国际服
     * @returns {Promise<any | null>} 绑定结果；失败返回 `null`
     */
    async bindWithSessionToken(sessionToken, isGlobal = undefined) {
        return this.requestApi(
            () => this.bindPlatform({ token: sessionToken, isGlobal }),
            {
                errorPrefix: 'API绑定暂时不可用，将仅更新当前 Bot 的本地绑定状态。',
                notifyUser: true,
                logTag: 'API错误 bind by token',
                loggerLevel: 'error',
            },
        )
    }

    /**
     * 执行绑定原子操作。API 提交成功后才写入本地凭证，避免失败时破坏旧绑定。
     * @param {{token?: phigrosToken, api_user_id?: apiUserId|string|number, isGlobal?: boolean}} binding 互斥的绑定凭证与服务器类型
     * @returns {Promise<any>} API 绑定结果及本地写入警告
     */
    async bindPlatform(binding) {
        const params = { ...this.platformParams(), ...binding }
        const result = await this.botAuth.bind(params)
        let localCredentialWarning = false
        try {
            await this.setApiId(result.apiUserId)
            if (binding.token) {
                await this.setSessionToken(binding.token)
            } else {
                await this.deleteSessionToken()
            }
        } catch {
            localCredentialWarning = true
            logger.warn('[phi-plugin] API绑定已成功，但本地用户凭证写入失败')
        }
        return { ...result, localCredentialWarning }
    }

    /**
     * 解析当前 Bot平台绑定；允许迁移时会显式提供本地 SSTK或 API ID建立新绑定。
     * @param {boolean} [allowMigration=false] 找不到绑定时是否允许使用本地凭证迁移
     * @returns {Promise<any>} bindingCredential 与 API 用户信息
     */
    async resolvePlatformBinding(allowMigration = false) {
        const local = await this.getLocalCredentials()
        return this.botAuth.ensureBinding({
            ...this.platformParams(),
            ...(local.sessionToken ? { token: local.sessionToken } : {}),
            ...(!local.sessionToken && local.apiId ? { api_user_id: local.apiId } : {}),
        }, allowMigration)
    }

    /**
     * 汇总当前用户的本地凭证和当前 Bot平台绑定信息。
     * @returns {Promise<{sessionToken: phigrosToken, apiId: apiUserId, binding: any | null}>} 凭证与绑定快照
     */
    async getCredentialInfo() {
        const local = await this.getLocalCredentials()
        try {
            const binding = await this.resolvePlatformBinding(false)
            return { ...local, binding }
        } catch (/** @type {any} */ error) {
            if (error?.code === 'binding_not_found') return { ...local, binding: null }
            throw error
        }
    }

    /**
     * 确保当前用户已具备远端 Bot平台绑定，必要时使用本地凭证完成一次迁移。
     * @returns {Promise<any>} 可用于后续 API 请求的绑定信息
     */
    async ensureRemoteBinding() {
        return this.resolvePlatformBinding(true)
    }

    /**
     * 仅解绑当前 Bot本地用户，不请求 API，也不删除 API 共享存档缓存。
     * @returns {Promise<{hadBinding: boolean}>} 本地执行前是否存在凭证
     */
    async unbindLocal() {
        const { sessionToken, apiId } = await this.getLocalCredentials()
        if (sessionToken) await this.deleteLocalSave()
        await this.clearLocalCredentials()
        await this.forgetCachedPlatformBinding()
        return { hadBinding: Boolean(sessionToken || apiId) }
    }

    /**
     * 为当前 API 账号设置新的 API Token。
     * @param {string} apiToken 新 API Token
     * @returns {Promise<any | null>} 设置结果；失败返回 `null`
     */
    async setApiToken(apiToken) {
        return this.requestApi(async () => {
            await this.ensureRemoteBinding()
            const sessionToken = await this.getSessionToken()
            return this.apiClient('/setApiToken', { ...this.platformParams(), token: sessionToken, token_new: apiToken })
        }, { errorPrefix: '设置 API Token 失败', notifyUser: true })
    }

    /**
     * 使用 API Token进行强认证，取得 SSTK 后为当前平台建立 Bot绑定。
     * @param {string} apiToken 待验证的 API Token
     * @returns {Promise<any | null>} 认证结果；失败返回 `null`
     */
    async authenticateApiToken(apiToken) {
        return this.requestApi(async () => {
            const data = (await this.apiClient('/getPgrToken', { api_token: apiToken })).data
            if (data?.token) await this.bindPlatform({ token: data.token })
            return data
        }, { errorPrefix: 'API Token 验证失败', notifyUser: true })
    }

    /**
     * 获取当前 API 账号已绑定的平台列表。
     * @returns {Promise<PlatformBindingsResponse | null>} 平台绑定列表；失败返回 `null`
     */
    async listPlatformBindings() {
        return this.requestApi(async () => {
            await this.ensureRemoteBinding()
            const sessionToken = await this.getSessionToken()
            return (await this.apiClient('/token/list', { ...this.platformParams(), token: sessionToken })).data
        }, { errorPrefix: '获取 Token 列表失败', notifyUser: true })
    }

    /**
     * 永久注销当前 API 账号；调用方应在成功后再清理本地 API 缓存。
     * @returns {Promise<any | null>} 注销结果；失败返回 `null`
     */
    async deleteApiAccount() {
        return this.requestApi(async () => {
            await this.ensureRemoteBinding()
            const sessionToken = await this.getSessionToken()
            return this.apiClient('/clear', { ...this.platformParams(), token: sessionToken })
        }, { errorPrefix: '注销 phi-api 账号失败', notifyUser: true })
    }

    /**
     * 读取当前用户按 sessionToken 缓存的本地存档。
     * @returns {Promise<import('./class/Save.js').default | undefined>} 本地存档；不存在时返回 `undefined`
     */
    async getLocalSave() {
        return getSave.getSave(this.userId)
    }

    /**
     * 保存当前用户的本地存档，并同步用户与 sessionToken 的映射。
     * @param {import('./class/Save.js').default | import('../lib/PhigrosUser.js').default} data 存档数据
     */
    async putLocalSave(data) {
        return getSave.putSave(this.userId, data)
    }

    /**
     * 读取当前用户按 sessionToken 缓存的本地历史记录。
     * @returns {Promise<import('./class/saveHistory.js').default>} 本地历史记录
     */
    async getLocalHistory() {
        return getSave.getHistory(this.userId)
    }

    /**
     * 保存当前用户的本地历史记录。
     * @param {import('./class/saveHistory.js').default | saveHistoryObject | object} data 历史记录数据
     */
    async putLocalHistory(data) {
        return getSave.putHistory(this.userId, data)
    }

    /**
     * 删除当前用户的本地存档、历史记录及 sessionToken 映射。
     * @returns {Promise<boolean>} 是否找到并删除了本地存档
     */
    async deleteLocalSave() {
        return getSave.delSave(this.userId)
    }

    /**
     * 读取当前用户按 API ID缓存的 API 存档。
     * @returns {Promise<import('./class/Save.js').default | undefined>} API 存档缓存
     */
    async getApiCachedSave() {
        return getSaveFromApi.getSave(this.userId)
    }

    /**
     * 保存当前用户的 API 存档缓存，并同步本地 API ID。
     * @param {Partial<oriSave | import('./class/Save.js').default>} data 包含 API ID的存档数据
     */
    async putApiCachedSave(data) {
        return getSaveFromApi.putSave(this.userId, data)
    }

    /**
     * 删除当前用户按 API ID保存的本地缓存，不影响 API 云端账号。
     * @returns {Promise<boolean>} 是否找到并删除了缓存
     */
    async deleteApiCachedSave() {
        return getSaveFromApi.delLocalSave(this.userId)
    }

    /**
     * 从 API 获取当前用户完整云存档。
     * @returns {Promise<import('./class/Save.js').default>} 初始化后的云存档
     */
    async getCloudSave() {
        await this.ensureRemoteBinding()
        return getSaveFromApi.getSaveFromApi(this.requireEvent())
    }

    /**
     * 从 API 获取当前用户指定字段的历史记录。
     * @template {keyof saveHistoryObject} K
     * @param {K[]} [fields] 需要返回的历史字段
     * @returns {Promise<import('./class/saveHistory.js').default>} 云端历史记录
     */
    async getCloudHistory(fields = []) {
        await this.ensureRemoteBinding()
        return getSaveFromApi.getHistory(this.requireEvent(), fields, this)
    }

    /**
     * 从 API 获取当前用户的成绩历史，支持全部成绩、单曲或单难度三种粒度。
     * @overload
     * @param {idString} songId
     * @param {levelKind} difficulty
     * @returns {Promise<ScoreDetail[]>}
     */
    /**
     * @overload
     * @param {idString} songId
     * @param {undefined} [difficulty]
     * @returns {Promise<songRecordHistory>}
     */
    /**
     * @overload
     * @param {undefined} [songId]
     * @param {undefined} [difficulty]
     * @returns {Promise<scoreHistoryObject>}
     */
    /**
     * 从 API 获取当前用户的成绩历史。
     * @param {idString} [songId] 曲目 ID
     * @param {levelKind} [difficulty] 难度
     */
    async getCloudSongHistory(songId, difficulty = undefined) {
        await this.ensureRemoteBinding()
        if (songId && difficulty) return getSaveFromApi.getSongHistory(this.requireEvent(), songId, difficulty, this)
        if (songId) return getSaveFromApi.getSongHistory(this.requireEvent(), songId, undefined, this)
        return getSaveFromApi.getSongHistory(this.requireEvent(), undefined, undefined, this)
    }

    /**
     * 从 API 拉取当前用户最新存档并更新 API 本地缓存。
     * @param {phigrosToken} [sessionToken] 绑定恢复时可用的 sessionToken
     * @returns {Promise<any>} 更新后的存档及增量统计
     */
    async getUpdatedSaveFromApi(sessionToken = undefined) {
        await this.ensureRemoteBinding()
        const { default: getUpdateSave } = await import('./getUpdateSave.js')
        return getUpdateSave.getNewSaveFromApi(this.requireEvent(), sessionToken, this)
    }

    /**
     * 直接从 Phigros 云存档更新当前用户的本地存档。
     * @param {phigrosToken} [sessionToken] Phigros sessionToken；省略时使用当前本地凭证
     * @param {boolean} [isGlobal] 是否使用国际服
     * @returns {Promise<any>} 更新后的存档及增量统计
     */
    async getUpdatedSaveFromLocal(sessionToken = undefined, isGlobal = undefined) {
        const { default: getUpdateSave } = await import('./getUpdateSave.js')
        return getUpdateSave.getNewSaveFromLocal(this.requireEvent(), sessionToken, isGlobal, this)
    }

    /**
     * 使用新的 sessionToken 完成本地绑定。
     * 只有成功读取并保存 Phigros 云存档后才替换本地凭证，API 绑定失败时可安全调用。
     * @param {phigrosToken} sessionToken 新的 Phigros sessionToken
     * @param {boolean} [isGlobal] 是否使用国际服
     * @returns {Promise<any | null>} 本地更新结果；token 校验或存档更新失败时返回 `null`
     */
    async bindLocallyWithSessionToken(sessionToken, isGlobal = undefined) {
        const updateData = await this.getUpdatedSaveFromLocal(sessionToken, isGlobal)
        if (!updateData) return null
        await this.useLocalSessionToken(sessionToken)
        return updateData
    }

    /**
     * 获取当前用户历史记录：有 SSTK 时先同步本地历史，否则直接读取 API。
     * @template {keyof saveHistoryObject} K
     * @param {K[]} [fields] 需要返回的历史字段
     * @returns {Promise<import('./class/saveHistory.js').default | null>} 历史记录；无法获取时返回 `null`
     */
    async getHistoryFromApi(fields = []) {
        await this.ensureRemoteBinding()
        const { default: getUpdateSave } = await import('./getUpdateSave.js')
        return getUpdateSave.getHistoryFromApi(this.requireEvent(), fields, this)
    }
}
