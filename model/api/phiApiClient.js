import { Config } from '../../components/index.js'
import logger from '../../components/Logger.js'
import autoSeekApi from './autoSeekApi.js'
import botApiAuth from './botApiAuth.js'
import {
    classifyApiConnectionError,
    isApiConnectionError,
    PhiApiError,
} from './phiApiErrors.js'
import { isApiVersionBlocked } from './apiVersion.js'

/**
 * 发送带 Bot HMAC 的底层 phi-plugin-api 请求。
 * 用户身份由请求体中的 sessionToken 或 API ID确定，本函数只负责 Bot HMAC 传输。
 * @param {string} originalPath 包含查询参数的 API 原始路径
 * @param {any} [params] 最终发送的请求参数
 * @param {'POST'|'GET'|'PUT'} [method='POST'] HTTP 方法
 * @param {{timeout?:number}} [transportOptions] 端点专用传输选项
 * @returns {Promise<any>} API JSON 响应
 */
async function request(originalPath, params = {}, method = 'POST', transportOptions = {}) {
    if (isApiVersionBlocked()) {
        throw new PhiApiError(
            'API协议大版本不兼容，请更新 phi-plugin 后重启',
            0,
            'api_version_incompatible',
        )
    }
    try {
        await botApiAuth.initialize()
        const json = await botApiAuth.signedRequest(originalPath, params, method, undefined, {}, transportOptions)
        if (Config.getUserCfg('config', 'debug') > 3) {
            logger.info(`[phi-plugin] API请求成功: ${originalPath}`)
        }
        return json
    } catch (/** @type {any} */ error) {
        if (error instanceof PhiApiError) {
            logger.warn(`[phi-plugin] API请求失败 ${originalPath}: ${error.code} (${error.status})`)
            if (isApiConnectionError(error)) autoSeekApi.seekApi()
            throw error
        }
        logger.error(`[phi-plugin] API网络错误 ${originalPath}: ${error?.message || String(error)}`)
        autoSeekApi.seekApi()
        throw classifyApiConnectionError(error)
    }
}

/**
 * phi-plugin-api 的全局请求实例。业务模块统一导入该实例，不传递请求函数。
 */
export const phiApiClient = { request }

export default phiApiClient
