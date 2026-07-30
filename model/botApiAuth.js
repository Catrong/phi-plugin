import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import YAML from 'yaml';
import Config from '../components/Config.js';
import logger from '../components/Logger.js';
import { pluginRoot } from './path.js';
import { APIBASEURL } from './constNum.js';
import userCredentialStore from './userCredentialStore.js';

const TIMEOUT = 5000;

export class PhiApiError extends Error {
    /** @param {string} message @param {number} [status] @param {string} [code] @param {any} [data] */
    constructor(message, status = 0, code = 'api_request_failed', data = undefined) {
        super(message);
        this.name = 'PhiApiError';
        this.status = status;
        this.code = code;
        this.data = data;
    }
}

const FATAL_IDENTITY_ERROR_CODES = new Set([
    'bot_client_unknown',
    'bot_client_revoked',
    'bot_key_version_invalid',
    'bot_signature_invalid',
]);

const CONNECTION_ERROR_CODES = new Set([
    'api_timeout',
    'api_dns_error',
    'api_connection_refused',
    'api_tls_error',
    'api_network_error',
    'api_offline',
]);

/** @param {any} params */
function localCredentialFingerprint(params) {
    const token = params?.token;
    const apiUserId = params?.api_user_id ?? params?.apiUserId;
    const identity = token ? `sstk:${token}` : apiUserId ? `api-id:${apiUserId}` : '';
    return identity ? crypto.createHash('sha256').update(identity).digest('hex') : '';
}

/** @type {Record<string, string | (() => string)>} */
const USER_ERROR_MESSAGES = {
    api_timeout: 'API请求超时，请稍后重试。',
    api_dns_error: '无法解析API地址，请Bot主人检查网络或API地址配置。',
    api_connection_refused: 'API暂时拒绝连接，插件会自动重试。',
    api_tls_error: 'API证书校验失败，请Bot主人检查系统时间或证书配置。',
    api_network_error: '连接API时网络异常，插件会自动重试。',
    api_offline: '暂时无法连接API，插件会自动重试。',
    bot_identity_missing: 'Bot尚未获得API身份，API恢复后会自动注册。',
    bot_client_unknown: '本地Bot凭证不被API识别，请Bot主人执行“重置API Bot身份”。',
    bot_client_revoked: '该Bot身份已被撤销，请Bot主人执行“重置API Bot身份”。',
    bot_key_version_invalid: 'Bot密钥版本已失效，请Bot主人执行“重置API Bot身份”。',
    bot_signature_invalid: 'Bot凭证签名校验失败，请Bot主人执行“重置API Bot身份”。',
    bot_registration_rate_limited: 'Bot身份申请过于频繁，插件稍后会自动重试。',
    invalid_registration_response: 'API返回的Bot身份数据无效，插件稍后会自动重试。',
    binding_not_found: '当前平台账号尚未绑定，请使用sessionToken绑定。',
    binding_credential_required: '当前平台的绑定凭据缺失，请重新绑定。',
    binding_credential_invalid: '当前平台的绑定凭据已失效，插件将自动恢复一次；仍失败时请重新绑定。',
    binding_conflict_requires_sstk: '当前平台已绑定其他查分ID，请使用sessionToken重新绑定。',
    user_id_binding_disabled: () => {
        const commandHead = String(Config.getUserCfg('config', 'cmdhead') || 'phi');
        return `该用户未开启API ID绑定，请使用 /${commandHead} bind <sessionToken> 或 /${commandHead} bind qrcode 扫码重新绑定。`;
    },
    user_not_found: '未找到对应的查分ID，请检查后重试。',
};

