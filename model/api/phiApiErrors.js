import Config from '../../components/Config.js'

export class PhiApiError extends Error {
    /** @param {string} message @param {number} [status] @param {string} [code] @param {any} [data] */
    constructor(message, status = 0, code = 'api_request_failed', data = undefined) {
        super(message)
        this.name = 'PhiApiError'
        this.status = status
        this.code = code
        this.data = data
    }
}

const FATAL_IDENTITY_ERROR_CODES = new Set([
    'bot_client_unknown',
    'bot_client_revoked',
    'bot_key_version_invalid',
    'bot_signature_invalid',
])

const CONNECTION_ERROR_CODES = new Set([
    'api_timeout',
    'api_dns_error',
    'api_connection_refused',
    'api_tls_error',
    'api_network_error',
    'api_offline',
])

/** @type {Record<string, string | (() => string)>} */
const USER_ERROR_MESSAGES = {
    api_timeout: 'API请求超时，请稍后重试。',
    api_dns_error: '无法解析API地址，请Bot主人检查网络或API地址配置。',
    api_connection_refused: 'API暂时拒绝连接，插件会自动重试。',
    api_tls_error: 'API证书校验失败，请Bot主人检查系统时间或证书配置。',
    api_network_error: '连接API时网络异常，插件会自动重试。',
    api_offline: '暂时无法连接API，插件会自动重试。',
    api_version_incompatible: 'API协议大版本不兼容，API功能已自动关闭，请更新 phi-plugin 后重启。',
    bot_identity_missing: 'Bot尚未获得API身份，API恢复后会自动注册。',
    bot_client_unknown: '本地Bot凭证不被API识别，请Bot主人执行“重置API Bot身份”。',
    bot_client_revoked: '该Bot身份已被撤销，请Bot主人执行“重置API Bot身份”。',
    bot_key_version_invalid: 'Bot密钥版本已失效，请Bot主人执行“重置API Bot身份”。',
    bot_signature_invalid: 'Bot凭证签名校验失败，请Bot主人执行“重置API Bot身份”。',
    bot_registration_rate_limited: 'Bot身份申请过于频繁，插件稍后会自动重试。',
    invalid_registration_response: 'API返回的Bot身份数据无效，插件稍后会自动重试。',
    binding_not_found: '当前平台账号尚未绑定，请使用sessionToken绑定。',
    bot_user_credential_required: '当前请求缺少 sessionToken 或 API ID，请重新绑定。',
    binding_conflict_requires_sstk: '当前平台已绑定其他查分ID，请使用sessionToken重新绑定。',
    user_id_binding_disabled: () => {
        const commandHead = String(Config.getUserCfg('config', 'cmdhead') || 'phi')
        return `该用户未开启API ID绑定，请使用 /${commandHead} bind <sessionToken> 或 /${commandHead} bind qrcode 扫码重新绑定。`
    },
    user_not_found: '未找到对应的查分ID，请检查后重试。',
}

/** @param {any} error */
export function classifyApiConnectionError(error) {
    if (error instanceof PhiApiError) return error
    const nativeCode = String(error?.code || error?.cause?.code || '').toUpperCase()
    const nativeMessage = String(error?.message || error?.cause?.message || '').toLowerCase()

    if (nativeCode === 'ECONNABORTED' || nativeCode === 'ETIMEDOUT' || nativeMessage.includes('timeout')) {
        return new PhiApiError('API请求超时', 0, 'api_timeout')
    }
    if (nativeCode === 'ENOTFOUND' || nativeCode === 'EAI_AGAIN') {
        return new PhiApiError('无法解析API地址', 0, 'api_dns_error')
    }
    if (nativeCode === 'ECONNREFUSED') {
        return new PhiApiError('API拒绝连接', 0, 'api_connection_refused')
    }
    if (
        nativeCode.startsWith('ERR_TLS_')
        || nativeCode.startsWith('CERT_')
        || nativeCode === 'DEPTH_ZERO_SELF_SIGNED_CERT'
        || nativeCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
        || nativeMessage.includes('certificate')
        || nativeMessage.includes('tls')
    ) {
        return new PhiApiError('API证书校验失败', 0, 'api_tls_error')
    }
    if (
        ['ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH', 'ENETDOWN', 'ERR_NETWORK'].includes(nativeCode)
        || nativeMessage.includes('network error')
        || nativeMessage.includes('socket hang up')
    ) {
        return new PhiApiError('API网络连接异常', 0, 'api_network_error')
    }
    return new PhiApiError('无法连接API', 0, 'api_offline')
}

/** @param {any} error */
export function isApiConnectionError(error) {
    return CONNECTION_ERROR_CODES.has(String(error?.code || ''))
}

/** @param {any} error */
export function isFatalBotIdentityError(error) {
    return FATAL_IDENTITY_ERROR_CODES.has(String(error?.code || ''))
}

/** @param {any} error */
export function hasPhiApiUserMessage(error) {
    return Object.hasOwn(USER_ERROR_MESSAGES, String(error?.code || ''))
}

/** @param {any} error */
export function getPhiApiUserMessage(error) {
    const code = String(error?.code || '')
    const message = USER_ERROR_MESSAGES[code]
    if (typeof message === 'function') return message()
    return message || error?.message || String(error?.cause || error || '未知错误')
}
