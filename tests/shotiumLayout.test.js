import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import art from '../model/render/pvisTemplate.js'
import staticText from '../model/render/staticText.js'

const resources = path.resolve(import.meta.dirname, '../resources').replace(/\\/g, '/')
const longTitle = '这是完整的长曲名 Mixed English title with 😀 emoji and a long ending'
const composer = '这是很长的合作曲师名称 / Long Composer Name'
const song = { song: longTitle, composer, num: 1, rank: 'IN', difficulty: 15.5, rks: 15,
    illustration: 'test.png', Rating: 'phi', score: 1000000, acc: 100, suggest: '100%', suggestType: 2 }

/** @param {string} page @param {boolean} renderNoJs @param {boolean} [includeStaticText] @param {string} [title] @param {Partial<typeof staticText>} [textHelper] @param {boolean} [customFont] */
function render(page, renderNoJs, includeStaticText = true, title = longTitle, textHelper = staticText, customFont = false) {
    const entry = { ...song, song: title, composer: title === longTitle ? composer : 'Camellia' }
    return art(`${resources}/html/${page}/${page}.art`, {
        _res_path: resources + '/', defaultLayout: `${resources}/html/common/layout/default.art`,
        renderNoJs, ...(renderNoJs && includeStaticText ? { staticText: textHelper } : {}), theme: 'default', themeInfo: customFont ? { fontUrl: 'theme-font.ttf' } : null,
        sys: { scale: '' }, Version: { ver: 'test' }, _plugin: 'phi-plugin',
        gameuser: { PlayerId: title, avatar: 'Introduction', rks: 15, ChallengeMode: 1, ChallengeModeRank: 45, data: '10 MiB' },
        Date: '2026-10-11', stats: [], phi: [entry], b19_list: [entry], head_title: '长曲名列表',
        song: page === 'suggest' ? Array.from({ length: 6 }, () => [{ ...entry, suggest: 99.85 }]) : [entry],
        phisong: [{ ...entry, level: 'IN', chart: { IN: { difficulty: 15.5 } }, apCount: 4, total: 4 }],
    })
}

test('静态标题适配保留短曲名字号，长中英混合及 emoji 标题保持最小可读字号', () => {
    assert.equal(staticText.fitLine("Rrhar'il", 164, 15, 11), 15)
    const medium = staticText.fitLine('A long English song name', 164, 15, 11)
    assert.ok(medium >= 11 && medium < 15)
    for (const title of [longTitle, '中文'.repeat(80), '😀'.repeat(80), 'x'.repeat(1000)]) {
        assert.equal(staticText.fitLine(title, 164, 15, 11), 11)
    }
    assert.equal(staticText.fitLine('', 164, 15, 11), 15)
    assert.equal(staticText.fitLine('<b>Short</b>', 164, 15, 11), 15)
    assert.equal(staticText.fitLine('e\u0301', 20, 15, 11), staticText.fitLine('e', 20, 15, 11))
})

test('固定卡片兼容旧字号 helper，自定义主题字体使用估算回退', () => {
    const { fitPvis, ...legacy } = staticText
    for (const page of ['b19', 'list', 'suggest']) {
        assert.ok(render(page, true, true, "Rrhar'il", legacy).includes('1000000'))
        let calls = 0
        const custom = { ...staticText, fitPvis: (/** @type {Parameters<typeof fitPvis>} */ ...args) => {
            calls++
            assert.equal(args[5]?.useFontMetrics, false)
            return fitPvis(...args)
        } }
        assert.ok(render(page, true, true, "Rrhar'il", custom, true).includes('1000000'))
        assert.ok(calls > 0)
    }
})

