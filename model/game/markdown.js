import { Config, logger, segment } from '../../components/index.js'
import send from '../render/send.js'
import platform from '../../components/platform/index.js'
import { readImageDimensions, uploadQuickCommandImage } from './quickCommandImageHost.js'


/** @import {botEvent} from '../../components/baseClass.js' */

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
export function commandInput(text, show) {
    return `<qqbot-cmd-input text="${escapeCommandAttribute(text)}" show="${escapeCommandAttribute(show)}" reference="false" />`
}

/** @param {{command:string,label:string}[]} commands */
function normalizeQuickCommands(commands) {
    const unique = []
    const seen = new Set()
    for (const item of commands || []) {
        if (!item?.command || !item?.label) continue
        const command = String(item.command).trim()
        const label = Array.from(String(item.label).trim()).slice(0, 10).join('')
        if (!command || !label || seen.has(command)) continue
        seen.add(command)
        unique.push({ command, label })
    }
    return unique
}

/** @param {{title?:string,commands:{command:string,label:string}[]}[]} sections */
function normalizeQuickCommandSections(sections) {
    const seen = new Set()
    return (sections || []).map(section => {
        const commands = []
        for (const item of section?.commands || []) {
            if (!item?.command || !item?.label) continue
            const command = String(item.command).trim()
            const label = String(item.label).trim()
            if (!command || !label || seen.has(command)) continue
            seen.add(command)
            commands.push({ command, label })
        }
        return { title: String(section?.title || ''), commands }
    }).filter(section => section.commands.length)
}

/** @param {{command:string,label:string}[][]} rows */
function buildQuickCommandKeyboardRows(rows) {
    const normalizedRows = (rows || []).filter(row => row?.length).slice(0, 5)
    if (!normalizedRows.length) return undefined
    return {
        content: {
            rows: normalizedRows.map((row, rowIndex) => ({
                buttons: row.slice(0, 5).map((item, offset) => ({
                    id: `phi-quick-${rowIndex}-${offset}`,
                    render_data: { label: item.label, visited_label: item.label, style: 1 },
                    action: {
                        type: 1,
                        permission: { type: 2 },
                        data: item.command,
                        unsupport_tips: '当前 QQ 版本不支持指令按钮，请手动发送指令。',
                    },
                })),
            })),
        },
    }
}

/**
 * 构建 QQ 官方消息接口的指令键盘。
 * 回调型按钮点击后直接把命令交给 QQBot 事件处理链，不经过输入框。
 * @param {{command:string,label:string}[]} commands
 */
export function buildQuickCommandKeyboard(commands) {
    const unique = normalizeQuickCommands(commands)
    if (!unique.length) return undefined
    const rows = []
    for (let index = 0; index < unique.length && rows.length < 5; index += 3) rows.push(unique.slice(index, index + 3))
    return buildQuickCommandKeyboardRows(rows)
}

/** @param {{command:string,label:string}[][]} rows */
function buildQuickCommandButtonSegment(rows) {
    if (typeof segment.button !== 'function') return undefined
    const buttonRows = rows.slice(0, 5).map(row => row.slice(0, 5).map(item => ({
            text: item.label,
            callback: item.command,
        })))
    if (!buttonRows.length) return undefined
    try {
        return segment.button(...buttonRows)
    } catch {
        return undefined
    }
}

/** @param {{command:string,label:string}[]} commands @param {{title?:string,commands:{command:string,label:string}[]}[]} [sections] */
function quickCommandRows(commands, sections = undefined) {
    if (sections) return normalizeQuickCommandSections(sections).map(section => section.commands)
    const unique = normalizeQuickCommands(commands)
    const rows = []
    for (let index = 0; index < unique.length && rows.length < 5; index += 3) {
        rows.push(unique.slice(index, index + 3))
    }
    return rows
}

/** @param {botEvent} e @param {{command:string,label:string}[]} commands @param {string} [title] @param {{title?:string,commands:{command:string,label:string}[]}[]} [sections] */
function quickCommandMessage(e, commands, title = '快捷操作', sections = undefined) {
    const rows = quickCommandRows(commands, sections)
    const button = buildQuickCommandButtonSegment(rows)
    const keyboard = buildQuickCommandKeyboardRows(rows)
    // QQ 群聊消息要求有非空消息载体；空格不会显示，但可以承载按钮。
    const carrier = segment.markdown(' ')
    return {
        message: button ? [carrier, button] : carrier,
        data: button ? {} : keyboard ? { keyboard } : quickCommandReplyData(e, commands),
        title,
    }
}

