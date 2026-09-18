import logger from '../../components/Logger.js'
import Version from '../../components/Version.js'
import Config from '../../components/Config.js'
import platform from '../../components/platform/index.js'
import makeRequest from './makeRequest.js'
import { isApiVersionBlocked } from './apiVersion.js'
import themePolicy from '../theme/policy.js'
import { UserCredentials } from '../user/userCredentials.js'

export class BotSyncService {
    constructor() {
        this.running = false
        this.initialized = false
        this.reportRenderPressure = false
        /** @type {Set<string>} */
        this.pendingAcknowledgements = new Set()
    }

    /**
     * 执行一次 Bot 状态同步；成功送达的消息在下一次请求中确认。
     * @returns {Promise<void>}
     */
    async sync() {
        if (this.running) return
        this.running = true
        const acknowledgedMessageIds = [...this.pendingAcknowledgements]
        try {
            // 始终在本地滚动采样；服务端许可只决定是否把匿名压力历史放入请求。
            const renderPressure = (await import('../render/picmodle.js')).default.takeRenderPressureSnapshot()
            const response = await makeRequest.syncBot({
                pluginVersion: Version.ver,
                acknowledgedMessageIds,
                ...(this.reportRenderPressure ? { renderPressure } : {}),
            })
            for (const id of acknowledgedMessageIds) this.pendingAcknowledgements.delete(id)
            this.reportRenderPressure = response?.reporting?.renderPressure === true
            if (response?.themePolicy) themePolicy.apply(response.themePolicy)

            for (const request of response?.unbindRequests || []) {
                await this.applyUnbindRequest(request)
            }

            for (const message of response?.messages || []) {
                try {
                    const sent = await platform.relpyPrivate(message.target.platformId, message.text)
                    if (sent !== false && sent != null) this.pendingAcknowledgements.add(message.id)
                } catch (error) {
                    logger.warn(`[phi-plugin] Bot消息私聊失败，将在下次同步重试：${message.id}`, error)
                }
            }
        } finally {
            this.running = false
        }
    }

    /**
     * 执行服务端下发的解绑信号：清除本地绑定与数据，并把解绑状态回传 API。
     * 单个信号失败不影响其余信号，失败项将在下次同步重试（API 端保持 disabled 直至确认）。
     * @param {{platform?: string, platformId?: string, reason?: string}} request 解绑信号
     * @returns {Promise<void>}
     */
    async applyUnbindRequest(request) {
        const platformId = String(request?.platformId ?? '').trim()
        if (!platformId) return
        try {
            const credentials = new UserCredentials(platformId)
            const { hadBinding } = await credentials.unbindLocal()
            await credentials.reportUnbind({
                platform: typeof request?.platform === 'string' ? request.platform : undefined,
                platformId,
                reason: request?.reason || 'disabled_by_account',
            })
            if (hadBinding) logger.mark(`[phi-plugin] 已按 API 解绑信号清除本地绑定：${platformId}`)
        } catch (error) {
            logger.warn(`[phi-plugin] 处理 API 解绑信号失败，将在下次同步重试：${platformId}`, error)
        }
    }

    /** 启动时立即同步一次；失败由一分钟周期和 API 重连流程继续恢复。 */
    async initialize() {
        if (!Config.getUserCfg('config', 'openPhiPluginApi') || isApiVersionBlocked()) return
        if (this.initialized) return
        this.initialized = true
        await this.sync().catch(error => {
            logger.warn('[phi-plugin] 初始 Bot状态同步失败，将稍后重试', error)
        })
    }

    /** API 恢复连接后立即补发心跳并拉取消息。 */
    async recoverAfterReconnect() {
        this.initialized = true
        await this.sync().catch(error => {
            logger.warn('[phi-plugin] API恢复后的 Bot状态同步失败', error)
        })
    }

    /** @returns {Promise<void>} 一分钟平台任务入口 */
    async scheduledTask() {
        if (!Config.getUserCfg('config', 'openPhiPluginApi') || isApiVersionBlocked()) return
        await this.sync().catch(error => {
            logger.warn('[phi-plugin] Bot状态同步失败', error)
        })
    }
}

export default new BotSyncService()
