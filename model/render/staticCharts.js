import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
/** @type {typeof import('echarts') | undefined} */
let echarts

// 仅缓存雷达 SVG，不持有 ECharts 实例；同时限制条目和字节数，避免长期运行积累。
const MAX_RADAR_ENTRIES = 64
const MAX_RADAR_BYTES = 2 * 1024 * 1024
const MAX_RADAR_ENTRY_BYTES = 128 * 1024
/** @type {Map<string, { svg: string, bytes: number }>} */
const radarCache = new Map()
let radarCacheBytes = 0

/** @param {string} key */
function cachedRadar(key) {
    const entry = radarCache.get(key)
    if (!entry) return undefined
    radarCache.delete(key)
    radarCache.set(key, entry)
    return entry.svg
}

/** @param {string} key @param {string} result */
function cacheRadar(key, result) {
    const bytes = Buffer.byteLength(key) + Buffer.byteLength(result)
    if (bytes > MAX_RADAR_ENTRY_BYTES) return result
    while (radarCache.size >= MAX_RADAR_ENTRIES || radarCacheBytes + bytes > MAX_RADAR_BYTES) {
        const oldest = radarCache.keys().next().value
        if (oldest === undefined) break
        radarCacheBytes -= /** @type {{ bytes: number }} */ (radarCache.get(oldest)).bytes
        radarCache.delete(oldest)
    }
    radarCache.set(key, { svg: result, bytes })
    radarCacheBytes += bytes
    return result
}

/** @param {unknown} value */
function escapeXml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
    }[char] || char))
}

/** @param {unknown} value @param {number} fallback */
function dimension(value, fallback) {
    const result = Number(value)
    return Number.isFinite(result) && result >= 80 ? Math.min(result, 16000) : fallback
}

/** @param {number} value */
function coord(value) {
    return Number(value.toFixed(2))
}

/** 不依赖浏览器字体测量，给中英文标签保留略宽于字形的空间。 @param {string} text @param {number} fontSize */
function textWidth(text, fontSize) {
    return Array.from(text).reduce((width, char) => width + (/^[\x20-\x7e]$/.test(char) ? 0.64 : 1.05) * fontSize, 0)
}

/** @param {string} text @param {number} fontSize @param {number} maxWidth */
function wrapLabel(text, fontSize, maxWidth) {
    const rows = []
    let row = '', width = 0
    for (const char of text) {
        if (char === '\n') {
            rows.push(row)
            row = ''; width = 0
            continue
        }
        const charWidth = textWidth(char, fontSize)
        if (row && width + charWidth > maxWidth) {
            rows.push(row)
            row = ''; width = 0
        }
        row += char
        width += charWidth
    }
    rows.push(row)
    return rows
}

/**
 * 优先保留两端标签，其余标签放到可用行；所有折线与节点仍保留。
 * @template {{ position: number, size: number }} T
 * @param {T[]} input @param {number} rows @param {number} gap
 * @returns {(T & { row: number })[]}
 */
function spaceLabels(input, rows, gap) {
    const labels = [...input].sort((a, b) => a.position - b.position)
    const priority = labels.length > 1 ? [labels[0], labels[labels.length - 1], ...labels.slice(1, -1)] : labels
    /** @type {{ start: number, end: number }[][]} */
    const occupied = Array.from({ length: rows }, () => [])
    /** @type {(T & { row: number })[]} */
    const placed = []
    for (const label of priority) {
        const start = label.position - label.size / 2, end = label.position + label.size / 2
        const row = occupied.findIndex(intervals => intervals.every(interval => end + gap <= interval.start || start >= interval.end + gap))
        if (row < 0) continue
        occupied[row].push({ start, end })
        placed.push({ ...label, row })
    }
    return placed.sort((a, b) => a.position - b.position)
}

