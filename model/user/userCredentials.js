import logger from '../../components/Logger.js'
import { Config } from '../../components/index.js'
import platform from '../../components/platform/index.js'
import PhigrosUser from '../../lib/PhigrosUser.js'
import { canUseApi } from './apiPermission.js'
import { PhiApiError } from '../api/phiApiErrors.js'
import getSave from '../save/getSave.js'
import getSaveFromApi from '../save/getSaveFromApi.js'
import makeRequest from '../api/makeRequest.js'
import makeRequestFnc from '../api/makeRequestFnc.js'
import userCredentialStore from './userCredentialStore.js'
import Save from '../save/Save.js'
import saveHistory from '../save/saveHistory.js'
import getNotes from './getNotes.js'
import fCompute from '../game/fCompute.js'
import { LevelNum } from '../game/constNum.js'
import getInfo from '../game/getInfo.js'

/** @typedef {{platform_name: string, platform_id: string, create_at: string, update_at: string, authentication: number, authentication_label?: string, binding_type?: 'bot'|'legacy', bot_display_name?: string, migration_notice?: string|null}} PlatformBindingInfo */
/** @typedef {{data: any, user_id: number, phigros_token: string, api_token: string, create_at: string, update_at: string, platform_data: PlatformBindingInfo[]}} PlatformBindingsResponse */
/** @typedef {{ignoreUnboundError?: boolean}} UserCredentialApiOptions */
/** @import {botEvent} from "../../components/baseClass.js" */
/**
 * 单个平台事件用户的凭证与存档操作入口。
 * 业务处理器应通过 `UserCredentials.fromEvent(e)` 创建实例，实例方法不得操作其他用户。
 */
export class UserCredentials {
    /**
     * 创建绑定到单个用户 ID 的凭证实例。
     * @param {string | number} userId 当前事件的用户 ID
     * @param {{event?: botEvent, store?: typeof userCredentialStore}} [dependencies] 测试或内部注入的依赖
     */
    constructor(userId, { event = undefined, store = userCredentialStore } = {}) {
        const normalizedUserId = String(userId ?? '').trim()
        if (!normalizedUserId) throw new TypeError('UserCredentials requires e.userId')
        this.userId = normalizedUserId
        this.event = event
            ? { ...event, user_id: normalizedUserId, userId: normalizedUserId }
            : undefined
        this.store = store
    }

    /**
     * 根据平台事件创建用户凭证实例，优先读取标准字段 `e.userId`，并兼容旧字段 `e.user_id`。
     * @param {any} e 当前平台事件
     * @param {{store?: typeof userCredentialStore}} [dependencies] 测试或内部注入的依赖
     * @returns {UserCredentials} 仅能操作当前事件用户的凭证实例
     */
    static fromEvent(e, dependencies = {}) {
        const userId = e?.userId ?? e?.user_id
        return new UserCredentials(userId, { ...dependencies, event: e })
    }

    /**
     * 获取实例关联的平台事件；需要平台上下文的方法在事件缺失时直接拒绝执行。
     * @returns 当前平台事件
     */
    requireEvent() {
        if (!this.event) throw new TypeError('This UserCredentials operation requires an event')
        return this.event
    }

    /**
     * 生成当前 Bot 平台用户的 API 参数，可选附加本地 SSTK或 API ID。
     * @param {boolean} [withAuthentication=false] 是否附加当前用户认证信息
     * @returns {Promise<import('../api/makeRequest.js').platformAuth & {token?: phigrosToken, api_user_id?: apiUserId}>} 平台及可选认证参数
     */
    async platformParams(withAuthentication = false) {
        const params = makeRequestFnc.makePlatform(this.requireEvent())
        if (!withAuthentication) return params
        const { sessionToken, apiId } = await this.getLocalCredentials()
        if (sessionToken) return { ...params, token: sessionToken }
        if (apiId) return { ...params, api_user_id: apiId }
        throw new PhiApiError('当前 Bot 本地尚未绑定用户', 404, 'binding_not_found')
    }

