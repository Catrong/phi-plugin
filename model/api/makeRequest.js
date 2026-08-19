import saveHistory from '../save/saveHistory.js';
import phiApiClient from './phiApiClient.js';
import logger from '../../components/Logger.js';
import platform from '../../components/platform/index.js';
import { APII18NCN } from '../game/constNum.js';
import { getPhiApiUserMessage, hasPhiApiUserMessage } from './phiApiErrors.js';

/**
 * API 请求的统一错误处理选项。
 * @typedef {Object} ApiRequestOptions
 * @property {string} [errorPrefix] 发送给用户的错误提示前缀
 * @property {boolean} [notifyUser] 未命中内置用户提示时是否仍通知用户
 * @property {string} [logTag] 错误日志标签；为空时不记录日志
 * @property {'warn'|'error'} [loggerLevel] 错误日志级别
 * @property {string[]} [ignoreMessages] 需要静默忽略的错误消息
 * @property {string[]} [ignoreCodes] 需要静默忽略的稳定错误码
 * @property {boolean} [ignoreUnboundError] 是否静默忽略“当前用户未绑定”错误
 */

/**
 * 具体接口函数的执行上下文。日志标签和级别由接口自身确定，不允许调用方覆盖。
 * @typedef {Object} ApiRequestExecutionOptions
 * @property {import('../../components/baseClass.js').botEvent} event 当前平台事件
 * @property {boolean} [ignoreUnboundError] 是否静默忽略未绑定错误
 * @property {boolean} [notifyUser] 是否通知用户
 * @property {string} [errorPrefix] 用户提示前缀
 */

/** @type {Record<string, {logTag: string, loggerLevel: 'warn'|'error'}>} */
const ENDPOINT_ERROR_LOGGING = {
    '/bot/bindings/bind': { logTag: 'API错误 bind platform', loggerLevel: 'error' },
    '/chartsTag/set/set': { logTag: 'setChartsTag', loggerLevel: 'error' },
    '/setApiToken': { logTag: 'setApiToken', loggerLevel: 'error' },
    '/clear': { logTag: 'clearApiAccount', loggerLevel: 'error' },
}

/** @param {string} path @returns {{logTag: string, loggerLevel: 'warn'|'error'}} */
function endpointErrorLogging(path) {
    if (path.startsWith('/alias-proposals')) {
        return { logTag: `API错误 alias proposal ${path}`, loggerLevel: 'warn' }
    }
    return ENDPOINT_ERROR_LOGGING[path] || { logTag: `API错误 ${path}`, loggerLevel: 'warn' }
}


/**
 * @typedef {Object} platformAuth
 * @property {string} platform 平台名称
 * @property {string} platform_id 用户平台内id
 * @property {string} _local_user_id Bot本地Redis用户键（API忽略）
 */

/**
 * @typedef {Object} apiAuth
 * @property {string} api_user_id 用户api内id
 */

/**
 * @typedef {Object} tokenAuth
 * @property {string} token PhigrosToken
 */

/**
 * @typedef {Object} apiTokenAuth
 * @property {string} api_token 用户api token
 */

/**
 * 基础鉴权：(platform+platform_id | api_user_id) + (token | api_token)
 * @typedef {(platformAuth | apiAuth | tokenAuth) & Partial<(tokenAuth | apiTokenAuth)>} baseAu
 */

/**
 * 高级鉴权：(platform+platform_id | api_user_id) + (token | api_token)
 * @typedef {(platformAuth | apiAuth | tokenAuth) & (tokenAuth | apiTokenAuth)} highAu
 */

/**
 * @typedef {Object} BindSuccessResponse
 * @property {string} message - Response message (e.g., "绑定成功")
 * @property {Object} data - Response data
 * @property {number} data.internal_id - 用户内部ID
 * @property {boolean} data.have_api_token - 是否拥有API Token
 * @property {boolean} [data.binding_cache_warning] - API绑定成功但本地凭据缓存需重试
 */

/**
 * @typedef {Object} PlatformDataItem
 * @property {string} platform_name
 * @property {string} platform_id
 * @property {string} create_at
 * @property {string} update_at
 * @property {number} authentication - 认证状态
 * @property {'bot'|'legacy'} [binding_type] 绑定来源
 * @property {string} [binding_id] Bot独立绑定ID
 * @property {string} [bot_client_id] Bot clientId
 * @property {string} [bot_display_name] Bot展示名（含四位编号）
 * @property {boolean} [bot_claimed] Bot是否已被认领
 * @property {'active'|'revoked'} [bot_status] Bot状态
 * @property {string} [authentication_label] 面向用户的认证状态
 * @property {string|null} [migration_notice] 旧绑定更新提示
 */

