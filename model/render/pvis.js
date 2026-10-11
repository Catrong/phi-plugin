import { DomHandler, DomUtils, Parser, parseDocument } from 'htmlparser2'
import { compile } from 'css-select'
import defaultStaticText from './staticText.js'

/** @typedef {ReturnType<typeof parseDocument> | ReturnType<typeof parseDocument>['children'][number]} HtmlNode */
/** @typedef {ReturnType<typeof DomUtils.findAll>[number]} HtmlElement */
/** @typedef {{method?: 'box' | 'pvis' | 'line', nowrap?: boolean, breakWords?: boolean, useFontMetrics?: boolean, lineHeight?: number}} PvisOptions */
/** @typedef {[number, number, number, number, (number | null)?, (PvisOptions | null)?]} PvisTuple */
/** @typedef {PvisTuple | false | Record<string, PvisTuple | false>} PvisConfig */
/** @typedef {{start: number, end: number, quote: string | null | undefined, value: string}} StyleAttribute */
/** @typedef {{end: number, style: StyleAttribute | null}} OpeningTag */

/** @param {unknown} value @returns {PvisTuple | false | undefined} */
function normalizeRule(value) {
    if (value === false) return false
    if (!Array.isArray(value) || value.length < 4) return undefined
    if (!value.slice(0, 4).every(number => typeof number === 'number' && Number.isFinite(number) && number > 0)) return undefined
    if (value[4] != null && !(typeof value[4] === 'number' && Number.isFinite(value[4]) && value[4] > 0)) return undefined
    if (value[5] != null && (typeof value[5] !== 'object' || Array.isArray(value[5]))) return undefined
    const rule = /** @type {PvisTuple} */ (value.slice(0, 6))
    if (rule[5]?.method && !['box', 'pvis', 'line'].includes(rule[5].method)) return undefined
    return rule
}

/**
 * 配置在每次调用内编译，避免渲染不同页面时互相覆盖规则。
 * @param {unknown} config
 */
function prepareRules(config) {
    let fallback = normalizeRule(config)
    /** @type {{matches: (node: HtmlNode) => boolean, value: PvisTuple | false}[]} */
    const rules = []
    if (config && typeof config === 'object' && !Array.isArray(config)) {
        fallback = normalizeRule(Reflect.get(config, 'default'))
        for (const [selector, value] of Object.entries(config)) {
            if (selector === 'default') continue
            const rule = normalizeRule(value)
            if (rule === undefined) continue
            try {
                rules.push({ matches: compile(selector, { cacheResults: false }), value: rule })
            } catch {
                // 无效的自定义选择器不影响其余有效规则和默认配置。
            }
        }
    }
    return { fallback, rules }
}

/**
 * 解析器负责实体解码。文本里的字面量 <、>、& 不再按 HTML 二次处理。
 * @param {HtmlNode} node
 * @returns {string}
 */
function visibleText(node) {
    if (node.type === 'text') return node.data
    if ('name' in node) {
        if (node.name === 'br') return '\n'
        if (node.name === 'script' || node.name === 'style') return ''
    }
    if (!('children' in node)) return ''
    const text = node.children.map(visibleText).join('')
    return 'name' in node && (node.name === 'p' || node.name === 'div') ? `${text}\n` : text
}

/** @param {HtmlElement} element */
function elementText(element) {
    // 根元素自己的闭标签不应额外产生一行，嵌套块和 br 则保留换行。
    return element.children.map(visibleText).join('')
}

/** @param {string} value */
function escapeAttribute(value) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/**
 * 只检查顶层 CSS 声明，避免 url()、字符串和注释中的分号被当成声明边界。
 * @param {string} style
 */
