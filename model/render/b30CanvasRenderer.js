import fs from 'node:fs'
import path from 'node:path'
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import { pluginResources } from '../filesystem/path.js'

const WIDTH = 1200
const PAGE_MARGIN = 40
const CARD_WIDTH = 360
const CARD_HEIGHT = 124
const CARD_GAP_X = 20
const CARD_GAP_Y = 18
const HEADER_HEIGHT = 272
const FONT_FAMILY = 'PhiCanvas'
const DISPLAY_FONT_FAMILY = 'PhiCanvasDisplay'

let fontsRegistered = false

function registerFonts() {
    if (fontsRegistered) return
    fontsRegistered = true
    const fontDir = path.join(pluginResources, 'html', 'common', 'font')
    const fonts = [
        ['phi.ttf', FONT_FAMILY],
        ['Aldrich-Regular.ttf', DISPLAY_FONT_FAMILY],
    ]
    for (const [fileName, family] of fonts) {
        const file = path.join(fontDir, fileName)
        if (fs.existsSync(file)) GlobalFonts.registerFromPath(file, family)
    }
}

/** @param {unknown} value */
function finite(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

/** @param {number} value @param {number} min @param {number} max */
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
}

/** @param {unknown} value */
function cleanText(value) {
    return String(value ?? '')
        .replace(/<[^>]*>/g, '')
        .replace(/&ensp;|&emsp;|&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
}

/** @param {any} ctx @param {number} x @param {number} y @param {number} width @param {number} height @param {number} radius */
function roundedPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + width - r, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + r)
    ctx.lineTo(x + width, y + height - r)
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
    ctx.lineTo(x + r, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}

/** @param {any} ctx @param {number} x @param {number} y @param {number} width @param {number} height @param {number} radius @param {any} color */
function fillRounded(ctx, x, y, width, height, radius, color) {
    roundedPath(ctx, x, y, width, height, radius)
    ctx.fillStyle = color
    ctx.fill()
}

/** @param {any} ctx @param {number} x @param {number} y @param {number} width @param {number} height @param {number} radius @param {string} color @param {number} lineWidth */
function strokeRounded(ctx, x, y, width, height, radius, color, lineWidth = 1) {
    roundedPath(ctx, x, y, width, height, radius)
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.stroke()
}

/** @param {any} ctx @param {number} size @param {number|string} weight @param {string} family */
function useFont(ctx, size, weight = 400, family = FONT_FAMILY) {
    ctx.font = `${weight} ${size}px "${family}"`
}

/** @param {any} ctx @param {unknown} value @param {number} maxWidth */
function ellipsize(ctx, value, maxWidth) {
    const source = cleanText(value)
    if (ctx.measureText(source).width <= maxWidth) return source
    let left = 0
    let right = source.length
    while (left < right) {
        const middle = Math.ceil((left + right) / 2)
        if (ctx.measureText(`${source.slice(0, middle)}...`).width <= maxWidth) left = middle
        else right = middle - 1
    }
    return `${source.slice(0, left)}...`
}

/** @param {any} ctx @param {unknown} value @param {number} maxWidth @param {number} maxSize @param {number} minSize @param {number|string} weight */
function fitText(ctx, value, maxWidth, maxSize, minSize, weight = 400) {
    let size = maxSize
    while (size > minSize) {
        useFont(ctx, size, weight)
        if (ctx.measureText(cleanText(value)).width <= maxWidth) break
        size -= 1
    }
    useFont(ctx, size, weight)
    return ellipsize(ctx, value, maxWidth)
}

/** @param {any} ctx @param {unknown} value @param {number} x @param {number} y @param {{size?:number,weight?:number|string,color?:string,align?:'left'|'right'|'center'|'start'|'end',baseline?:'top'|'hanging'|'middle'|'alphabetic'|'ideographic'|'bottom',family?:string,maxWidth?:number}} [options] */
function drawText(ctx, value, x, y, options = {}) {
    useFont(ctx, options.size ?? 18, options.weight ?? 400, options.family ?? FONT_FAMILY)
    ctx.fillStyle = options.color ?? '#ffffff'
    ctx.textAlign = options.align ?? 'left'
    ctx.textBaseline = options.baseline ?? 'alphabetic'
    const output = options.maxWidth ? ellipsize(ctx, value, options.maxWidth) : cleanText(value)
    ctx.fillText(output, x, y)
}