/** @param {any} error */
export function classifyApiConnectionError(error) {
    if (error instanceof PhiApiError) return error;
    const nativeCode = String(error?.code || error?.cause?.code || '').toUpperCase();
    const nativeMessage = String(error?.message || error?.cause?.message || '').toLowerCase();

    if (nativeCode === 'ECONNABORTED' || nativeCode === 'ETIMEDOUT' || nativeMessage.includes('timeout')) {
        return new PhiApiError('API请求超时', 0, 'api_timeout');
    }
    if (nativeCode === 'ENOTFOUND' || nativeCode === 'EAI_AGAIN') {
        return new PhiApiError('无法解析API地址', 0, 'api_dns_error');
    }
    if (nativeCode === 'ECONNREFUSED') {
        return new PhiApiError('API拒绝连接', 0, 'api_connection_refused');
    }
    if (
        nativeCode.startsWith('ERR_TLS_')
        || nativeCode.startsWith('CERT_')
        || nativeCode === 'DEPTH_ZERO_SELF_SIGNED_CERT'
        || nativeCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
        || nativeMessage.includes('certificate')
        || nativeMessage.includes('tls')
    ) {
        return new PhiApiError('API证书校验失败', 0, 'api_tls_error');
    }
    if (
        ['ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH', 'ENETDOWN', 'ERR_NETWORK'].includes(nativeCode)
        || nativeMessage.includes('network error')
        || nativeMessage.includes('socket hang up')
    ) {
        return new PhiApiError('API网络连接异常', 0, 'api_network_error');
    }
    return new PhiApiError('无法连接API', 0, 'api_offline');
}

/** @param {any} error */
export function isApiConnectionError(error) {
    return CONNECTION_ERROR_CODES.has(String(error?.code || ''));
}

/** @param {any} error */
export function isFatalBotIdentityError(error) {
    return FATAL_IDENTITY_ERROR_CODES.has(String(error?.code || ''));
}

/** @param {any} error */
export function hasPhiApiUserMessage(error) {
    return Object.hasOwn(USER_ERROR_MESSAGES, String(error?.code || ''));
}

/** @param {any} error */
export function getPhiApiUserMessage(error) {
    const code = String(error?.code || '');
    const message = USER_ERROR_MESSAGES[code];
    if (typeof message === 'function') return message();
    return message || error?.message || String(error?.cause || error || '未知错误');
}

function configIdentity() {
    return {
        clientId: String(Config.getUserCfg('config', 'apiBotClientId') || '').trim(),
        secret: String(Config.getUserCfg('config', 'apiBotClientSecret') || '').trim(),
        secretVersion: Number(Config.getUserCfg('config', 'apiBotSecretVersion') || 0),
    };
}

/** @param {{clientId: string, secret: string, secretVersion: number}} identity */
function writeIdentityAtomic(identity) {
    const target = path.join(pluginRoot, 'config', 'config', 'config.yaml');
    const current = YAML.parse(fs.readFileSync(target, 'utf8')) || {};
    current.apiBotClientId = identity.clientId;
    current.apiBotClientSecret = identity.secret;
    current.apiBotSecretVersion = identity.secretVersion;
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp, YAML.stringify(current), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, target);
    delete Config.config['config.config'];
}

/** @param {any} response */
function parseResponse(response) {
    const data = response.data;
    if (response.status < 200 || response.status >= 300 || data?.error) {
        throw new PhiApiError(
            data?.message || data?.error || `API request failed (${response.status})`,
            response.status,
            data?.code || data?.errorCode || 'api_request_failed',
            data,
        );
    }
    return data;
}

export class BotApiAuth {
    constructor() {
        this.ready = false;
        this.initializing = null;
        this.fatalError = null;
        this.fatalIdentity = '';
    }

    async initialize(pluginVersion = '1.0.0') {
        if (this.ready) return configIdentity();
        const current = configIdentity();
        const fingerprint = `${current.clientId}:${current.secretVersion}:${crypto.createHash('sha256').update(current.secret).digest('hex')}`;
        if (this.fatalError && this.fatalIdentity === fingerprint) throw this.fatalError;
        if (this.fatalIdentity !== fingerprint) {
            this.fatalError = null;
            this.fatalIdentity = '';
        }
        if (this.initializing) return this.initializing;
        this.initializing = this.initializeOnce(pluginVersion).finally(() => { this.initializing = null; });
        return this.initializing;
    }

