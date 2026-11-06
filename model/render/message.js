import Config from '../../components/Config.js'
import logger from '../../components/Logger.js'
import { segment } from '../../components/index.js'
import platform from '../../components/platform/index.js'
import send from './send.js'

/**
 * 消息元素默认组装顺序：图片 → 文本 → Markdown → 按钮。
 * 调用方可以通过 `sendMessage(e, parts, { order })` 覆盖，或通过
 * `sendMessage(e, parts, { compose })` 完全接管组装过程。
 * @type {MessageElementKind[]}
 */
export const DEFAULT_MESSAGE_ORDER = ['image', 'text', 'markdown', 'button']

/**
 * @typedef {'image' | 'text' | 'markdown' | 'button' | 'file' | 'forward'} MessageElementKind
 * @typedef {{
 *   image?: unknown | (() => unknown) | Promise<unknown>,
 *   text?: unknown | (() => unknown) | Promise<unknown>,
 *   title?: string,
 *   markdown?: string,
 *   button?: unknown | (() => unknown) | Promise<unknown>,
 * }} MessageParts
 * @typedef {{
 *   at?: boolean,
 *   quote?: boolean,
 *   recallMsg?: number,
 *   data?: Record<string, unknown>,
 *   order?: MessageElementKind[],
 *   requireOfficialBot?: boolean,
 *   compose?: (parts: Record<string, unknown>, order: MessageElementKind[], context: { e: any, parts: MessageParts, order: MessageElementKind[] }) => unknown[],
 * }} SendMessageOptions
 */

/**
 * 判断当前事件是否来自 QQ 官方机器人。
 * QQ 官方机器人使用 QQBot 适配器，支持指令链接和 Markdown。
 * @param {any} e
 */
export function isOfficialBot(e) {
    const adapter = platform.getAdapterName(e)
    return typeof adapter === 'string' && /^(qqbot|qq[-_ ]?official[-_ ]?bot)$/i.test(adapter.trim())
}

/**
 * 判断是否为 QQ 频道的私聊会话：用户 ID 带 qg_ 前缀且不是群聊。
 * 频道私聊接口只收基础消息，Markdown 与按钮都不生效。
 * @param {any} e
 */
export function isGuildDirect(e) {
    if (!e || e.isGroup) return false
    return String(e.user_id ?? e.userId ?? '').startsWith('qg_')
}