/** @param {botEvent} e @param {{command:string,label:string}[]} commands */
function quickCommandReplyData(e, commands) {
    if (!isOfficialBot(e)) return {}
    const keyboard = buildQuickCommandKeyboard(commands)
    return keyboard ? { keyboard } : {}
}


/** @param {unknown} value */
function imageData(value) {
    if (!value || typeof value !== 'object') return undefined
    const item = /** @type {any} */ (value)
    if (item.__phiSegment && item.type === 'image') return item.data
    if (item.type === 'image') return item.data ?? item.file ?? item.url
    return undefined
}

/**
 * 将图片段转换为单个 Markdown 图片段，使支持图床的适配器可以把图片和键盘放在同一条消息中。
 * 优先使用宿主提供的 imageToUrl，再使用 phi-plugin 的图床脚本。
 * @param {botEvent} e
 * @param {*} message
 */
async function prepareMergedQuickCommandMessage(e, message) {
    const hostConverter = e?.bot?.imageToUrl || globalThis.Bot?.imageToUrl
    let hasImage = false
    let failed = false
    /** @param {unknown} data */
    const convert = async data => {
        if (typeof hostConverter === 'function') {
            try {
                const result = await hostConverter.call(e?.bot || globalThis.Bot, data)
                const value = typeof result === 'string' ? { url: result } : result
                if (value?.url && /^https?:\/\//i.test(value.url)) {
                    const dimensions = await readImageDimensions(data)
                    return { ...value, width: value.width || dimensions?.width, height: value.height || dimensions?.height }
                }
            } catch (error) {
                logger.warn('[phi-plugin] 宿主图片转公网地址失败，尝试配置图床脚本', error)
            }
        }
        return uploadQuickCommandImage(data)
    }
    /** @param {*} value @returns {Promise<*>} */
    const walk = async value => {
        const data = imageData(value)
        if (data === undefined) {
            if (Array.isArray(value)) return Promise.all(value.map(walk))
            return value
        }
        hasImage = true
        const source = typeof data === 'string' && /^https?:\/\//i.test(data)
            ? { url: data }
            : await convert(data)
        if (!source?.url) {
            failed = true
            return value
        }
        const width = Number(source.width) > 0 ? Number(source.width) : undefined
        const height = Number(source.height) > 0 ? Number(source.height) : undefined
        if (!width || !height) {
            failed = true
            logger.warn('[phi-plugin] 快捷指令合并图片缺少实际尺寸，已回退为分开发送')
            return value
        }
        return segment.markdown(`![快捷操作图片 #${width}px #${height}px](${source.url})`)
    }
    return { message: await walk(message), ready: !hasImage || !failed }
}

/**
 * 判断当前事件是否来自 QQ 官方机器人。
 * QQ 官方机器人使用 QQBot 适配器，只有它支持 qqbot-cmd-input 快捷输入标签。
 * @param {botEvent} e
 */
export function isOfficialBot(e) {
    const adapter = platform.getAdapterName(e)
    return typeof adapter === 'string' && /^(qqbot|qq[-_ ]?official[-_ ]?bot)$/i.test(adapter.trim())
}

/**
 * 构建通用的快捷操作菜单。
 * @param {{command:string,label:string}[]} commands
 * @param {string} [title]
 */
export function buildQuickCommandMarkdown(commands, title = '快捷操作') {
    const unique = []
    const seen = new Set()
    for (const item of commands || []) {
        if (!item?.command || !item?.label) continue
        const command = String(item.command).trim()
        const label = String(item.label).trim()
        if (!command || !label || seen.has(command)) continue
        seen.add(command)
        unique.push({ command, label })
    }
    if (!unique.length) return ''
    // QQ 官方 Markdown 的旧解析器按主题市场的三列表格处理，固定三列最稳定。
    const columns = 3
    const rows = []
    for (let index = 0; index < unique.length; index += columns) {
        const row = unique.slice(index, index + columns)
        while (row.length < columns) row.push({ command: '', label: '' })
        rows.push(`| ${row.map(item => item.command ? commandInput(item.command, item.label) : '\u200b').join(' | ')} |`)
    }
    const separator = `| ${Array.from({ length: columns }, () => ':---:').join(' | ')} |`
    return ['***', `${escapeMarkdownText(title)}：`, '', rows[0], separator, ...rows.slice(1)].join('\n')
}