/**
 * @typedef {Object} UserData
 * @property {string} user_id
 * @property {string} phigros_token
 * @property {string} api_token
 * @property {string} create_at
 * @property {string} update_at
 * @property {PlatformDataItem[]} platform_data
 */

/**
 * @typedef {Object} UserResponse
 * @property {UserData} data
 * @property {number} user_id - Reference to definition 168966427
 * @property {string} phigros_token - Reference to definition 168966417
 * @property {string} api_token - Reference to definition 168966428
 * @property {string} create_at
 * @property {string} update_at
 * @property {PlatformDataItem[]} platform_data - Reference to definition 169006958
 */

/**
 * @typedef {Object} songInfoRequest
 * @property {string} song_id - 歌曲ID
 * @property {levelKind} difficulty - 难度
 */

/**
 * @typedef {Object} difficultyRecord
 * @property {boolean} fc
 * @property {number} score
 * @property {number} acc
 */

/**
 * @typedef {Array<difficultyRecord | null>} songRecord
 */

/**
 * @typedef {Object} getCloudSongResponse
 * @property {songRecord|difficultyRecord} data
 */

/**
 * 游戏用户基础信息
 * @typedef {Object} GameUserBasic
 * @property {string} background 背景图
 * @property {string} [selfIntro] 自我介绍（仅me对象中存在）
 */

/**
 * 分数概要信息
 * @typedef {Object} SummaryInfo
 * @property {number} rankingScore 排名分数
 * @property {number} challengeModeRank 挑战模式排名
 * @property {string} [updatedAt] 更新时间（仅me对象中存在）
 * @property {string} [avatar] 头像（仅me对象中存在）
 */

/**
 * 修改时间
 * @typedef {Object} ModifiedTime
 * @property {string} iso ISO时间戳
 */

/**
 * 存档信息
 * @typedef {Object} SaveInfo
 * @property {SummaryInfo} summary 分数概要
 * @property {ModifiedTime} modifiedAt 修改时间
 * @property {string} PlayerId 玩家ID
 */

/**
 * 挑战模式条目
 * @typedef {Object} ChallengeListItem
 * @property {number} ChallengeMode 挑战模式
 * @property {number} ChallengeModeRank 挑战模式排名
 * @property {string} date 日期
 */

/**
 * 用户条目
 * @typedef {Object} UserItem
 * @property {GameUserBasic} gameuser 基础信息（普通用户只有background）
 * @property {SaveInfo} saveInfo 存档信息
 * @property {number} index 用户索引
 * @property {boolean} me 是否为当前用户
 */

/**
 * 当前用户数据
 * @typedef {Object} MeData
 * @property {oriSave} save 存档数据
 * @property {saveHistoryObject} history 用户历史记录
 */

/**
 * ranklist响应数据主体
 * @typedef {Object} ranklistResponseData
 * @property {number} totDataNum 数据总数
 * @property {UserItem[]} users 用户数组
 * @property {MeData} me 当前用户扩展数据
 */

/**
 * scoreList用户对象
 * @typedef {Object} ScoreListUserItem
 * @property {number} index 用户排名
 * @property {Object} gameuser 用户基础信息
 * @property {string} gameuser.background 背景图
 * @property {number} gameuser.rankingScore rks
 * @property {number} gameuser.challengeModeRank 课题分
 * @property {string} gameuser.avatar 头像
 * @property {string} gameuser.modifiedAt 账户活跃时间
 * @property {string} gameuser.PlayerId 玩家ID
 * @property {Object} record 用户成绩记录
 * @property {number} record.score 分数
 * @property {number} record.acc 准确率
 * @property {boolean} record.fc 是否FC
 * @property {number} record.updated_at 成绩更新时间
 */
/**
 * scoreList响应数据主体
 * @typedef {Object} ScoreListResponseData
 * @property {number} totDataNum 数据总数
 * @property {number} userRank 用户排名
 * @property {ScoreListUserItem[]} users 用户数组
 */

