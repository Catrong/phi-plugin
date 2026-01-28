import axios from 'axios';
import https from 'node:https';
import { Config } from '../components/index.js';
import saveHistory from './class/saveHistory.js';
import logger from '../components/Logger.js';
import { APIBASEURL } from './constNum.js';


/**
 * @typedef {Object} platformAuth
 * @property {string} platform 平台名称
 * @property {string} platform_id 用户平台内id
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
 */

/**
 * @typedef {Object} PlatformDataItem
 * @property {string} platform_name
 * @property {string} platform_id
 * @property {string} create_at
 * @property {string} update_at
 * @property {number} authentication - 认证状态
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
 * @typedef {Object} tokenManageParams
 * @property {'delete' | 'rmau'} operation
 * @property {string} platform
 * @property {string} platform_id
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
 * @property {boolean} allowDataCollection 是否允许数据收集
 */

/**
 * @typedef {object} chartsTagRequestData
 * @property {idString} song_id 曲目ID
 * @property {levelKind[]} [rank] 难度
 */

/**
 * @typedef {object} chartsTagResponseData
 * @property {apiUserId} user_id 用户ID
 * @property {idString} songId 曲目ID
 * @property {levelKind} rank 难度
 * @property {string} time 时间
 * @property {chartsTagString[]} tags 标签内容
 */

const agent = new https.Agent({ rejectUnauthorized: false });

export default class makeRequest {

    /**
     * 绑定平台账号与用户Token/getPgrToken
     * @param {baseAu & {isGlobal?: boolean}} params 
     * @returns {Promise<BindSuccessResponse>}
     */
    static async bind(params) {
        return makeFetch(burl('/bind'), params)
    }

    /**
     * 解绑用户的某个平台账号
     * @param {object} params 
     * @param {string} params.platform 平台名称
     * @param {string} params.platform_id 用户平台内id
     * @returns {Promise<{message: string}>}
     */
    static async unbind(params) {
        return await makeFetch(burl('/unbind'), params)
    }

    /**
     * 清空用户数据
     * @param {highAu} params 
     * @returns {Promise<{message: string}>}
     */
    static async clear(params) {
        return await makeFetch(burl('/clear'), params)
    }

    /**
     * 设置或更新用户的 API Token
     * @param {highAu & {token_new: string}} params 
     * @returns {Promise<{message: string}>}
     */
    static async setApiToken(params) {
        return await makeFetch(burl('/setApiToken'), params)
    }

    /**
     * 获取用户的 PgrToken
     * @param {highAu} params 
     * @returns {Promise<{apiId: apiUserId, token: phigrosToken}>}
     */
    static async getPgrToken(params) {
        return (await makeFetch(burl('/getPgrToken'), params)).data
    }

    /**
     * 获取用户已绑定的所有平台账号
     * @param {highAu} params 
     * @returns {Promise<UserResponse>}
     */
    static async tokenList(params) {
        return (await makeFetch(burl('/token/list'), params)).data
    }

    /**
     * 
     * @param {highAu & {data: tokenManageParams}} params 
     * @returns {Promise<{message: string}>}
     */
    static async tokenManage(params) {
        return await makeFetch(burl('/token/manage'), params)
    }

    /**
     * 获取用户云存档单曲数据
     * @param {baseAu & songInfoRequest} params
     * @returns {Promise<getCloudSongResponse>}
     */
    static async getCloudSong(params) {
        return (await makeFetch(burl('/get/cloud/song'), params)).data
    }

    /**
     * 获取用户云存档数据
     * @param {baseAu} params 
     * @returns {Promise<oriSave>}
     */
    static async getCloudSaves(params) {
        return (await makeFetch(burl('/get/cloud/saves'), params)).data
    }

    /**
     * 获取用户云存档saveInfo数据
     * @param {baseAu} params 
     * @returns {Promise<saveInfo>}
     */
    static async getCloudSaveInfo(params) {
        return (await makeFetch(burl('/get/cloud/saveInfo'), params)).data
    }