/**
 * 向 QQ 官方机器人发送快捷操作菜单。
 * @param {botEvent} e
 * @param {{command:string,label:string}[]} commands
 * @param {string} [title]
 */
export async function sendQuickCommands(e, commands, title = '快捷操作') {
    if (!isOfficialBot(e) || !Config.getUserCfg('config', 'LetterMarkdown')) return
    const normalized = normalizeQuickCommands(commands)
    if (!normalized.length) return
    const quickMessage = quickCommandMessage(e, normalized, title)
    try {
        const sent = /** @type {{error?: unknown[]}|undefined} */ (await send.reply(e, quickMessage.message, false, quickMessage.data))
        if (sent?.error?.length) logger.warn('[phi-plugin] 快捷操作按钮发送失败')
    } catch (error) {
        logger.warn('[phi-plugin] 快捷操作按钮发送失败', error)
    }
}

/**
 * 发送带有“确认/取消”回调按钮的确认提示。
 * QQ 官方机器人点击后直接把“确认”或“取消”交给当前上下文；其他适配器保留文本回复流程。
 * @param {botEvent} e
 * @param {string} text
 */
export async function sendConfirmationPrompt(e, text) {
    if (!isOfficialBot(e) || !Config.getUserCfg('config', 'LetterMarkdown')) {
        return send.send_with_At(e, `${text}\n请回复“确认”或“取消”。`)
    }
    const button = buildQuickCommandButtonSegment([[
        { command: '确认', label: '确认' },
        { command: '取消', label: '取消' },
    ]])
    if (!button) return send.send_with_At(e, `${text}\n请回复“确认”或“取消”。`)
    return send.send_with_At(e, [segment.markdown(`${text}\n请点击下方按钮。`), button])
}

/**
 * 构建分组快捷操作菜单。每个分组独立渲染为一张标准 Markdown 表格。
 * @param {{title:string,commands:{command:string,label:string}[]}[]} sections
 * @param {string} [title]
 */
export function buildQuickCommandSectionsMarkdown(sections, title = '快捷操作') {
    const blocks = []
    for (const section of sections || []) {
        const sectionCommands = section?.commands || []
        const table = buildQuickCommandMarkdown(sectionCommands, section?.title || title)
        if (table) blocks.push(table)
    }
    return blocks.join('\n\n')
}

/**
 * 向 QQ 官方机器人发送分组快捷操作菜单。
 * @param {botEvent} e
 * @param {{title:string,commands:{command:string,label:string}[]}[]} sections
 * @param {string} [title]
 */
export async function sendQuickCommandSections(e, sections, title = '快捷操作') {
    if (!isOfficialBot(e) || !Config.getUserCfg('config', 'LetterMarkdown')) return
    const normalizedSections = normalizeQuickCommandSections(sections)
    const commands = normalizedSections.flatMap(section => section.commands)
    if (!normalizeQuickCommands(commands).length) return
    const quickMessage = quickCommandMessage(e, commands, title, normalizedSections)
    try {
        const sent = /** @type {{error?: unknown[]}|undefined} */ (await send.reply(e, quickMessage.message, false, quickMessage.data))
        if (sent?.error?.length) logger.warn('[phi-plugin] 快捷操作按钮发送失败')
    } catch (error) {
        logger.warn('[phi-plugin] 快捷操作按钮发送失败', error)
    }
}

/**
 * 发送主消息及其快捷按钮。合并模式把按钮附加在同一次发送中，
 * 由 QQ 适配器负责把图片转换为 Markdown 图片；适配器不支持时调用方可回退到分离模式。
 * @param {botEvent} e
 * @param {*} message
 * @param {{command:string,label:string}[]} commands
 * @param {string} [title]
 * @param {{quote?:boolean,sections?:{title?:string,commands:{command:string,label:string}[]}[]}} [options]
 */
