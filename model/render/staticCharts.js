// 仅缓存直接生成的雷达 SVG；同时限制条目和字节数，避免长期运行积累。
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
 * @typedef {{ rows: string[], cos: number, sin: number, width: number, height: number, fontSize: number, x: number, top: number, anchor: 'start' | 'middle' | 'end' }} RadarLabel
 */

/**
 * 保留原雷达图的方向、五层网格、配色和标签排版，直接生成 SVG。
 * Shotium 无需执行 JS，宿主也无需加载图表引擎或创建图表实例。
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
    const centerX = width / 2, centerY = height / 2
    const nameGap = 12, edge = 8
    const axes = words.map((_, index) => {
        // SVG 的 y 轴向下；第一轴向上，之后逆时针，与原图表一致。
        const angle = Math.PI / 2 + index * Math.PI * 2 / words.length
        return { cos: Math.cos(angle), sin: Math.sin(angle) }
    })
    /** @type {RadarLabel[]} */
    let labels = []
    let radius = 20
    // 普通标签使用配置字号；密集标签逐步缩小，保留全部名称和票数。
    for (let size = fontSize; size >= 10; size--) {
        const maxLabelWidth = Math.max(size * 2, Math.min(160, width * 0.22))
        labels = words.map((word, index) => {
            const rows = wrapLabel(word.name, size, maxLabelWidth)
            if (options.showValue) {
                // 把括号与票数作为整体，避免换行拆成“换手( / 5)”。
                const value = `(${word.value})`
                const last = rows.length - 1
                if (textWidth(rows[last] + value, size) <= maxLabelWidth) rows[last] += value
                else rows.push(value)
            }
            const labelWidth = Math.max(...rows.map(row => textWidth(row, size)))
            const labelHeight = rows.length * size * 1.2
            // 极长文本也完整保留；仅当一个标签本身超出画布时再整体缩小。
            const fit = Math.min(1, (width - edge * 2) / Math.max(1, labelWidth), (height - edge * 2) / labelHeight)
            return { rows, ...axes[index], width: labelWidth * fit, height: labelHeight * fit,
                fontSize: size * fit, x: 0, top: 0, anchor: /** @type {'middle'} */ ('middle') }
        })
        radius = Math.min(width, height) * 0.3
        for (const label of labels) {
            const cos = Math.abs(label.cos), sin = Math.abs(label.sin)
            if (cos > 0.001) radius = Math.min(radius, (width / 2 - label.width - edge) / cos - nameGap)
            if (sin > 0.001) radius = Math.min(radius, (height / 2 - label.height * (cos < 0.001 ? 1 : 0.5) - edge) / sin - nameGap)
        }
        radius = Math.max(20, radius)
        for (const label of labels) {
            label.anchor = Math.abs(label.cos) < 0.001 ? 'middle' : label.cos > 0 ? 'start' : 'end'
            const x = centerX + label.cos * (radius + nameGap)
            const y = centerY - label.sin * (radius + nameGap)
            const offset = label.anchor === 'start' ? 0 : label.anchor === 'end' ? label.width : label.width / 2
            const left = Math.max(edge, Math.min(width - edge - label.width, x - offset))
            label.x = left + offset
            const top = y - (Math.abs(label.cos) < 0.001 ? (label.sin > 0 ? label.height : 0) : label.height / 2)
            label.top = Math.max(edge, Math.min(height - edge - label.height, top))
        }
        const crowded = labels.some((label, index) => labels.slice(index + 1).some(other => {
            const left = label.x - (label.anchor === 'start' ? 0 : label.anchor === 'end' ? label.width : label.width / 2)
            const otherLeft = other.x - (other.anchor === 'start' ? 0 : other.anchor === 'end' ? other.width : other.width / 2)
            return left < otherLeft + other.width + 4 && left + label.width + 4 > otherLeft
                && label.top < other.top + other.height + 4 && label.top + label.height + 4 > other.top
        }))
        if (!crowded) break
    }

    /** @param {number} fraction */
    const points = fraction => axes.map(axis => `${coord(centerX + axis.cos * radius * fraction)},${coord(centerY - axis.sin * radius * fraction)}`).join(' ')
    /** @param {number} fraction */
    const polygonPath = fraction => 'M' + points(fraction).replace(/ /g, 'L') + 'Z'
    const content = ['<g font-family="PHI,NOTO,sans-serif">']
    for (let step = 1; step <= 5; step++) {
        // 挖掉内圈，避免嵌套半透明面叠加后改变原来的交替底色。
        const band = polygonPath(step / 5) + (step > 1 ? polygonPath((step - 1) / 5) : '')
        content.push(`<path d="${band}" fill="white" fill-opacity="${step % 2 ? 0.05 : 0.1}" fill-rule="evenodd"/>`)
    }
    for (let step = 1; step <= 5; step++) {
        content.push(`<polygon class="phi-chart-radar-grid" points="${points(step / 5)}" fill="none" stroke="white" stroke-opacity="0.3"/>`)
    }
    for (const axis of axes) {
        content.push(`<line class="phi-chart-radar-axis" x1="${centerX}" y1="${centerY}" x2="${coord(centerX + axis.cos * radius)}" y2="${coord(centerY - axis.sin * radius)}" stroke="white" stroke-opacity="0.5"/>`)
    }
    const values = words.map((word, index) => {
        // 无统一最大值时，各轴沿用 max(value * 1.2, 1)；先求比例可避免极大有限数溢出。
        const fraction = Number.isFinite(maximum) && Number(maximum) > 0
            ? word.value / Math.max(Number(maximum), word.value) : Math.min(word.value, 1 / 1.2)
        return { x: coord(centerX + axes[index].cos * radius * fraction), y: coord(centerY - axes[index].sin * radius * fraction) }
    })
    // 原面积颜色的 alpha 0.3 与默认 opacity 0.7 叠乘，保持实际显示透明度。
    content.push(`<polygon class="phi-chart-radar-shape" points="${values.map(point => `${point.x},${point.y}`).join(' ')}" fill="#64c8ff" fill-opacity="0.21" stroke="#64c8ff" stroke-opacity="0.8" stroke-width="2"/>`)
    for (const point of values) content.push(`<circle class="phi-chart-radar-point" cx="${point.x}" cy="${point.y}" r="4" fill="#64c8ff"/>`)
    for (const label of labels) {
        label.rows.forEach((row, index) => {
            const y = label.top + label.fontSize * 1.2 * (index + 0.5)
            content.push(`<text class="phi-chart-radar-label" x="${coord(label.x)}" y="${coord(y)}" text-anchor="${label.anchor}" dominant-baseline="central" font-size="${coord(label.fontSize)}" fill="white">${escapeXml(row)}</text>`)
        })
    }
    content.push('</g>')
    return cacheRadar(key, svg(content.join(''), width, height, '谱面标签雷达图'))
}

export default { difficulty, radar }