    /** @param {string} pluginVersion */
    async initializeOnce(pluginVersion) {
        const identity = configIdentity();
        if (!identity.clientId || !identity.secret || !Number.isSafeInteger(identity.secretVersion) || identity.secretVersion < 1) {
            return this.register(pluginVersion);
        }
        try {
            await this.signedRequest('/bot-clients/self', undefined, 'GET', identity);
            this.ready = true;
            this.fatalError = null;
            return identity;
        } catch (/** @type {any} */ error) {
            this.ready = false;
            if (isFatalBotIdentityError(error)) {
                this.fatalError = error;
                this.fatalIdentity = `${identity.clientId}:${identity.secretVersion}:${crypto.createHash('sha256').update(identity.secret).digest('hex')}`;
                logger.error(`[phi-plugin] API Bot凭证不可用，新平台API操作已停止：${error.code || error.message}`);
            } else {
                this.fatalError = null;
                this.fatalIdentity = '';
                logger.warn(`[phi-plugin] API Bot身份暂时无法验证，将在API恢复后重试：${error.code || error.message}`);
            }
            throw error;
        }
    }

    async register(pluginVersion = '1.0.0') {
        let response;
        try {
            response = await axios.post(`${APIBASEURL}/bot-clients/register`, JSON.stringify({
                pluginName: 'phi-plugin',
                pluginVersion,
            }), {
                headers: { 'Content-Type': 'application/json' },
                timeout: TIMEOUT,
                validateStatus: () => true,
            });
        } catch (error) {
            throw classifyApiConnectionError(error);
        }
        const data = parseResponse(response);
        const identity = {
            clientId: String(data.clientId || ''),
            secret: String(data.secret || ''),
            secretVersion: Number(data.secretVersion || 0),
        };
        if (!identity.clientId || !identity.secret || identity.secretVersion < 1) {
            throw new PhiApiError('API returned an invalid Bot credential', 502, 'invalid_registration_response');
        }
        writeIdentityAtomic(identity);
        this.ready = true;
        this.fatalError = null;
        this.fatalIdentity = '';
        logger.mark(`[phi-plugin] API Bot身份已签发：${identity.clientId}`);
        if (data.claimUrl) logger.mark(`[phi-plugin] Bot认领链接（15分钟有效）：${data.claimUrl}`);
        return { ...identity, claimUrl: data.claimUrl, claimExpiresAt: data.claimExpiresAt };
    }

    async recoverAfterReconnect(pluginVersion = '1.0.0') {
        return this.initialize(pluginVersion);
    }

    async reset(pluginVersion = '1.0.0') {
        this.ready = false;
        return this.register(pluginVersion);
    }

    async getClaimLink() {
        await this.initialize();
        return this.signedRequest('/bot-clients/self/claim-code', {}, 'POST');
    }

    /** @param {string} method @param {string} originalPath @param {string} rawBody @param {{clientId:string, secret:string, secretVersion:number}} [identity] @returns {Record<string, string>} */
    sign(method, originalPath, rawBody, identity = configIdentity()) {
        if (!identity.clientId || !identity.secret || identity.secretVersion < 1) {
            throw new PhiApiError('API Bot身份尚未初始化', 0, 'bot_identity_missing');
        }
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomBytes(18).toString('base64url');
        const bodyHash = crypto.createHash('sha256').update(rawBody || '').digest('hex');
        const canonical = [method.toUpperCase(), originalPath, timestamp, nonce, bodyHash].join('\n');
        const signature = crypto.createHmac('sha256', identity.secret).update(canonical).digest('base64url');
        return {
            'X-Phi-Bot-Client-Id': identity.clientId,
            'X-Phi-Bot-Key-Version': String(identity.secretVersion),
            'X-Phi-Bot-Timestamp': timestamp,
            'X-Phi-Bot-Nonce': nonce,
            'X-Phi-Bot-Signature': signature,
        };
    }

    /** @param {string} originalPath @param {any} body @param {string} [method] @param {{clientId:string, secret:string, secretVersion:number}} [identity] @param {Record<string,string>} [extraHeaders] */
    async signedRequest(originalPath, body, method = 'POST', identity = configIdentity(), extraHeaders = {}) {
        const upperMethod = method.toUpperCase();
        const rawBody = upperMethod === 'GET' ? '' : JSON.stringify(body ?? {});
        const headers = { ...this.sign(upperMethod, originalPath, rawBody, identity), ...extraHeaders };
        if (upperMethod !== 'GET') headers['Content-Type'] = 'application/json';
        let response;
        try {
            response = await axios.request({
                url: `${APIBASEURL}${originalPath}`,
                method: upperMethod,
                headers,
                data: upperMethod === 'GET' ? undefined : rawBody,
                timeout: TIMEOUT,
                validateStatus: () => true,
            });
        } catch (error) {
            throw classifyApiConnectionError(error);
        }
        return parseResponse(response);
    }