export async function sendWithQuickCommands(e, message, commands, title = '快捷操作', options = {}) {
    if (!isOfficialBot(e) || !Config.getUserCfg('config', 'LetterMarkdown')) {
        return send.send_with_At(e, message, Boolean(options.quote))
    }
    const merge = Config.getUserCfg('config', 'QuickCommandMergeImage') === true
    const normalized = normalizeQuickCommands(commands)
    if (!normalized.length) {
        if (merge) {
            const prepared = await prepareMergedQuickCommandMessage(e, message)
            if (prepared.ready) return send.send_with_At(e, prepared.message, Boolean(options.quote))
        }
        return send.send_with_At(e, message, Boolean(options.quote))
    }

    if (merge) {
        const quickMessage = quickCommandMessage(e, normalized, title, options.sections)
        const prepared = await prepareMergedQuickCommandMessage(e, message)
        if (!prepared.ready) {
            logger.warn('[phi-plugin] 合并模式没有可用的公网图片地址，已回退为分开发送')
            await send.send_with_At(e, message, Boolean(options.quote))
            return options.sections ? sendQuickCommandSections(e, options.sections, title) : sendQuickCommands(e, normalized, title)
        }
        const mergedMessage = prepared.message
        const mergedTail = quickMessage.data?.keyboard
            ? []
            : (Array.isArray(quickMessage.message) ? quickMessage.message.slice(1) : [quickMessage.message])
        const payload = Array.isArray(mergedMessage)
            ? [...mergedMessage, ...mergedTail]
            : [mergedMessage, ...mergedTail]
        try {
            const sent = /** @type {{error?: unknown[]}|undefined} */ (await send.send_with_At(e, payload, Boolean(options.quote), quickMessage.data))
            if (sent?.error?.length) throw new Error('QQ 适配器拒绝合并消息')
            return sent
        } catch (error) {
            logger.warn('[phi-plugin] 快捷按钮与图片合并失败，已回退为分开发送', error)
        }
    }

    await send.send_with_At(e, message, Boolean(options.quote))
    return options.sections ? sendQuickCommandSections(e, options.sections, title) : sendQuickCommands(e, normalized, title)
}

/** @param {botEvent} e @param {*} message @param {{title?:string,commands:{command:string,label:string}[]}[]} sections @param {string} [title] @param {{quote?:boolean}} [options] */
export function sendWithQuickCommandSections(e, message, sections, title = '快捷操作', options = {}) {
    const commands = (sections || []).flatMap(section => section?.commands || [])
    return sendWithQuickCommands(e, message, commands, title, { ...options, sections })
}

/** @param {string} commandHead */
function normalizeCommandHead(commandHead) {
    return String(commandHead ?? '').replace(/^[/#]+/, '').trim()
}

/** @param {string} commandHead @param {string} command */
function pageCommand(commandHead, command) {
    const head = normalizeCommandHead(commandHead)
    return head && command ? `/${head} ${command}` : ''
}

/** @param {string} commandHead */
export function helpQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'p30'), label: 'P30成绩' },
        { command: pageCommand(commandHead, 'info'), label: '个人信息' },
        { command: pageCommand(commandHead, 'update'), label: '更新存档' },
        { command: pageCommand(commandHead, 'myset'), label: '用户设置' },
        { command: pageCommand(commandHead, 'market'), label: '主题市场' },
    ]
}

/** @param {string} commandHead */
export function userSettingQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'myset theme 0'), label: '主题风格' },
        { command: pageCommand(commandHead, 'myset avgkind 0'), label: 'B30统计数据展示' },
        { command: pageCommand(commandHead, 'myset avgcolor 0'), label: 'B30均值条配色' },
        { command: pageCommand(commandHead, 'myset api 0'), label: 'API功能开关' },
        { command: pageCommand(commandHead, 'myset B30分析 0'), label: 'B30统计分析' },
        { command: pageCommand(commandHead, 'market'), label: '主题市场' },
    ]
}

