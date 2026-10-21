import assert from 'node:assert/strict'
import test from 'node:test'
import send from '../model/render/send.js'
import picmodle from '../model/render/picmodle.js'
import {
    applySoloHint,
    buildPuzzle,
    createSoloState,
    formatHintText,
} from '../model/game/grks/hints.js'
import { isUsableImage, pickImageOrText } from '../model/game/grks/renderResult.js'
import { sendHintImage } from '../apps/grks/solo.js'

/**
 * 构造一条 B30 成绩。
 * @param {string} id
 * @param {number} rks
 * @returns {any}
 */
function record(id, rks) {
    return {
        id,
        song: `Song ${id}`,
        rank: 'IN',
        difficulty: 15,
        score: 995000,
        acc: 99.1,
        rks,
        illustration: `ill-${id}.png`,
        fc: false,
    }
}

/**
 * 构造 PHP 的 B30 数据（P3 + B27）。
 * @returns {{phi: any[], b19_list: any[]}}
 */
function makeB30() {
    return {
        phi: Array.from({ length: 3 }, (_, index) => record(`p${index}`, 16 - index * 0.1)),
        b19_list: Array.from({ length: 27 }, (_, index) => record(`b${index}`, 15.5 - index * 0.01)),
    }
}

test('recognizes rendered images from every platform shape', () => {
    // Yunzai 的 CQ 码字符串、Koishi 的元素对象、长图分段数组都算渲染成功
    assert.equal(isUsableImage('[CQ:image,file=base64://abc]'), true)
    assert.equal(isUsableImage({ type: 'image', data: 'x' }), true)
    assert.equal(isUsableImage([{ type: 'image' }, '[CQ:image,file=x]']), true)
    // 渲染器失败时返回错误文案字符串，或调用方 catch 后保持 null
    assert.equal(isUsableImage('渲染失败QAQ！\nError: boom'), false)
    assert.equal(isUsableImage('图片生成请求较多，请稍后重试QAQ！'), false)
    assert.equal(isUsableImage(null), false)
    assert.equal(isUsableImage(undefined), false)
    assert.equal(isUsableImage([]), false)
    assert.equal(isUsableImage([null]), false)

    assert.equal(pickImageOrText('[CQ:image,file=x]', '文字'), '[CQ:image,file=x]')
    assert.equal(pickImageOrText('渲染失败QAQ！', '文字'), '文字')
})

test('sends only the image on success and the text fallback on failure', async () => {
    const puzzle = buildPuzzle({
        b30: makeB30(),
        stats: [],
        challengeModeRank: undefined,
        sourceToken: 'token',
    })
    const { state, hint } = applySoloHint(createSoloState('token'), puzzle, {
        PositionHintAt: 5,
        HintRevealNum: 2,
        StatsHint: 'auto',
    })
    const fallbackText = formatHintText({
        puzzle,
        hint,
        revealedSlots: state.revealedSlots,
        positionRevealed: state.positionRevealed,
    })
    const event = /** @type {any} */ ({ isGroup: false, user_id: 'user-1' })
    /** 渲染器返回值，测试内改写以模拟成功/失败 */
    let rendered = /** @type {any} */ ({ type: 'image', data: 'ok' })
    /** @type {any[]} */
    const sent = []
    test.mock.method(send, 'send_with_At', async (/** @type {any} */ _e, /** @type {any} */ msg) => {
        sent.push(msg)
        return true
    })
    test.mock.method(picmodle, 'grks', async () => rendered)

    await sendHintImage(event, { puzzle, state, hint, footnote: '第 1 条提示' })
    assert.deepEqual(sent, [{ type: 'image', data: 'ok' }])

    rendered = '[CQ:image,file=base64://abc]'
    await sendHintImage(event, { puzzle, state, hint, footnote: '第 1 条提示' })
    assert.deepEqual(sent.at(-1), '[CQ:image,file=base64://abc]')

    // 渲染器返回错误文案：只发文字兜底，不再附带错误提示
    rendered = '渲染失败QAQ！\nError: boom'
    await sendHintImage(event, { puzzle, state, hint, footnote: '第 1 条提示' })
    assert.equal(sent.at(-1), fallbackText)
    assert.ok(!String(sent.at(-1)).includes('渲染失败QAQ'))
})
