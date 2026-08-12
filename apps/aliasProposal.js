import Config from '../components/Config.js'
import phiPluginBase from '../components/baseClass.js'
import send from '../model/render/send.js'
import getInfo from '../model/game/getInfo.js'
import aliasProposalService from '../model/api/aliasProposalService.js'

/** @import {PlatformEvent} from '../components/platform/types.js' */
/** @import {AliasProposalRecord, AliasProposalStatus} from '../model/type/aliasProposal.js' */

const head = Config.getUserCfg('config', 'cmdhead')
const prefix = `^[#/](${head})(\\s*)(别名|alias)(\\s*)`

/** @returns {import('../components/platform/types.js').PlatformTask} */
export function createAliasProposalTask() {
    return {
        name: 'phi-别名通知与正式别名同步',
        fnc: () => aliasProposalService.scheduledTask(),
        cron: '0 */5 * * * ?',
    }
}

/** @type {Record<AliasProposalStatus, string>} */
const statusName = {
    submitted: '等待初审',
    rejected_private: '私密拒绝',
    public_review_requested: '已申请公审',
    public_voting: '公开投票',
    vote_passed: '投票通过待终审',
    approved: '正式通过',
    public_review_denied: '公审申请被拒',
    rejected_final: '最终拒绝',
}

/**
 * 按命令前缀和竖线分隔符解析用户输入。
 * @param {string} message 原始消息文本
 * @param {string} command 命令部分的正则表达式片段
 * @returns {string[]} 去除首尾空白后的参数
 */
function splitArgs(message, command) {
    return message
        .replace(new RegExp(`${prefix}${command}\\s*`, 'i'), '')
        .split('|')
        .map(item => item.trim())
}

/**
 * 将提案列表格式化为适合 Bot 文本消息的紧凑内容。
 * @param {AliasProposalRecord[]} items 提案列表
 * @param {boolean} [includeVote=false] 是否展示票数和公开评审理由
 * @returns {string} 可直接发送的消息文本
 */
function shortList(items, includeVote = false) {
    if (!items.length) return '暂无相关别名提案。'
    return items.slice(0, 15).map((item, index) => {
        const vote = includeVote ? `｜+${item.votesUp || 0}/-${item.votesDown || 0}` : ''
        const reason = includeVote && item.publicReviewReason ? `\n理由：${item.publicReviewReason}` : ''
        return `${index + 1}. ${item.alias} -> ${item.songId}\n${statusName[item.status] || item.status}${vote}${reason}\nID: ${item.id}`
    }).join('\n\n')
}

export class aliasProposal extends phiPluginBase {
    /** 初始化命令规则和五分钟定时任务。 */
    constructor() {
        super({
            name: 'phi-别名提案',
            dsc: 'Token 驱动的曲目别名提案与公投',
            event: 'message',
            priority: 1000,
            task: createAliasProposalTask(),
            rule: [
                { reg: `${prefix}(提案|submit)(\\s*).*$`, fnc: 'propose' },
                { reg: `${prefix}(我的|mine)$`, fnc: 'mine' },
                { reg: `${prefix}(公审|public)$`, fnc: 'publicList' },
                { reg: `${prefix}(申诉|appeal)(\\s*).*$`, fnc: 'appeal' },
                { reg: `${prefix}(投票|vote)(\\s*).*$`, fnc: 'vote' },
                { reg: `${prefix}(撤票|unvote)(\\s*).*$`, fnc: 'unvote' },
            ],
        })
        void aliasProposalService.initialize()
    }

    /**
     * 统一隐藏 API 错误细节，防止响应内容意外包含敏感信息。
     * @template T
     * @param {PlatformEvent} e 当前消息事件
     * @param {() => Promise<T>} operation 要执行的别名 API 操作
     * @returns {Promise<T | null>} 成功结果；失败时已回复用户并返回 null
     */
    async withFailureMessage(e, operation) {
        try {
            return await operation()
        } catch (error) {
            const message = error instanceof Error && error.message === '请先绑定 sessionToken。'
                ? error.message
                : '别名服务暂时不可用，请稍后重试。'
            send.send_with_At(e, message)
            return null
        }
    }

