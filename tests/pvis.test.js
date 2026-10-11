import assert from 'node:assert/strict'
import test from 'node:test'
import { DomUtils, parseDocument } from 'htmlparser2'
import processPvisHtml from '../model/render/pvis.js'
import staticText from '../model/render/staticText.js'

/** @param {string} html */
function markedElements(html) {
    return DomUtils.findAll(element => element.attribs.name === 'pvis', parseDocument(html).children)
}

/** @param {string} html */
function fontSizes(html) {
    return markedElements(html).map(element => [...(element.attribs.style || '').matchAll(/font-size:\s*([\d.]+)px/g)].at(-1)?.[1])
}

test('简单默认数组适配所有标记，其他 HTML 和正文原文保持不变', () => {
    const html = '<!DOCTYPE html>\n<!--原注释--><main><p name="pvis">Short</p>\n<span name=pvis>这是比较长的文本</span><p>未标记</p></main>'
    const output = processPvisHtml(html, [120, 40, 30, 10, 1.2])
    const [first, second] = fontSizes(output)
    assert.equal(Number(first), staticText.fitBox('Short', 120, 40, 30, 10, 1.2, { plainText: true }))
    assert.equal(Number(second), staticText.fitBox('这是比较长的文本', 120, 40, 30, 10, 1.2, { plainText: true }))
    assert.equal(output.replace(/ style="font-size: [\d.]+px"/g, ''), html)
})

test('区域选择器使用真正的 CSS 匹配，支持自身、祖先、组合、属性和兄弟选择器', () => {
    const html = `<main id="page"><section class="region" data-mode="special"><h2>标题</h2>
        <p name="pvis" class="focus">曲名</p><aside><span name="pvis">曲师</span></aside>
        </section><p name="pvis">其他区域</p></main>`
    const output = processPvisHtml(html, {
        default: [200, 100, 20, 20, 1],
        '#page > section.region[data-mode="special"]': [200, 100, 18, 18, 1],
        'h2 + p.focus[name="pvis"]': [200, 100, 16, 16, 1],
        '.region aside > span': [200, 100, 14, 14, 1],
    })
    assert.deepEqual(fontSizes(output), ['16', '14', '20'])
})

test('后匹配规则完整覆盖，包括 false 跳过与后续重新启用', () => {
    const html = '<div class="region"><p name="pvis">A</p><p name="pvis" class="enabled">B</p></div><p name="pvis">C</p>'
    const config = Object.freeze({
        default: Object.freeze([100, 100, 20, 20, 1]),
        '.region': false,
        '.enabled': Object.freeze([100, 100, 12, 12, 1]),
    })
    const output = processPvisHtml(html, config)
    assert.deepEqual(fontSizes(output), [undefined, '12', '20'])
    assert.ok(output.includes('<p name="pvis">A</p>'))
    assert.deepEqual(config.default, [100, 100, 20, 20, 1])
})

test('默认 false 允许只适配特殊区域，未匹配元素保持原字号', () => {
    const html = '<p name="pvis" style="font-size: 17px">原字号</p><div class="special"><p name="pvis">特例</p></div>'
    const output = processPvisHtml(html, { default: false, '.special': [100, 100, 13, 13] })
    assert.deepEqual(fontSizes(output), ['17', '13'])
    assert.ok(output.startsWith('<p name="pvis" style="font-size: 17px">原字号</p>'))
})

test('实体只解码一次，br 和嵌套标签参与测量，原始 HTML 正文完整保留', () => {
    const content = 'A&amp;B &#x1F600;<br/>第二行<b>加粗</b> &lt;b&gt;字面标签&lt;/b&gt; &amp;lt; &#160;<script>invisible</script>'
    const html = `<p name="pvis">${content}</p>`
    /** @type {Parameters<typeof staticText.fitBox>[]} */
    const calls = []
    const output = processPvisHtml(html, [140, 80, 20, 10, 1.1], {
        staticText: { fitBox: (...args) => { calls.push(args); return 12.3 } },
    })
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'A&B 😀\n第二行加粗 <b>字面标签</b> &lt; \u00a0')
    assert.deepEqual(calls[0].slice(1), [140, 80, 20, 10, 1.1, { plainText: true }])
    assert.ok(output.endsWith(`${content}</p>`))
    assert.deepEqual(fontSizes(output), ['12.3'])
})

