import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { APIBASEURL, redisPath } from './constNum.js'
import { dataPath } from './path.js'
import getSave from './getSave.js'
import { UserCredentials } from './userCredentials.js'
import getInfo from './getInfo.js'
import platform, { redis } from '../components/platform/index.js'
import logger from '../components/Logger.js'

/** @import {PlatformUserId} from '../components/platform/types.js' */
/** @import {AliasBotContext, AliasBotEvent, AliasBotSessionResponse, AliasNotificationBinding, AliasNotificationBindingWithUser, AliasNotificationItem, AliasNotificationPollResponse, AliasProposalCreateInput, AliasProposalEnvelope, AliasProposalListResponse, AliasProposalRecord, AliasVoteValue} from './type/aliasProposal.js' */

const snapshotPath = path.join(dataPath, 'alias', 'approved-nicklist.yaml')
const lastApprovedSyncKey = `${redisPath}:aliasApproved:lastSync`

/**
 * @param {string} pathname API 绝对路径
 * @returns {string} phi-plugin-api 完整地址
 */
function apiUrl(pathname) {
    return `${APIBASEURL}${pathname}`
}

/**
 * 发起 JSON 请求并将网络错误转换为不含 token 的固定错误。
 * @template T
 * @param {string} pathname API 路径
 * @param {unknown} body JSON 请求体
 * @param {'POST' | 'PUT'} [method='POST'] HTTP 方法
 * @returns {Promise<T>} 解析后的响应
 */
async function requestJson(pathname, body, method = 'POST') {
    let response
    try {
        response = await fetch(apiUrl(pathname), {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10_000),
        })
    } catch {
        throw new Error('别名服务暂时不可用，请稍后重试。')
    }
    const data = /** @type {({error?: unknown} & Record<string, unknown>) | null} */ (
        await response.json().catch(() => null)
    )
    if (!response.ok || !data) {
        throw new Error(typeof data?.error === 'string' ? data.error : '别名服务暂时不可用，请稍后重试。')
    }
    return /** @type {T} */ (data)
}

/**
 * 严格校验公开 YAML 快照，拒绝非对象、非数组和空别名。
 * @param {unknown} value YAML 解析结果
 * @returns {Record<string, string[]>} 可安全合并的正式别名快照
 */
export function validateApprovedAliasSnapshot(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid alias snapshot')
    /** @type {Record<string, string[]>} */
    const result = {}
    for (const [songId, aliases] of Object.entries(value)) {
        if (!songId.trim() || !Array.isArray(aliases)) throw new Error('Invalid alias snapshot')
        result[songId] = aliases.map(alias => {
            if (typeof alias !== 'string' || !alias.trim()) throw new Error('Invalid alias snapshot')
            return alias.trim()
        })
    }
    return result
}

/**
 * @template T
 * @param {T[]} items 原始数组
 * @param {number} size 每批最大数量
 * @returns {T[][]} 顺序不变的分批数组
 */
function chunks(items, size) {
    /** @type {T[][]} */
    const result = []
    for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
    return result
}

/**
 * 将结构化通知格式化为不包含 token 的私聊文本。
 * @param {AliasNotificationItem} item API 通知项
 * @returns {string} 私聊消息文本
 */
export function formatAliasNotification(item) {
    const payload = item.payload || {}
    const title = {
        rejected_private: '别名提案被私密拒绝',
        public_review_allowed: '别名提案已进入公开投票',
        public_review_denied: '别名提案的公审申请被拒绝',
        vote_ended: '别名提案公开投票已结束',
        final_approved: '别名提案已正式通过',
        final_rejected: '别名提案已被最终拒绝',
    }[item.type] || '别名提案状态已更新'
    return `${title}\n别名：${payload.alias || '--'}\n曲目：${payload.songId || '--'}\n状态：${payload.status || '--'}\n票数：赞成 ${payload.votesUp || 0} / 反对 ${payload.votesDown || 0}\n提案 ID：${payload.proposalId || item.proposalId}`
}

class AliasProposalService {
    /** 初始化任务状态；不会在构造阶段写入用户数据。 */
    constructor() {
        this.runningTask = false
        this.initialized = false
    }

