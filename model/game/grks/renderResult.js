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
