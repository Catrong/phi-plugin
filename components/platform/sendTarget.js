/**
 * 跨会话主动发送的目标规范化与调度。
 *
 * 平台适配器只负责把宿主能力包装成 `transport`，具体"群聊优先用哪个接口、
 * 私聊如何降级"的规则集中在这里，便于两端行为一致、也可单独测试。
 *
 * @typedef {object} PlatformChatTargetLike 会话目标
 * @property {'group' | 'private'} [scene] group=群聊/频道，private=私聊
 * @property {string} [botId] 机器人自身 ID
 * @property {string} [chatId] 群/频道 ID
 * @property {string} [groupId] 群 ID（Yunzai 习惯）
 * @property {string} [guildId] 频道 ID（Koishi/Discord 习惯）
 * @property {string} [userId] 私聊目标用户
 * @property {string} [platform] 平台名，用于日志与隔离
 *
 * @typedef {object} chatTransport 宿主能力包装
 * @property {(botId?: string) => any} [pickBot] 取机器人实例
 * @property {(bot: any, channelId: string, content: any) => any} [sendMessage] 用机器人向频道发送
 * @property {(bot: any, userId: string, content: any) => any} [sendPrivateMessage] 用机器人向用户私聊
 * @property {(groupId: string) => any} [pickGroup] 取群对象
 * @property {(groupId: string, content: any) => any} [sendGroupMsg] 直接向群发送
 * @property {(botId: string | undefined, userId: string, content: any) => any} [sendFriendMsg] 直接向好友发送
 * @property {(userId: string) => any} [pickFriend] 取好友对象
 */

/**
 * 归一化会话目标；缺少必要字段时返回 null。
 * @param {PlatformChatTargetLike | null | undefined} target
 * @returns {{scene: 'group' | 'private', platform: string, botId: string, chatId: string, guildId: string, userId: string} | null}
 */
export function normalizeChatTarget(target) {
    if (!target) return null
    const groupId = firstNonEmpty(target.chatId, target.groupId, target.guildId)
    const userId = firstNonEmpty(target.userId)
    const scene = target.scene === 'private'
        ? 'private'
        : target.scene === 'group'
            ? 'group'
            : (groupId ? 'group' : 'private')
    if (scene === 'group' && !groupId) return null
    if (scene === 'private' && !userId) return null
    return {
        scene,
        platform: firstNonEmpty(target.platform),
        botId: firstNonEmpty(target.botId),
        chatId: groupId,
        guildId: firstNonEmpty(target.guildId, groupId),
        userId,
    }
}

/**
 * 由平台事件生成会话目标（用于把匹配对局投递回发起会话）。
 * @param {any} e
 * @returns {{scene: 'group' | 'private', platform: string, botId: string, chatId: string, guildId: string, userId: string} | null}
 */
export function chatTargetFromEvent(e) {
    if (!e) return null
    const session = e.session || e.rawSession || {}
    const isGroup = Boolean(e.isGroup || e.group_id || e.groupId || (!e.isPrivate && session.guildId))
    if (isGroup) {
        return normalizeChatTarget({
            scene: 'group',
            platform: firstNonEmpty(e.platform, session.platform),
            botId: firstNonEmpty(e.self_id, e.selfId, session.selfId),
            chatId: firstNonEmpty(e.group_id, e.groupId, e.chatId, e.channelId, session.channelId, session.guildId),
            guildId: firstNonEmpty(e.guildId, session.guildId),
        })
    }
    return normalizeChatTarget({
        scene: 'private',
        platform: firstNonEmpty(e.platform, session.platform),
        botId: firstNonEmpty(e.self_id, e.selfId, session.selfId),
        userId: firstNonEmpty(e.user_id, e.userId, session.userId),
    })
}

/**
 * 会话唯一键，用于判断两名玩家是否在同一会话。
 * @param {PlatformChatTargetLike | null | undefined} target
 * @returns {string}
 */
export function chatTargetKey(target) {
    const normalized = normalizeChatTarget(target)
    if (!normalized) return ''
    return [
        normalized.platform,
        normalized.botId,
        normalized.scene,
        normalized.scene === 'group' ? normalized.chatId : normalized.userId,
    ].join(':')
}

/**
 * 按 scene 与可用能力投递消息；任何异常或缺失能力都返回 false，调用方负责回滚。
 * @param {chatTransport} transport
 * @param {PlatformChatTargetLike | null | undefined} target
 * @param {any} content
 * @returns {Promise<boolean>}
 */
export async function dispatchToChat(transport, target, content) {
    const normalized = normalizeChatTarget(target)
    if (!normalized || !transport) return false
    try {
        if (normalized.scene === 'group') {
            if (transport.pickBot && transport.sendMessage) {
                const bot = await transport.pickBot(normalized.botId)
                if (bot) {
                    const sent = await transport.sendMessage(bot, normalized.chatId, content)
                    if (sent !== false && sent !== undefined && sent !== null) return true
                }
            }
            if (transport.pickGroup) {
                const group = await transport.pickGroup(normalized.chatId)
                if (group?.sendMsg) {
                    const sent = await group.sendMsg(content)
                    if (sent !== false && sent !== undefined && sent !== null) return true
                }
            }
            if (transport.sendGroupMsg) {
                const sent = await transport.sendGroupMsg(normalized.chatId, content)
                if (sent !== false && sent !== undefined && sent !== null) return true
            }
            return false
        }

        if (transport.pickBot && transport.sendPrivateMessage) {
            const bot = await transport.pickBot(normalized.botId)
            if (bot) {
                const sent = await transport.sendPrivateMessage(bot, normalized.userId, content)
                if (sent !== false && sent !== undefined && sent !== null) return true
            }
        }
        if (transport.sendFriendMsg) {
            const sent = await transport.sendFriendMsg(normalized.botId || undefined, normalized.userId, content)
            if (sent !== false && sent !== undefined && sent !== null) return true
        }
        if (transport.pickFriend) {
            const friend = await transport.pickFriend(normalized.userId)
            if (friend?.sendMsg) {
                const sent = await friend.sendMsg(content)
                if (sent !== false && sent !== undefined && sent !== null) return true
            }
        }
        return false
    } catch {
        return false
    }
}

/**
 * 取第一个非空字符串。
 * @param {...any} values
 * @returns {string}
 */
function firstNonEmpty(...values) {
    for (const value of values) {
        if (value === undefined || value === null) continue
        const text = String(value).trim()
        if (text) return text
    }
    return ''
}