/** @param {any} ctx @param {any} image @param {number} x @param {number} y @param {number} width @param {number} height */
function drawCover(ctx, image, x, y, width, height) {
    if (!image?.width || !image?.height) return
    const scale = Math.max(width / image.width, height / image.height)
    const sourceWidth = width / scale
    const sourceHeight = height / scale
    const sourceX = (image.width - sourceWidth) / 2
    const sourceY = (image.height - sourceHeight) / 2
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
}

/** @param {any} ctx @param {any} image @param {number} x @param {number} y @param {number} width @param {number} height @param {number} radius */
function drawRoundedCover(ctx, image, x, y, width, height, radius) {
    ctx.save()
    roundedPath(ctx, x, y, width, height, radius)
    ctx.clip()
    drawCover(ctx, image, x, y, width, height)
    ctx.restore()
}

/** @param {string} source */
async function loadRemoteImage(source) {
    const response = await fetch(source, {
        headers: {
            Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
            Referer: 'https://phib19.top/',
            'User-Agent': 'phi-plugin-canvas/1.0',
        },
        signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`image request failed: ${response.status}`)
    const declaredSize = Number(response.headers.get('content-length') || 0)
    if (declaredSize > 20 * 1024 * 1024) throw new Error('image is too large')
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > 20 * 1024 * 1024) throw new Error('image is too large')
    return loadImage(buffer)
}

/** @param {unknown} source */
function recordIllustrationSource(source) {
    const key = String(source || '')
    try {
        const url = new URL(key)
        if (url.hostname === 'r-0semi.xtower.site' && url.pathname.startsWith('/illustration/')) {
            url.pathname = url.pathname.replace('/illustration/', '/illustrationLowRes/')
            return url.toString()
        }
    } catch {
        const parent = path.dirname(key)
        if (path.basename(parent).toLowerCase() === 'ill') {
            const lowResolution = path.join(path.dirname(parent), 'illLow', path.basename(key))
            if (fs.existsSync(lowResolution)) return lowResolution
        }
    }
    return key
}

