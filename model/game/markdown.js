import { Config, logger, segment } from '../../components/index.js'
import send from '../render/send.js'


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