    /**
     * 校验 token 并为当前本地绑定注册或轮换通知密钥。
     * @param {PlatformUserId} userId Bot 平台用户 ID
     * @param {phigrosToken} token 已绑定的 Phigros sessionToken
     * @param {PlatformUserId | undefined} botId 用于后续私聊的 Bot ID
     * @returns {Promise<AliasNotificationBinding>} 更新后的本地通知绑定
     */
    async ensureBotSession(userId, token, botId) {
        const old = await getSave.get_alias_binding(userId)
        const clientId = old?.clientId || crypto.randomUUID()
        /** @type {AliasBotSessionResponse} */
        const result = await requestJson('/alias-proposals/bot/session/verify', {
            token,
            clientId,
            notificationKey: old?.aliasNotificationKey,
        })
        /** @type {AliasNotificationBinding} */
        const binding = {
            clientId,
            aliasNotificationKey: result.notificationKey,
            aliasNotificationKeyUpdatedAt: result.keyUpdatedAt,
            botId: botId || old?.botId || null,
        }
        await getSave.set_alias_binding(userId, binding)
        return binding
    }

    /**
     * 取得事件对应的 token 和已验证通知绑定。
     * @param {AliasBotEvent} e 当前 Bot 事件
     * @returns {Promise<{token: phigrosToken, binding: AliasNotificationBinding}>}
     */
    async bindingForEvent(e) {
        const token = await UserCredentials.fromEvent(e).getSessionToken()
        if (!token) throw new Error('请先绑定 sessionToken。')
        const binding = await this.ensureBotSession(e.user_id, token, e.self_id)
        return { token, binding }
    }

    /**
     * 使用 Bot API 响应中的当前密钥更新本地绑定。
     * @param {PlatformUserId} userId Bot 平台用户 ID
     * @param {AliasNotificationBinding} binding 现有本地绑定
     * @param {AliasProposalEnvelope} response Bot 提案接口响应
     * @returns {Promise<AliasProposalRecord>} 提案记录
     */
    async updateBindingFromResponse(userId, binding, response) {
        await getSave.set_alias_binding(userId, {
            ...binding,
            aliasNotificationKey: response.notificationKey,
            aliasNotificationKeyUpdatedAt: response.keyUpdatedAt,
        })
        return response.proposal
    }

    /**
     * @param {AliasNotificationBinding} binding 本地通知绑定
     * @returns {AliasBotContext} API 请求中的 Bot 上下文
     */
    botBody(binding) {
        return {
            clientId: binding.clientId,
            notificationKey: binding.aliasNotificationKey,
        }
    }

    /**
     * 创建别名提案；API 失败时不写本地待处理记录。
     * @param {AliasBotEvent} e 当前 Bot 事件
     * @param {AliasProposalCreateInput} input 提案内容
     * @returns {Promise<AliasProposalRecord>} 新提案
     */
    async create(e, input) {
        const { token, binding } = await this.bindingForEvent(e)
        /** @type {AliasProposalEnvelope} */
        const response = await requestJson('/alias-proposals', {
            token,
            alias: input.alias,
            songId: input.songId,
            note: input.note || undefined,
            bot: this.botBody(binding),
        })
        return this.updateBindingFromResponse(e.user_id, binding, response)
    }

    /**
     * @param {AliasBotEvent} e 当前 Bot 事件
     * @returns {Promise<AliasProposalRecord[]>} 当前用户的提案
     */
    async mine(e) {
        const { token } = await this.bindingForEvent(e)
        /** @type {AliasProposalListResponse} */
        const response = await requestJson('/alias-proposals/mine', { token, limit: 50 })
        return response.items || []
    }

    /**
     * @param {AliasBotEvent} e 当前 Bot 事件
     * @returns {Promise<AliasProposalRecord[]>} 正在公投的提案
     */
    async publicList(e) {
        const { token } = await this.bindingForEvent(e)
        /** @type {AliasProposalListResponse} */
        const response = await requestJson('/alias-proposals/public/list', { token, limit: 50 })
        return response.items || []
    }

    /**
     * @param {AliasBotEvent} e 当前 Bot 事件
     * @param {string} proposalId 提案 UUID
     * @param {string} reason 10-500 字公审理由
     * @returns {Promise<AliasProposalRecord>} 更新后的提案
     */
    async requestPublicReview(e, proposalId, reason) {
        const { token, binding } = await this.bindingForEvent(e)
        /** @type {AliasProposalEnvelope} */
        const response = await requestJson(`/alias-proposals/${encodeURIComponent(proposalId)}/public-review`, {
            token,
            reason,
            bot: this.botBody(binding),
        })
        return this.updateBindingFromResponse(e.user_id, binding, response)
    }

