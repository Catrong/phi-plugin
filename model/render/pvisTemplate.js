import fs from 'node:fs'
import art from 'art-template'
import { processPvisHtml } from './pvis.js'
import staticText from './staticText.js'

/**
 * art 的局部 set 不会自动传回调用方。只桥接 pvis 声明，其余模板保持原样；
 * 配置存在本次渲染数据中，不污染模板缓存或其他并发请求。
 * @param {string} source
 */
export function preparePvisTemplate(source) {
    return source.replace(/\{\{\s*set\s+pvis\s*=\s*/g, '{{set pvis = $data.__phiPvis = ')
}

/** @param {string} source @param {Record<string, any>} data */
export function renderPvisSource(source, data) {
    if (!data.renderNoJs) return art.render(source, data)
    const request = { ...data, staticText: { ...staticText, ...data.staticText }, __phiPvis: undefined }
    const html = art.render(preparePvisTemplate(source), request)
    return processPvisHtml(html, request.__phiPvis, { staticText: data.staticText, themeInfo: data.themeInfo })
}

/** 独立模板预览和测试与实际 Shotium 使用同一处理路径。 */
/** @param {string} filename @param {Record<string, any>} data */
export default function renderPvisFile(filename, data) {
    return renderPvisSource(fs.readFileSync(filename, 'utf8'), data)
}

/**
 * 复用宿主的模板读取、监听和失效机制，通过请求独立的接收对象导出局部声明。
 * 缓存仍存原始 art；不改宿主模板引擎，也不覆盖 renderer.html。
 * @param {any} renderer
 * @param {string} name
 * @param {Record<string, any>} data
 * @param {(name: string, data: any) => string | false} baseDealTpl
 * @returns {string | false}
 */
export function dealPvisTemplate(renderer, name, data, baseDealTpl) {
    if (!data.renderNoJs) return baseDealTpl.call(renderer, name, data)
    const request = { ...data, staticText: { ...staticText, ...data.staticText }, __phiPvis: undefined }
    const cache = new Proxy(renderer.html, {
        get(target, key, receiver) {
            const source = Reflect.get(target, key, receiver)
            return typeof source === 'string' ? preparePvisTemplate(source) : source
        },
    })
    const receiver = new Proxy(renderer, {
        get(target, key) {
            if (key === 'html') return cache
            const value = Reflect.get(target, key, target)
            return typeof value === 'function' ? value.bind(target) : value
        },
        set: (target, key, value) => Reflect.set(target, key, value, target),
    })
    const file = baseDealTpl.call(receiver, name, request)
    if (file && request.__phiPvis !== undefined) {
        const source = fs.readFileSync(file, 'utf8')
        const processed = processPvisHtml(source, request.__phiPvis, { staticText: data.staticText, themeInfo: data.themeInfo })
        if (processed !== source) fs.writeFileSync(file, processed)
    }
    return file
}