/**
 * @typedef {object} liteScoreDetail
 * @property {number} score 分数
 * @property {number} acc 准确率
 * @property {number} fc 是否FC
 * @property {number} rksWhenInsert 插入时RKS
 * @property {number} updated_at 更新时间戳
 */

/**
 * @typedef {object} apFcCountResult
 * @property {number} total 总成绩数
 * @property {number} fcCount FC数量
 * @property {number} apCount AP数量
 */

/**
 * @typedef {Object} APIUpdateCommentObject 评论对象
 * @property {string} songId 曲目ID
 * @property {allLevelKind} rank 等级
 * @property {apiUserId} apiUserId 用户ID
 * @property {number} rks
 * @property {number} score
 * @property {number} acc
 * @property {boolean} fc
 * @property {string} [spInfo] FC AP
 * @property {number} challenge
 * @property {string} [time]
 * @property {string} comment 评论内容
 */

/**
 * @typedef {Object} APICommentObject 评论对象
 * @property {phigrosToken} [sessionToken] 仅在新建时添加
 * @property {number} id 自增长ID
 * @property {string} songId 曲目ID
 * @property {allLevelKind} rank 等级
 * @property {apiUserId} apiUserId 用户ID
 * @property {number} rks
 * @property {number} score
 * @property {number} acc
 * @property {boolean} fc
 * @property {string} spInfo FC AP
 * @property {number} challenge
 * @property {string} time
 * @property {string} comment 评论内容
 * @property {?string} PlayerId 仅在查询时添加
 * @property {?string} avatar 仅在查询时添加
 */

/**
 * @typedef {Object} userSetting
 * @property {boolean} [allowDataCollection] 是否允许数据收集
 * @property {boolean} [allowLeaderboard] 是否允许排行榜展示
 * @property {boolean} [allowDataAggregation] 是否允许数据聚合
 * @property {boolean} [allowPlayerIdSearch] 是否允许按PlayerId搜索
 * @property {boolean} [allowUserIdSearch] 是否允许按UserId搜索
 */

/**
 * 谱面标签有效票数映射。分类标签的计数为其下细分标签数量/票数聚合，细分标签为实际投票项。
 * @typedef {Record<chartsTagString, number>} chartsTagVoteCountMap
 */

/**
 * @typedef {object} chartsTagRequestData
 * @property {idString} song_id 曲目ID
 * @property {levelKind[]} [rank] 难度
 */

/**
 * 谱面标签树节点。
 * parentId 为空时为分类标签；细分标签可通过 parentIds 同时归属多个分类。
 * @typedef {object} ChartTagTreeNode
 * @property {number} [id] 标签ID
 * @property {chartsTagString} name 标签名
 * @property {number | null} [parentId] 父标签ID，分类标签为空
 * @property {number[]} [parentIds] 原始父标签ID列表，可包含多个分类
 * @property {'category' | 'detail'} [kind] 标签节点类型
 * @property {string | null} [description] 标签描述
 * @property {string | null} [icon] 标签图标
 * @property {number} [sortOrder] 排序权重
 * @property {number} [status] 状态
 * @property {number} voteCount 展示用有效票数
 * @property {number} [primaryVoteCount] 主要票数量
 * @property {number} [secondaryVoteCount] 次要票数量
 * @property {ChartTagTreeNode[]} children 子标签
 */

/**
 * 谱面标签统计响应，data 为平铺有效票数，tree 为分类/细分树。
 * @typedef {object} ChartTagSongRankResponse
 * @property {chartsTagVoteCountMap} data 平铺有效票数
 * @property {chartsTagVoteCountMap} [primary] 主要票统计
 * @property {chartsTagVoteCountMap} [secondary] 次要票统计
 * @property {ChartTagTreeNode[]} tree 标签树
 */

/**
 * @typedef {object} chartsTagResponseData
 * @property {apiUserId} user_id 用户ID
 * @property {idString} songId 曲目ID
 * @property {levelKind} rank 难度
 * @property {string} time 时间
 * @property {chartsTagString[]} tags 标签内容，旧字段；没有区分主要/次要时使用
 * @property {chartsTagString[]} [primaryTags] 主要票标签
 * @property {chartsTagString[]} [secondaryTags] 次要票标签
 */

