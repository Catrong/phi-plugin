import { openSync, closeSync, readSync, fstatSync } from 'node:fs'

// 与 common.css 的 body 字体顺序一致。只保留 cmap 和横向 advance，不缓存字体文件。
const fontFiles = [
    'phi.ttf', 'NotoSansArabic.ttf', 'NotoSansSymbols2.ttf', 'NotoSans-Regular.ttf',
    'NotoSansJP.ttf', 'NotoSansKannada.ttf', 'NotoSansCanadianAboriginal.ttf',
    'NotoColorEmoji-Regular.ttf', 'HIMALAYA.TTF', '吞弥恰俊.ttf', 'NotoSansMath-Regular.ttf',
].map(name => new URL(`../../resources/html/common/font/${name}`, import.meta.url))

/** @param {number} fd @param {number} offset @param {number} length @param {number} fileSize */
function readRange(fd, offset, length, fileSize) {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > fileSize) throw new Error('Invalid font table')
    const data = Buffer.alloc(length)
    let read = 0
    while (read < length) {
        const count = readSync(fd, data, read, length - read, offset + read)
        if (!count) throw new Error('Incomplete font table')
        read += count
    }
    return data
}

/** @param {Buffer} table @param {number} offset */
function readCmap(table, offset) {
    const format = table.readUInt16BE(offset)
    if (format === 12) {
        const length = table.readUInt32BE(offset + 4), count = table.readUInt32BE(offset + 12)
        if (count > 0x110000 || length < 16 + count * 12 || offset + length > table.length) throw new Error('Invalid cmap format 12')
        const starts = new Uint32Array(count), ends = new Uint32Array(count), glyphs = new Uint32Array(count)
        for (let i = 0; i < count; i++) {
            const point = offset + 16 + i * 12
            starts[i] = table.readUInt32BE(point)
            ends[i] = table.readUInt32BE(point + 4)
            glyphs[i] = table.readUInt32BE(point + 8)
            if (starts[i] > ends[i] || ends[i] > 0x10ffff || (i && starts[i] <= ends[i - 1])) throw new Error('Unsorted cmap groups')
        }
        return /** @param {number} code */ code => {
            let low = 0, high = count - 1
            while (low <= high) {
                const middle = (low + high) >>> 1
                if (code < starts[middle]) high = middle - 1
                else if (code > ends[middle]) low = middle + 1
                else return glyphs[middle] + code - starts[middle]
            }
            return 0
        }
    }
    if (format === 4) {
        const length = table.readUInt16BE(offset + 2), count = table.readUInt16BE(offset + 6) / 2
        if (!Number.isInteger(count) || !count || length < 16 + count * 8 || offset + length > table.length) throw new Error('Invalid cmap format 4')
        // 拷贝唯一需要的子表，避免子 Buffer 持有完整 cmap。
        const data = Buffer.from(table.subarray(offset, offset + length))
        const startOffset = 16 + count * 2, deltaOffset = startOffset + count * 2, rangeOffset = deltaOffset + count * 2
        return /** @param {number} code */ code => {
            if (code > 0xffff) return 0
            let low = 0, high = count - 1
            while (low <= high) {
                const middle = (low + high) >>> 1, end = data.readUInt16BE(14 + middle * 2)
                if (code > end) low = middle + 1
                else high = middle - 1
            }
            if (low >= count) return 0
            const start = data.readUInt16BE(startOffset + low * 2)
            if (code < start) return 0
            const delta = data.readInt16BE(deltaOffset + low * 2), point = rangeOffset + low * 2
            const range = data.readUInt16BE(point)
            if (!range) return (code + delta) & 0xffff
            const glyphPoint = point + range + (code - start) * 2
            if (glyphPoint + 2 > data.length) return 0
            const glyph = data.readUInt16BE(glyphPoint)
            return glyph ? (glyph + delta) & 0xffff : 0
        }
    }
    return null
}