test('显式方法选项沿用各自算法，并为自定义字体选择度量回退', () => {
    const html = '<p name="pvis">Mixed 标题</p>'
    /** @type {Parameters<typeof staticText.fitPvis>[]} */
    const pvisCalls = []
    const output = processPvisHtml(html, [100, 50, 25, 10, 1.15, { method: 'pvis', nowrap: true, breakWords: true }], {
        themeInfo: { fontUrl: 'custom.ttf' },
        staticText: { fitPvis: (...args) => { pvisCalls.push(args); return 13 } },
    })
    assert.deepEqual(fontSizes(output), ['13'])
    assert.deepEqual(pvisCalls[0], ['Mixed 标题', 100, 50, 25, 10, {
        useFontMetrics: false, nowrap: true, breakWords: true, lineHeight: 1.15, plainText: true,
    }])
    const explicit = processPvisHtml(html, [100, 50, 25, 10, null, { method: 'pvis', useFontMetrics: true }], {
        themeInfo: { fontUrl: 'custom.ttf' },
        staticText: { fitPvis: (...args) => { assert.equal(args[5]?.useFontMetrics, true); assert.equal(args[5]?.lineHeight, undefined); return 15 } },
    })
    assert.deepEqual(fontSizes(explicit), ['15'])
    const line = processPvisHtml(html, [100, 50, 25, 10, null, { method: 'line' }], {
        staticText: { fitLine: (...args) => { assert.deepEqual(args, ['Mixed 标题', 100, 25, 10, { plainText: true }]); return 14.2 } },
    })
    assert.deepEqual(fontSizes(line), ['14.2'])
})

test('默认和缺失 helper 方法使用当前实现，输出与原字号算法一致', () => {
    const text = 'Mixed 中文😀 song title'
    const html = `<p name="pvis">${text}</p>`
    const { fitPvis, ...legacy } = staticText
    const tuples = /** @type {import('../model/render/pvis.js').PvisTuple[]} */ ([
        [110, 45, 22, 9, 1.1],
        [110, 45, 22, 9, null, { method: 'pvis', nowrap: true }],
        [110, 45, 22, 9, null, { method: 'line' }],
    ])
    const expected = [
        staticText.fitBox(text, 110, 45, 22, 9, 1.1),
        staticText.fitPvis(text, 110, 45, 22, 9, { nowrap: true }),
        staticText.fitLine(text, 110, 22, 9),
    ]
    for (let index = 0; index < tuples.length; index++) {
        assert.equal(Number(fontSizes(processPvisHtml(html, tuples[index]))[0]), expected[index])
        assert.equal(Number(fontSizes(processPvisHtml(html, tuples[index], { staticText: legacy }))[0]), expected[index])
    }
    assert.equal(Number(fontSizes(processPvisHtml(html, tuples[1], { staticText: { fitPvis: undefined } }))[0]), expected[1])
})

test('引号、无引号及空 style 正确注入，属性中的大于号不会截断开标签', () => {
    const html = `<p data-x="a > b" NAME='pvis' STYLE='color:red; background:url("data:x;y");'>甲</p>
        <p name=pvis style=color:blue>乙</p><p name="pvis" style>丙</p><span name=pvis style="">丁</span>`
    const output = processPvisHtml(html, [100, 100, 14, 14])
    assert.deepEqual(fontSizes(output), ['14', '14', '14', '14'])
    assert.ok(output.includes(`data-x="a > b" NAME='pvis' STYLE='color:red; background:url("data:x;y"); font-size: 14px'`))
    assert.ok(output.includes('style="color:blue; font-size: 14px"'))
    assert.equal(markedElements(output)[0].attribs['data-x'], 'a > b')
    assert.ok(output.includes('>丙</p>'))
})