/**
 * 设置谱面标签投票请求。
 * content 为旧字段；新版后端优先读取 primaryTags / secondaryTags。
 * @typedef {highAu & {
 *   song_id: idString,
 *   rank: levelKind,
 *   content?: chartsTagString[],
 *   primaryTags?: chartsTagString[],
 *   secondaryTags?: chartsTagString[]
 * }} setChartsTagParams
 */

export default class makeRequest {

    /**
     * 从未知异常中提取可读错误消息。
     * @param {any} error 捕获到的异常
     * @returns {string} 规范化后的错误消息
     */
    static getErrorMessage(error) {
        return String(error?.message || error?.cause || error?.code || error || '未知错误')
    }

    /**
     * 判断异常是否命中调用方配置的静默规则。
     * `ignoreUnboundError` 只匹配稳定错误码和旧版明确消息，不会吞掉其他 401/403。
     * @param {any} error 捕获到的异常
     * @param {ApiRequestOptions} [options] 错误处理策略
     * @returns {boolean} 是否应静默忽略
     */
    static shouldIgnoreError(error, options = {}) {
        const errorCode = String(error?.code || '')
        const errorMessage = makeRequest.getErrorMessage(error)
        if (options.ignoreCodes?.includes(errorCode)) return true
        if (options.ignoreMessages?.includes(errorMessage)) return true
        return options.ignoreUnboundError !== false && (
            errorCode === 'binding_not_found'
            || errorMessage === 'binding_not_found'
            || errorMessage === APII18NCN.userNotFound
        )
    }

    /**
     * 统一处理 API 请求错误，包括用户提示、日志和静默规则。
     * @param {import('../../components/baseClass.js').botEvent} event 当前平台事件
     * @param {any} error 捕获到的异常
     * @param {ApiRequestOptions} [options] 错误处理策略
     * @returns {boolean} 是否已按静默规则忽略
     */
    static handleApiError(event, error, options = {}) {
        if (makeRequest.shouldIgnoreError(error, options)) return true

        const {
            errorPrefix = '',
            notifyUser = false,
            logTag = '',
            loggerLevel = 'warn',
        } = options
        const errorMessage = makeRequest.getErrorMessage(error)
        let userMessage = hasPhiApiUserMessage(error) ? getPhiApiUserMessage(error) : null
        const status = error?.status ?? (typeof error?.code === 'number' ? error.code : undefined)

        if (status === 403 && !userMessage) {
            userMessage = `API访问被拒绝。${errorMessage || '请检查你的设置是否正确启用了API访问权限。'}`
        } else if (status >= 500 && !userMessage) {
            userMessage = `API访问发生服务器错误。${errorMessage || '请稍后再试，或联系管理员。'}`
        }

        if (notifyUser && userMessage) {
            const prefix = errorPrefix ? `${errorPrefix}\n` : ''
            platform.sendWithAt(
                platform.wrapEvent(event),
                `${prefix}${userMessage || `错误信息：${errorMessage}`}`,
                false,
                {},
            )
        }
        if (logTag) logger[loggerLevel](`[phi-plugin] ${logTag}`, error)
        return false
    }

    /**
     * 为当前 Bot 平台用户建立或迁移 API 绑定。
     * Bot HMAC 由底层请求器负责，本方法统一管理该接口的日志和错误处理。
     * @param {{platform: string, platformId: string, token?: phigrosToken, apiUserId?: apiUserId|string|number, isGlobal?: boolean}} params 绑定身份及用户凭证
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<{bindingId: string, apiUserId: apiUserId} | null>} API 绑定结果
     */
    static async bindBotPlatform(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch('/bot/bindings/bind', params, 'POST', options)
    }

    /**
     * 使用 sessionToken 创建曲目别名提案。
     * @param {{token: phigrosToken, alias: string, songId: string, note?: string, source: 'bot'}} params 提案内容
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<import('../type/aliasProposal.js').AliasProposalRecord | null>} 新提案
     */
    static async createAliasProposal(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch('/alias-proposals', params, 'POST', options)
    }

