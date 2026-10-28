/**
 * 判断渲染结果是否为可用图片。
 *
 * `picmodle.render` 渲染失败时返回错误文案字符串（如 `渲染失败QAQ！…`），
 * 成功时返回平台图片段：Yunzai 的 CQ 码字符串、Koishi 的 h 元素，
 * 或长图分段产生的图片段数组。
 * @param {unknown} image 渲染结果
 * @returns {boolean}
 */
export function isUsableImage(image) {
    if (!image) return false
    if (Array.isArray(image)) return image.length > 0 && image.every(Boolean)
    if (typeof image === 'string') return image.startsWith('[CQ:image')
    return true
}

/**
 * 有图时只发送图片；渲染失败时返回文字兜底内容。
 * @param {unknown} image 渲染结果
 * @param {string} fallbackText 渲染失败时发送的文字
 * @returns {unknown} 可直接交给发送接口的消息内容
 */
export function pickImageOrText(image, fallbackText) {
    return isUsableImage(image) ? image : fallbackText
}