/** @param {unknown} source */
async function getImage(source) {
    if (!source) return null
    const key = String(source)
    try {
        if (/^https?:\/\//i.test(key)) return await loadRemoteImage(key)
        if (/^file:\/\//i.test(key)) return await loadImage(new URL(key))
        return await loadImage(key)
    } catch {
        return null
    }
}

/** @param {any} data */
function layoutRecords(data) {
    const entries = []
    let y = HEADER_HEIGHT
    let column = 0
    /** @param {any} record @param {string} label @param {string} kind */
    const pushCard = (record, label, kind) => {
        entries.push({ type: 'card', record, label, kind, x: PAGE_MARGIN + column * (CARD_WIDTH + CARD_GAP_X), y })
        column += 1
        if (column === 3) {
            column = 0
            y += CARD_HEIGHT + CARD_GAP_Y
        }
    }
    for (let index = 0; index < (Array.isArray(data.phi) ? data.phi.length : 0); index++) {
        pushCard(data.phi[index], `P${index + 1}`, 'phi')
    }
    const overflowAt = Array.isArray(data.phi) && data.phi.length ? 27 : 30
    for (let index = 0; index < (Array.isArray(data.b19_list) ? data.b19_list.length : 0); index++) {
        if (index === overflowAt) {
            if (column) {
                column = 0
                y += CARD_HEIGHT + CARD_GAP_Y
            }
            entries.push({ type: 'separator', label: 'OVER FLOW', y })
            y += 56
        }
        const record = data.b19_list[index]
        pushCard(record, `#${record?.num ?? index + 1}`, index < overflowAt ? 'best' : 'overflow')
    }
    if (column) y += CARD_HEIGHT + CARD_GAP_Y
    return { entries, bottom: y }
}

/** @param {any} ctx @param {string} label @param {number} y */
function drawSeparator(ctx, label, y) {
    const center = WIDTH / 2
    const gradientLeft = ctx.createLinearGradient(PAGE_MARGIN, 0, center - 110, 0)
    gradientLeft.addColorStop(0, 'rgba(255,255,255,0)')
    gradientLeft.addColorStop(1, 'rgba(255,255,255,0.82)')
    ctx.fillStyle = gradientLeft
    ctx.fillRect(PAGE_MARGIN, y + 20, center - PAGE_MARGIN - 110, 2)
    const gradientRight = ctx.createLinearGradient(center + 110, 0, WIDTH - PAGE_MARGIN, 0)
    gradientRight.addColorStop(0, 'rgba(255,255,255,0.82)')
    gradientRight.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradientRight
    ctx.fillRect(center + 110, y + 20, center - PAGE_MARGIN - 110, 2)
    drawText(ctx, label, center, y + 22, {
        size: 19,
        weight: 700,
        align: 'center',
        baseline: 'middle',
        family: DISPLAY_FONT_FAMILY,
        color: '#f5f7fb',
    })
}

/** @type {Record<string, string>} */
const rankColors = {
    AT: '#8c8f96',
    IN: '#f4434b',
    HD: '#24b8ed',
    EZ: '#88cd4a',
    LEGACY: '#b38de8',
}

const suggestionColors = ['#ef5862', '#ec9b45', '#b6b83c', '#3db874', '#31abb5', '#9b64d5']

/** @param {any} ctx @param {any} item @param {Map<string, any>} images */
function drawRecordCard(ctx, item, images) {
    const { x, y, record, label, kind } = item
    const rank = cleanText(record?.rank || 'IN')
    const accent = rankColors[rank] || '#24b8ed'

    ctx.save()
    ctx.shadowColor = kind === 'phi' ? 'rgba(255,228,64,0.58)' : 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = kind === 'phi' ? 15 : 10
    ctx.shadowOffsetY = 4
    fillRounded(ctx, x, y, CARD_WIDTH, CARD_HEIGHT, 7, 'rgba(12,17,26,0.88)')
    ctx.restore()

    const illustration = images.get(recordIllustrationSource(record?.illustration))
    if (illustration) drawRoundedCover(ctx, illustration, x, y, 172, CARD_HEIGHT, 7)
    else {
        const placeholder = ctx.createLinearGradient(x, y, x + 172, y + CARD_HEIGHT)
        placeholder.addColorStop(0, '#253447')
        placeholder.addColorStop(1, '#111720')
        fillRounded(ctx, x, y, 172, CARD_HEIGHT, 7, placeholder)
    }
    const coverShade = ctx.createLinearGradient(x + 70, 0, x + 180, 0)
    coverShade.addColorStop(0, 'rgba(10,14,20,0)')
    coverShade.addColorStop(1, 'rgba(10,14,20,0.9)')
    ctx.fillStyle = coverShade
    ctx.fillRect(x + 70, y, 110, CARD_HEIGHT)

    fillRounded(ctx, x + 8, y + 8, 48, 22, 4, kind === 'phi' ? '#fff5a8' : 'rgba(255,255,255,0.92)')
    drawText(ctx, label, x + 32, y + 19, {
        size: 12,
        weight: 700,
        align: 'center',
        baseline: 'middle',
        color: '#111820',
        family: DISPLAY_FONT_FAMILY,
    })

    fillRounded(ctx, x + 96, y + 83, 86, 34, 4, accent)
    drawText(ctx, `${rank} ${finite(record?.difficulty).toFixed(1)}`, x + 139, y + 94, {
        size: 11,
        weight: 700,
        align: 'center',
        baseline: 'middle',
    })
    drawText(ctx, finite(record?.rks).toFixed(2), x + 139, y + 108, {
        size: 15,
        weight: 700,
        align: 'center',
        baseline: 'middle',
    })

    ctx.fillStyle = `${accent}40`
    ctx.fillRect(x + 172, y, CARD_WIDTH - 172, CARD_HEIGHT)
    ctx.fillStyle = accent
    ctx.fillRect(x + CARD_WIDTH - 4, y, 4, CARD_HEIGHT)

    const songName = fitText(ctx, record?.song || record?.id || 'NO SIGNAL', 168, 17, 10, 600)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(songName, x + 264, y + 20)

    const ratingSource = path.join(pluginResources, 'html', 'otherimg', `${record?.Rating || 'NEW'}.png`)
    const rating = images.get(ratingSource)
    if (rating) {
        const targetWidth = 48
        const targetHeight = Math.min(38, targetWidth * rating.height / rating.width)
        ctx.drawImage(rating, x + 184, y + 46, targetWidth, targetHeight)
    } else {
        drawText(ctx, record?.Rating || 'NEW', x + 208, y + 64, {
            size: 13,
            weight: 700,
            align: 'center',
            baseline: 'middle',
            color: accent,
        })
    }

    drawText(ctx, Math.round(finite(record?.score)).toString().padStart(7, '0'), x + 288, y + 59, {
        size: 24,
        weight: 700,
        align: 'center',
        baseline: 'middle',
        family: DISPLAY_FONT_FAMILY,
    })
    ctx.fillStyle = 'rgba(255,255,255,0.32)'
    ctx.fillRect(x + 238, y + 77, 102, 1)
    drawText(ctx, `${finite(record?.acc).toFixed(2)}%`, x + 272, y + 96, {
        size: 15,
        weight: 600,
        align: 'center',
        baseline: 'middle',
    })
    const suggestion = cleanText(record?.suggest || '无法推分')
    const suggestionColor = suggestionColors[clamp(Math.trunc(finite(record?.suggestType)), 0, 5)]
    fillRounded(ctx, x + 304, y + 84, 46, 23, 11, `${suggestionColor}cc`)
    drawText(ctx, suggestion, x + 327, y + 96, {
        size: 9,
        weight: 700,
        align: 'center',
        baseline: 'middle',
        maxWidth: 40,
    })

    if (record?.accAvg) {
        /** @type {Record<string, [string, string]>} */
        const colors = {
            Higher: ['rgba(155,132,0,0.86)', '#fff06a'],
            Lower: ['rgba(109,0,47,0.86)', '#ff657d'],
            Hyper: ['rgba(0,126,171,0.86)', '#50d4ff'],
            Finished: ['rgba(0,126,48,0.86)', '#5dff8c'],
        }
        const [background, foreground] = colors[record.accKind] || colors.Hyper
        fillRounded(ctx, x + 74, y - 10, 178, 22, 4, background)
        drawText(ctx, record.accAvg, x + 163, y + 1, {
            size: 10,
            weight: 600,
            align: 'center',
            baseline: 'middle',
            color: foreground,
            maxWidth: 166,
        })
    }

    if (record?.cpToOld) {
        fillRounded(ctx, x + 250, y - 10, 102, 22, 4, 'rgba(18,24,34,0.94)')
        drawText(ctx, `Dif ${record.cpToOld.dif} / RKS ${record.cpToOld.rks}`, x + 301, y + 1, {
            size: 8,
            weight: 600,
            align: 'center',
            baseline: 'middle',
            maxWidth: 94,
        })
    }
}

/** @param {any} ctx @param {any} data @param {Map<string, any>} images */
function drawHeader(ctx, data, images) {
    fillRounded(ctx, PAGE_MARGIN, 34, 1120, 198, 8, 'rgba(9,14,22,0.78)')
    strokeRounded(ctx, PAGE_MARGIN, 34, 1120, 198, 8, 'rgba(255,255,255,0.13)')
    ctx.fillStyle = '#21b8ef'
    ctx.fillRect(PAGE_MARGIN, 34, 5, 198)

    const avatarPath = path.join(pluginResources, 'html', 'avatar', `${data.gameuser?.avatar || ''}.png`)
    const avatar = images.get(avatarPath)
    if (avatar) drawRoundedCover(ctx, avatar, 64, 58, 126, 126, 8)
    else {
        fillRounded(ctx, 64, 58, 126, 126, 8, '#182635')
        drawText(ctx, 'PHI', 127, 121, { size: 30, weight: 700, align: 'center', baseline: 'middle', color: '#37c8f4' })
    }

    drawText(ctx, data.gameuser?.PlayerId || data.PlayerId || 'Unknown Player', 216, 78, {
        size: 28,
        weight: 700,
        baseline: 'middle',
        maxWidth: 400,
    })
    drawText(ctx, 'RATING SCORE', 216, 111, { size: 10, weight: 700, color: '#8fa5b9', family: DISPLAY_FONT_FAMILY })
    drawText(ctx, finite(data.gameuser?.rks ?? data.Rks).toFixed(4), 216, 142, {
        size: 32,
        weight: 700,
        color: '#ffffff',
        family: DISPLAY_FONT_FAMILY,
    })

    const challengePath = path.join(pluginResources, 'html', 'otherimg', `${data.gameuser?.ChallengeMode ?? data.ChallengeMode ?? 0}.png`)
    const challenge = images.get(challengePath)
    if (challenge) ctx.drawImage(challenge, 390, 112, 44, 44)
    drawText(ctx, data.gameuser?.ChallengeModeRank ?? data.ChallengeModeRank ?? 0, 444, 136, {
        size: 18,
        weight: 700,
        baseline: 'middle',
    })

    fillRounded(ctx, 216, 170, 242, 34, 5, 'rgba(255,255,255,0.08)')
    drawText(ctx, data.gameuser?.data || '-', 232, 188, { size: 13, weight: 500, baseline: 'middle', maxWidth: 210 })
    drawText(ctx, data.Date || '-', 604, 69, { size: 13, color: '#a9bac9', align: 'right' })

    drawText(ctx, 'RECORD OVERVIEW', 655, 68, { size: 12, weight: 700, color: '#8fa5b9', family: DISPLAY_FONT_FAMILY })
    const stats = Array.isArray(data.stats) ? data.stats : []
    const rows = [
        ['CLEAR', 'cleared'],
        ['FULL COMBO', 'fc'],
        ['PHI', 'phi'],
    ]
    const statsX = 655
    const labelWidth = 100
    const cellWidth = 88
    for (let index = 0; index < stats.length; index++) {
        const x = statsX + labelWidth + index * cellWidth
        drawText(ctx, stats[index]?.title || '-', x + cellWidth / 2, 93, { size: 12, weight: 700, align: 'center', baseline: 'middle', color: rankColors[stats[index]?.title] || '#d8e3ec' })
    }
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const [label, key] = rows[rowIndex]
        const y = 120 + rowIndex * 31
        drawText(ctx, label, statsX, y, { size: 10, weight: 700, baseline: 'middle', color: '#8fa5b9', family: DISPLAY_FONT_FAMILY })
        for (let index = 0; index < stats.length; index++) {
            const x = statsX + labelWidth + index * cellWidth
            fillRounded(ctx, x + 5, y - 12, cellWidth - 10, 24, 4, 'rgba(255,255,255,0.07)')
            drawText(ctx, stats[index]?.[key] ?? 0, x + cellWidth / 2, y, { size: 13, weight: 600, align: 'center', baseline: 'middle' })
        }
    }

    const special = Array.isArray(data.spInfo) ? data.spInfo.filter(Boolean).slice(0, 3) : []
    for (let index = 0; index < special.length; index++) {
        fillRounded(ctx, 478, 169 + index * 24, 150, 20, 4, 'rgba(32,184,239,0.18)')
        drawText(ctx, special[index], 553, 179 + index * 24, { size: 9, weight: 600, align: 'center', baseline: 'middle', color: '#94e5ff', maxWidth: 140 })
    }
}

/** @param {string} points */
function parsePoints(points) {
    return cleanText(points).split(/\s+/).map(pair => pair.split(',').map(Number)).filter(pair => pair.length === 2 && pair.every(Number.isFinite))
}

/** @param {any} ctx @param {any} analysis @param {number} x @param {number} y @param {number} width @param {number} height */
function drawTagAnalysis(ctx, analysis, x, y, width, height) {
    fillRounded(ctx, x, y, width, height, 7, 'rgba(10,16,25,0.9)')
    strokeRounded(ctx, x, y, width, height, 7, 'rgba(65,200,243,0.25)')
    drawText(ctx, 'CHART PROFILE', x + 24, y + 29, { size: 10, weight: 700, color: '#41c8f3', family: DISPLAY_FONT_FAMILY })
    drawText(ctx, '谱面实力分析', x + 24, y + 57, { size: 22, weight: 700 })
    const meta = analysis
        ? `RKS >= ${finite(analysis.threshold).toFixed(1)}  |  成绩 ${finite(analysis.recordCount)}  |  选票 ${finite(analysis.totalVotes)}`
        : '暂无数据'
    drawText(ctx, meta, x + width - 24, y + 47, { size: 10, color: '#91a6b8', align: 'right', maxWidth: 300 })
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(x + 20, y + 72, width - 40, 1)

    const radar = analysis?.radar
    const radarX = x + 35
    const radarY = y + 92
    const radarWidth = Math.min(300, width * 0.44)
    const radarHeight = height - 120
    drawText(ctx, '分类汇总', radarX, radarY, { size: 13, weight: 700 })
    if (Array.isArray(radar?.categories) && radar.categories.length) {
        const scale = Math.min((radarWidth - 54) / 200, (radarHeight - 36) / 184)
        const offsetX = radarX + (radarWidth - 200 * scale) / 2
        const offsetY = radarY + 18
        ctx.save()
        ctx.translate(offsetX, offsetY)
        ctx.scale(scale, scale)
        ctx.lineWidth = 1 / scale
        for (const grid of radar.grids || []) {
            const points = parsePoints(grid)
            if (!points.length) continue
            ctx.beginPath()
            points.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py))
            ctx.closePath()
            ctx.strokeStyle = 'rgba(255,255,255,0.16)'
            ctx.stroke()
        }
        for (const axis of radar.axes || []) {
            ctx.beginPath()
            ctx.moveTo(100, 92)
            ctx.lineTo(finite(axis?.x), finite(axis?.y))
            ctx.strokeStyle = 'rgba(255,255,255,0.12)'
            ctx.stroke()
        }
        const shape = parsePoints(radar.points)
        if (shape.length) {
            ctx.beginPath()
            shape.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py))
            ctx.closePath()
            ctx.fillStyle = 'rgba(40,191,235,0.26)'
            ctx.strokeStyle = '#45d1f5'
            ctx.lineWidth = 2 / scale
            ctx.fill()
            ctx.stroke()
        }
        ctx.restore()
        for (const category of radar.categories) {
            const labelX = offsetX + finite(category.labelX) * scale
            const labelY = offsetY + finite(category.labelY) * scale
            drawText(ctx, category.name, labelX, labelY, { size: 9, weight: 600, align: category.anchor === 'end' ? 'right' : category.anchor === 'start' ? 'left' : 'center', baseline: 'middle', maxWidth: 70 })
            drawText(ctx, category.displayRks, labelX, labelY + 11, { size: 8, color: '#56d7f8', align: category.anchor === 'end' ? 'right' : category.anchor === 'start' ? 'left' : 'center', baseline: 'middle' })
        }
    }

    const listX = radarX + radarWidth + 16
    const listWidth = x + width - 24 - listX
    /** @param {string} title @param {any[]} values @param {number} startY @param {string} color */
    const drawRanking = (title, values, startY, color) => {
        drawText(ctx, title, listX, startY, { size: 13, weight: 700, color })
        const shown = Array.isArray(values) ? values.slice(0, 5) : []
        for (let index = 0; index < shown.length; index++) {
            const rowY = startY + 19 + index * 27
            fillRounded(ctx, listX, rowY, listWidth, 22, 4, 'rgba(255,255,255,0.055)')
            drawText(ctx, index + 1, listX + 13, rowY + 11, { size: 9, weight: 700, align: 'center', baseline: 'middle', color })
            drawText(ctx, shown[index]?.name || '-', listX + 28, rowY + 11, { size: 10, weight: 600, baseline: 'middle', maxWidth: listWidth - 80 })
            drawText(ctx, finite(shown[index]?.rks).toFixed(2), listX + listWidth - 10, rowY + 11, { size: 10, weight: 700, align: 'right', baseline: 'middle', color })
        }
    }
    drawRanking('擅长词条', analysis?.strong, radarY, '#67e4a5')
    drawRanking('薄弱词条', analysis?.weak, radarY + 171, '#ff8493')

    if (!analysis || analysis.insufficient) {
        fillRounded(ctx, x + 20, y + height - 42, width - 40, 24, 4, 'rgba(255,178,66,0.11)')
        drawText(ctx, '有效选票或逐标签成绩样本不足，可前往 phib19.top 参与谱面标签投票', x + width / 2, y + height - 30, { size: 10, align: 'center', baseline: 'middle', color: '#ffd184', maxWidth: width - 56 })
    }
}

