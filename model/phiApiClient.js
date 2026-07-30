import axios from 'axios'
import { Config } from '../components/index.js'
import logger from '../components/Logger.js'
import autoSeekApi from './autoSeekApi.js'
import botApiAuth, {
    classifyApiConnectionError,
    isApiConnectionError,
    PhiApiError,
} from './botApiAuth.js'
import { APIBASEURL } from './constNum.js'

const TIMEOUT = 5000

/**
 * 发送带 Bot HMAC及用户绑定凭据的底层 phi-plugin-api 请求。
 * bindingCredential 失效时会清理本地缓存并自动重试一次；网络错误会触发 API 重连检测。
 * @param {string} originalPath 包含查询参数的 API 原始路径
 * @param {any} [params] 最终发送的请求参数
 * @param {'POST'|'GET'} [method='POST'] HTTP 方法
 * @returns {Promise<any>} API JSON 响应
 */
export async function requestPhiApi(originalPath, params = {}, method = 'POST') {
    const url = `${APIBASEURL}${originalPath}`
    const upperMethod = method.toUpperCase()
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const authHeaders = await botApiAuth.requestHeaders(url, params, upperMethod)
            const result = upperMethod === 'GET'
                ? await axios.get(url, { params, headers: authHeaders, timeout: TIMEOUT, validateStatus: () => true })
                : await axios.post(url, JSON.stringify(params), {
                    headers: { 'Content-Type': 'application/json', ...authHeaders },
                    timeout: TIMEOUT,
                    validateStatus: () => true,
                })
            const json = result.data
            if (result.status < 200 || result.status >= 300 || json?.error) {
                const error = new PhiApiError(
                    json?.message || json?.error || `API请求失败 (${result.status})`,
                    result.status,
                    json?.code || json?.errorCode || 'api_request_failed',
                    json,
                )
                if (attempt === 0 && error.code === 'binding_credential_invalid') {
                    await botApiAuth.invalidateBinding(params)
                    continue
                }
                throw error
            }
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
    throw new PhiApiError('绑定凭据恢复失败', 401, 'binding_credential_invalid')
}
