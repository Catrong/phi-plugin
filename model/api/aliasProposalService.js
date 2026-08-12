import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { redisPath } from '../game/constNum.js'
import { dataPath } from '../filesystem/path.js'
import { UserCredentials } from '../user/userCredentials.js'
import getInfo from '../game/getInfo.js'
import platform, { redis } from '../../components/platform/index.js'
import logger from '../../components/Logger.js'
import makeRequest from './makeRequest.js'
import userCredentialStore from '../user/userCredentialStore.js'

/** @import {AliasBotEvent, AliasNotificationItem, AliasProposalCreateInput, AliasProposalRecord, AliasVoteValue} from '../type/aliasProposal.js' */

const snapshotPath = path.join(dataPath, 'alias', 'approved-nicklist.yaml')
const lastApprovedSyncKey = `${redisPath}:aliasApproved:lastSync`

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
     * 取得事件用户本地保存的 sessionToken。
     * @param {AliasBotEvent} e 当前 Bot 事件
     * @returns {Promise<phigrosToken>} 当前用户的 sessionToken
     */
    async tokenForEvent(e) {
        const token = await UserCredentials.fromEvent(e).getSessionToken()
        if (!token) throw new Error('请先绑定 sessionToken。')
        return token
    }

    /**
     * 创建别名提案；API 失败时不写本地待处理记录。
     * @param {AliasBotEvent} e 当前 Bot 事件
     * @param {AliasProposalCreateInput} input 提案内容
     * @returns {Promise<AliasProposalRecord | null>} 新提案
     */
    async create(e, input) {
        const token = await this.tokenForEvent(e)
        return makeRequest.createAliasProposal({
            token,
            alias: input.alias,
            songId: input.songId,
            note: input.note || undefined,
            source: 'bot',
        })
    }

    /**
     * @param {AliasBotEvent} e 当前 Bot 事件
     * @returns {Promise<AliasProposalRecord[]>} 当前用户的提案
     */
    async mine(e) {
        const token = await this.tokenForEvent(e)
        return makeRequest.getAliasProposalsMine({ token, limit: 50 })
    }

    /**
     * @param {AliasBotEvent} e 当前 Bot 事件
     * @returns {Promise<AliasProposalRecord[]>} 正在公投的提案
     */
    async publicList(e) {
        const token = await this.tokenForEvent(e)
        return makeRequest.getAliasPublicProposals({ token, limit: 50 })
    }

    /**
     * @param {AliasBotEvent} e 当前 Bot 事件
     * @param {string} proposalId 提案 UUID
     * @param {string} reason 10-500 字公审理由
     * @returns {Promise<AliasProposalRecord | null>} 更新后的提案
     */
    async requestPublicReview(e, proposalId, reason) {
        const token = await this.tokenForEvent(e)
        return makeRequest.requestAliasPublicReview(proposalId, { token, reason })
    }

    /**
     * 设置、修改或撤回公开投票。
     * @param {AliasBotEvent} e 当前 Bot 事件
     * @param {string} proposalId 提案 UUID
     * @param {AliasVoteValue} value 1 赞成、-1 反对、0 撤票
     * @returns {Promise<AliasProposalRecord | null>} 更新后的提案
     */
    async vote(e, proposalId, value) {
        const token = await this.tokenForEvent(e)
        return makeRequest.voteAliasProposal(proposalId, { token, value })
    }

    /**
     * 下载并原子替换 Approved 快照，然后重建运行时别名索引。
     * @param {boolean} [force=false] 是否忽略六小时成功间隔
     * @returns {Promise<boolean>} 是否实际替换了快照
     */
    async syncApprovedSnapshot(force = false) {
        const last = Number(await redis.get(lastApprovedSyncKey) || 0)
        if (!force && Date.now() - last < 6 * 60 * 60 * 1000) return false
        const parsed = validateApprovedAliasSnapshot(await makeRequest.getApprovedAliasSnapshot())
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
     * 使用本地 sessionToken 批量轮询；仅在私聊成功后确认通知。
     * @returns {Promise<void>}
     */
    async pollNotifications() {
        const credentials = [...(await userCredentialStore.listSessionCredentials()).entries()]
            .map(([userId, token]) => ({
                userId: /** @type {import('../../components/platform/types.js').PlatformUserId} */ (userId),
                token,
            }))
        for (const batch of chunks(credentials, 100)) {
            const sessions = batch.map(item => ({ ...item, requestId: String(crypto.randomUUID()) }))
            const response = await makeRequest.pollAliasNotifications({
                sessions: sessions.map(item => ({ requestId: item.requestId, token: item.token })),
                limitPerSession: 50,
            })
            const byRequest = new Map(sessions.map(item => [item.requestId, item]))
            /** @type {Array<{token: phigrosToken, notificationIds: string[]}>} */
            const confirmations = []
            for (const session of response.sessions || []) {
                const local = byRequest.get(session.requestId)
                if (!local) continue
                const delivered = []
                for (const item of session.items || []) {
                    try {
                        const sent = await platform.relpyPrivate(local.userId, formatAliasNotification(item))
                        if (sent !== false && sent != null) delivered.push(item.id)
                    } catch {
                        // Leave the notification pending for the next poll.
                    }
                }
                if (delivered.length) confirmations.push({
                    token: local.token,
                    notificationIds: delivered,
                })
            }
            if (confirmations.length) {
                await makeRequest.confirmAliasNotifications({ sessions: confirmations })
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