/** @param {any} ctx @param {any} histogram @param {number} x @param {number} y @param {number} width @param {number} height */
function drawHistogram(ctx, histogram, x, y, width, height) {
    fillRounded(ctx, x, y, width, height, 7, 'rgba(10,16,25,0.9)')
    strokeRounded(ctx, x, y, width, height, 7, 'rgba(255,255,255,0.13)')
    drawText(ctx, 'RKS DISTRIBUTION', x + 24, y + 29, { size: 10, weight: 700, color: '#f0c85a', family: DISPLAY_FONT_FAMILY })
    drawText(ctx, '等效 RKS 直方图', x + 24, y + 57, { size: 22, weight: 700 })
    drawText(ctx, '平均 RKS', x + width - 24, y + 27, { size: 9, color: '#91a6b8', align: 'right' })
    drawText(ctx, finite(histogram?.average).toFixed(4), x + width - 24, y + 51, { size: 20, weight: 700, color: '#ffffff', align: 'right', family: DISPLAY_FONT_FAMILY })

    const plotX = x + 55
    const plotY = y + 92
    const plotWidth = width - 78
    const plotHeight = height - 145
    for (const tick of histogram?.ticks || []) {
        const tickY = plotY + plotHeight * (1 - clamp(finite(tick.position), 0, 100) / 100)
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(plotX, tickY, plotWidth, 1)
        drawText(ctx, tick.label, plotX - 8, tickY, { size: 8, color: '#8194a5', align: 'right', baseline: 'middle' })
    }
    const averageY = plotY + plotHeight * (1 - clamp(finite(histogram?.averagePosition), 0, 100) / 100)
    ctx.save()
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = '#ffd969'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(plotX, averageY)
    ctx.lineTo(plotX + plotWidth, averageY)
    ctx.stroke()
    ctx.restore()

    const slots = Array.isArray(histogram?.slots) ? histogram.slots : []
    const slotWidth = slots.length ? plotWidth / slots.length : plotWidth
    const barWidth = Math.max(3, Math.min(13, slotWidth * 0.62))
    for (let index = 0; index < slots.length; index++) {
        const slot = slots[index]
        const barHeight = plotHeight * clamp(finite(slot.height), 0, 100) / 100
        const barX = plotX + index * slotWidth + (slotWidth - barWidth) / 2
        const gradient = ctx.createLinearGradient(0, plotY + plotHeight - barHeight, 0, plotY + plotHeight)
        if (slot.kind === 'phi') {
            gradient.addColorStop(0, '#fff18a')
            gradient.addColorStop(1, '#db9f2d')
        } else {
            gradient.addColorStop(0, '#52dbf8')
            gradient.addColorStop(1, '#167fae')
        }
        fillRounded(ctx, barX, plotY + plotHeight - barHeight, barWidth, Math.max(2, barHeight), Math.min(3, barWidth / 2), gradient)
        if (slots.length <= 32 || index % 2 === 0) {
            drawText(ctx, slot.label, barX + barWidth / 2, plotY + plotHeight + 13, { size: slots.length > 20 ? 6 : 8, color: '#9aabba', align: 'center', baseline: 'middle' })
        }
    }
    drawText(ctx, `P1-P3 / B1-B27    ${finite(histogram?.count)} 个有效槽位`, x + width / 2, y + height - 22, { size: 9, color: '#9aabba', align: 'center', baseline: 'middle' })
}