    /**
     * 设置、修改或撤回公开投票。
     * @param {AliasBotEvent} e 当前 Bot 事件
     * @param {string} proposalId 提案 UUID
     * @param {AliasVoteValue} value 1 赞成、-1 反对、0 撤票
     * @returns {Promise<AliasProposalRecord>} 更新后的提案
     */
    async vote(e, proposalId, value) {
        const { token, binding } = await this.bindingForEvent(e)
        /** @type {AliasProposalEnvelope} */
        const response = await requestJson(`/alias-proposals/${encodeURIComponent(proposalId)}/vote`, {
            token,
            value,
            bot: this.botBody(binding),
        }, 'PUT')
        return this.updateBindingFromResponse(e.user_id, binding, response)
    }

    /**
     * 下载并原子替换 Approved 快照，然后重建运行时别名索引。
     * @param {boolean} [force=false] 是否忽略六小时成功间隔
     * @returns {Promise<boolean>} 是否实际替换了快照
     */
    async syncApprovedSnapshot(force = false) {
        const last = Number(await redis.get(lastApprovedSyncKey) || 0)
        if (!force && Date.now() - last < 6 * 60 * 60 * 1000) return false
        let response
        try {
            response = await fetch(apiUrl('/alias-proposals/export/nicklist.yaml'), {
                signal: AbortSignal.timeout(15_000),
            })
        } catch {
            throw new Error('Approved alias snapshot is unavailable')
        }
        if (!response.ok) throw new Error(`Approved alias snapshot returned ${response.status}`)
        const parsed = validateApprovedAliasSnapshot(YAML.parse(await response.text()))
        fs.mkdirSync(path.dirname(snapshotPath), { recursive: true })
        const tempPath = `${snapshotPath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
        try {
            fs.writeFileSync(tempPath, YAML.stringify(parsed), 'utf8')
            fs.renameSync(tempPath, snapshotPath)
        } finally {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
        }
        getInfo.setApprovedAliasSnapshot(parsed)
        await redis.set(lastApprovedSyncKey, String(Date.now()))
        return true
    }

    /**
     * 批量轮询所有本地绑定；仅在私聊成功后确认通知。
     * @returns {Promise<void>}
     */
    async pollNotifications() {
        /** @type {AliasNotificationBindingWithUser[]} */
        const bindings = (await getSave.list_alias_bindings()).filter(item => item.clientId && item.aliasNotificationKey)
        for (const batch of chunks(bindings, 100)) {
            /** @type {AliasNotificationPollResponse} */
            const response = await requestJson('/alias-proposals/bot/notifications/poll', {
                clients: batch.map(item => ({ clientId: item.clientId, notificationKey: item.aliasNotificationKey })),
                limitPerClient: 50,
            })
            const byClient = new Map(batch.map(item => [item.clientId, item]))
            /** @type {Array<{clientId: string, notificationKey: string, notificationIds: string[]}>} */
            const confirmations = []
            for (const client of response.clients || []) {
                const binding = byClient.get(client.clientId)
                if (!binding) continue
                const delivered = []
                for (const item of client.items || []) {
                    try {
                        const sent = await platform.relpyPrivate(binding.userId, formatAliasNotification(item), binding.botId || undefined)
                        if (sent !== false && sent != null) delivered.push(item.id)
                    } catch {
                        // Leave the notification pending for the next poll.
                    }
                }
                if (delivered.length) confirmations.push({
                    clientId: binding.clientId,
                    notificationKey: binding.aliasNotificationKey,
                    notificationIds: delivered,
                })
            }
            if (confirmations.length) {
                await requestJson('/alias-proposals/bot/notifications/confirm', { clients: confirmations })
            }
        }
    }

    /** @returns {Promise<void>} 完成一次五分钟周期任务 */
    async scheduledTask() {
        if (this.runningTask) return
        this.runningTask = true
        try {
            await this.pollNotifications().catch(() => logger.warn('[phi-plugin] alias notification poll failed'))
            await this.syncApprovedSnapshot(false).catch(() => logger.warn('[phi-plugin] approved alias sync failed'))
        } finally {
            this.runningTask = false
        }
    }

    /** @returns {Promise<void>} 启动时尝试拉取一次正式别名快照 */
    async initialize() {
        if (this.initialized) return
        this.initialized = true
        await this.syncApprovedSnapshot(true).catch(() => logger.warn('[phi-plugin] initial approved alias sync failed'))
    }
}

export default new AliasProposalService()