/** @param {string} commandHead */
export function userSettingQuickCommandSections(commandHead) {
    /** @param {string} setting @param {number|string} value */
    const command = (setting, value) => pageCommand(commandHead, `myset ${setting} ${value}`)
    return [
        {
            title: '主题风格',
            commands: [
                { command: command('theme', 0), label: '主题0' },
                { command: command('theme', 1), label: '主题1' },
                { command: command('theme', 2), label: '主题2' },
                { command: command('theme', 3), label: '主题3' },
            ],
        },
        {
            title: 'B30统计数据展示',
            commands: [
                { command: command('avgkind', 0), label: '统计全' },
                { command: command('avgkind', 1), label: '统计B' },
                { command: command('avgkind', 2), label: '统计T' },
                { command: command('avgkind', 3), label: '统计隐' },
            ],
        },
        {
            title: 'B30均值条配色',
            commands: [
                { command: command('avgcolor', 0), label: '配色红' },
                { command: command('avgcolor', 1), label: '配色金' },
                { command: command('avgcolor', 2), label: '配色蓝' },
                { command: command('avgcolor', 3), label: '配色绿' },
            ],
        },
        {
            title: 'API功能开关',
            commands: [
                { command: command('api', 0), label: 'API开' },
                { command: command('api', 1), label: 'API关' },
            ],
        },
        {
            title: 'B30统计分析',
            commands: [
                { command: command('B30分析', 0), label: '分析显' },
                { command: command('B30分析', 1), label: '分析隐' },
            ],
        },
    ]
}

/** @param {string} commandHead */
export function apiSettingQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'apiset'), label: '刷新设置' },
        { command: pageCommand(commandHead, 'tkls'), label: 'Token列表' },
        { command: pageCommand(commandHead, 'myset'), label: '用户设置' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** @param {string} commandHead */
export function apiHelpQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'bind qrcode'), label: '扫码绑定' },
        { command: pageCommand(commandHead, 'tkls'), label: 'Token列表' },
        { command: pageCommand(commandHead, 'apiset'), label: 'API设置' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'help'), label: '全部帮助' },
    ]
}

/** @param {string} commandHead */
export function configQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, '设置'), label: '全局设置' },
        { command: pageCommand(commandHead, 'myset'), label: '用户设置' },
        { command: pageCommand(commandHead, 'update'), label: '更新插件' },
        { command: pageCommand(commandHead, 'market'), label: '主题市场' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** @param {string} commandHead */
export function scoreQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'p30'), label: 'P30成绩' },
        { command: pageCommand(commandHead, 'info'), label: '个人信息' },
        { command: pageCommand(commandHead, 'update'), label: '更新存档' },
    ]
}

/** @param {string} commandHead */
export function updateQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'p30'), label: 'P30成绩' },
        { command: pageCommand(commandHead, 'info'), label: '个人信息' },
        { command: pageCommand(commandHead, 'list'), label: '成绩筛选' },
        { command: pageCommand(commandHead, 'myset'), label: '用户设置' },
    ]
}

/** @param {string} commandHead */
export function userListQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'list'), label: '全部成绩' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'info'), label: '个人信息' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** @param {string} commandHead */
export function historyQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, '2025history'), label: '年度总结' },
        { command: pageCommand(commandHead, 'hisb30'), label: 'B30历史' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'info'), label: '个人信息' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** @param {string} commandHead */
export function b19AnalysisQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'p30'), label: 'P30成绩' },
        { command: pageCommand(commandHead, 'lmtacc 90'), label: 'ACC限制' },
        { command: pageCommand(commandHead, 'suggest'), label: '推分建议' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** @param {string} commandHead */
export function singleScoreQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'list'), label: '成绩筛选' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'info'), label: '个人信息' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** @param {string} commandHead */
export function suggestQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'suggest'), label: '刷新建议' },
        { command: pageCommand(commandHead, 'list'), label: '成绩筛选' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** @param {string} commandHead */
export function chapterQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'chap ALL'), label: '全部章节' },
        { command: pageCommand(commandHead, 'chap help'), label: '章节帮助' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'list'), label: '成绩筛选' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** @param {string} commandHead */
