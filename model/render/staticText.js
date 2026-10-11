import { measureText, measureLineHeight } from './fontMetrics.js'

/**
 * Shotium 没有页面脚本，固定标题栏不能依赖 DOM 测量缩字号。
 * fitPvis 读取自带字体度量；fitLine/fitBox 保留保守估算，供旧模块及自定义
 * 字体兜底。固定标题仍遵守可读字号下限，不把很长的标题缩成细线。
 */
/** @param {unknown} value */
function textUnits(value) {
    const text = String(value ?? '').replace(/<[^>]*>/g, '').replace(/&(?:nbsp|#160);/gi, ' ')
    let units = 0
    for (const char of text) {
        if (/\p{Mark}|[\u200d\ufe0e\ufe0f]/u.test(char)) continue
        if (/\s/u.test(char)) units += 0.36
        else if (/[ilI1.,'`:;!|]/.test(char)) units += 0.36
        else if (/[MWmw@%&]/.test(char)) units += 0.9
        else if (/[A-Z0-9]/.test(char)) units += 0.72
        else if (/[\x00-\x7f]/.test(char)) units += 0.6
        else units += 1.05
    }
    return units
}

/**
 * @param {unknown} text
 * @param {number} width 标题栏的保守可用宽度（CSS px），留出边缘余量。
 * @param {number} maximum 原始字号。
 * @param {number} minimum 保持清晰的最小字号；超长文本交给 CSS 省略。
 */
function fitLine(text, width, maximum, minimum) {
    const max = Number.isFinite(maximum) && maximum > 0 ? maximum : 15
    const min = Number.isFinite(minimum) && minimum > 0 ? Math.min(minimum, max) : max
    const available = Number.isFinite(width) && width > 0 ? width : 0
    const units = textUnits(text)
    if (!units) return max
    return Math.max(min, Math.floor(Math.min(max, available / units) * 10) / 10)
}

/**
 * 按显式换行与自动折行估算多行盒子的字号。到达最小字号后由页面扩展高度，
 * 不能用省略号或裁切补救；字体测量仍以真实渲染验证为准。
 * @param {unknown} text @param {number} width @param {number} height
 * @param {number} maximum @param {number} minimum @param {number} [lineHeight]
 */
function fitBox(text, width, height, maximum, minimum, lineHeight = 1.2) {
    const max = Number.isFinite(maximum) && maximum > 0 ? maximum : 16
    const min = Number.isFinite(minimum) && minimum > 0 ? Math.min(minimum, max) : max
    if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) return min
    const leading = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 1.2
    const paragraphs = String(text ?? '').replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<\/(?:p|div)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\r\n?/g, '\n').split('\n')
    /** @param {number} size */
    const fits = size => {
        let lines = 0
        for (const paragraph of paragraphs) {
            const budget = width / size
            let row = 0
            lines++
            // 拉丁词按词换行；中日韩字符可逐字折行，长词再按字符拆开。
            const words = paragraph.match(/[\x21-\x7e]+|\s+|[^\x00-\x7f]/gu) || []
            for (const word of words) {
                const units = textUnits(word)
                if (/^\s+$/u.test(word)) {
                    if (row) row += units
                    continue
                }
                if (units <= budget) {
                    if (row && row + units > budget) { lines++; row = 0 }
                    row += units
                } else {
                    for (const char of word) {
                        const unit = textUnits(char)
                        if (row && row + unit > budget) { lines++; row = 0 }
                        row += unit
                    }
                }
            }
        }
        return lines * size * leading <= height
    }
    if (fits(max)) return max
    if (!fits(min)) return min
    let low = min, high = max
    for (let step = 0; step < 16; step++) {
        const middle = (low + high) / 2
        if (fits(middle)) low = middle
        else high = middle
    }
    return Math.max(min, Math.min(max, Math.floor(low * 10) / 10))
}

/**
 * 对齐原 pvis 脚本的整数字号收缩，使用自带字体的真实 advance 和 normal 行高。
 * 自定义主题字体可关闭字体测量，继续用保守字宽；达到可读下限后由模板兜底。
 * @param {unknown} text @param {number} width @param {number} height
 * @param {number} maximum @param {number} minimum
 * @param {{nowrap?: boolean, breakWords?: boolean, lineHeight?: number, useFontMetrics?: boolean}} [options]
 */
function fitPvis(text, width, height, maximum, minimum, options = {}) {
    const max = Number.isFinite(maximum) && maximum > 0 ? maximum : 16
    const min = Number.isFinite(minimum) && minimum > 0 ? Math.min(minimum, max) : 1
    if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) return min
    const value = String(text ?? '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')
        .replace(/&(?:nbsp|#160);/gi, ' ').replace(/&(?:ensp|#8194);/gi, '\u2002').replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    const measure = options.useFontMetrics === false ? textUnits : measureText
    const leading = Number.isFinite(options.lineHeight) && /** @type {number} */ (options.lineHeight) > 0
        ? /** @type {number} */ (options.lineHeight) : options.useFontMetrics === false ? 1.5 : measureLineHeight(value)
    const paragraphs = value.replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/[\t\f ]+/g, ' ').trim())
    /** @param {number} size */
    const fits = size => {
        let lines = 0
        for (const paragraph of paragraphs) {
            lines++
            if (options.nowrap) {
                if (Math.round(measure(paragraph) * size) > Math.round(width)) return false
                continue
            }
            let row = 0
            const words = paragraph.match(/[\x21-\x7e]+|\s+|[^\x00-\x7f]/gu) || []
            for (const word of words) {
                const advance = measure(word) * size
                if (/^\s+$/u.test(word)) { if (row) row += advance; continue }
                if (Math.round(advance) > Math.round(width)) {
                    if (!options.breakWords) return false
                    for (const char of word) {
                        const unit = measure(char) * size
                        if (row && row + unit > width) { lines++; row = 0 }
                        row += unit
                    }
                } else {
                    if (row && row + advance > width) { lines++; row = 0 }
                    row += advance
                }
            }
        }
        return lines * Math.round(size * leading) <= Math.round(height)
    }
    if (fits(max)) return max
    let low = Math.ceil(min), high = Math.floor(max)
    while (low <= high) {
        const middle = Math.floor((low + high) / 2)
        if (fits(middle)) low = middle + 1
        else high = middle - 1
    }
    return Math.max(min, high)
}

export default { fitLine, fitBox, fitPvis }
