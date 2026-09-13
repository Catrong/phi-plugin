import { Config, logger, segment } from '../../components/index.js'
import send from '../render/send.js'
import platform from '../../components/platform/index.js'


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
 * @param {{showHeaders?: boolean, headers?: string[], columns?: number}} [options]
 */
export function buildQuickCommandMarkdown(commands, title = '快捷操作', options = {}) {
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
    const defaultColumns = unique.length <= 5 ? unique.length : 3
    const columns = Math.max(1, Math.min(8, Math.floor(options.columns || defaultColumns)))
    const rows = []
    for (let index = 0; index < unique.length; index += columns) {
        const row = unique.slice(index, index + columns)
        while (row.length < columns) row.push({ command: '', label: '' })
        rows.push(`| ${row.map(item => item.command ? commandInput(item.command, item.label) : '').join(' | ')} |`)
    }
    const headerValues = options.headers?.length === columns
        ? options.headers
        : Array.from({ length: columns }, (_, index) => String(index + 1))
    const headers = options.showHeaders === true
        ? [`| ${Array.from({ length: columns }, () => '操作').join(' | ')} |`, `| ${Array.from({ length: columns }, () => ':---:').join(' | ')} |`]
        : [`| ${headerValues.map(value => escapeMarkdownText(value)).join(' | ')} |`, `| ${Array.from({ length: columns }, () => ':---:').join(' | ')} |`]
    return ['***', `${escapeMarkdownText(title)}：`, '', ...headers, ...rows].join('\n')
}

/**
 * 向 QQ 官方机器人发送快捷操作菜单。
 * @param {botEvent} e
 * @param {{command:string,label:string}[]} commands
 * @param {string} [title]
 */
export async function sendQuickCommands(e, commands, title = '快捷操作') {
    if (!isOfficialBot(e) || !Config.getUserCfg('config', 'LetterMarkdown')) return
    const markdown = buildQuickCommandMarkdown(commands, title)
    if (!markdown) return
    try {
        const sent = /** @type {{error?: unknown[]}|undefined} */ (await send.reply(e, segment.markdown(markdown)))
        if (sent?.error?.length) logger.warn('[phi-plugin] 快捷操作 Markdown 发送失败')
    } catch (error) {
        logger.warn('[phi-plugin] 快捷操作 Markdown 发送失败', error)
    }
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
        const columns = sectionCommands.length >= 4 ? 4 : Math.max(1, sectionCommands.length)
        const table = buildQuickCommandMarkdown(sectionCommands, section?.title || title, {
            showHeaders: false,
            columns,
            headers: Array.from({ length: columns }, (_, index) => String(index)),
        })
        if (table) blocks.push(table)
    }
    return blocks.join('\n\n')
}

/** 向 QQ 官方机器人发送分组快捷操作菜单。 */
export async function sendQuickCommandSections(e, sections, title = '快捷操作') {
    if (!isOfficialBot(e) || !Config.getUserCfg('config', 'LetterMarkdown')) return
    for (const section of sections || []) {
        const sectionCommands = section?.commands || []
        const columns = sectionCommands.length >= 4 ? 4 : Math.max(1, sectionCommands.length)
        const markdown = buildQuickCommandMarkdown(sectionCommands, section?.title || title, {
            showHeaders: false,
            columns,
            headers: Array.from({ length: columns }, (_, index) => String(index)),
        })
        if (!markdown) continue
        try {
            const sent = /** @type {{error?: unknown[]}|undefined} */ (await send.reply(e, segment.markdown(markdown)))
            if (sent?.error?.length) logger.warn('[phi-plugin] 快捷操作 Markdown 发送失败')
        } catch (error) {
            logger.warn('[phi-plugin] 快捷操作 Markdown 发送失败', error)
        }
    }
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

/** 帮助页：按功能类别提供最常用的入口。 */
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

/** 用户设置页：快捷入口必须能直接执行对应设置。 */
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

/** 用户设置页：每个设置区域单独展示该区域的全部选项。 */
export function userSettingQuickCommandSections(commandHead) {
    const command = (setting, value) => pageCommand(commandHead, `myset ${setting} ${value}`)
    return [
        {
            title: '主题风格',
            commands: [
                { command: command('theme', 0), label: '[0]默认' },
                { command: command('theme', 1), label: '[1]寒冬' },
                { command: command('theme', 2), label: '[2]使一颗心免于哀伤' },
                { command: command('theme', 3), label: '[3]大师赛2' },
            ],
        },
        {
            title: 'B30统计数据展示',
            commands: [
                { command: command('avgkind', 0), label: '[0]全部统计' },
                { command: command('avgkind', 1), label: '[1]仅B30' },
                { command: command('avgkind', 2), label: '[2]仅Top' },
                { command: command('avgkind', 3), label: '[3]隐藏' },
            ],
        },
        {
            title: 'B30均值条配色',
            commands: [
                { command: command('avgcolor', 0), label: '[0]红' },
                { command: command('avgcolor', 1), label: '[1]金' },
                { command: command('avgcolor', 2), label: '[2]蓝' },
                { command: command('avgcolor', 3), label: '[3]绿' },
            ],
        },
        {
            title: 'API功能开关',
            commands: [
                { command: command('api', 0), label: '[0]启用' },
                { command: command('api', 1), label: '[1]禁用' },
            ],
        },
        {
            title: 'B30统计分析',
            commands: [
                { command: command('B30分析', 0), label: '[0]显示' },
                { command: command('B30分析', 1), label: '[1]隐藏' },
            ],
        },
    ]
}

/** API 用户设置页。 */
export function apiSettingQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'apiset'), label: '刷新设置' },
        { command: pageCommand(commandHead, 'tkls'), label: 'Token列表' },
        { command: pageCommand(commandHead, 'myset'), label: '用户设置' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** API 帮助页。 */
export function apiHelpQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'bind qrcode'), label: '扫码绑定' },
        { command: pageCommand(commandHead, 'tkls'), label: 'Token列表' },
        { command: pageCommand(commandHead, 'apiset'), label: 'API设置' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'help'), label: '全部帮助' },
    ]
}

