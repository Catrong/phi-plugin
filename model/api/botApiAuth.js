import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import YAML from 'yaml';
import Config from '../../components/Config.js';
import logger from '../../components/Logger.js';
import { pluginRoot } from '../filesystem/path.js';
import { APIBASEURL } from '../game/constNum.js';
import { classifyApiConnectionError, isFatalBotIdentityError, PhiApiError } from './phiApiErrors.js';
import { isApiVersionBlocked } from './apiVersion.js';
import { SUPPORTED_API_VERSION } from './apiVersion.js';

const TIMEOUT = 5000;

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

    /** @returns {string} 本地配置中的 API 签发 Bot clientId，不发起网络请求 */
    getClientId() {
        return configIdentity().clientId;
    }

    async initialize(pluginVersion = SUPPORTED_API_VERSION) {
        if (isApiVersionBlocked()) {
            throw new PhiApiError(
                'API协议大版本不兼容，请更新 phi-plugin 后重启',
                0,
                'api_version_incompatible',
            );
        }
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

    async register(pluginVersion = SUPPORTED_API_VERSION) {
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

    async recoverAfterReconnect(pluginVersion = SUPPORTED_API_VERSION) {
        return this.initialize(pluginVersion);
    }

    async reset(pluginVersion = SUPPORTED_API_VERSION) {
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
        if (isApiVersionBlocked()) {
            throw new PhiApiError(
                'API协议大版本不兼容，请更新 phi-plugin 后重启',
                0,
                'api_version_incompatible',
            );
        }
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

}

export default new BotApiAuth();