/** @param {unknown} value */
export function escapeMarkdownText(value) {
    return String(value ?? '')
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\\/g, '\\\\')
        .replace(/([|*_`~])/g, '\\$1')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

/** @param {unknown} value */
export function escapeCommandAttribute(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

/** @param {string} text @param {string} show */
export function mdCmd(text, show) {
    const label = escapeMarkdownText(show).replace(/([\[\]])/g, '\\$1')
    const command = encodeURIComponent(text).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    return `[${label}](mqqapi://aio/inlinecmd?command=${command}&enter=false&reply=false)`
}

/** 
 * @param {string} command 省略命令头的指令文本
 * @param {string} label
 * @param {buttonStyle} [style] 按钮样式:1-蓝框蓝字,2-灰框黑字,3-灰框红字,4-蓝底白字,其他均为灰框黑字
 * @returns {buttonCommandObject}
 */
export function butCmd(command, label, style) {
    const head = Config.getUserCfg('config', 'cmdhead')
    return { command: (head && command) ? `/${head} ${command}` : `/${command}`, label, style }
}

/**
 * 当前快捷操作发送方式。
 * 兼容旧布尔配置：true -> markdown，false -> off。
 * 频道私聊不支持 Markdown 与按钮，一律按 off 处理。
 * @param {any} [e]
 * @returns {'off' | 'markdown' | 'button'}
 */
export function getShortcutMode(e) {
    if (isGuildDirect(e)) return 'off'
    const value = Config.getUserCfg('config', 'LetterMarkdown')
    if (value === false || value === 'off') return 'off'
    if (value === 'button') return 'button'
    return 'markdown'
}

/**
 * 统一按钮定义，兼容 `{ button }` 与旧 `{ command, label }` 结构。
 * @param {any[]} row
 */
function normalizeButtonRow(row) {
    const result = []
    for (const item of row || []) {
        const button = item?.button || item
        if (!button?.command || !button?.label) continue
        const command = String(button.command).trim()
        const label = String(button.label).trim()
        const style = button.style
        if (!command || !label) continue
        result.push(style === undefined ? { command, label } : { command, label, style })
    }
    return result
}

/**
 * 规范化二维按钮列表：第一维代表行，第二维代表列。
 * 兼容旧的一维列表，按单行处理。
 * @param {any[]} rows
 */
function normalizeButtonRows(rows) {
    const inputRows = Array.isArray(rows) && Array.isArray(rows[0]) ? rows : [rows]
    const seen = new Set()
    const result = []
    for (const row of inputRows) {
        const normalized = []
        for (const button of normalizeButtonRow(row)) {
            if (seen.has(button.command)) continue
            seen.add(button.command)
            normalized.push(button)
        }
        if (normalized.length) result.push(normalized)
    }
    return result
}

/**
 * 构建通用的快捷操作菜单。
 * @param {any[]} rows 二维按钮列表
 */
export function buildQuickCommandMarkdown(rows) {
    const normalizedRows = normalizeButtonRows(rows)
    if (!normalizedRows.length) return ''
    // QQ 官方 Markdown 的旧解析器按主题市场的三列表格处理，固定三列最稳定。
    const columns = 3
    const tableRows = []
    for (const inputRow of normalizedRows) {
        for (let index = 0; index < inputRow.length; index += columns) {
            const row = inputRow.slice(index, index + columns)
            while (row.length < columns) row.push({ command: '', label: '' })
            tableRows.push(`| ${row.map(item => item.command ? mdCmd(item.command, item.label) : '\u200b').join(' | ')} |`)
        }
    }
    if (!tableRows.length) return ''
    const separator = `| ${Array.from({ length: columns }, () => ':---:').join(' | ')} |`
    return [tableRows[0], separator, ...tableRows.slice(1)].join('\n')
}

/** @param {any[]} sections */
export function buildQuickCommandSectionsMarkdown(sections) {
    const blocks = []
    for (const section of sections || []) {
        const sectionButtons = section?.buttons || section?.commands || []
        const table = buildQuickCommandMarkdown(sectionButtons)
        if (table) blocks.push(table)
    }
    return blocks.join('\n\n')
}

/**
 * 构建 QQ 官方消息接口的指令键盘。
 * @param {any[]} rows 二维按钮列表
 */
export function buildQuickCommandKeyboard(rows) {
    const normalizedRows = normalizeButtonRows(rows)
    if (!normalizedRows.length) return undefined
    const keyboardRows = []
    let index = 0
    for (const inputRow of normalizedRows) {
        for (let offset = 0; offset < inputRow.length && keyboardRows.length < 5; offset += 3) {
            const row = inputRow.slice(offset, offset + 3)
            keyboardRows.push({
                buttons: row.map(item => ({
                    id: `phi-quick-${index++}`,
                    render_data: { label: Array.from(item.label).slice(0, 10).join(''), style: item.style ?? 1 },
                    action: {
                        type: 2,
                        permission: { type: 2 },
                        data: item.command,
                        enter: false,
                        unsupport_tips: '当前 QQ 版本不支持指令按钮，请手动发送指令。',
                    },
                })),
            })
        }
    }
    return keyboardRows.length ? { content: { rows: keyboardRows } } : undefined
}

/**
 * 构建 Yunzai `segment.button` 按钮行。
 * 每个输入行的列数超过 3 时自动换行，行与行之间不会接续排列。
 * @param {any[]} rows 二维按钮列表
 */
export function buildQuickCommandButtons(rows) {
    const normalizedRows = normalizeButtonRows(rows)
    if (!normalizedRows.length) return undefined
    const buttonRows = []
    for (const inputRow of normalizedRows) {
        for (let offset = 0; offset < inputRow.length && buttonRows.length < 5; offset += 3) {
            buttonRows.push(inputRow.slice(offset, offset + 3).map(item => ({
                text: Array.from(item.label).slice(0, 10).join(''),
                input: item.command,
                send: false,
                reply: false,
            })))
        }
    }
    return buttonRows.length ? segment.button(...buttonRows) : undefined
}

/** @param {any} e @param {any[]} buttons */
export function quickCommandReplyData(e, buttons) {
    if (!isOfficialBot(e)) return {}
    const keyboard = buildQuickCommandKeyboard(buttons)
    return keyboard ? { keyboard } : {}
}

/** @param {unknown} value */
function isEmpty(value) {
    return value === undefined || value === null || value === false || value === ''
}

/**
 * 解析延迟提供的元素（函数或 Promise）。
 * @param {unknown} value
 */
async function resolvePart(value) {
    return typeof value === 'function' ? await value() : await value
}

/**
 * 按顺序把图片、文本、Markdown 等元素组装成一条消息数组。
 * 这是默认组装器，可通过 `sendMessage` 的 `compose` 选项替换。
 * @param {Record<string, unknown>} parts
 * @param {MessageElementKind[]} [order]
 * @param {{ e?: any, parts?: MessageParts }} [context]
 * @returns {unknown[]}
 */
export function composeMessage(parts, order = DEFAULT_MESSAGE_ORDER, context = {}) {
    /** @type {unknown[]} */
    const message = []
    let previousKind = ''
    for (const kind of order) {
        const value = parts?.[kind]
        if (isEmpty(value)) continue
        const items = (Array.isArray(value) ? value : [value]).filter(item => !isEmpty(item))
        if (!items.length) continue
        if (message.length && previousKind !== kind) {
            const last = message.length - 1
            if (!hasBoundaryNewline(message[last], false) && !hasBoundaryNewline(items[0], true)) {
                if (kind === 'text' || kind === 'markdown') {
                    const padded = addBoundaryNewline(items[0], true)
                    if (padded !== undefined) items[0] = padded
                    else message.push('\n')
                } else {
                    const padded = addBoundaryNewline(message[last], false)
                    if (padded !== undefined) message[last] = padded
                    else message.push('\n')
                }
            }
        }
        message.push(...items)
        previousKind = kind
    }
    return message
}

/** @param {unknown} value @returns {string | undefined} */
function boundaryText(value) {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
        if ('text' in value && typeof value.text === 'string') return value.text
        if ('content' in value && typeof value.content === 'string') return value.content
    }
}

/** @param {unknown} value @param {boolean} start */
function hasBoundaryNewline(value, start) {
    const text = boundaryText(value)
    return text !== undefined && (start ? text.startsWith('\n') : text.endsWith('\n'))
}

/** @param {unknown} value @param {boolean} start @returns {unknown} */
function addBoundaryNewline(value, start) {
    const text = boundaryText(value)
    if (text === undefined) return undefined
    const padded = hasBoundaryNewline(value, start) ? text : start ? `\n${text}` : `${text}\n`
    if (typeof value === 'string') return padded
    if (value && typeof value === 'object') {
        return 'text' in value ? { ...value, text: padded } : { ...value, content: padded }
    }
}

/**
 * 统一发送出口：同一处调用的图片、普通消息、Markdown 消息按默认顺序组装。
 *
 * - `image`：图片元素（渲染结果、segment 或返回它们的函数/Promise）。
 * - `text`：普通文本（或 segment 数组）。
 * - `markdown`：Markdown 纯文本（字符串）。仅在 QQ 官方机器人
 *   且开启 `LetterMarkdown` 时发送，保留原有降级行为。
 *
 * 当系统设置 `MergeImageWithText` 关闭（默认）且同时存在图片和 Markdown/按钮消息时，
 * 先单独发送图片，再发送文本与 Markdown/按钮；图片与纯文本仍合并成一条。
 *
 * @param {any} e 事件对象
 * @param {MessageParts} parts 发送内容
 * @param {SendMessageOptions} [options] 发送选项
 * @returns {Promise<any> | any}
 */
export function sendMessage(e, parts = {}, options = {}) {
    const isAsyncPart = (/** @type {unknown} */ value) =>
        typeof value === 'function' || Boolean(value && typeof (/** @type {any} */ (value).then) === 'function')
    if (isAsyncPart(parts.image) || isAsyncPart(parts.text) || isAsyncPart(parts.markdown) || isAsyncPart(parts.button)) {
        return (async () => {
            /** @type {MessageParts} */
            const resolvedParts = { ...parts }
            if ('image' in parts) resolvedParts.image = await resolvePart(parts.image)
            if ('text' in parts) resolvedParts.text = await resolvePart(parts.text)
            if (parts.markdown) resolvedParts.markdown = await resolvePart(parts.markdown)
            if (parts.button) resolvedParts.button = await resolvePart(parts.button)
            return dispatchMessage(e, resolvedParts, options)
        })()
    }
    return dispatchMessage(e, parts, options)
}

/**
 * @param {any} e
 * @param {MessageParts} parts
 * @param {SendMessageOptions} [options]
 * @returns {any}
 */
function dispatchMessage(e, parts, options = {}) {
    const {
        recallMsg,
        data = {},
        order = DEFAULT_MESSAGE_ORDER,
        requireOfficialBot = true,
        compose = composeMessage,
    } = options
    let at = options.at ?? false
    let quote = options.quote ?? false

    /** @type {Record<string, unknown>} */
    const resolved = {}
    if ('image' in parts) resolved.image = parts.image
    if ('text' in parts) resolved.text = parts.text

    /** @type {Record<string, unknown>} */
    let markdownData = {}
    const markdown = typeof parts.markdown === 'string' ? parts.markdown : ''
    const buttons = Array.isArray(parts.button) ? parts.button : undefined
    if (markdown || buttons) {
        const mode = getShortcutMode(e)
        let text = markdown
        if (!text && buttons) text = buildQuickCommandMarkdown(buttons)
        // Markdown 正文前留空行，配合开头的 @ 用户
        const body = `\n\n${text}`
        const canSend = mode !== 'off' && (!requireOfficialBot || isOfficialBot(e))
        if (canSend) {
            if (mode === 'button') {
                const canUseButton = typeof platform.hasButtonSegment === 'function' ? platform.hasButtonSegment() : true
                const button = canUseButton ? buildQuickCommandButtons(buttons || []) : undefined
                if (button) {
                    resolved.button = button
                } else if (text) {
                    // 按钮消息不可用时，自动降级为 Markdown 列表。
                    if (isOfficialBot(e) || !requireOfficialBot) resolved.markdown = segment.markdown(body)
                    else resolved.text = resolved.text ? [resolved.text, text] : text
                }
            } else if (text) {
                resolved.markdown = segment.markdown(body)
                if (buttons) {
                    markdownData = { ...markdownData, ...quickCommandReplyData(e, buttons) }
                }
            }
        }
    }

    // Markdown/按钮消息不走引用，改为开头 @ 用户
    if (resolved.markdown || resolved.button) {
        at = true
        quote = false
    }

    if (compose === composeMessage && markdownData.keyboard && resolved.markdown) {
        resolved.markdown = addBoundaryNewline(resolved.markdown, false) ?? resolved.markdown
    }
    const message = compose(resolved, order, { e, parts, order })
    if (!message.length) return undefined

    const replyData = { ...markdownData, ...data }
    if (recallMsg !== undefined) replyData.recallMsg = recallMsg
    const sendPayload = (/** @type {unknown} */ payload, /** @type {Record<string, unknown>} */ payloadData) => at
        ? send.send_with_At(e, payload, quote, payloadData)
        : send.reply(e, payload, quote, payloadData)

    /**
     * 默认设置下，图片与文本/Markdown/按钮消息分开：
     * 先单独发送图片，再发送文本与 Markdown/按钮；图片与纯文本仍合并为一条。
     * 自定义 compose 时由调用方完全接管组装，不再拆分。
     */
    const mergeImageWithText = Boolean(Config.getUserCfg('config', 'MergeImageWithText'))
    const shouldSplitImage = compose === composeMessage
        && !mergeImageWithText
        && !isEmpty(resolved.image)
        && (!isEmpty(resolved.markdown) || !isEmpty(resolved.button) || Boolean(markdownData.keyboard))

    if (shouldSplitImage) {
        return (async () => {
            /** @type {Record<string, unknown>} */
            const imageData = { ...data }
            if (recallMsg !== undefined) imageData.recallMsg = recallMsg
            try {
                // 图片作为先行内容单独发送，不重复 @ 或引用；文本与 Markdown/按钮随后回复用户。
                await send.reply(e, resolved.image, false, imageData)
            } catch (error) {
                logger.warn('[phi-plugin] 图片消息发送失败，继续发送文本消息', error)
            }
            const rest = compose({ text: resolved.text, markdown: resolved.markdown, button: resolved.button }, order, { e, parts, order })
            if (!rest.length) return undefined
            const restPayload = rest.length === 1 ? rest[0] : rest
            return sendPayload(restPayload, replyData)
        })()
    }

    // 只有一个元素时保持原有的单条消息形态，避免平台层或调用方拿到多余数组。
    const payload = message.length === 1 ? message[0] : message
    return sendPayload(payload, replyData)
}

export default sendMessage