/** @param {string | URL} file */
function readFont(file) {
    const fd = openSync(file, 'r')
    try {
        const fileSize = fstatSync(fd).size, header = readRange(fd, 0, 12, fileSize)
        const count = header.readUInt16BE(4)
        // TTC 集合不在此路径支持；插件自带的字体均为单个 sfnt。
        if (header.toString('ascii', 0, 4) === 'ttcf' || !count || count > 4096) throw new Error('Unsupported font container')
        const directory = readRange(fd, 12, count * 16, fileSize)
        /** @type {Map<string, { offset: number, length: number }>} */
        const tables = new Map()
        for (let i = 0; i < count; i++) {
            const position = i * 16
            tables.set(directory.toString('ascii', position, position + 4), { offset: directory.readUInt32BE(position + 8), length: directory.readUInt32BE(position + 12) })
        }
        /** @param {string} name @param {number} [size] */
        const table = (name, size) => {
            const entry = tables.get(name)
            if (!entry || (size && entry.length < size) || entry.length > 16 * 1024 * 1024) throw new Error(`Invalid ${name} table`)
            return readRange(fd, entry.offset, size ?? entry.length, fileSize)
        }
        const head = table('head', 54), hhea = table('hhea', 36), maxp = table('maxp', 6)
        const em = head.readUInt16BE(18), metricsCount = hhea.readUInt16BE(34), glyphCount = maxp.readUInt16BE(4)
        if (!em || !metricsCount || metricsCount > glyphCount) throw new Error('Invalid horizontal metrics')
        const hmtx = table('hmtx', metricsCount * 4), advances = new Uint16Array(metricsCount)
        for (let i = 0; i < metricsCount; i++) advances[i] = hmtx.readUInt16BE(i * 4)
        const cmap = table('cmap'), cmapCount = cmap.readUInt16BE(2)
        if (4 + cmapCount * 8 > cmap.length) throw new Error('Invalid cmap records')
        const candidates = []
        for (let i = 0; i < cmapCount; i++) {
            const position = 4 + i * 8, platform = cmap.readUInt16BE(position), encoding = cmap.readUInt16BE(position + 2), offset = cmap.readUInt32BE(position + 4)
            if (!(platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))) || offset + 2 > cmap.length) continue
            const format = cmap.readUInt16BE(offset)
            if (format === 4 || format === 12) candidates.push({ offset, priority: format === 12 ? 2 : 1 })
        }
        candidates.sort((a, b) => b.priority - a.priority)
        let glyphFor = null
        for (const candidate of candidates) {
            try { glyphFor = readCmap(cmap, candidate.offset) } catch { continue }
            if (glyphFor) break
        }
        if (!glyphFor) throw new Error('Unsupported Unicode cmap')
        const ascent = hhea.readInt16BE(4), descent = -hhea.readInt16BE(6), gap = hhea.readInt16BE(8)
        return {
            glyphFor, glyphCount, em, advances,
            ascent: Math.max(0, ascent / em), descent: Math.max(0, descent / em), gap: Math.max(0, gap / em),
        }
    } finally { closeSync(fd) }
}

/** @param {string} char */
function approximateWidth(char) {
    if (/\p{Mark}|[\u200d\ufe0e\ufe0f]/u.test(char)) return 0
    if (/\s/u.test(char)) return 0.35
    if (/[ilI1.,'`:;!|]/.test(char)) return 0.35
    if (/[MWmw@%&]/.test(char)) return 0.9
    return /[\x00-\x7f]/.test(char) ? 0.6 : 1
}

/**
 * 每个字体按需读取一次，缺失或格式不支持时继续回退；缓存不持有整份字体。
 * 字宽为 glyph advance 之和，不执行 OpenType shaping、字偶距或 emoji 序列合成。
 * 适合插件常用拉丁字母、中日韩文字与符号。复杂脚本仍以真实页面为准。
 * @param {(string | URL)[]} [files]
 */
export function createTextMeasurer(files = fontFiles) {
    /** @type {(ReturnType<typeof readFont> | false | undefined)[]} */
    const fonts = new Array(files.length)
    /** @param {number} index */
    const load = index => {
        if (fonts[index] === undefined) {
            try { fonts[index] = readFont(files[index]) } catch { fonts[index] = false }
        }
        return fonts[index]
    }
    /** @type {Map<number, { width: number, ascent: number, descent: number, gap: number }>} */
    const glyphCache = new Map()
    /** @param {string} char */
    const measureGlyph = char => {
        const code = char.codePointAt(0) ?? 0
        const cached = glyphCache.get(code)
        if (cached) return cached
        let result = null
        for (let index = 0; index < files.length; index++) {
            const font = load(index)
            if (!font) continue
            const glyph = font.glyphFor(code)
            if (!glyph || glyph >= font.glyphCount) continue
            result = { width: font.advances[Math.min(glyph, font.advances.length - 1)] / font.em, ascent: font.ascent, descent: font.descent, gap: font.gap }
            break
        }
        result ??= { width: approximateWidth(char), ascent: 0.9, descent: 0.3, gap: 0 }
        if (glyphCache.size >= 4096) {
            const first = glyphCache.keys().next().value
            if (first !== undefined) glyphCache.delete(first)
        }
        glyphCache.set(code, result)
        return result
    }
    /**
     * 返回 CSS 字号为 1px 时的宽度。合成粗体通常不会改变横向 advance。
     * @param {unknown} value @param {{fontWeight?: string | number}} [options]
     */
    function measureText(value, options = {}) {
        let width = 0
        // canvas 单行测量按空格处理这些字符；调用方负责 HTML 去标签与实体解码。
        for (const char of String(value ?? '').replace(/[\t\r\n\f]/g, ' ')) width += measureGlyph(char).width
        return width
    }
    /**
     * 默认字体与实际参与回退字体的 hhea 行高，用于估计 CSS normal 的一行高度。
     * 不包括页面显式 line-height 或 OpenType 复杂脚本整形产生的额外范围。
     * @param {unknown} [value]
     */
    function measureLineHeight(value = '') {
        const primary = load(0)
        let ascent = primary ? primary.ascent + primary.gap / 2 : 0.9
        let descent = primary ? primary.descent + primary.gap / 2 : 0.3
        for (const char of String(value ?? '')) {
            const metric = measureGlyph(char)
            ascent = Math.max(ascent, metric.ascent + metric.gap / 2)
            descent = Math.max(descent, metric.descent + metric.gap / 2)
        }
        return ascent + descent
    }
    return { measureText, measureLineHeight }
}

const defaultMeasurer = createTextMeasurer()
export const measureText = defaultMeasurer.measureText
export const measureLineHeight = defaultMeasurer.measureLineHeight
export default defaultMeasurer
