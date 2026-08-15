import logger from '../../components/Logger.js'
import Version from '../../components/Version.js'
import Config from '../../components/Config.js'
import platform from '../../components/platform/index.js'
import makeRequest from './makeRequest.js'
import { isApiVersionBlocked } from './apiVersion.js'

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
            const renderPressure = this.reportRenderPressure
                ? (await import('../render/picmodle.js')).default.takeRenderPressureSnapshot()
                : undefined
            const response = await makeRequest.syncBot({
                pluginVersion: Version.ver,
                acknowledgedMessageIds,
                ...(renderPressure ? { renderPressure } : {}),
            })
            for (const id of acknowledgedMessageIds) this.pendingAcknowledgements.delete(id)
            this.reportRenderPressure = response?.reporting?.renderPressure === true

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