    /**
     * 生成具体 API 接口的执行上下文，日志标签和级别由 makeRequest 按接口固定。
     * @param {UserCredentialApiOptions} [options] 用户接口允许的错误选项
     * @returns {import('../api/makeRequest.js').ApiRequestExecutionOptions} 当前用户接口的错误处理上下文
     */
    endpointOptions(options = {}) {
        return {
            event: this.requireEvent(),
            ignoreUnboundError: options.ignoreUnboundError ? true : false,
        }
    }

    // 当前平台用户的本地凭证状态。

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
     * 删除当前用户的 sessionToken。
     */
    async deleteSessionToken() {
        return this.store.deleteSessionToken(this.userId)
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
        return this.store.setApiId(this.userId, /** @type {apiUserId} */(String(apiId)))
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

    /** 删除当前用户的 sessionToken 和 API ID。 */
    async clearLocalCredentials() {
        return this.store.clearLocalCredentials(this.userId)
    }

    /**
     * 切换为本地 sessionToken 身份，并清除可能冲突的 API ID。
     * @param {phigrosToken} sessionToken 新的 sessionToken
     */
    async useSessionToken(sessionToken) {
        await this.setSessionToken(sessionToken)
        await this.deleteApiId()
    }

    /**
     * 将当前用户切换为本地 API ID身份，并清除可能冲突的 sessionToken。
     * @param {apiUserId | string | number} apiId 新的 API ID
     */
    async useApiId(apiId) {
        await this.setApiId(apiId)
        await this.deleteSessionToken()
    }

    // 平台绑定与 API 账号操作。

    /**
     * 使用 API ID为当前 Bot平台账号建立首次绑定，并在方法内部完成错误处理。
     * @param {apiUserId | string | number} apiId 目标 API ID
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns 绑定结果；失败返回 `null`
     */
    async bindWithApiId(apiId, options = {}) {
        return this.bindPlatform(
            { api_user_id: apiId },
            { ...options, ignoreUnboundError: true },
        )
    }

    /**
     * 使用 sessionToken 为当前 Bot平台账号建立或迁移绑定，并在方法内部完成错误处理。
     * @param {phigrosToken} sessionToken Phigros sessionToken
     * @param {boolean} [isGlobal] 是否使用国际服
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns 绑定结果；失败返回 `null`
     */
    async bindWithSessionToken(sessionToken, isGlobal = undefined, options = {}) {
        return this.bindPlatform({ token: sessionToken, isGlobal }, options)
    }

    /**
     * 执行绑定原子操作。API 提交成功后才写入本地凭证，避免失败时破坏旧绑定。
     * @param {({token: phigrosToken, api_user_id?: never} | {token?: never, api_user_id: apiUserId | string | number}) & {isGlobal?: boolean}} binding 互斥的绑定凭证与服务器类型
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns  API 绑定结果及本地写入警告；失败返回 `null`
     */
    async bindPlatform(binding, options = {}) {
        const { platform, platform_id: platformId } = await this.platformParams()
        const data = await makeRequest.bindBotPlatform(
            {
                platform,
                platformId,
                ...(binding.token ? { token: binding.token } : { apiUserId: binding.api_user_id }),
                ...(binding.isGlobal === true ? { isGlobal: true } : {}),
            },
            {
                event: this.requireEvent(),
                ignoreUnboundError: options.ignoreUnboundError === true,
                errorPrefix: binding.token
                    ? 'API绑定暂时不可用，将仅更新当前 Bot 的本地绑定状态。'
                    : undefined,
                notifyUser: Boolean(binding.token),
            },
        )
        if (!data) return null
        let localCredentialWarning = false
        try {
            if (binding.token) {
                await this.useSessionToken(binding.token)
            } else {
                await this.useApiId(data.apiUserId)
            }
        } catch {
            localCredentialWarning = true
            logger.warn('[phi-plugin] API绑定已成功，但本地用户凭证写入失败')
        }
        return { ...data, localCredentialWarning }
    }

    /**
     * 仅解绑当前 Bot本地用户，不请求 API，也不删除 API 共享存档缓存。
     * @returns {Promise<{hadBinding: boolean}>} 本地执行前是否存在凭证
     */
    async unbindLocal() {
        const { sessionToken, apiId } = await this.getLocalCredentials()
        if (sessionToken) await this.deleteLocalSave()
        await this.clearLocalCredentials()
        return { hadBinding: Boolean(sessionToken || apiId) }
    }

    /**
     * 为当前 API 账号设置新的 API Token。
     * @param {string} apiToken 新 API Token
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns 设置结果；失败返回 `null`
     */
    async setApiToken(apiToken, options = {}) {
        const sessionToken = await this.getSessionToken()
        return makeRequest.setApiToken(
            { ...(await this.platformParams()), token: sessionToken, token_new: apiToken },
            { ...this.endpointOptions(options), errorPrefix: '设置 API Token 失败', notifyUser: true },
        )
    }

    /**
     * 使用 API Token进行强认证，取得 SSTK 后为当前平台建立 Bot绑定。
     * @param {string} apiToken 待验证的 API Token
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns 认证结果；失败返回 `null`
     */
    async authenticateApiToken(apiToken, options = {}) {
        const data = await makeRequest.getPgrToken(
            { api_token: apiToken },
            {
                ...this.endpointOptions(options),
                errorPrefix: 'API Token 验证失败',
                notifyUser: true,
            },
        )
        if (data?.token) await this.bindPlatform({ token: data.token })
        return data
    }

    /**
     * 获取当前 API 账号已绑定的平台列表。
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<PlatformBindingsResponse | null>} 平台绑定列表；失败返回 `null`
     */
    async listPlatformBindings(options = {}) {
        const sessionToken = await this.getSessionToken()
        return makeRequest.tokenList(
            { ...(await this.platformParams()), token: sessionToken },
            { ...this.endpointOptions(options), errorPrefix: '获取 Token 列表失败', notifyUser: true },
        )
    }

    /**
     * 永久注销当前 API 账号；调用方应在成功后再清理本地 API 缓存。
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns 注销结果；失败返回 `null`
     */
    async deleteApiAccount(options = {}) {
        const sessionToken = await this.getSessionToken()
        return makeRequest.clear(
            { ...(await this.platformParams()), token: sessionToken },
            { ...this.endpointOptions(options), errorPrefix: '注销 phi-api 账号失败', notifyUser: true },
        )
    }

    /**
     * 获取当前 API 用户的禁用状态。
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<boolean | null>} 禁用状态；请求失败或被忽略时返回 `null`
     */
    async getUserAPIBanStatus(options = {}) {
        const endpointOptions = this.endpointOptions(options)
        try {
            return await makeRequest.getUserBan(
                await this.platformParams(true),
                endpointOptions,
            )
        } catch (error) {
            if (makeRequest.shouldIgnoreError(error, endpointOptions)) return null
            throw error
        }
    }

    /**
     * 获取当前用户的本地禁用状态。
     * @returns {Promise<boolean | null>} 禁用状态；请求失败或被忽略时返回 `null`
     */
    async getUserLoaclBanStatus() {
        return await userCredentialStore.isSessionTokenBanned(await this.getSessionToken())
    }

    /**
     * 获取当前用户的谱面标签投票记录。
     * @param {any[]} data 谱面与难度查询列表
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<any[] | null>} 用户投票记录；请求失败或被忽略时返回 `null`
     */
    async getChartsUsersVote(data, options = {}) {
        return makeRequest.getChartsUsersVote(
            { ...(await this.platformParams(true)), data },
            this.endpointOptions(options),
        )
    }

    /**
     * 获取当前用户附近的排行榜数据。
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns 排行榜数据；请求失败或被忽略时返回 `null`
     */
    async getRanklistUser(options = {}) {
        return makeRequest.getRanklistUser(
            await this.platformParams(true),
            this.endpointOptions(options),
        )
    }

    /**
     * 获取当前用户发布的评论。
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<any[] | null>} 评论列表；请求失败或被忽略时返回 `null`
     */
    async getCommentsByUserId(options = {}) {
        return makeRequest.getCommentsByUserId(
            await this.platformParams(true),
            this.endpointOptions(options),
        )
    }

    /**
     * 获取当前用户在指定谱面的成绩排行。
     * @param {{songId: idString, rank: levelKind, orderBy: 'acc'|'score'|'fc'|'update_at'}} query 查询条件
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns 成绩排行数据；请求失败或被忽略时返回 `null`
     */
    async getScoreRanklistByUser(query, options = {}) {
        return makeRequest.getScoreRanklistByUser(
            { ...(await this.platformParams(true)), ...query },
            this.endpointOptions(options),
        )
    }

    /**
     * 获取当前用户的 B30 谱面标签分析。
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns 标签分析；请求失败或被忽略时返回 `null`
     */
    async getB30TagAnalysis(options = {}) {
        return makeRequest.getB30TagAnalysis(
            await this.platformParams(true),
            this.endpointOptions(options),
        )
    }

    /**
     * 将当前用户的本地历史记录上传到 API。
     * @param {import('../save/saveHistory.js').default | saveHistoryObject} history 待上传的历史记录
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<{message: string} | null>} 上传结果；失败返回 `null`
     */
    async uploadHistory(history, options = {}) {
        const sessionToken = await this.getSessionToken()
        return makeRequest.setHistory(
            { ...(await this.platformParams()), token: sessionToken, data: /** @type {any} */ (history) },
            this.endpointOptions(options),
        )
    }

    /**
     * 获取当前用户的 API 隐私与数据设置。
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<import('../api/makeRequest.js').userSetting | null>} 用户设置；失败返回 `null`
     */
    async getUserSetting(options = {}) {
        const sessionToken = await this.getSessionToken()
        return makeRequest.getUserSetting(
            { ...(await this.platformParams()), token: sessionToken },
            { ...this.endpointOptions(options), errorPrefix: '获取用户设置失败', notifyUser: true },
        )
    }

    /**
     * 更新当前用户的 API 隐私与数据设置。
     * @param {import('../api/makeRequest.js').userSetting} setting 需要更新的设置字段
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<import('../api/makeRequest.js').userSetting | null>} 更新后的设置；失败返回 `null`
     */
    async setUserSetting(setting, options = {}) {
        const sessionToken = await this.getSessionToken()
        return makeRequest.setUserSetting(
            { ...(await this.platformParams()), token: sessionToken, setting },
            { ...this.endpointOptions(options), errorPrefix: '设置失败', notifyUser: true },
        )
    }

    /**
     * 提交当前用户对指定谱面的标签投票。
     * @param {idString} songId 曲目 ID
     * @param {levelKind} rank 难度
     * @param {chartsTagString[]} tags 标签列表
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<{message: string} | null>} 投票结果；失败返回 `null`
     */
    async setChartsTag(songId, rank, tags, options = {}) {
        const sessionToken = await this.getSessionToken()
        return makeRequest.setChartsTag(
            { ...(await this.platformParams()), token: sessionToken, song_id: songId, rank, content: tags },
            { ...this.endpointOptions(options), errorPrefix: '投票失败QAQ！ERROR', notifyUser: true },
        )
    }

    /**
     * 添加当前用户的在线谱面评论。
     * @param {import('../api/makeRequest.js').APIUpdateCommentObject} comment 评论内容
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<{message: string} | null>} 添加结果；失败返回 `null`
     */
    async addComment(comment, options = {}) {
        const sessionToken = await this.getSessionToken()
        return makeRequest.addComment(
            { ...(await this.platformParams()), token: sessionToken, data: { comment } },
            this.endpointOptions(options),
        )
    }

    /**
     * 删除当前用户指定 ID 的在线评论。
     * @param {string} commentId 评论 ID
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<{message: string} | null>} 删除结果；失败返回 `null`
     */
    async deleteComment(commentId, options = {}) {
        const sessionToken = await this.getSessionToken()
        return makeRequest.delComment(
            { ...(await this.platformParams()), token: sessionToken, comment_id: commentId },
            this.endpointOptions(options),
        )
    }

    // 以 sessionToken 为键的本地存档仓库操作。

    /**
     * 读取当前用户按 sessionToken 缓存的本地存档。
     * @returns {Promise<import('../save/Save.js').default | undefined>} 本地存档；不存在时返回 `undefined`
     */
    async getLocalSave() {
        return getSave.getSaveBySessionToken(await this.getSessionToken())
    }

    /**
     * 保存当前用户的本地存档，并同步用户与 sessionToken 的映射。
     * @param {import('../save/Save.js').default | import('../../lib/PhigrosUser.js').default} data 存档数据
     */
    async putLocalSave(data) {
        await getSave.putSaveBySessionToken(data)
        return this.setSessionToken(data.session)
    }

    /**
     * 读取当前用户按 sessionToken 缓存的本地历史记录。
     * @returns {Promise<import('../save/saveHistory.js').default>} 本地历史记录
     */
    async getLocalHistory() {
        return getSave.getHistoryBySessionToken(await this.getSessionToken())
    }

    /**
     * 保存当前用户的本地历史记录。
     * @param {import('../save/saveHistory.js').default | saveHistoryObject | object} data 历史记录数据
     */
    async putLocalHistory(data) {
        const sessionToken = await this.getSessionToken()
        if (!sessionToken) throw new Error('sessionToken is undefined')
        return getSave.putHistoryBySessionToken(sessionToken, data)
    }

    /**
     * 删除当前用户的本地存档、历史记录及 sessionToken 映射。
     * @returns {Promise<boolean>} 是否找到并删除了本地存档
     */
    async deleteLocalSave() {
        const sessionToken = await this.getSessionToken()
        const deleted = await getSave.deleteSaveBySessionToken(sessionToken)
        await this.deleteSessionToken()
        return deleted
    }

    // 以 API ID 为键的只读存档缓存操作。

    /**
     * 读取当前用户按 API ID缓存的 API 存档。
     * @returns {Promise<import('../save/Save.js').default | undefined>} API 存档缓存
     */
    async getApiCachedSave() {
        return getSaveFromApi.getSaveByApiId(await this.getApiId())
    }

    /**
     * 保存当前用户的 API 存档缓存，并同步本地 API ID。
     * @param {Partial<oriSave | import('../save/Save.js').default>} data 包含 API ID的存档数据
     */
    async putApiCachedSave(data) {
        const apiId = data?.apiId
        if (!apiId) throw new Error('apiId is undefined')
        await getSaveFromApi.putSaveByApiId(apiId, data)
        return this.setApiId(apiId)
    }

    /**
     * 删除当前用户按 API ID保存的本地缓存，不影响 API 云端账号。
     * @returns {Promise<boolean>} 是否找到并删除了缓存
     */
    async deleteApiCachedSave() {
        const apiId = await this.getApiId()
        const deleted = getSaveFromApi.deleteSaveByApiId(apiId)
        await this.deleteApiId()
        return deleted
    }

    // API 云端存档与历史读取。

    /**
     * 从 API 获取当前用户完整云存档。
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<Save | null>} 初始化后的云存档；失败返回 `null`
     */
    async getCloudSave(options = {}) {
        const cloudSave = await makeRequest.getCloudSaves(
            await this.platformParams(true),
            this.endpointOptions(options),
        )
        if (!cloudSave) return null
        let result = new Save(cloudSave)
        await result.init()
        return result
    }

    /**
     * 使用公开 API ID读取其他用户的完整云存档。
     * @param {apiUserId} apiId 公开 API ID
     * @param {UserCredentialApiOptions} [options] 错误处理策略
     * @returns {Promise<Save | null>} 已初始化的云存档
     */
    async getCloudSaveByApiId(apiId, options = {}) {
        const cloudSave = await makeRequest.getCloudSaves(
            { api_user_id: apiId },
            this.endpointOptions(options),
        )
        if (!cloudSave) return null
        const result = new Save(cloudSave)
        await result.init()
        return result
    }

    /**hu
     * 从 API 获取当前用户指定字段的历史记录。
     * @template {keyof saveHistoryObject} K
     * @param {K[]} [fields] 需要返回的历史字段
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<saveHistory | null>} 云端历史记录；失败返回 `null`
     */
    async getCloudHistory(fields = [], options = {}) {
        const result = await makeRequest.getHistory(
            { ...(await this.platformParams(true)), request: fields },
            this.endpointOptions(options),
        )
        if (!result) return null
        return new saveHistory(result)
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
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<ScoreDetail[] | songRecordHistory | scoreHistoryObject | null>} 成绩历史；失败返回 `null`
     */
    async getCloudSongHistory(songId, difficulty = undefined, options = {}) {
        return makeRequest.getHistoryRecord(
            {
                ...(await this.platformParams(true)),
                ...(songId ? { song_id: songId } : {}),
                ...(difficulty ? { rank: difficulty } : {}),
            },
            this.endpointOptions(options),
        )
    }

    // 云端存档同步与本地增量计算。

    /**
     * 从 API 拉取当前用户最新存档并更新 API 本地缓存。
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns 更新后的存档及增量统计；失败返回 `null`
     */
    async getUpdatedSaveFromApi(options = {}) {
        const event = this.requireEvent()
        const old = await this.getApiCachedSave()
        const newSaveInfo = await makeRequest.getCloudSaveInfo(
            {
                ...(await this.platformParams(true)),
            },
            this.endpointOptions(options),
        )
        if (!newSaveInfo) return null
        if (new Date(newSaveInfo.modifiedAt.iso).getTime() != old?.saveInfo?.modifiedAt?.iso?.getTime()) {
            const newSave = await makeRequest.getCloudSaves(
                {
                    ...(await this.platformParams(true))
                },
                this.endpointOptions(options),
            )
            if (!newSave) return null
            await this.putApiCachedSave(newSave)
            const result = new Save(newSave)
            await result.init()
            await this.putApiCachedSave(result)
            const added_rks_notes = await buildingRecord(old, result, event)
            return { save: result, added_rks_notes }
        } else {
            return { save: old, added_rks_notes: [0, 0] }
        }
    }

    /**
     * 直接从 Phigros 云存档更新当前用户的本地存档。
     * @param {phigrosToken} [sessionToken] Phigros sessionToken；省略时使用当前本地凭证
     * @param {boolean} [isGlobal] 是否使用国际服
     * @returns {Promise<any>} 更新后的存档及增量统计
     */
    async getUpdatedSaveFromLocal(sessionToken = undefined, isGlobal = undefined) {
        const event = this.requireEvent()
        const old = await this.getLocalSave()
        sessionToken = sessionToken ?? old?.session
        if (!sessionToken) throw new Error('缺少 sessionToken 参数')

        const user = new PhigrosUser(sessionToken, isGlobal ?? old?.global)
        try {
            await user.getSaveInfo()
            await user.buildRecord()
            if (getInfo.badSave && new Save(user).equalRecord(getInfo.badSave)) {
                notifyUser(event, '请注意，TapTap目前的云存档API疑似存在问题，已阻止本次更新，请在确保游戏内数据正常的情况下，覆盖云存档并尝试更新，如若依旧失败请耐心等待恢复。')
                return old ? { save: old, added_rks_notes: [0, 0] } : undefined
            }
        } catch (error) {
            const message = platform.getAdapterName(event) === 'QQBot'
                ? '更新失败！QAQ\n请稍后重试'
                : `更新失败！QAQ\n${error}`
            notifyUser(event, message)
            logger.error(error)
            return undefined
        }

        try {
            await this.putLocalSave(user)
        } catch (error) {
            notifyUser(event, `保存存档失败！${error}`)
            logger.error(error)
            return undefined
        }

        if (old?.session && old.session !== user.session) {
            notifyUser(event, `检测到新的sessionToken，将自动更换本地绑定。如果需要删除当前 Bot 本地保存的存档和历史，请使用 ⌈/${Config.getUserCfg('config', 'cmdhead')} unbind⌋。`)
        }

        const now = new Save(user)
        const history = await this.getLocalHistory()
        history.update(now)
        await this.putLocalHistory(history)
        const added_rks_notes = await buildingRecord(old, now, event)
        return { save: now, added_rks_notes }
    }

    /**
     * 使用新的 sessionToken 完成本地绑定。
     * 只有成功读取并保存 Phigros 云存档后才替换本地凭证，API 绑定失败时可安全调用。
     * @param {phigrosToken} sessionToken 新的 Phigros sessionToken
     * @param {boolean} [isGlobal] 是否使用国际服
     * @returns 本地更新结果；token 校验或存档更新失败时返回 `null`
     */
    async bindLocallyWithSessionToken(sessionToken, isGlobal = undefined) {
        const updateData = await this.getUpdatedSaveFromLocal(sessionToken, isGlobal)
        if (!updateData) return null
        await this.useSessionToken(sessionToken)
        return updateData
    }

    /**
     * 获取当前用户历史记录：有 SSTK 时先同步本地历史，否则直接读取 API。
     * @template {keyof saveHistoryObject} K
     * @param {K[]} [fields] 需要返回的历史字段
     * @param {UserCredentialApiOptions} [options] 错误处理策略，可忽略未绑定错误
     * @returns {Promise<import('../save/saveHistory.js').default | null>} 历史记录；无法获取时返回 `null`
     */
    async getHistoryFromApi(fields = [], options = {}) {
        const event = this.requireEvent()
        const sessionToken = await this.getSessionToken()
        if (!sessionToken) {
            if (!await canUseApi(event)) {
                notifyUser(event, '请先绑定sessionToken哦！')
                return null
            }
            const remoteHistory = await this.getCloudHistory(fields, options)
            if (!remoteHistory && !options.ignoreUnboundError) {
                notifyUser(event, '从API获取历史记录失败，请稍后重试或绑定sessionToken后重试哦')
            }
            return remoteHistory
        }

        const localHistory = await this.getLocalHistory()
        if (localHistory) await this.uploadHistory(localHistory)
        const remoteHistory = await this.getCloudHistory(fields, options)
        if (remoteHistory) return remoteHistory
        if (!options.ignoreUnboundError) {
            logger.warn('[phi-plugin]获取历史记录失败，将使用本地历史记录')
            notifyUser(event, '从API获取历史记录失败，将使用本地存档的历史记录哦')
        }
        return localHistory
    }
}

/**
     * 更新存档
     * @param {botEvent} e
     * @param {Save | oriSave | undefined} old
     * @param {Save | oriSave} now
     * @returns {Promise<[number,number]>} [rks变化值，note变化值]，失败返回 false
     */
async function buildingRecord(old = undefined, now, e) {


    let notesData = await getNotes.getNotesData(e.user_id)
    /**删除旧字段 */
    // @ts-ignore
    if (notesData.update || notesData.task_update) {
        // @ts-ignore
        delete notesData.update
        // @ts-ignore
        delete notesData.task_update
    }

    /**note数量变化 */
    let add_money = 0

    let task = notesData?.task
    if (task) {
        const idList = fCompute.objectKeys(now.gameRecord)
        for (let id of idList) {
            for (let i in task) {
                if (!task[i]) continue
                if (!task[i].finished && id == task[i].song) {
                    let level = LevelNum[task[i].request.rank]
                    if (!now.gameRecord[id][level]) continue
                    switch (task[i].request.type) {
                        case 'acc': {
                            if (now.gameRecord[id][level].acc >= task[i].request.value) {
                                notesData.task[i].finished = true
                                notesData.money += task[i].reward
                                add_money += task[i].reward
                            }
                            break
                        }
                        case 'score': {
                            if (now.gameRecord[id][level].score >= task[i].request.value) {
                                notesData.task[i].finished = true
                                notesData.money += task[i].reward
                                add_money += task[i].reward
                            }
                            break
                        }
                    }
                }
            }
        }
    }
    getNotes.putNotesData(e.user_id, notesData)

    /**rks变化 */
    let add_rks = old ? now.saveInfo.summary.rankingScore - old.saveInfo.summary.rankingScore : 0
    return [add_rks, add_money]
}

/**
 * 通过平台适配器发送 UserCredentials 内部流程提示，避免反向依赖 send 模块。
 * @param {botEvent} event 当前平台事件
 * @param {string} message 提示内容
 */
function notifyUser(event, message) {
    return platform.sendWithAt(platform.wrapEvent(event), message, false, {})
}
