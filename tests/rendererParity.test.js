import assert from 'node:assert/strict'
import path from 'node:path'
import vm from 'node:vm'
import test from 'node:test'
import art from 'art-template'
import staticText from '../model/render/staticText.js'

const resources = path.resolve(import.meta.dirname, '../resources').replace(/\\/g, '/')
/** @param {boolean} renderNoJs @param {string} [spinfo] @param {object} [helper] */
function atlas(renderNoJs, spinfo = '', helper = staticText) {
    return art(`${resources}/html/atlas/atlas.art`, {
        _res_path: resources + '/', defaultLayout: `${resources}/html/common/layout/default.art`,
        renderNoJs, staticText: helper, theme: 'default', themeInfo: null, sys: { scale: '' },
        _plugin: 'Phi-Plugin', Version: { ver: 'test' }, illustration: 'test.png',
        song: 'Exoplanetary Mirage', composer: 'Camellia', length: '2:58', spinfo,
        chart: { IN: { charter: 'Orbital Velocity: 16.700 km/s', difficulty: 16.8, tap: 688, drag: 1044, hold: 217, flick: 106, combo: 2055, rgba: [255, 0, 0, 1] } },
        fCompute: { formatDifficulty: /** @param {number} value */ value => String(value), rgbaToGradient: () => '#ff0000' },
    })
}

test('歌曲信息卡使用原20px谱师字号和表格几何，较长说明才扩展高度', () => {
    const html = atlas(true)
    assert.match(html, /style="font-size: 20px">Orbital Velocity: 16\.700 km\/s/)
    assert.match(html, /style="font-size: 48px">Exoplanetary Mirage/)
    assert.doesNotMatch(html, /margin-top: 12px|<div class="txt expanded-info">/)
    const metadata = '版本 3.19.4\n更新日期 2026-07-03\n保留完整说明。'
    const ordinary = atlas(true, metadata)
    assert.match(ordinary, /style="font-size: 18px">版本 3\.19\.4<br>更新日期 2026-07-03/)
    assert.doesNotMatch(ordinary, /<div class="txt expanded-info">/)
    assert.match(atlas(true, metadata.repeat(30)), /<div class="txt expanded-info">/)
    assert.match(atlas(true, '', { fitLine: staticText.fitLine }), /Orbital Velocity: 16\.700 km\/s/)
})

test('真实字体缩放同时遵守宽高和整数规则，支持显式多行与可读下限', () => {
    const fit = staticText.fitPvis
    assert.equal(fit('Exoplanetary Mirage', 563, 72, 48, 18, { nowrap: true }), 48)
    assert.equal(fit('Compute It With Some Devilish Alcoholic Steampunk Engines', 563, 72, 48, 18, { nowrap: true }), 20)
    assert.equal(fit('短名', 200, 16, 23.5, 1, { nowrap: true }), 10)
    assert.equal(fit('短名', 200, 12, 10, 1, { nowrap: true }), 8)
    assert.equal(fit('版本 3.19.4<br>更新日期 2026-07-03<br>保留完整说明。', 538, 82, 20, 12), 18)
    assert.equal(fit('x'.repeat(1000), 100, 20, 20, 12, { nowrap: true }), 12)
    for (const budget of [0, -1, NaN, Infinity]) assert.equal(fit('测试', budget, 40, 20, 12), 12)
    assert.ok(fit('😀中文 Arabic العربية', 100, 100, 20, 12) >= 12)
    assert.ok(fit('自定义字体主题', 120, 40, 20, 12, { useFontMetrics: false }) >= 12)
})

test('Puppeteer 等待真实字体后恢复原字号重测，后续放宽盒子可恢复字号', async () => {
    const script = [...atlas(false).matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .find(match => match[1].includes('function adjustFontSize'))?.[1]
    assert.ok(script)
    let loaded = false
    /** @type {() => void} */
    let finishFonts = () => {}
    const fontsReady = new Promise(resolve => { finishFonts = () => resolve(undefined) })
    const parent = { offsetWidth: 100, offsetHeight: 40 }
    const node = {
        style: { fontSize: '' }, parentElement: parent,
        get scrollWidth() { return Math.round(Number.parseFloat(this.style.fontSize || '20px') * (loaded ? 4 : 10)) },
        get scrollHeight() { return Math.round(Number.parseFloat(this.style.fontSize || '20px') * 1.5) },
    }
    const listeners = new Map()
    vm.runInNewContext(script, {
        document: { getElementsByName: () => [node], fonts: { ready: fontsReady } },
        window: { addEventListener: /** @param {string} name @param {() => void} fn */ (name, fn) => listeners.set(name, fn),
            getComputedStyle: /** @param {typeof node} element */ element => ({ getPropertyValue: () => element.style.fontSize || '20px' }) },
        console: { log() {}, error() {} },
    })
    listeners.get('DOMContentLoaded')()
    assert.equal(node.style.fontSize, '10px')
    loaded = true
    finishFonts()
    await fontsReady
    await Promise.resolve()
    assert.equal(node.style.fontSize, '')
    parent.offsetWidth = 60
    listeners.get('resize')()
    assert.equal(node.style.fontSize, '15px')
    parent.offsetWidth = 100
    listeners.get('resize')()
    assert.equal(node.style.fontSize, '')
})
