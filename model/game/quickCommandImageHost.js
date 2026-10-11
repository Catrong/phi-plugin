import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { Config, logger } from '../../components/index.js'
import { pluginRoot } from '../filesystem/path.js'

let cachedScript = ''
/** @type {((data: Buffer, options: {filename:string,mimeType:string}) => unknown) | null} */
let cachedUpload = null

/** @param {unknown} value */
function asUploadFunction(value) {
    if (typeof value === 'function') return value
    if (value && typeof value === 'object') {
        const module = /** @type {any} */ (value)
        if (typeof module.default === 'function') return module.default
        if (typeof module.upload === 'function') return module.upload
    }
    return null
}

/** @param {string} script */
async function loadUploadFunction(script) {
    const resolved = path.isAbsolute(script) ? script : path.resolve(pluginRoot, script)
    if (resolved === cachedScript && cachedUpload) return cachedUpload
    const loaded = await import(`${pathToFileURL(resolved).href}?v=${Date.now()}`)
    const upload = asUploadFunction(loaded)
    if (!upload) throw new TypeError('图床脚本必须导出 upload 函数或 default 函数')
    cachedScript = resolved
    cachedUpload = upload
    return upload
}

/** @param {unknown} data */
async function toBuffer(data) {
    if (Buffer.isBuffer(data)) return data
    if (data instanceof Uint8Array) return Buffer.from(data)
    if (typeof data !== 'string') return null
    if (/^base64:\/\//i.test(data)) return Buffer.from(data.slice(9), 'base64')
    if (/^https?:\/\//i.test(data)) return null
    try {
        return await fs.readFile(/^file:\/\//i.test(data) ? new URL(data) : data)
    } catch {
        return null
    }
}

/** @param {Buffer} buffer */
function detectMime(buffer) {
    if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
    if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg'
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
    return 'image/png'
}

/** @param {Buffer} buffer @returns {{width:number,height:number}|undefined} */
export function detectImageDimensions(buffer) {
    if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
    }
    if (buffer.length >= 30 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
        const chunk = buffer.subarray(12, 16).toString('ascii')
        if (chunk === 'VP8X' && buffer.length >= 30) {
            return {
                width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
                height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16),
            }
        }
    }
    if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
        let offset = 2
        while (offset + 9 < buffer.length) {
            if (buffer[offset] !== 0xff) { offset++; continue }
            const marker = buffer[offset + 1]
            offset += 2
            if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue
            if (offset + 2 > buffer.length) break
            const length = buffer.readUInt16BE(offset)
            if (length < 2 || offset + length > buffer.length) break
            const isSof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
                || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)
            if (isSof && offset + 7 < buffer.length) {
                return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) }
            }
            offset += length
        }
    }
    return undefined
}

/**
 * 尝试从快捷指令图片源读取实际尺寸。仅读取本地 Buffer、base64 或文件路径，
 * 不会为了测尺寸额外下载远程图片。
 * @param {unknown} data
 * @returns {Promise<{width:number,height:number}|undefined>}
 */
export async function readImageDimensions(data) {
    const buffer = await toBuffer(data)
    return buffer?.length ? detectImageDimensions(buffer) : undefined
}

/**
 * 使用 phi-plugin 配置的图床脚本上传图片。
 * 脚本签名：upload(data: Buffer, { filename, mimeType }) => string | { url, width?, height? }
 * @param {unknown} data
 * @param {{filename?:string,mimeType?:string}} [options]
 */
export async function uploadQuickCommandImage(data, options = {}) {
    const script = String(Config.getUserCfg('config', 'QuickCommandImageHostScript') || '').trim()
    if (!script) return null
    const buffer = await toBuffer(data)
    if (!buffer?.length) return null
    const timeoutValue = Number(Config.getUserCfg('config', 'QuickCommandImageHostTimeout'))
    const timeout = Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : 10000
    /** @type {NodeJS.Timeout | undefined} */
    let timer
    try {
        const upload = await loadUploadFunction(script)
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`图床上传超时（${timeout}ms）`)), timeout)
            timer.unref?.()
        })
        const mimeType = options.mimeType || detectMime(buffer)
        const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png'
        const filename = options.filename || `phi-quick-command-${randomUUID()}.${extension}`
        const result = await Promise.race([
            Promise.resolve(upload(buffer, {
                filename,
                mimeType,
            })),
            timeoutPromise,
        ])
        const value = typeof result === 'string' ? { url: result } : result
        const url = typeof value?.url === 'string' ? value.url.trim() : ''
        if (!url || !/^https?:\/\//i.test(url)) {
            throw new TypeError('图床脚本必须返回 http(s) 图片地址')
        }
        const dimensions = detectImageDimensions(buffer)
        return {
            url,
            width: Number.isFinite(Number(value.width)) ? Number(value.width) : dimensions?.width,
            height: Number.isFinite(Number(value.height)) ? Number(value.height) : dimensions?.height,
        }
    } catch (error) {
        logger.warn('[phi-plugin] 快捷指令图床上传失败', error)
        return null
    } finally {
        if (timer) clearTimeout(timer)
    }
}