    /** @param {string} platform @param {string | number} platformId @param {any} params */
    async readCachedBinding(platform, platformId, params) {
        const identity = configIdentity();
        const cached = await userCredentialStore.getBotBinding(identity.clientId, platform, platformId);
        const fingerprint = localCredentialFingerprint(params);
        if (!cached || (fingerprint && cached.credentialFingerprint === fingerprint)) return cached;
        await userCredentialStore.deleteBotBinding(identity.clientId, platform, platformId);
        return null;
    }

    /** @param {string} platform @param {string | number} platformId @param {any} value @param {any} params */
    async saveBinding(platform, platformId, value, params) {
        const identity = configIdentity();
        return userCredentialStore.setBotBinding(identity.clientId, platform, platformId, {
            ...value,
            credentialFingerprint: localCredentialFingerprint(params),
        });
    }

    /** @param {any} params */
    async invalidateBinding(params) {
        const platform = params?.platform;
        const platformId = String(params?.platform_id ?? params?.platformId ?? '');
        if (!platform || !platformId) return;
        const identity = configIdentity();
        await userCredentialStore.deleteBotBinding(identity.clientId, platform, platformId);
    }

    /** @param {any} params @param {boolean} [allowMigration] */
    async ensureBinding(params, allowMigration = true) {
        await this.initialize();
        const platform = params?.platform;
        const platformId = String(params?.platform_id ?? params?.platformId ?? '');
        if (!platform || !platformId) return null;
        const token = params?.token;
        const apiUserId = params?.api_user_id ?? params?.apiUserId;
        if (!token && !apiUserId) {
            throw new PhiApiError('当前 Bot 本地尚未绑定用户', 404, 'binding_not_found');
        }
        const cached = await this.readCachedBinding(platform, platformId, params);
        if (cached) return cached;
        if (!allowMigration) {
            throw new PhiApiError('当前 Bot 本地绑定凭据尚未建立', 404, 'binding_not_found');
        }
        if (token) return this.bind({ platform, platform_id: platformId, token });
        return this.bind({ platform, platform_id: platformId, api_user_id: apiUserId });
    }

    /** @param {any} params */
    async bind(params) {
        await this.initialize();
        const platform = params?.platform;
        const platformId = String(params?.platform_id ?? params?.platformId ?? '');
        const data = await this.signedRequest('/bot/bindings/bind', {
            platform,
            platformId,
            ...(params?.token ? { token: params.token } : { apiUserId: params?.api_user_id ?? params?.apiUserId }),
            ...(params?.isGlobal === true ? { isGlobal: true } : {}),
        });
        try {
            return await this.saveBinding(platform, platformId, data, params);
        } catch (error) {
            logger.warn('[phi-plugin] API绑定已成功，但本地绑定凭据缓存写入失败，可执行更新重试');
            return {
                bindingId: data.bindingId,
                apiUserId: String(data.apiUserId),
                bindingCredential: data.bindingCredential,
                credentialVersion: Number(data.credentialVersion),
                updatedAt: new Date().toISOString(),
                cacheWarning: true,
            };
        }
    }

    /** @param {string} url @param {any} params @param {string} [method] @returns {Promise<Record<string,string>>} */
    async requestHeaders(url, params, method = 'POST') {
        await this.initialize();
        const parsed = new URL(url);
        const originalPath = `${parsed.pathname}${parsed.search}`;
        const rawBody = method.toUpperCase() === 'GET' ? '' : JSON.stringify(params ?? {});
        const headers = this.sign(method, originalPath, rawBody);
        if (params?.platform && (params?.platform_id ?? params?.platformId)) {
            const binding = await this.ensureBinding(params);
            if (!binding) throw new PhiApiError('当前平台尚未绑定', 404, 'binding_not_found');
            headers['X-Phi-Binding-Credential'] = binding.bindingCredential;
        }
        return headers;
    }
}

export default new BotApiAuth();
