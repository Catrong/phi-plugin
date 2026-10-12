import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import art from '../model/render/pvisTemplate.js'
import staticText from '../model/render/staticText.js'

const resources = path.resolve(import.meta.dirname, '../resources').replace(/\\/g, '/')
const row = {
    player: 'Rebirth', song: '双重间谍 (Double Agent)', hit: false,
    cells: [
        { cls: 'charterCell', value: 'Simon_Axis、騎士Knight', state: 'diff', arrow: '' },
        { cls: 'versionCell', value: '3.19.4', sub: '2026-07-03', state: 'diff', arrow: 'down' },
        { cls: 'chapterCell', value: 'Chapter EX-节奏大师 精选集', state: 'diff', arrow: '' },
        { cls: 'originalCell', value: '非独占', state: 'same', arrow: '' },
        { cls: 'difficultyCell', value: '15.7', state: 'same', arrow: '' },
        { cls: 'bpmCell', value: '240~280', state: 'diff', arrow: 'down' },
        { cls: 'comboCell', value: '1235', state: 'near', arrow: 'up' },
    ],
}

/** @param {boolean} renderNoJs @param {boolean} [helper] */
function render(renderNoJs, helper = true) {
    return art(`${resources}/html/frib19/frib19.art`, {
        _res_path: resources + '/', defaultLayout: `${resources}/html/common/layout/default.art`,
        renderNoJs, ...(helper ? { staticText } : {}), theme: 'default', themeInfo: null,
        sys: { scale: '' }, Version: { ver: 'v1.0.3' }, _plugin: 'Phi-Plugin',
        level: 'IN', levelText: 'IN', round: 1, maxGuess: 12, rows: [row], answerRow: row,
        players: 1, nearVersion: 2, nearDifficulty: 0.3, nearBpm: 20, nearCombo: 200, cmdhead: 'phi', timeout: 300,
    })
}

test('弗一把保留完整版本、日期与属性，方向标记独立于数值文字且不参与省略', () => {
    const html = render(true)
    assert.match(html, /<p class="cellValue"[^>]*>3\.19\.4<\/p>\s*<span class="arrow">↓<\/span>/)
    assert.match(html, /<p class="cellValue"[^>]*>1235<\/p>\s*<span class="arrow">↑<\/span>/)
    assert.match(html, /<p class="cellValue"[^>]*>非独占<\/p>\s*<span class="mark">✓<\/span>/)
    assert.match(html, /class="cellSub" name="pvis">2026-07-03<\/p>/)
    assert.match(html, /class="cellValue"[^>]*>240~280<\/p>/)
    assert.ok(html.includes(row.song))
    assert.ok(html.includes(row.cells[2].value))
    for (const tag of html.matchAll(/<p class="(?:cellValue|cellSub|songName)"[^>]*>/g)) assert.doesNotMatch(tag[0], /phi-fit-line/)
    const generic = html.match(/body \[name="pvis"\] \{([^}]+)\}/)?.[1] || ''
    assert.doesNotMatch(generic, /white-space|overflow|text-overflow/)
    assert.match(html, /\.tableBox \.cellMain \{ height: auto; flex: 0 0 auto;/)
    assert.match(html, /\.tableBox \.cellSub \{ flex: 0 0 auto;/)
})

test('弗一把静态辅助模块未重载时仍完整排版，Puppeteer 保留原缩字结构', () => {
    assert.match(render(true, false), /class="cellSub" name="pvis">2026-07-03/)
    const html = render(false, false)
    assert.match(html, /function adjustFontSize/)
    assert.doesNotMatch(html, /\.tableBox \.cellMain \{ height: auto/)
    assert.match(html, /class="cellValue" name="pvis">3\.19\.4\s*<span class="arrow">↓<\/span>/)
})

test('多行字号保留显式换行与最小可读字号，短文本不额外缩小', () => {
    assert.equal(staticText.fitBox('Short', 300, 100, 20, 10), 20)
    const wrapped = staticText.fitBox('完整版本说明<br>2026-07-03 日期\n更早 / 更晚', 160, 60, 20, 10)
    assert.ok(wrapped >= 10 && wrapped < 20)
    assert.equal(staticText.fitBox('中文'.repeat(500), 80, 20, 20, 12), 12)
    assert.equal(staticText.fitBox('文字', NaN, 20, 20, 12), 12)
    assert.equal(staticText.fitBox('文字', 80, 10, 20, 12.17), 12.17)
})