/** @param {any} ctx @param {any} data @param {number} y */
function drawAnalysis(ctx, data, y) {
    drawSeparator(ctx, 'B30 数据分析', y)
    const panelY = y + 54
    const height = 430
    if (data.b30Analysis?.showTags) {
        drawTagAnalysis(ctx, data.b30Analysis.tagAnalysis, PAGE_MARGIN, panelY, 720, height)
        drawHistogram(ctx, data.b30Analysis.histogram, 780, panelY, 380, height)
    } else {
        drawHistogram(ctx, data.b30Analysis?.histogram, PAGE_MARGIN, panelY, WIDTH - PAGE_MARGIN * 2, height)
    }
    return panelY + height
}

/** @param {any} data */
function imageSources(data) {
    const sources = new Set()
    if (data.background) sources.add(String(data.background))
    const avatarPath = path.join(pluginResources, 'html', 'avatar', `${data.gameuser?.avatar || ''}.png`)
    sources.add(avatarPath)
    sources.add(path.join(pluginResources, 'html', 'otherimg', `${data.gameuser?.ChallengeMode ?? data.ChallengeMode ?? 0}.png`))
    for (const record of [...(data.phi || []), ...(data.b19_list || [])]) {
        if (!record) continue
        if (record.illustration) sources.add(recordIllustrationSource(record.illustration))
        sources.add(path.join(pluginResources, 'html', 'otherimg', `${record.Rating || 'NEW'}.png`))
    }
    return [...sources]
}