function hasImportantFontSize(style) {
    let quote = '', depth = 0, comment = false, start = 0
    for (let index = 0; index <= style.length; index++) {
        const char = style[index], next = style[index + 1]
        if (comment) {
            if (char === '*' && next === '/') { comment = false; index++ }
            continue
        }
        if (quote) {
            if (char === '\\') index++
            else if (char === quote) quote = ''
            continue
        }
        if (char === '/' && next === '*') { comment = true; index++; continue }
        if (char === '"' || char === "'") { quote = char; continue }
        if (char === '(') depth++
        else if (char === ')') depth = Math.max(0, depth - 1)
        if ((char === ';' && !depth) || index === style.length) {
            const declaration = style.slice(start, index).replace(/\/\*[\s\S]*?\*\//g, '')
            // font 简写也设置 font-size，其 important 优先级同样需要保留。
            if (/^\s*(?:font-size|font)\s*:[\s\S]*!\s*important\s*$/i.test(declaration)) return true
            start = index + 1
        }
    }
    return false
}

/**
 * @param {string} html @param {OpeningTag} opening @param {number} size
 * @returns {{start: number, end: number, value: string}}
 */
function fontSizePatch(html, opening, size) {
    const attribute = opening.style
    if (!attribute) {
        const insert = html[opening.end - 1] === '/' ? opening.end - 1 : opening.end
        return { start: insert, end: insert, value: ` style="font-size: ${size}px"` }
    }
    const important = hasImportantFontSize(attribute.value) ? ' !important' : ''
    const suffix = `${attribute.value.trim() && !attribute.value.trimEnd().endsWith(';') ? ';' : ''} font-size: ${size}px${important}`
    if (attribute.quote) {
        const equal = html.indexOf('=', attribute.start)
        const firstQuote = html.indexOf(attribute.quote, equal + 1)
        const lastQuote = html.indexOf(attribute.quote, firstQuote + 1)
        if (lastQuote >= 0 && lastQuote <= attribute.end) return { start: lastQuote, end: lastQuote, value: suffix }
    }
    // 无引号的 style 追加带空格的声明时必须加引号；保留标签中其他属性的原文。
    const end = attribute.quote === undefined ? attribute.start + 5 : attribute.end
    return { start: attribute.start, end, value: `style="${escapeAttribute(attribute.value)}${suffix}"` }
}

/**
 * 在 art 模板渲染完成后，为 name="pvis" 的元素补上字号。
 * 元素自身及其祖先都参与区域选择器匹配；后声明的匹配规则完整覆盖前一条。
 * 只修改开标签中的 style，正文、标签、脚本和其他 HTML 均保留原文。
 *
 * @param {string} html
 * @param {unknown} config
 * @param {{staticText?: Partial<typeof defaultStaticText>, themeInfo?: {fontUrl?: string | null} | null}} [options]
 * @returns {string}
 */
export function processPvisHtml(html, config, options = {}) {
    if (typeof html !== 'string' || !html) return html
    const { fallback, rules } = prepareRules(config)
    if ((fallback === undefined || fallback === false) && !rules.some(rule => rule.value !== false)) return html

    /** @type {Map<number, OpeningTag>} */
    const openings = new Map()
    /** @type {StyleAttribute | null} */
    let style = null
    const handler = new DomHandler(undefined, { withStartIndices: true, withEndIndices: true })
    const onOpen = handler.onopentag.bind(handler)
    handler.onopentag = (name, attributes) => {
        onOpen(name, attributes)
        if (attributes.name === 'pvis') openings.set(parser.startIndex, { end: parser.endIndex, style })
        style = null
    }
    const indexedHandler = Object.assign(handler, {
        /** @param {string} _name */
        onopentagname(_name) { style = null },
        /** @param {string} name @param {string} value @param {string | null | undefined} quote */
        onattribute(name, value, quote) {
            if (name === 'style' && !style) style = { start: parser.startIndex, end: parser.endIndex, value, quote }
        },
    })
    const parser = new Parser(indexedHandler, { decodeEntities: true })
    parser.end(html)
    const elements = DomUtils.findAll(element => element.attribs.name === 'pvis', handler.dom)
    if (!elements.length) return html
    const helper = {
        fitBox: options.staticText?.fitBox ?? defaultStaticText.fitBox,
        fitPvis: options.staticText?.fitPvis ?? defaultStaticText.fitPvis,
        fitLine: options.staticText?.fitLine ?? defaultStaticText.fitLine,
    }
    /** @type {{start: number, end: number, value: string}[]} */
    const patches = []
    for (const element of elements) {
        let rule = fallback
        for (const special of rules) {
            let candidate = /** @type {HtmlNode | null} */ (element)
            while (candidate && !special.matches(candidate)) candidate = candidate.parent
            if (candidate) rule = special.value
        }
        if (!rule || element.startIndex === null) continue
        const opening = openings.get(element.startIndex)
        if (!opening) continue
        const [width, height, maximum, minimum, lineHeight, extra] = rule
        const text = elementText(element)
        const { method = 'box', ...methodOptions } = extra ?? {}
        let size
        if (method === 'pvis') {
            size = helper.fitPvis(text, width, height, maximum, minimum, {
                useFontMetrics: !options.themeInfo?.fontUrl,
                ...methodOptions,
                ...(lineHeight != null ? { lineHeight } : {}),
                plainText: true,
            })
        } else if (method === 'line') {
            size = helper.fitLine(text, width, maximum, minimum, { plainText: true })
        } else {
            size = helper.fitBox(text, width, height, maximum, minimum, lineHeight ?? undefined, { plainText: true })
        }
        if (!(Number.isFinite(size) && size > 0)) continue
        patches.push(fontSizePatch(html, opening, size))
    }
    // 从后向前应用 offset 修改，不会让先前解析的 HTML 位置发生偏移。
    patches.sort((left, right) => right.start - left.start)
    for (const patch of patches) html = html.slice(0, patch.start) + patch.value + html.slice(patch.end)
    return html
}

export default processPvisHtml
