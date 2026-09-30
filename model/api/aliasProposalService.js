import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { redisPath } from '../game/constNum.js'
import { dataPath } from '../filesystem/path.js'
import { UserCredentials } from '../user/userCredentials.js'
import getInfo from '../game/getInfo.js'
import { redis } from '../../components/platform/index.js'
import logger from '../../components/Logger.js'
import Config from '../../components/Config.js'
import makeRequest from './makeRequest.js'
import { isApiVersionBlocked } from './apiVersion.js'

/** @import {AliasBotEvent, AliasProposalCreateInput, AliasProposalRecord, AliasVoteValue} from '../type/aliasProposal.js' */

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
        return UserCredentials.fromEvent(e).createAliasProposal(input)
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

    /** @returns {Promise<void>} 完成一次正式别名快照同步任务 */
    async scheduledTask() {
        if (!Config.getUserCfg('config', 'openPhiPluginApi') || isApiVersionBlocked()) return
        if (this.runningTask) return
        this.runningTask = true
        try {
            await this.syncApprovedSnapshot(false).catch(() => logger.warn('[phi-plugin] approved alias sync failed'))
        } finally {
            this.runningTask = false
        }
    }

    /** @returns {Promise<void>} 启动时尝试拉取一次正式别名快照 */
    async initialize() {
        if (!Config.getUserCfg('config', 'openPhiPluginApi') || isApiVersionBlocked()) return
        if (this.initialized) return
        this.initialized = true
        await this.syncApprovedSnapshot(true).catch(() => logger.warn('[phi-plugin] initial approved alias sync failed'))
    }
}

export default new AliasProposalService()
