// @ts-nocheck -- Runtime module consumed by multiple Yunzai adapters with untyped Redis clients.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import YAML from 'yaml';
import Config from '../components/Config.js';
import logger from '../components/Logger.js';
import { redis } from '../components/platform/index.js';
import { pluginRoot } from './path.js';
import { APIBASEURL, redisPath } from './constNum.js';

const TIMEOUT = 5000;

export class PhiApiError extends Error {
    constructor(message, status = 0, code = 'api_request_failed', data = undefined) {
        super(message);
        this.name = 'PhiApiError';
        this.status = status;
        this.code = code;
        this.data = data;
    }
}

function configIdentity() {
    return {
        clientId: String(Config.getUserCfg('config', 'apiBotClientId') || '').trim(),
        secret: String(Config.getUserCfg('config', 'apiBotClientSecret') || '').trim(),
        secretVersion: Number(Config.getUserCfg('config', 'apiBotSecretVersion') || 0),
    };
}

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

function bindingKey(clientId, platform, platformId) {
    const digest = crypto.createHash('sha256').update(`${platform}\n${platformId}`).digest('hex');
    return `${redisPath}:apiBotBinding:${clientId}:${digest}`;
}

function parseResponse(response) {
    const data = response.data;
    if (response.status < 200 || response.status >= 300 || data?.error) {
        throw new PhiApiError(
            data?.error || data?.message || `API request failed (${response.status})`,
            response.status,
            data?.code || 'api_request_failed',
            data,
        );
    }
    return data;
}

class BotApiAuth {
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
        } catch (error) {
            this.ready = false;
            this.fatalError = error;
            this.fatalIdentity = `${identity.clientId}:${identity.secretVersion}:${crypto.createHash('sha256').update(identity.secret).digest('hex')}`;
            logger.error(`[phi-plugin] API Bot凭证无效，新平台API操作已停止：${error.code || error.message}`);
            throw error;
        }
    }

    async register(pluginVersion = '1.0.0') {
        const response = await axios.post(`${APIBASEURL}/bot-clients/register`, JSON.stringify({
            pluginName: 'phi-plugin',
            pluginVersion,
        }), {
            headers: { 'Content-Type': 'application/json' },
            timeout: TIMEOUT,
            validateStatus: () => true,
        });
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

    async reset(pluginVersion = '1.0.0') {
        this.ready = false;
        return this.register(pluginVersion);
    }

    async getClaimLink() {
        await this.initialize();
        return this.signedRequest('/bot-clients/self/claim-code', {}, 'POST');
    }

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
            throw new PhiApiError('API离线', 0, 'api_offline', undefined);
        }
        return parseResponse(response);
    }

    async readCachedBinding(platform, platformId) {
        const identity = configIdentity();
        const raw = await redis.get(bindingKey(identity.clientId, platform, platformId));
        if (!raw) return null;
        try {
            const value = JSON.parse(raw);
            if (value?.bindingCredential && value?.apiUserId && value?.bindingId) return value;
        } catch { /* discard malformed cache */ }
        await this.invalidateBinding({ platform, platform_id: platformId });
        return null;
    }

    async saveBinding(platform, platformId, value) {
        const identity = configIdentity();
        const stored = {
            bindingId: value.bindingId,
            apiUserId: String(value.apiUserId),
            bindingCredential: value.bindingCredential,
            credentialVersion: Number(value.credentialVersion),
            updatedAt: new Date().toISOString(),
        };
        await redis.set(bindingKey(identity.clientId, platform, platformId), JSON.stringify(stored));
        return stored;
    }

    async invalidateBinding(params) {
        const platform = params?.platform;
        const platformId = String(params?.platform_id ?? params?.platformId ?? '');
        if (!platform || !platformId) return;
        const identity = configIdentity();
        await redis.del(bindingKey(identity.clientId, platform, platformId));
    }

    async ensureBinding(params, allowMigration = true) {
        await this.initialize();
        const platform = params?.platform;
        const platformId = String(params?.platform_id ?? params?.platformId ?? '');
        if (!platform || !platformId) return null;
        const cached = await this.readCachedBinding(platform, platformId);
        if (cached) return cached;
        try {
            const resolved = await this.signedRequest('/bot/bindings/resolve', { platform, platformId });
            return this.saveBinding(platform, platformId, resolved);
        } catch (error) {
            if (!(error instanceof PhiApiError) || error.code !== 'binding_not_found' || !allowMigration) throw error;
        }

        const [{ default: getSave }, { default: getSaveFromApi }] = await Promise.all([
            import('./getSave.js'),
            import('./getSaveFromApi.js'),
        ]);
        const localUserId = String(params?._local_user_id ?? platformId);
        const token = await getSave.get_user_token(localUserId);
        if (token) return this.bind({ platform, platform_id: platformId, token });
        const apiUserId = await getSaveFromApi.get_user_apiId(localUserId);
        if (apiUserId) return this.bind({ platform, platform_id: platformId, api_user_id: apiUserId });
        throw new PhiApiError('当前平台尚未绑定，请使用SSTK绑定', 404, 'binding_not_found');
    }

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
            return await this.saveBinding(platform, platformId, data);
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

    async unbind(params) {
        await this.initialize();
        const platform = params?.platform;
        const platformId = String(params?.platform_id ?? params?.platformId ?? '');
        const data = await this.signedRequest('/bot/bindings/unbind', { platform, platformId });
        await this.invalidateBinding({ platform, platform_id: platformId });
        return data;
    }

    async requestHeaders(url, params, method = 'POST') {
        await this.initialize();
        const parsed = new URL(url);
        const originalPath = `${parsed.pathname}${parsed.search}`;
        const rawBody = method.toUpperCase() === 'GET' ? '' : JSON.stringify(params ?? {});
        const headers = this.sign(method, originalPath, rawBody);
        if (params?.platform && (params?.platform_id ?? params?.platformId)) {
            const binding = await this.ensureBinding(params);
            headers['X-Phi-Binding-Credential'] = binding.bindingCredential;
        }
        return headers;
    }
}

export default new BotApiAuth();