test('常规短标题保留原字体行高，字号贴合 Puppeteer 的原盒子约束', () => {
    const b19 = render('b19', true, true, "Rrhar'il")
    assert.match(b19, /style="font-size: 32px"/)
    assert.match(b19, /title="Rrhar&#39;il" style="font-size: 15px"/)
    assert.match(b19, /\.num p, \.Nosignal \.client p \{ font-size: 12px; \}/)
    assert.match(render('list', true, true, "Rrhar'il"), /title="Rrhar&#39;il - Camellia" style="font-size: 8px"/)
    assert.match(render('suggest', true, true, "Rrhar'il"), /title="Rrhar&#39;il - Camellia" style="font-size: 10px"/)
    assert.match(render('b19', true, true, 'A long English song name'), /title="A long English song name" style="font-size: 14px"/)
    for (const page of ['b19', 'list', 'suggest']) {
        assert.doesNotMatch(render(page, true, true, "Rrhar'il"), /line-height: 1\.15/)
    }
})

test('静态字号只返回有限正数，异常预算和小数字号仍遵守范围', () => {
    for (const value of [undefined, null, NaN, Infinity, 0, -1]) {
        const size = staticText.fitLine(longTitle, /** @type {number} */ (value), 15, 11)
        assert.ok(Number.isFinite(size) && size >= 11 && size <= 15)
    }
    assert.equal(staticText.fitLine(longTitle, 10, 15, 11.17), 11.17)
    assert.equal(staticText.fitLine(longTitle, 10, NaN, Infinity), 15)
    assert.equal(staticText.fitLine(longTitle, 10, 15, 99), 15)
})

test('Shotium 固定卡片仅对标题显式缩放省略，编号和难度不会继承标题样式', () => {
    for (const page of ['b19', 'list', 'suggest']) {
        const html = render(page, true)
        const genericRule = html.match(/body \[name="pvis"\] \{([^}]+)\}/)?.[1]
        assert.ok(genericRule, '共享布局必须保留文字宽度边界')
        assert.doesNotMatch(genericRule, /white-space|overflow|text-overflow/, '通用字体标记不可强制单行、裁切或省略')
        assert.match(html, /body \.phi-fit-line\[name="pvis"\] \{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/)
        assert.ok(html.includes(longTitle))
        assert.match(html, /name="pvis" class="phi-fit-line" title="/)
        const constrained = [...html.matchAll(/<(?:p|span) name="pvis" class="phi-fit-line"[^>]*>(.*?)<\/(?:p|span)>/g)]
        assert.ok(constrained.length > 0)
        assert.ok(constrained.every(match => match[1].includes(longTitle)), '只有曲名、曲师和玩家名可以使用单行标题样式')
        assert.match(html, /<(?:p|span) name="pvis">(?:P1|1)<\/(?:p|span)>/)
        if (page !== 'b19') assert.match(html, /<span name="pvis">15\.5<\/span>/)
        const puppeteer = render(page, false)
        assert.doesNotMatch(puppeteer, /name="pvis" class="phi-fit-line"|staticText|text-overflow: ellipsis/)
        assert.match(puppeteer, /function adjustFontSize/)
    }
    assert.match(render('b19', true), /style="font-size: 18px"/)
    assert.match(render('b19', true), /style="font-size: 11px"/)
    assert.match(render('list', true), /style="font-size: 8px"/)
    assert.match(render('list', true), /\.song_name \[name="pvis"\] \{ font-size: 8px; \}/)
    assert.equal((render('suggest', true).match(/name="pvis" class="phi-fit-line" title="/g) || []).length, 7)
    assert.match(render('suggest', true), /style="font-size: 9px"/)
    assert.doesNotMatch(render('suggest', true), /line-height: 1\.15/)
})

test('模板未传文字辅助模块时仍保留完整标题和有效的单行字号', () => {
    for (const page of ['b19', 'list', 'suggest']) {
        const html = render(page, true, false)
        assert.match(html, /body \.phi-fit-line\[name="pvis"\] \{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/)
        assert.match(html, /name="pvis" class="phi-fit-line"/)
        assert.ok(html.includes('1000000'))
        const titles = /name="pvis" class="phi-fit-line" title="[^"]+" style="font-size: ([\d.]+)px"/g
        const sizes = [...html.matchAll(titles)].map(match => Number(match[1]))
        assert.ok(sizes.length > 0 && sizes.every(size => Number.isFinite(size) && size > 0))
        assert.deepEqual(sizes, [...render(page, true).matchAll(titles)].map(match => Number(match[1])))
    }
})
