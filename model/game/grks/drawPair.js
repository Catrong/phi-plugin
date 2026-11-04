/**
 * @template T
 * @param {string[]} tokens
 * @param {string} redToken
 * @param {string} blueToken
 * @param {(token: string) => Promise<T | null>} load
 * @returns {Promise<[T, T] | null>}
 */
export async function drawPair(tokens, redToken, blueToken, load) {
    if (!redToken || !blueToken) throw new Error('无法识别参赛者存档')
    const candidates = [...new Set(tokens)]
    /** @type {{token: string, answer: T} | null} */
    let first = null
    while (candidates.length) {
        const index = Math.floor(Math.random() * candidates.length)
        const token = candidates[index]
        candidates[index] = candidates[candidates.length - 1]
        candidates.pop()
        if (token === redToken && token === blueToken) continue
        const answer = await load(token)
        if (answer === null) continue
        if (!first) {
            first = { token, answer }
            continue
        }
        if (first.token !== blueToken && token !== redToken) return [first.answer, answer]
        if (token !== blueToken && first.token !== redToken) return [answer, first.answer]
    }
    return null
}