/**
 * Render the built-in default B30 theme without a browser.
 * @param {any} data
 * @param {{scale?: number, pluginName?: string, version?: string, quality?: number}} [options]
 */
export async function renderDefaultB30Canvas(data, options = {}) {
    registerFonts()
    const layout = layoutRecords(data)
    const analysisHeight = data.b30Analysis ? 514 : 0
    const footerHeight = 132
    const baseHeight = Math.max(720, layout.bottom + analysisHeight + footerHeight)
    const scale = clamp(finite(options.scale) || 1, 0.25, 2)
    const canvas = createCanvas(Math.ceil(WIDTH * scale), Math.ceil(baseHeight * scale))
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const sources = imageSources(data)
    const loaded = await Promise.all(sources.map(async source => /** @type {[string, any]} */ ([source, await getImage(source)])))
    const images = new Map(loaded)

    const background = images.get(String(data.background || ''))
    ctx.fillStyle = '#0b1119'
    ctx.fillRect(0, 0, WIDTH, baseHeight)
    if (background) {
        ctx.save()
        ctx.filter = 'blur(14px) saturate(1.08)'
        drawCover(ctx, background, -18, -18, WIDTH + 36, baseHeight + 36)
        ctx.restore()
    }
    const shade = ctx.createLinearGradient(0, 0, 0, baseHeight)
    shade.addColorStop(0, 'rgba(5,10,17,0.58)')
    shade.addColorStop(0.55, 'rgba(5,10,17,0.76)')
    shade.addColorStop(1, 'rgba(4,8,14,0.92)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, WIDTH, baseHeight)

    drawHeader(ctx, data, images)
    for (const entry of layout.entries) {
        if (entry.type === 'separator') drawSeparator(ctx, entry.label, entry.y)
        else drawRecordCard(ctx, entry, images)
    }

    let footerY = layout.bottom
    if (data.b30Analysis) footerY = drawAnalysis(ctx, data, layout.bottom + 4) + 20
    drawText(ctx, `${options.pluginName || 'Phi-Plugin'} ${options.version || ''}`, WIDTH / 2, footerY + 43, {
        size: 33,
        weight: 700,
        align: 'center',
        baseline: 'middle',
        family: DISPLAY_FONT_FAMILY,
        color: '#f6f9fc',
    })
    drawText(ctx, '非 Phigros 官方项目，与南京鸽游网络有限公司及 Phigros 官方不存在授权、合作或运营关系。', WIDTH / 2, footerY + 82, {
        size: 11,
        align: 'center',
        baseline: 'middle',
        color: '#7f92a3',
    })

    return canvas.encode('jpeg', clamp(finite(options.quality) || 90, 60, 100))
}

export default renderDefaultB30Canvas
