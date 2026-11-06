import { Config, logger } from '../../components/index.js'
import {
    buildQuickCommandMarkdown,
    buildQuickCommandSectionsMarkdown,
    mdCmd,
    escapeMarkdownText,
    isOfficialBot,
    sendMessage,
} from '../render/message.js'
import { menus } from '../render/messages.js'

export {
    buildQuickCommandMarkdown,
    buildQuickCommandSectionsMarkdown,
    mdCmd as commandInput,
    escapeCommandAttribute,
    escapeMarkdownText,
    isOfficialBot,
} from '../render/message.js'


/** @import {botEvent} from '../../components/baseClass.js' */

/**
 * 向 QQ 官方机器人发送快捷操作菜单。
 * @param {botEvent} e
 * @param {{command:string,label:string}[][]} buttons
 */
export async function sendQuickCommands(e, buttons) {
    const markdown = buildQuickCommandMarkdown(buttons)
    if (!markdown) return
    try {
        const sent = /** @type {{error?: unknown[]}|undefined} */ (await sendMessage(e, { markdown, button: buttons }))
        if (sent?.error?.length) logger.warn('[phi-plugin] 快捷操作 Markdown 发送失败')
    } catch (error) {
        logger.warn('[phi-plugin] 快捷操作 Markdown 发送失败', error)
    }
}


/**
 * 生成主题市场的 Markdown 表格与翻页导航。
 * @param {{slug:string,name:string,botDownloadAllowed:boolean|null}[]} themes
 * @param {{page?:number,pageCount?:number}} [pagination]
 */
export function buildMarketQuickMarkdown(themes, pagination = {}) {
    if (!themes.length) return ''
    const commandHead = `${Config.getUserCfg('config', 'cmdhead')}`
    const rows = themes.map(theme => [
        escapeMarkdownText(theme.name),
        mdCmd(`/${commandHead} market detail ${theme.slug}`, '查看详情'),
        mdCmd(`/${commandHead} market ${theme.slug}`, '使用主题'),
    ])
    const table = [
        '| 名称 | 查看详情 | 使用主题 |',
        '| :---: | :---: | :---: |',
        ...rows.map(row => `| ${row.join(' | ')} |`),
    ]
    const page = pagination.page || 1
    const pageCount = pagination.pageCount || 1
    const navigation = pageCount > 1 ? [
        '',
        '***',
        `| ${page > 1 ? mdCmd(`/${commandHead}pr`, '上一页') : '已是首页'} | ${page} / ${pageCount} 页 | ${page < pageCount ? mdCmd(`/${commandHead}nx`, '下一页') : '已是末页'} |`,
        '| :---: | :---: | :---: |',
    ] : []
    return [...table, ...navigation].join('\n')
}


/**
 * 组合主题市场的 Markdown 发送片段：表格自带可点击指令链接，不再额外转成按钮键盘。
 * @param {{slug:string,name:string,botDownloadAllowed:boolean|null}[]} themes
 * @param {{page?:number,pageCount?:number}} [pagination]
 */
export function marketQuickMarkdownPart(themes, pagination = {}) {
    return { markdown: buildMarketQuickMarkdown(themes, pagination) }
}

/**
 * @param {botEvent} e
 * @param {{slug:string,name:string,botDownloadAllowed:boolean|null}[]} themes
 * @param {{page?:number,pageCount?:number}} [pagination]
 */
export async function sendMarketQuickCommands(e, themes, pagination = {}) {
    const markdown = buildMarketQuickMarkdown(themes, pagination)
    if (!markdown) return
    try {
        const sent = /** @type {{error?: unknown[]}|undefined} */ (await sendMessage(e, { markdown }, { requireOfficialBot: false }))
        if (sent?.error?.length) logger.warn('[phi-plugin][主题市场] Markdown 发送失败')
    } catch (error) {
        logger.warn('[phi-plugin][主题市场] Markdown 发送失败', error)
    }
}