test('已有 font-size 和 important 由新的字号覆盖，其他 style 原样保留', () => {
    const html = '<p name="pvis" style="color:red; font-size:30px!important; --label:\'font-size: 1px!important;\';">测试</p>'
    const output = processPvisHtml(html, [100, 100, 16, 16])
    assert.ok(output.includes('color:red; font-size:30px!important; --label:\'font-size: 1px!important;\'; font-size: 16px !important'))
    const quotedOnly = processPvisHtml('<p name=pvis style="--label:\'font-size: 1px!important;\'; color:red">测试</p>', [100, 100, 16, 16])
    assert.ok(quotedOnly.includes('font-size: 16px"'))
    assert.ok(!quotedOnly.includes('font-size: 16px !important'))
})

test('重要的 font 简写也保留字号优先级，普通简写和字符串不会误触发', () => {
    const html = '<p name="pvis" style="font: italic bold 40px/1.2 Arial!important; color:red">测试</p>'
    const output = processPvisHtml(html, [100, 100, 16, 16])
    assert.ok(output.includes('font: italic bold 40px/1.2 Arial!important; color:red; font-size: 16px !important'))
    const ordinary = processPvisHtml('<p name=pvis style="font: 40px Arial; --label:\'font: 1px Arial!important;\'">测试</p>', [100, 100, 16, 16])
    assert.ok(ordinary.includes('font-size: 16px"'))
    assert.ok(!ordinary.includes('font-size: 16px !important'))
})

test('第六项 null 使用默认多行算法，默认与选择器规则都可正常渲染', () => {
    const html = '<p name=pvis>中文 Mixed song title</p>'
    const defaults = processPvisHtml(html, [100, 45, 22, 10])
    assert.equal(processPvisHtml(html, [100, 45, 22, 10, null, null]), defaults)
    assert.equal(processPvisHtml(html, { default: false, '[name="pvis"]': [100, 45, 22, 10, null, null] }), defaults)
    assert.equal(Number(fontSizes(defaults)[0]), staticText.fitBox('中文 Mixed song title', 100, 45, 22, 10))
})

test('各次和并发调用独立使用配置，嵌套的多个标记不会使 offset 互相干扰', async () => {
    const html = '<div name="pvis">外层<span name="pvis">内层</span></div>'
    const outputs = await Promise.all([12, 18, 24].map(size => Promise.resolve().then(() => processPvisHtml(html, [200, 100, size, size]))))
    assert.deepEqual(outputs.map(fontSizes), [['12', '12'], ['18', '18'], ['24', '24']])
    assert.equal(html, '<div name="pvis">外层<span name="pvis">内层</span></div>')
})

test('无标记、无有效配置、跳过配置和非法选择器均安全保留 HTML', () => {
    const html = '<p name="pvis">原文</p><!-- name=pvis -->'
    for (const config of [undefined, null, false, {}, [], [0, 10, 20, 10], [100, 100, 20, 10, 'invalid'], { default: false }, { '[invalid': [100, 100, 20, 10] }]) {
        assert.equal(processPvisHtml(html, config), html)
    }
    const unmarked = '<script>const x = \'<p name="pvis">\'</script><p>内容</p>'
    assert.equal(processPvisHtml(unmarked, [100, 100, 20, 10]), unmarked)
    assert.deepEqual(fontSizes(processPvisHtml(html, { default: [100, 100, 20, 10], '[invalid': [100, 100, 12, 12] })), ['20'])
})

test('helper 异常字号不写入样式，空文字保留最大字号', () => {
    const html = '<p name=pvis></p>'
    assert.deepEqual(fontSizes(processPvisHtml(html, [100, 100, 20, 10])), ['20'])
    for (const invalid of [NaN, Infinity, 0, -1]) {
        assert.equal(processPvisHtml(html, [100, 100, 20, 10], { staticText: { fitBox: () => invalid } }), html)
    }
})