    /**
     * 获取当前 sessionToken 用户提交的别名提案。
     * @param {{token: phigrosToken, limit?: number, offset?: number}} params 分页参数
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<import('../type/aliasProposal.js').AliasProposalRecord[]>} 提案列表
     */
    static async getAliasProposalsMine(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch('/alias-proposals/mine', params, 'POST', options))?.items ?? []
    }

    /**
     * 获取当前公开投票，并附带 sessionToken 用户自己的投票。
     * @param {{token: phigrosToken, limit?: number, offset?: number}} params 分页参数
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<import('../type/aliasProposal.js').AliasProposalRecord[]>} 公开投票列表
     */
    static async getAliasPublicProposals(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch('/alias-proposals/public/list', params, 'POST', options))?.items ?? []
    }

    /**
     * 为一次私密拒绝申请公开评审。
     * @param {string} proposalId 提案 UUID
     * @param {{token: phigrosToken, reason: string}} params 公审理由
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<import('../type/aliasProposal.js').AliasProposalRecord | null>} 更新后的提案
     */
    static async requestAliasPublicReview(proposalId, params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch(`/alias-proposals/${encodeURIComponent(proposalId)}/public-review`, params, 'POST', options)
    }

    /**
     * 设置、修改或撤回公开投票。
     * @param {string} proposalId 提案 UUID
     * @param {{token: phigrosToken, value: 1|-1|0}} params 投票内容
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<import('../type/aliasProposal.js').AliasProposalRecord | null>} 更新后的提案
     */
    static async voteAliasProposal(proposalId, params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch(`/alias-proposals/${encodeURIComponent(proposalId)}/vote`, params, 'PUT', options)
    }

    /**
     * 获取 Bot 使用的正式别名 JSON 快照。
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<Record<string, string[]>>} 正式别名快照
     */
    static async getApprovedAliasSnapshot(/** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch('/alias-proposals/export/nicklist.json', undefined, 'GET', options)
    }

    /**
     * 汇报 Bot 在线状态、可选绘图压力，并取得待私聊消息。
     * @param {{
     *  pluginVersion: string,
     *  acknowledgedMessageIds: string[],
     *  renderPressure?: {
     *    windowStartedAt: string, capacity: number, active: number, queued: number,
     *    maxActive: number, maxQueued: number, completed: number, failed: number, timedOut: number
     *  }
     * }} params Bot 运行状态
     * @returns {Promise<{
     *  ok: true, serverTime: string, nextSyncAfterSeconds: number,
     *  reporting: {renderPressure: boolean},
     *  messages: {id:string,type:string,schemaVersion:number,target:{platform:string,platformId:string},text:string,payload:object,createdAt:string,expiresAt:string}[]
     * }>}
     */
    static async syncBot(params) {
        return makeFetch('/bot/sync', params, 'POST')
    }

    /**
     * 以 Bot HMAC 向 phi-plugin-api 申请主题市场短期下载链接。
     * 调用方负责使用同一 requestId 进行有限重试。
     * @param {{requestId:string, themeId:string, version?:string}} params
     */
    static async requestThemeDownload(params) {
        return phiApiClient.request('/bot/integrations/theme-store/download-url', params, 'POST', { timeout: 15_000 })
    }

    /** @returns {Promise<{ok:true,themes:any[]}>} 获取当前 Bot 主题策略过滤后的市场主题列表。 */
    static async getThemeMarketList() {
        return phiApiClient.request('/bot/integrations/theme-store/themes', {}, 'GET', { timeout: 30_000 })
    }

    /** @param {string} themeId 获取当前 Bot 主题策略过滤后的主题详情。 */
    static async getThemeMarketDetail(themeId) {
        return phiApiClient.request(`/bot/integrations/theme-store/themes/${encodeURIComponent(themeId)}`, {}, 'GET', { timeout: 15_000 })
    }

    /**
     * 清空用户数据
     * @param {highAu} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<{message: string}>}
     */
    static async clear(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch('/clear', params, 'POST', options)
    }

    /**
     * 设置或更新用户的 API Token
     * @param {highAu & {token_new: string}} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<{message: string}>}
     */
    static async setApiToken(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch('/setApiToken', params, 'POST', options)
    }

    /**
     * 获取用户的 PgrToken
     * @param {highAu | apiTokenAuth} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<{apiId: apiUserId, token: phigrosToken}>}
     */
    static async getPgrToken(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch('/getPgrToken', params, 'POST', options))?.data ?? null
    }

    /**
     * 获取用户已绑定的所有平台账号
     * @param {highAu} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<UserResponse>}
     */
    static async tokenList(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch('/token/list', params, 'POST', options))?.data ?? null
    }

    /**
     * 获取用户云存档单曲数据
     * @param {baseAu & songInfoRequest} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<getCloudSongResponse>}
     */
    static async getCloudSong(params, options = undefined) {
        return (await makeFetch(burl('/get/cloud/song'), params, 'POST', options)).data
    }

    /**
     * 获取用户云存档数据
     * @param {baseAu} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<oriSave>}
     */
    static async getCloudSaves(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/cloud/saves'), params, 'POST', options))?.data ?? null
    }

    /**
     * 获取用户云存档saveInfo数据
     * @param {baseAu} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<saveInfo>}
     */
    static async getCloudSaveInfo(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/cloud/saveInfo'), params, 'POST', options))?.data ?? null
    }

    /**
     * 根据用户获取排行榜相关信息
     * @param {baseAu} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<ranklistResponseData>}
     */
    static async getRanklistUser(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/ranklist/user'), params, 'POST', options))?.data ?? null
    }

    /**
     * 根据名次获取排行榜相关信息
     * @param {object} params
     * @param {number} params.request_rank 请求的排名
     * @returns {Promise<ranklistResponseData>}
     */
    static async getRanklistRank(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/ranklist/rank'), params, 'POST', options))?.data ?? null
    }

    /**
     * 获取rks大于目标值的用户数量
     * @param {{request_rks: number}} params
     * @returns {Promise<{rksRank: number, totNum: number}>}
     */
    static async getRanklistRks(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/ranklist/rksRank'), params, 'POST', options))?.data ?? null
    }

    /**
     * 获取用户歌曲分数排行列表
     * @param {baseAu & {songId: idString, rank: levelKind, orderBy: 'acc'|'score'|'fc'|'update_at'}} params id+.0
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<ScoreListResponseData>}
     */
    static async getScoreRanklistByUser(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/scoreList/user'), params, 'POST', options))?.data ?? null
    }

    /**
     * 获取谱面平均ACC
     * @param {{songId: idString, rank: levelKind, minRks?: number, maxRks?: number}} params id+.0
     * @returns {Promise<{accAvg: number, count: number}>}
     */
    static async getSongAccAvg(params) {
        return (await makeFetch(burl('/get/scoreList/songAccAvg'), params)).data
    }

    /**
     * 获取谱面所有成绩
     * @param {{songId: idString, rank: levelKind, minRks?: number, maxRks?: number, requestField?: (keyof liteScoreDetail)[], numPrecision: number}} params id+.0
     * @returns {Promise<(string[] | number[])[]>}
     */
    static async getSongAccList(params) {
        return (await makeFetch(burl('/get/scoreList/songAccList'), params)).data
    }

    /**
     * 获取谱面所有成绩AP FC数量
     * @param {{songId: idString, rank?: levelKind[]}} params id+.0
     * @returns {Promise<Record<levelKind, apFcCountResult>>}
     */
    static async getSongApFcCount(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/scoreList/songApFcCount'), params, 'POST', options))?.data ?? null
    }

    /**
     * 批量获取谱面所有成绩AP FC数量
     * @param {{songId: idString[], rank?: levelKind[],rksRange?: {min: number, max: number}}} params id+.0
     * @returns {Promise<Record<idString, Record<levelKind, apFcCountResult>>>}
     */
    static async getSongsApFcCount(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/scoreList/songsApFcCount'), params, 'POST', options))?.data ?? null
    }

    /**
     * 获取所有谱面平均ACC
     * @param {{songIds?: idString[], minRks?: number, maxRks?: number}} params id+.0
     * @returns {Promise<Record<idString, Record<levelKind, {accAvg: number | null, count: number}>>>}
     */
    static async getAllSongAccAvg(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/scoreList/allAccAvg'), params, 'POST', options))?.data ?? null
    }

    /**
     * 获取所有谱面平均ACC(B30版)
     * @param {{songIds?: idString[], minRks?: number, maxRks?: number}} params id+.0
     * @returns {Promise<Record<idString, Record<levelKind, {accAvg: number | null, count: number}>>>}
     */
    static async getAllSongAccAvgB30(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/scoreList/allAccAvgB30'), params, 'POST', options))?.data ?? null
    }

    /**
     * 获取所有谱面平均ACC(全部)
     * @param {{songIds?: idString[], minRks?: number, maxRks?: number}} params id+.0
     * @returns {Promise<Record<idString, Record<levelKind, {accAvg: number | null, count: number}>>>}
     */
    static async getAllSongAccAvgDual(params) {
        return (await makeFetch(burl('/get/scoreList/allAccAvgDual'), params)).data
    }

    /**
     * 获取所有谱面acc排行列表
     * @param {{queries: {songId: idString, rank: levelKind, acc: number}[], dimension:("all" | "b30")[], minRks?: number, maxRks?: number}} params
     * @returns {Promise<Record<"all" | "b30", {songId: idString, rank: levelKind, acc: number, topPercent: number, betterCount: number, totalCount: number}[]>>}
     */
    static async getAllSongAccRank(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/scoreList/allAccRank'), params, 'POST', options))?.data ?? null
    }

    /**
     * @overload
     * @param {baseAu} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<saveHistoryObject>}
     */
    /**
     * @template {keyof saveHistoryObject} K
     * @overload
     * @param {baseAu & {request: K[]}} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<Pick<saveHistoryObject, K> | null>}
     */
    /**
     * 获取用户data历史记录
     * @template {keyof saveHistoryObject} K
     * @param {baseAu & {request?: K[]}} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<Partial<saveHistoryObject> | null>}
     */
    static async getHistory(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/history/history'), params, 'POST', options))?.data ?? null
    }

    /**
     * @overload
     * @param {baseAu} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<{data: scoreHistoryObject}>}
     */
    /**
     * @overload
     * @param {baseAu & { song_id: idString }} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<{ data: songRecordHistory }>}
     */
    /**
     * @overload
     * @param {baseAu & { song_id: idString, rank: levelKind }} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<{ data: ScoreDetail[] }>}
     */
    /**
     * 获取用户成绩历史记录
     * @param {baseAu & {song_id?: idString, rank?: levelKind}} params
     * @returns {Promise<{
     *   data: ScoreDetail[] | songRecordHistory | scoreHistoryObject
     * }>}
     */
    static async getHistoryRecord(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/history/record'), params, 'POST', options))?.data ?? null
    }

    /**
     * 上传用户的历史记录
     * @param {baseAu & {data: saveHistory}} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<{message: string}>}
     */
    static async setHistory(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return await makeFetch(burl('/set/history'), params, 'POST', options)
    }

    /**
     * 上传用户tk
     * @param {{data: phigrosToken[]}} params
     * @returns {Promise<{message: string}>}
     */
    static async setUsersToken(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch('/set/usersToken', params, 'POST', options)
    }

    /**
     * 查询用户是否被禁用
     * @param {baseAu} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<boolean>}
     */
    static async getUserBan(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/get/banUser'), params, 'POST', options))?.data ?? null
    }

    /**
     * 获取歌曲评论
     * @param {{song_id: idString}} params
     * @returns {Promise<APICommentObject[]>}
     */
    static async getCommentsBySongId(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/comment/get/bySongId'), params, 'POST', options))?.data ?? null
    }

    /**
     * 获取歌曲评论
     * @param {baseAu} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<APICommentObject[]>}
     */
    static async getCommentsByUserId(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/comment/get/byUserId'), params, 'POST', options))?.data ?? null
    }

    /**
     * 添加单条评论
     * @param {highAu & {data: {comment: APIUpdateCommentObject}}} params
     * @returns {Promise<{message: string}>}
     */
    static async addComment(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch(burl('/comment/add'), params, 'POST', options)
    }

    /**
     * 删除单条评论
     * @param {highAu & {comment_id: string}} params
     * @returns {Promise<{message: string}>}
     */
    static async delComment(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch(burl('/comment/del'), params, 'POST', options)
    }

    /**
     * 批量添加评论
     * @param {{data: import('../game/getComment.js').commentObject[]}} params
     * @returns {Promise<{message: string}>}
     */
    static async updateComments(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch(burl('/comment/update'), params, 'POST', options)
    }

    /**
     * 获取谱面标签名称列表
     * @returns {Promise<chartsTagString[]>}
     */
    static async getChartsTagsName() {
        return (await makeFetch(burl('/chartsTag/get/tagNames'), {}, 'GET')).data
    }

    /**
     * 获取谱面标签树
     * @returns {Promise<ChartTagTreeNode[]>}
     */
    static async getChartsTagsTree(/** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/chartsTag/get/tagTree'), {}, 'GET', options))?.data ?? null
    }

    /**
     * 获取谱面标签信息
     * @param {{song_id: idString, rank: levelKind}} params
     * @returns {Promise<chartsTagVoteCountMap>}
     */
    static async getChartsTagbySongRank(params) {
        return (await makeFetch(burl('/chartsTag/get/bySongRank'), params)).data
    }

    /**
     * 获取谱面标签信息，包含分类计数树
     * @param {{song_id: idString, rank: levelKind}} params
     * @returns {Promise<ChartTagSongRankResponse>}
     */
    static async getChartsTagbySongRankWithTree(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch(burl('/chartsTag/get/bySongRank'), params, 'POST', options)
    }

    /**
     * 批量获取谱面标签信息，按曲目和难度分别返回。
     * @param {{data: {song_id: idString, rank?: levelKind[]}[], total?: boolean}} params
     * @returns {Promise<{
     *  data: Record<idString, Record<levelKind, chartsTagVoteCountMap>>,
     *  primary: Record<idString, Record<levelKind, chartsTagVoteCountMap>>,
     *  secondary: Record<idString, Record<levelKind, chartsTagVoteCountMap>>,
     *  tree: Record<idString, Record<levelKind, ChartTagTreeNode[]>>
     * }>}
     */
    static async getChartsTagsBatch(params) {
        return await makeFetch(burl('/chartsTag/get/chartsTags'), params)
    }

    /**
     * 获取用户 B30 谱面标签分析（雷达图、擅长 tag 与薄弱 tag）。
     * @param {baseAu} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<{
     *  totalVotes: number,
     *  minimumVotes: number,
     *  averageRks: number,
     *  categories: {name: string, rks: number, votes: number, hasVotes: boolean}[],
     *  radar: {grids: string[], axes: {x: number, y: number}[], points: string, categories: object[]},
     *  strong: {name: string, rks: number, votes: number}[],
     *  weak: {name: string, rks: number, votes: number}[],
     *  insufficient: boolean
     * }>}
     */
    static async getB30TagAnalysis(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/chartsTag/get/b30Analysis'), params, 'POST', options))?.data ?? null
    }


    /**
     * 获取用户对谱面标签的投票记录
     * @param {baseAu & {data: chartsTagRequestData[]}} params
     * @param {ApiRequestExecutionOptions} [options] 错误处理上下文
     * @returns {Promise<chartsTagResponseData[]>}
     */
    static async getChartsUsersVote(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/chartsTag/get/usersVote'), params, 'POST', options))?.data ?? null
    }

    /**
     * 用户设置谱面标签
     * @param {setChartsTagParams} params
     * @returns {Promise<{message: string}>}
     */
    static async setChartsTag(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return makeFetch(burl('/chartsTag/set/set'), params, 'POST', options)
    }

    /**
     * 获取用户设置
     * @param {highAu} params
     * @returns {Promise<userSetting>}
     */
    static async getUserSetting(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/userSetting/get'), params, 'POST', options))?.data ?? null
    }

    /**
     * 设置用户设置
     * @param {highAu & {setting: userSetting}} params
     * @returns {Promise<userSetting>}
     */
    static async setUserSetting(params, /** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/userSetting/set'), params, 'POST', options))?.data ?? null
    }

    /**
     * 设置用户设置
     * @returns {Promise<string>}
     */
    static async liveInfo(/** @type {ApiRequestExecutionOptions | undefined} */ options = undefined) {
        return (await makeFetch(burl('/live'), undefined, 'POST', options))?.data ?? null
    }
}

/**
 * @param {string} originalPath
 * @param {any} [params]
 * @param {'POST'|'GET'|'PUT'} [method='POST']
 * @param {ApiRequestExecutionOptions} [options] 错误处理上下文；省略时向上抛出错误
 * @returns {Promise<any>}
 */
async function makeFetch(originalPath, params, method = 'POST', options = undefined) {
    const execute = () => phiApiClient.request(originalPath, params, method)
    if (!options) return execute()
    try {
        return await execute()
    } catch (error) {
        makeRequest.handleApiError(options.event, error, {
            ...endpointErrorLogging(originalPath),
            errorPrefix: options.errorPrefix,
            notifyUser: options.notifyUser,
            ignoreUnboundError: options.ignoreUnboundError,
        })
        return null
    }
}

/**
 * 拼接基础URL
 * @param {string} path
 * @returns
 */
function burl(path) {
    return path
}