/** @param {string} body @param {number} width @param {number} height @param {string} label */
function svg(body, width, height, label) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="width:100%;height:100%;display:block" role="img" aria-label="${escapeXml(label)}">${body}</svg>`
}

/** @param {number} width @param {number} height @param {string} text */
function emptyChart(width, height, text) {
    return svg(`<text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="20">${escapeXml(text)}</text>`, width, height, text)
}

/**
 * @typedef {{ x: number, y: number, xLabel?: string, xLable?: string, yLabel?: string, yLable?: string, visX?: boolean, visY?: boolean }} DifficultyPoint
 * @typedef {{ color?: string, data?: DifficultyPoint[] }} DifficultyLine
 */

/**
 * 将定数历史数据直接画成 SVG，供不执行浏览器脚本的渲染器使用。
 * @param {DifficultyLine[] | string | null | undefined} input
 * @param {number} [width]
 * @param {number} [height]
 */
function difficulty(input, width = 800, height = 250) {
    width = dimension(width, 800)
    height = dimension(height, 250)
    /** @type {unknown} */
    let parsed = input
    if (typeof input === 'string') {
        try { parsed = JSON.parse(input) } catch { parsed = [] }
    }
    const lines = /** @type {DifficultyLine[]} */ (Array.isArray(parsed) ? parsed : [])
        .filter(line => line && Array.isArray(line.data))
        .map(line => ({ ...line, data: (line.data || []).filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y)) }))
    const allData = lines.flatMap(line => line.data)
    if (!allData.length) return emptyChart(width, height, '暂无定数历史')

    const fontSize = 16
    const margin = { top: 24, right: 24, bottom: 56, left: 64 }
    const innerWidth = Math.max(1, width - margin.left - margin.right)
    const innerHeight = Math.max(1, height - margin.top - margin.bottom)
    const xs = allData.map(point => point.x)
    const ys = allData.map(point => point.y)
    const xMin = Math.min(...xs), xMax = Math.max(...xs)
    const yMin = Math.min(...ys), yMax = Math.max(...ys)
    const xPadding = (xMax - xMin) * 0.1 || 1
    const yPadding = (yMax - yMin) * 0.1 || 1
    /** @param {number} value */
    const xScale = value => coord((value - xMin + xPadding) / (xMax - xMin + 2 * xPadding) * innerWidth)
    /** @param {number} value */
    const yScale = value => coord(innerHeight - (value - yMin + yPadding) / (yMax - yMin + 2 * yPadding) * innerHeight)
    const content = [`<g transform="translate(${margin.left},${margin.top})" font-family="PHI,NOTO,sans-serif">`,
        `<path d="M0 0V${innerHeight}H${innerWidth}" fill="none" stroke="white"/>`]
    for (let i = 0; i <= 5; i++) {
        const x = coord(i / 5 * innerWidth)
        const y = coord(i / 5 * innerHeight)
        content.push(`<path d="M${x} ${innerHeight}v6M-6 ${y}h6" stroke="white" fill="none"/>`)
    }
    const xLabels = new Set()
    const yLabels = new Set()
    /** @type {{ position: number, size: number, x: number, y: number, color: string, text: string }[]} */
    const xCandidates = [], yCandidates = []
    for (const line of lines) {
        // 颜色仅接受十六进制，不能把属性或 URL 注入 SVG。
        const color = line.color && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(line.color) ? line.color : '#64B5F6'
        if (line.data.length > 1) {
            const points = line.data.map(point => `${xScale(point.x)},${yScale(point.y)}`).join(' ')
            content.push(`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>`)
        }
        for (const point of line.data) {
            const x = xScale(point.x), y = yScale(point.y)
            content.push(`<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`)
            const xLabel = String(point.xLable || point.xLabel || '')
            if (point.visX && !xLabels.has(`${x}:${xLabel}`)) {
                xLabels.add(`${x}:${xLabel}`)
                xCandidates.push({ position: x, size: textWidth(xLabel, fontSize), x, y, color, text: xLabel })
            }
            const yLabel = String(point.yLable || point.yLabel || '')
            if (point.visY && !yLabels.has(`${y}:${yLabel}`)) {
                yLabels.add(`${y}:${yLabel}`)
                yCandidates.push({ position: y, size: fontSize, x, y, color, text: yLabel })
            }
        }
    }
    for (const label of spaceLabels(xCandidates, 2, 6)) {
        content.push(`<path d="M${label.x} ${label.y}V${innerHeight}" stroke="${label.color}" stroke-opacity="0.4" stroke-dasharray="4,2"/>`,
            `<text class="phi-chart-axis-x" x="${label.x}" y="${innerHeight + 21 + label.row * 21}" text-anchor="middle" font-size="${fontSize}" fill="${label.color}">${escapeXml(label.text)}</text>`)
    }
    for (const label of spaceLabels(yCandidates, 1, 4)) {
        content.push(`<path d="M${label.x} ${label.y}H0" stroke="${label.color}" stroke-opacity="0.4" stroke-dasharray="4,2"/>`,
            `<text class="phi-chart-axis-y" x="-10" y="${label.y}" text-anchor="end" dominant-baseline="middle" font-size="${fontSize}" fill="${label.color}">${escapeXml(label.text)}</text>`)
    }
    content.push('</g>')
    return svg(content.join(''), width, height, '定数变化折线图')
}

/**
 * @typedef {{ name: string, value: number }} ChartWord
 * @typedef {{ width?: number, height?: number, fontSize?: number, showValue?: boolean }} RadarOptions
 */

/**
 * ECharts 的服务端 SVG 模式保留原雷达图样式，Shotium 无需执行 JS。
 * 少于三个标签时展示横条，避免不完整的雷达坐标系隐藏有效数据。
 * @param {ChartWord[] | null | undefined} input
 * @param {number} [maximum]
 * @param {RadarOptions} [options]
 */
function radar(input, maximum, options = {}) {
    const width = dimension(options.width, 900)
    const height = dimension(options.height, 430)
    const fontSize = Math.max(10, Math.min(60, Number(options.fontSize) || 30))
    const words = (Array.isArray(input) ? input : []).filter(word => word && Number.isFinite(word.value) && word.value >= 0)
        .map(word => ({ name: String(word.name ?? ''), value: word.value }))
    if (!words.length) return emptyChart(width, height, '暂无谱面标签')
    if (words.length < 3) {
        const max = Math.max(Number(maximum) || 0, ...words.map(word => word.value), 1)
        const content = words.map((word, i) => {
            const y = height * (i + 1) / (words.length + 1)
            const barWidth = coord((width - 80) * word.value / max)
            const rows = wrapLabel(`${word.name} (${word.value})`, fontSize, width - 80)
            const label = rows.map((row, index) => `<text x="40" y="${coord(y - fontSize - (rows.length - index - 1) * fontSize * 1.2)}" fill="white" font-size="${fontSize}" font-family="PHI,NOTO,sans-serif">${escapeXml(row)}</text>`).join('')
            return `${label}<rect x="40" y="${coord(y)}" width="${width - 80}" height="12" fill="white" fill-opacity="0.1"/><rect x="40" y="${coord(y)}" width="${barWidth}" height="12" fill="#64c8ff"/>`
        }).join('')
        return svg(content, width, height, '谱面标签')
    }
    const key = JSON.stringify([words, maximum, width, height, fontSize, !!options.showValue])
    const cached = cachedRadar(key)
    if (cached !== undefined) return cached
    // 使用生产构建，避免内部刻度诊断写入宿主日志；Puppeteer 或非雷达请求无需加载它。
    echarts ||= /** @type {typeof import('echarts')} */ (require('echarts/dist/echarts.min.js'))
    const maxLabelWidth = Math.max(fontSize * 2, Math.min(160, width * 0.22))
    const labels = words.map(word => {
        const rows = wrapLabel(word.name, fontSize, maxLabelWidth)
        if (options.showValue) {
            // 把括号与票数作为整体，避免换行拆成“换手( / 5)”。
            const value = `(${word.value})`
            const last = rows.length - 1
            if (textWidth(rows[last] + value, fontSize) <= maxLabelWidth) rows[last] += value
            else rows.push(value)
        }
        return rows
    })
    const nameGap = 12, edge = 8
    let radius = Math.min(width, height) * 0.3
    labels.forEach((rows, index) => {
        const angle = Math.PI / 2 + index * Math.PI * 2 / words.length
        const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle))
        const labelWidth = Math.max(...rows.map(row => textWidth(row, fontSize)))
        const labelHeight = rows.length * fontSize * 1.2
        if (cos > 0.001) radius = Math.min(radius, (width / 2 - labelWidth - edge) / cos - nameGap)
        if (sin > 0.001) radius = Math.min(radius, (height / 2 - labelHeight * (cos < 0.001 ? 1 : 0.5) - edge) / sin - nameGap)
    })
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height })
    try {
        chart.setOption({
            animation: false,
            radar: {
                indicator: words.map((word, index) => ({
                    name: labels[index].join('\n'),
                    max: Number.isFinite(maximum) && Number(maximum) > 0 ? Math.max(Number(maximum), word.value) : Math.max(word.value * 1.2, 1),
                })),
                shape: 'polygon', splitNumber: 5, radius: Math.max(20, radius), axisNameGap: nameGap,
                axisName: { color: '#fff', fontFamily: 'PHI,NOTO,sans-serif', fontSize, lineHeight: fontSize * 1.2 },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } },
                splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)'] } },
                axisLine: { lineStyle: { color: 'rgba(255,255,255,0.5)' } },
            },
            series: [{ type: 'radar', data: [{ value: words.map(word => word.value),
                lineStyle: { color: 'rgba(100,200,255,0.8)', width: 2 },
                areaStyle: { color: 'rgba(100,200,255,0.3)' },
                itemStyle: { color: 'rgba(100,200,255,1)' },
            }] }],
        })
        return cacheRadar(key, chart.renderToSVGString().replace('<svg ', '<svg role="img" aria-label="谱面标签雷达图" style="width:100%;height:100%;display:block" '))
    } finally {
        chart.dispose()
    }
}

export default { difficulty, radar }
