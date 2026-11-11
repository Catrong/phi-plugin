import assert from 'node:assert/strict'
import test from 'node:test'
import { makeCategoryWords } from '../apps/chart.js'

/** @param {string} value @returns {chartsTagString} */
function tagName(value) {
    return /** @type {chartsTagString} */ (value)
}

test('谱面标签视图保留分类、全部子标签和跨分类归属', () => {
    const shared = { name: tagName('频繁切轨'), voteCount: 7, children: [] }
    const result = makeCategoryWords([
        { name: tagName('读谱'), voteCount: 0, children: [
            { name: tagName('差速'), voteCount: 5, children: [] },
            { name: tagName('变速/闪现'), voteCount: 3, children: [] },
        ] },
        { name: tagName('拆谱'), voteCount: 0, children: [shared] },
        { name: tagName('定位'), voteCount: 0, children: [shared] },
    ])

    assert.deepEqual(result.words, [
        { name: '读谱', value: 8 },
        { name: '拆谱', value: 7 },
        { name: '定位', value: 7 },
    ])
    assert.equal(result.wordsMaxValue, 8)
    assert.deepEqual(result.tagCategories.map(category => ({
        name: category.name,
        key: category.key,
        children: category.children,
    })), [
        { name: '读谱', key: 'reading', children: [
            { name: '差速', value: 5 },
            { name: '变速/闪现', value: 3 },
        ] },
        { name: '拆谱', key: 'pattern', children: [{ name: '频繁切轨', value: 7 }] },
        { name: '定位', key: 'precision', children: [{ name: '频繁切轨', value: 7 }] },
    ])
})

test('空标签树返回可绘制的空视图', () => {
    assert.deepEqual(makeCategoryWords([]), { words: [], wordsMaxValue: 1, tagCategories: [] })
})