    /**
     * 私聊提交单曲别名提案。
     * @param {PlatformEvent} e 当前消息事件
     * @returns {Promise<boolean>} 是否成功提交
     */
    async propose(e) {
        if (e.isGroup) {
            send.send_with_At(e, '别名提案仅允许在私聊中提交。')
            return false
        }
        const [songText, alias, note] = splitArgs(e.msg, '(提案|submit)')
        if (!songText || !alias) {
            send.send_with_At(e, `格式：/${head} alias submit 曲目 | 别名 | 私密备注（可选）`)
            return false
        }
        if (alias.length > 64 || (note && note.length > 500)) {
            send.send_with_At(e, '别名最多 64 字，备注最多 500 字。')
            return false
        }
        const songIds = getInfo.fuzzysongsnick(songText, 0.85, true)
        if (songIds.length !== 1) {
            const candidates = songIds.slice(0, 8).map(id => `${getInfo.info(id, true)?.song || id} (${id})`).join('\n')
            send.send_with_At(e, songIds.length ? `曲目不唯一，请使用更精确的名称：\n${candidates}` : '未找到对应曲目。')
            return false
        }
        const proposal = await this.withFailureMessage(e, () => aliasProposalService.create(e, {
            songId: songIds[0], alias, note,
        }))
        if (proposal) send.send_with_At(e, `提案已提交。\n${proposal.alias} -> ${proposal.songId}\nID: ${proposal.id}`)
        return Boolean(proposal)
    }

    /**
     * 查询当前 token 用户的提案。
     * @param {PlatformEvent} e 当前消息事件
     * @returns {Promise<boolean>} 是否成功取得列表
     */
    async mine(e) {
        const items = await this.withFailureMessage(e, () => aliasProposalService.mine(e))
        if (items) send.send_with_At(e, shortList(items))
        return Boolean(items)
    }

    /**
     * 查询正在公开投票的提案。
     * @param {PlatformEvent} e 当前消息事件
     * @returns {Promise<boolean>} 是否成功取得列表
     */
    async publicList(e) {
        const items = await this.withFailureMessage(e, () => aliasProposalService.publicList(e))
        if (items) send.send_with_At(e, shortList(items, true))
        return Boolean(items)
    }

    /**
     * 私聊为一次私密拒绝申请公开评审。
     * @param {PlatformEvent} e 当前消息事件
     * @returns {Promise<boolean>} 是否成功提交申请
     */
    async appeal(e) {
        if (e.isGroup) {
            send.send_with_At(e, '公审申请仅允许在私聊中提交。')
            return false
        }
        const [proposalId, reason] = splitArgs(e.msg, '(申诉|appeal)')
        if (!proposalId || !reason) {
            send.send_with_At(e, `格式：/${head} alias appeal 提案ID | 10-500字理由`)
            return false
        }
        if (reason.length < 10 || reason.length > 500) {
            send.send_with_At(e, '公审理由必须为 10-500 字。')
            return false
        }
        const proposal = await this.withFailureMessage(e, () => aliasProposalService.requestPublicReview(e, proposalId, reason))
        if (proposal) send.send_with_At(e, `公审申请已提交。\nID: ${proposal.id}`)
        return Boolean(proposal)
    }

    /**
     * 设置或修改当前用户的公开投票。
     * @param {PlatformEvent} e 当前消息事件
     * @returns {Promise<boolean>} 是否成功记录投票
     */
    async vote(e) {
        const args = e.msg.replace(new RegExp(`${prefix}(投票|vote)\\s*`, 'i'), '').trim().split(/\s+/)
        const proposalId = args[0]
        const choice = String(args[1] || '').toLowerCase()
        /** @type {1 | -1 | null} */
        const value = ['赞成', 'yes', '1', '+'].includes(choice) ? 1 : ['反对', 'no', '-1', '-'].includes(choice) ? -1 : null
        if (!proposalId || value === null) {
            send.send_with_At(e, `格式：/${head} alias vote 提案ID 赞成|反对`)
            return false
        }
        const proposal = await this.withFailureMessage(e, () => aliasProposalService.vote(e, proposalId, value))
        if (proposal) send.send_with_At(e, `投票已记录：${value === 1 ? '赞成' : '反对'}。`)
        return Boolean(proposal)
    }

    /**
     * 撤回当前用户对指定提案的投票。
     * @param {PlatformEvent} e 当前消息事件
     * @returns {Promise<boolean>} 是否成功撤票
     */
    async unvote(e) {
        const proposalId = e.msg.replace(new RegExp(`${prefix}(撤票|unvote)\\s*`, 'i'), '').trim()
        if (!proposalId) {
            send.send_with_At(e, `格式：/${head} alias unvote 提案ID`)
            return false
        }
        const proposal = await this.withFailureMessage(e, () => aliasProposalService.vote(e, proposalId, 0))
        if (proposal) send.send_with_At(e, '投票已撤回。')
        return Boolean(proposal)
    }

    /** @returns {Promise<void>} 完成一次通知轮询和到期快照同步 */
    async aliasScheduledTask() {
        await aliasProposalService.scheduledTask()
    }
}
