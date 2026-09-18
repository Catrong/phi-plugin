import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createKoishiAdapter } from '../components/platform/koishi.js'

const { h } = createRequire(import.meta.url)('koishi')
const adapter = createKoishiAdapter({}, { h, database: false })

test('binary Koishi images use MIME data URIs without deprecated protocol warnings', () => {
    const originalWarn = h.warn
    const warnings = []
    h.warn = (/** @type {string} */ message) => warnings.push(message)
    try {
        for (const [mime, bytes] of [
            ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
            ['image/jpeg', Buffer.from([255, 216, 255, 224])],
            ['image/webp', Buffer.from('RIFF0000WEBP')],
            ['image/gif', Buffer.from('GIF89a')],
        ]) {
            const image = /** @type {any} */ (adapter.segment.image(bytes))
            assert.equal(image.attrs.src, `data:${mime};base64,${bytes.toString('base64')}`)
        }
        assert.equal(warnings.length, 0)
    } finally { h.warn = originalWarn }
})

test('typed-array slices and legacy base64 images preserve exact bytes', () => {
    const bytes = new Uint8Array([0, 255, 216, 255, 224, 0])
    const slice = bytes.subarray(1, 5)
    const expected = `data:image/jpeg;base64,${Buffer.from(slice).toString('base64')}`
    assert.equal(/** @type {any} */ (adapter.segment.image(slice)).attrs.src, expected)
    assert.equal(/** @type {any} */ (adapter.segment.image(`base64://${Buffer.from(slice).toString('base64')}`)).attrs.src, expected)
})

test('existing image URLs and data URIs remain unchanged', () => {
    for (const value of ['https://example.com/image.png', 'file:///tmp/image.png', 'data:image/png;base64,aGVsbG8=']) {
        assert.equal(/** @type {any} */ (adapter.segment.image(value)).attrs.src, value)
    }
})