/** Bot 全局设置页。 */
export function configQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, '设置'), label: '全局设置' },
        { command: pageCommand(commandHead, 'myset'), label: '用户设置' },
        { command: pageCommand(commandHead, 'update'), label: '更新插件' },
        { command: pageCommand(commandHead, 'market'), label: '主题市场' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** 成绩页通用入口，使用 B27 作为默认成绩概览。 */
export function scoreQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'p30'), label: 'P30成绩' },
        { command: pageCommand(commandHead, 'info'), label: '个人信息' },
        { command: pageCommand(commandHead, 'update'), label: '更新存档' },
    ]
}

/** 更新存档结果页。 */
export function updateQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'p30'), label: 'P30成绩' },
        { command: pageCommand(commandHead, 'info'), label: '个人信息' },
        { command: pageCommand(commandHead, 'list'), label: '成绩筛选' },
        { command: pageCommand(commandHead, 'myset'), label: '用户设置' },
    ]
}

/** 成绩筛选页。 */
export function userListQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'list'), label: '全部成绩' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'info'), label: '个人信息' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** 存档历史页。 */
export function historyQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, '2025history'), label: '年度总结' },
        { command: pageCommand(commandHead, 'hisb30'), label: 'B30历史' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'info'), label: '个人信息' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** B19 衍生分析页。 */
export function b19AnalysisQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'p30'), label: 'P30成绩' },
        { command: pageCommand(commandHead, 'lmtacc 90'), label: 'ACC限制' },
        { command: pageCommand(commandHead, 'suggest'), label: '推分建议' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** 单曲成绩页。 */
export function singleScoreQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'list'), label: '成绩筛选' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'info'), label: '个人信息' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** 推分建议页。 */
export function suggestQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'suggest'), label: '刷新建议' },
        { command: pageCommand(commandHead, 'list'), label: '成绩筛选' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** 章节成绩页。 */
export function chapterQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'chap ALL'), label: '全部章节' },
        { command: pageCommand(commandHead, 'chap help'), label: '章节帮助' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'list'), label: '成绩筛选' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** 定数成就页。 */
export function achievementQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'achievement 1'), label: '查看低定数' },
        { command: pageCommand(commandHead, 'b27'), label: 'B27成绩' },
        { command: pageCommand(commandHead, 'list'), label: '成绩筛选' },
        { command: pageCommand(commandHead, 'chap ALL'), label: '章节成绩' },
        { command: pageCommand(commandHead, 'help'), label: '帮助' },
    ]
}

/** 绑定/更新页。 */
export function sessionQuickCommands(commandHead) {
    return [
        { command: pageCommand(commandHead, 'update'), label: '更新存档' },
        { command: pageCommand(commandHead, 'bind qrcode'), label: '扫码绑定' },
        { command: pageCommand(commandHead, 'sessionToken'), label: '查看Token' },
        { command: pageCommand(commandHead, 'unbind'), label: '解绑' },
        { command: pageCommand(commandHead, 'myset'), label: '用户设置' },
    ]
}

/** 排行榜页。 */
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


/**
 * @param {botEvent} e
 * @param {{slug:string,name:string,botDownloadAllowed:boolean|null}[]} themes
 * @param {{page?:number,pageCount?:number}} [pagination]
 */
export async function sendMarketQuickCommands(e, themes, pagination = {}) {
    // 旧版测试及无平台上下文的调用仍允许生成 Markdown；真实事件只对 QQ 官方机器人发送。
    if ((e?.bot || e?.platform) && !isOfficialBot(e)) return
    if (!Config.getUserCfg('config', 'LetterMarkdown')) return
    const markdown = buildMarketQuickMarkdown(themes, pagination)
    if (!markdown) return
    try {
        const sent = /** @type {{error?: unknown[]}|undefined} */ (await send.reply(e, segment.markdown(markdown)))
        if (sent?.error?.length) logger.warn('[phi-plugin][主题市场] Markdown 发送失败')
    } catch (error) {
        logger.warn('[phi-plugin][主题市场] Markdown 发送失败', error)
    }
}