export function achievementQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'achievement 1'), label: '查看低定数' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'list'), label: '成绩筛选' },
        { command: pageCommand(commandHead, 'chap ALL'), label: '章节成绩' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** @param {string} commandHead */
export function sessionQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'update'), label: '更新存档' },
        { command: pageCommand(commandHead, 'bind qrcode'), label: '扫码绑定' },
        { command: pageCommand(commandHead, 'sessionToken'), label: '查看Token' },
        { command: pageCommand(commandHead, 'unbind'), label: '解绑' },
        { command: pageCommand(commandHead, 'myset'), label: '用户设置' },
    ]
}

/** @param {string} commandHead */
export function rankQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'ranklist'), label: '排行榜' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'info'), label: '个人信息' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** 兼容旧调用方，默认使用帮助页菜单。 */
export const commonQuickCommands = helpQuickCommands

/**
 * @param {{slug:string,name:string,botDownloadAllowed:boolean|null}[]} themes
 * @param {{page?:number,pageCount?:number}} [pagination]
 */
export function buildMarketQuickMarkdown(themes, pagination = {}) {
    if (!themes.length) return ''
    const commandHead = `${Config.getUserCfg('config', 'cmdhead')}`
    const rows = themes.map(theme => [
        escapeMarkdownText(theme.name),
        commandInput(`/${commandHead} market detail ${theme.slug}`, '查看详情'),
        commandInput(`/${commandHead} market ${theme.slug}`, '使用主题'),
    ])
    const table = [
        `| 名称 | 查看详情 | 使用主题 |`,
        '| :---: | :---: | :---: |',
        ...rows.map(row => `| ${row.join(' | ')} |`),
    ]
    const page = pagination.page || 1
    const pageCount = pagination.pageCount || 1
    const navigation = pageCount > 1 ? [
        '',
        '***',
        `| ${page > 1 ? commandInput(`/${commandHead}pr`, '上一页') : '已是首页'} | ${page} / ${pageCount} 页 | ${page < pageCount ? commandInput(`/${commandHead}nx`, '下一页') : '已是末页'} |`,
        '| :---: | :---: | :---: |',
    ] : []
    return ['***', '本页主题快捷操作：', '', ...table, ...navigation].join('\n')
}

/** @param {{slug:string,name:string,botDownloadAllowed:boolean|null}[]} themes @param {{page?:number,pageCount?:number}} pagination */
function marketQuickCommands(themes, pagination = {}) {
    const commandHead = `${Config.getUserCfg('config', 'cmdhead')}`
    const commands = []
    for (const theme of themes || []) {
        commands.push(
            { command: `/${commandHead} market detail ${theme.slug}`, label: '查看详情' },
            { command: `/${commandHead} market ${theme.slug}`, label: '使用主题' },
        )
    }
    const page = pagination.page || 1
    const pageCount = pagination.pageCount || 1
    if (pageCount > 1) {
        if (page > 1) commands.push({ command: `/${commandHead}pr`, label: '上一页' })
        if (page < pageCount) commands.push({ command: `/${commandHead}nx`, label: '下一页' })
    }
    return commands
}


/**
 * @param {botEvent} e
 * @param {{slug:string,name:string,botDownloadAllowed:boolean|null}[]} themes
 * @param {{page?:number,pageCount?:number}} [pagination]
 * @param {*} [message]
 */
export async function sendMarketQuickCommands(e, themes, pagination = {}, message = undefined) {
    if (!isOfficialBot(e) || !Config.getUserCfg('config', 'LetterMarkdown')) return
    const commands = marketQuickCommands(themes, pagination)
    if (!normalizeQuickCommands(commands).length) return
    if (message !== undefined && Config.getUserCfg('config', 'QuickCommandMergeImage') === true) {
        return sendWithQuickCommands(e, message, commands, '本页主题快捷操作')
    }
    const quickMessage = quickCommandMessage(e, commands, '本页主题快捷操作')
    try {
        const sent = /** @type {{error?: unknown[]}|undefined} */ (await send.reply(e, quickMessage.message, false, quickMessage.data))
        if (sent?.error?.length) logger.warn('[phi-plugin][主题市场] 快捷按钮发送失败')
    } catch (error) {
        logger.warn('[phi-plugin][主题市场] 快捷按钮发送失败', error)
    }
}