    /**
     * 根据用户获取排行榜相关信息
     * @param {baseAu} params 
     * @returns {Promise<ranklistResponseData>}
     */
    static async getRanklistUser(params) {
        return (await makeFetch(burl('/get/ranklist/user'), params)).data
    }

    /**
     * 根据名次获取排行榜相关信息
     * @param {object} params 
     * @param {number} params.request_rank 请求的排名
     * @returns {Promise<ranklistResponseData>}
     */
    static async getRanklistRank(params) {
        return (await makeFetch(burl('/get/ranklist/rank'), params)).data
    }

    /**
     * 获取rks大于目标值的用户数量
     * @param {{request_rks: number}} params
     * @returns {Promise<{rksRank: number, totNum: number}>}
     */
    static async getRanklistRks(params) {
        return (await makeFetch(burl('/get/ranklist/rksRank'), params)).data
    }

    /**
     * 获取用户歌曲分数排行列表
     * @param {baseAu & {songId: idString, rank: levelKind, orderBy: 'acc'|'score'|'fc'|'update_at'}} params id+.0
     * @returns {Promise<ScoreListResponseData>}
     */
    static async getScoreRanklistByUser(params) {
        return (await makeFetch(burl('/get/scoreList/user'), params)).data
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
     * 获取所有谱面平均ACC
     * @param {{songIds?: idString[], minRks?: number, maxRks?: number}} params id+.0
     * @returns {Promise<Record<idString, Record<levelKind, {accAvg: number | null, count: number}>>>}
     */
    static async getAllSongAccAvg(params) {
        return (await makeFetch(burl('/get/scoreList/allAccAvg'), params)).data
    }

    /**
     * @overload
     * @param {baseAu} params 
     * @returns {Promise<saveHistoryObject>}
     */
    /**
     * @template {keyof saveHistoryObject} K
     * @overload
     * @param {baseAu & {request: K[]}} params 
     * @returns {Promise<Pick<saveHistoryObject, K>>}
     */
    /**
     * 获取用户data历史记录
     * @template {keyof saveHistoryObject} K
     * @param {baseAu & {request?: K[]}} params 
     * @returns {Promise<Partial<saveHistoryObject>>}
     */
    static async getHistory(params) {
        return (await makeFetch(burl('/get/history/history'), params)).data
    }

    /**
     * @overload
     * @param {baseAu} params 
     * @returns {Promise<{data: scoreHistoryObject}>}
     */
    /**
     * @overload
     * @param {baseAu & { song_id: idString }} params
     * @returns {Promise<{ data: songRecordHistory }>}
     */
    /**
     * @overload
     * @param {baseAu & { song_id: idString, difficulty: levelKind }} params
     * @returns {Promise<{ data: ScoreDetail[] }>}
     */
    /**
     * 获取用户成绩历史记录
     * @param {baseAu & Partial<songInfoRequest>} params 
     * @returns {Promise<{
     *   data: ScoreDetail[] | songRecordHistory | scoreHistoryObject
     * }>}
     */
    static async getHistoryRecord(params) {
        return (await makeFetch(burl('/get/history/record'), params)).data
    }

    /**
     * 上传用户的历史记录
     * @param {baseAu & {data: saveHistory}} params 
     * @returns {Promise<{message: string}>}
     */
    static async setHistory(params) {
        return await makeFetch(burl('/set/history'), params)
    }

    /**
     * 上传用户tk
     * @param {{data: phigrosToken[]}} params 
     * @returns {Promise<{message: string}>}
     */
    static async setUsersToken(params) {
        return await makeFetch(burl('/set/usersToken'), params)
    }

    /**
     * 查询用户是否被禁用
     * @param {baseAu} params 
     * @returns {Promise<boolean>}
     */
    static async getUserBan(params) {
        return (await makeFetch(burl('/get/banUser'), params)).data
    }

    /**
     * 获取歌曲评论
     * @param {{song_id: idString}} params 
     * @returns {Promise<APICommentObject[]>}
     */
    static async getCommentsBySongId(params) {
        return (await makeFetch(burl('/comment/get/bySongId'), params)).data
    }

    /**
     * 获取歌曲评论
     * @param {baseAu} params 
     * @returns {Promise<APICommentObject[]>}
     */
    static async getCommentsByUserId(params) {
        return (await makeFetch(burl('/comment/get/byUserId'), params)).data
    }

    /**
     * 添加单条评论
     * @param {highAu & {data: {comment: APIUpdateCommentObject}}} params 
     * @returns {Promise<{message: string}>}
     */
    static async addComment(params) {
        return (await makeFetch(burl('/comment/add'), params))
    }

    /**
     * 删除单条评论
     * @param {highAu & {comment_id: string}} params 
     * @returns {Promise<{message: string}>}
     */
    static async delComment(params) {
        return (await makeFetch(burl('/comment/del'), params))
    }

    /**
     * 批量添加评论
     * @param {{data: import('./getComment.js').commentObject[]}} params 
     * @returns {Promise<{message: string}>}
     */
    static async updateComments(params) {
        return (await makeFetch(burl('/comment/update'), params))
    }

    /**
     * 获取谱面标签名称列表
     * @returns {Promise<chartsTagString[]>}
     */
    static async getChartsTagsName() {
        return (await makeFetch(burl('/chartsTag/get/tagNames'), {}, 'GET')).data
    }

    /**
     * 获取谱面标签信息
     * @param {{song_id: idString, rank: levelKind}} params 
     * @returns {Promise<{[tag: chartsTagString]: number}>}
     */
    static async getChartsTagbySongRank(params) {
        return (await makeFetch(burl('/chartsTag/get/bySongRank'), params)).data
    }

    /**
     * 
     * @param {baseAu & {data: chartsTagRequestData[]}} params 
     * @returns {Promise<chartsTagResponseData[]>}
     */
    static async getChartsUsersVote(params) {
        return (await makeFetch(burl('/chartsTag/get/usersVote'), params)).data
    }

    /**
     * 用户设置谱面标签
     * @param {highAu & {song_id: idString, rank: levelKind, content: chartsTagString[]}} params 
     * @returns {Promise<{message: string}>}
     */
    static async setChartsTag(params) {
        return (await makeFetch(burl('/chartsTag/set/set'), params))
    }

    /**
     * 获取用户设置
     * @param {highAu} params 
     * @returns {Promise<userSetting>}
     */
    static async getUserSetting(params) {
        return (await makeFetch(burl('/userSetting/get'), params)).data
    }

    /**
     * 设置用户设置
     * @param {highAu & {setting: userSetting}} params 
     * @returns {Promise<userSetting>}
     */
    static async setUserSetting(params) {
        return (await makeFetch(burl('/userSetting/set'), params)).data
    }

    /**
     * 设置用户设置
     * @returns {Promise<string>}
     */
    static async liveInfo() {
        return (await makeFetch(burl('/live'))).data
    }
}

/**
 * 
 * @param {string} url 
 * @param {any} [params] 
 * @param {'POST'|'GET'} [method='POST'] 
 * @returns 
 */
async function makeFetch(url, params, method = 'POST') {
    if (Config.getUserCfg('config', 'debug') > 3) {
        logger.info(`[phi-plugin] 请求API: ${url}`, JSON.stringify(params));
    }
    let result
    try {
        switch (method.toUpperCase()) {
            case 'GET':
                result = await axios.get(url, { params: params });
                break;
            case 'POST':
                result = await axios.post(url, JSON.stringify(params), { headers: { 'Content-Type': 'application/json' } });
                break;
            default:
                throw new Error(`不支持的请求方法: ${method}`);
        }
    } catch (e) {
        logger.error(`请求失败: ${url}`, e);
        throw new Error('API离线');
    }
    if (!result) {
        throw new Error('请求失败')
    }
    let json = result.data
    if (json.error) {
        throw new Error(json.error)
    }
    if (Config.getUserCfg('config', 'debug') > 3) {
        logger.info(`[phi-plugin] API响应: ${url}`, JSON.stringify(json));
    }
    return json
}

/**
 * 拼接基础URL
 * @param {string} path 
 * @returns 
 */
function burl(path) {
    return `${APIBASEURL}${path}`
}