import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import art from 'art-template'
import staticCharts from '../model/render/staticCharts.js'

const resources = path.resolve(import.meta.dirname, '../resources').replace(/\\/g, '/')
const lineData = [{ color: '#ff0000', data: [
    { x: 1, y: 15, xLabel: 'v1', yLabel: '15.0', visX: true, visY: true },
    { x: 2, y: 15.5, xLabel: 'v2', yLabel: '15.5', visX: true, visY: true },
] }]

/** @param {boolean} renderNoJs @param {string} [theme] */
function renderData(renderNoJs, theme = 'default') {
    return {
        renderNoJs, staticCharts, theme, themeInfo: null,
        _res_path: resources + '/',
        defaultLayout: resources + '/html/common/layout/default.art',
        sys: { scale: 'style="transform:scale(1)"' },
        Version: { ver: 'test' }, _plugin: 'phi-plugin',
        background: '', illustration: '', song: '测试曲目', length: '2:00',
        updateLable: '1.0', updateDate: '2026-10-11',
        hisData: {}, lineData: JSON.stringify(lineData),
        chartImg: 'chart.png', chartLength: '2:00', charter: '谱师', charterReal: '',
        rank: 'IN', difficulty: 15.5, tap: 10, drag: 10, hold: 10, flick: 10, combo: 40,
        distribution: [[25, 25, 25, 25, 100]], tip: '',
        words: [{ name: '多指', value: 10 }, { name: '交互', value: 8 }, { name: '纵连', value: 6 }],
        wordsMaxValue: 12,
    }
}

/** @param {string} page @param {boolean} renderNoJs @param {string} [theme] */
function render(page, renderNoJs, theme) {
    return art.render(fs.readFileSync(`${resources}/html/${page}/${page}.art`, 'utf8'), renderData(renderNoJs, theme))
}

test('静态定数图保留折线、节点和版本标签，JSON 与数组输入一致', () => {
    const result = staticCharts.difficulty(lineData)
    assert.match(result, /<polyline /)
    assert.equal((result.match(/<circle /g) || []).length, 2)
    assert.match(result, />v1<\/text>/)
    assert.match(result, />15\.5<\/text>/)
    assert.equal(result, staticCharts.difficulty(JSON.stringify(lineData)))
    assert.doesNotMatch(result, /NaN|Infinity/)
})

test('静态定数图过滤异常节点、处理单点/空数据并转义标签与颜色', () => {
    const result = staticCharts.difficulty([{ color: '" onload="alert(1)', data: [
        { x: 1, y: 15, xLabel: '<script>alert(1)</script>', visX: true },
        { x: NaN, y: Infinity },
    ] }])
    assert.equal((result.match(/<circle /g) || []).length, 1)
    assert.match(result, /&lt;script&gt;/)
    assert.doesNotMatch(result, /onload|<script>|NaN|Infinity/)
    assert.match(staticCharts.difficulty('invalid'), /暂无定数历史/)
    assert.match(staticCharts.difficulty([]), /暂无定数历史/)
})

test('密集定数图保留全部节点并把版本标签错开放置，两端标签仍可见', () => {
    const points = Array.from({ length: 24 }, (_, index) => ({
        x: index, y: 14.5 + index * 0.01, xLabel: `v${index + 1}.0.0`, yLabel: (14.5 + index * 0.01).toFixed(2), visX: true, visY: true,
    }))
    const result = staticCharts.difficulty([{ data: points }], 800, 250)
    assert.equal((result.match(/<circle /g) || []).length, points.length)
    assert.match(result, />v1\.0\.0<\/text>/)
    assert.match(result, />v24\.0\.0<\/text>/)
    const xLabels = [...result.matchAll(/class="phi-chart-axis-x" x="([^"]+)" y="([^"]+)"[^>]*font-size="([^"]+)"[^>]*>([^<]*)<\/text>/g)]
    assert.ok(new Set(xLabels.map(label => label[2])).size > 1, '版本标签应使用两行')
    assert.ok(xLabels.length < points.length, '过密标签应按空间筛选，不能全部挤在一起')
    for (const row of new Set(xLabels.map(label => label[2]))) {
        const labels = xLabels.filter(label => label[2] === row).sort((a, b) => Number(a[1]) - Number(b[1]))
        for (let index = 1; index < labels.length; index++) {
            const prev = labels[index - 1], next = labels[index]
            const required = (prev[4].length + next[4].length) * Number(prev[3]) * 0.55 / 2
            assert.ok(Number(next[1]) - Number(prev[1]) >= required, `${prev[4]} 与 ${next[4]} 重叠`)
        }
    }
    const yLabels = [...result.matchAll(/class="phi-chart-axis-y" x="[^"]+" y="([^"]+)"[^>]*font-size="([^"]+)"/g)]
        .sort((a, b) => Number(a[1]) - Number(b[1]))
    for (let index = 1; index < yLabels.length; index++) {
        assert.ok(Number(yLabels[index][1]) - Number(yLabels[index - 1][1]) >= Number(yLabels[index][2]) + 4)
    }
    assert.doesNotMatch(result, /font-size="11"/)
})

test('普通页面、定数图及空/少标签不会提前加载 ECharts', () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import { createRequire } from 'node:module';
        const require = createRequire(import.meta.url);
        const charts = (await import('./model/render/staticCharts.js')).default;
        charts.difficulty([]);
        charts.radar([]);
        charts.radar([{ name: '单标签', value: 1 }]);
        if (require.cache[require.resolve('echarts/dist/echarts.min.js')]) process.exit(1);
        charts.radar([{ name: '一', value: 1 }, { name: '二', value: 2 }, { name: '三', value: 3 }]);
        if (!require.cache[require.resolve('echarts/dist/echarts.min.js')]) process.exit(2);
    `], { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
})

test('静态标签雷达图在 Node 端生成且不包含可执行标签', () => {
    const result = staticCharts.radar([
        { name: '<script>alert(1)</script>', value: 10 },
        { name: '交互', value: 8 },
        { name: '纵连', value: 6 },
    ], 12, { showValue: true })
    assert.match(result, /<svg /)
    assert.match(result, /<path /)
    assert.match(result, /&lt;script&gt;/)
    assert.match(result, /交互\(8\)/)
    assert.doesNotMatch(result, /<script>|<foreignObject|NaN|Infinity/)
})

test('不足三个标签显示数值横条，空标签显示占位', () => {
    const result = staticCharts.radar([{ name: '多指', value: 0 }], 0)
    assert.match(result, /多指 \(0\)/)
    assert.match(result, /<rect /)
    assert.doesNotMatch(result, /NaN|Infinity/)
    assert.match(staticCharts.radar([]), /暂无谱面标签/)
})

test('长中文雷达标签折行后完整保留名称和票数，括号不会被拆开', () => {
    const words = [
        { name: '多指交互技巧', value: 10 }, { name: '复杂纵连', value: 8 },
        { name: '长条位移', value: 6 }, { name: '节奏变化', value: 4 },
        { name: '错位双押', value: 3 }, { name: '锁手与换手', value: 5 },
    ]
    const result = staticCharts.radar(words, 12, { width: 450, height: 430, fontSize: 30, showValue: true })
    const labels = [...result.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map(match => match[1]).join('')
    for (const word of words) assert.ok(labels.includes(`${word.name}(${word.value})`), `${word.name} 的文字或票数缺失`)
    assert.ok((result.match(/<text\b/g) || []).length > words.length, '长标签应分行')
    for (const match of result.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)) {
        assert.equal((match[1].match(/\(/g) || []).length, (match[1].match(/\)/g) || []).length, '票数括号应保留在同一行')
    }
})

test('雷达缓存按内容命中，数据、显示选项变化会生成新的 SVG', () => {
    const echarts = createRequire(import.meta.url)('echarts/dist/echarts.min.js')
    const init = echarts.init
    let calls = 0
    echarts.init = (/** @type {any} */ dom, /** @type {any} */ theme, /** @type {any} */ options) => { calls++; return init(dom, theme, options) }
    try {
        const words = [{ name: '缓存多指', value: 11 }, { name: '缓存交互', value: 8 }, { name: '缓存纵连', value: 6 }]
        const base = staticCharts.radar(words, 12, { width: 550, height: 400, fontSize: 22 })
        assert.equal(staticCharts.radar(JSON.parse(JSON.stringify(words)), 12, { height: 400, fontSize: 22, width: 550 }), base)
        assert.equal(calls, 1)
        words[0].value = 9
        const updated = staticCharts.radar(words, 12, { width: 550, height: 400, fontSize: 22 })
        assert.notEqual(updated, base)
        const variants = [
            staticCharts.radar(words, 20, { width: 550, height: 400, fontSize: 22 }),
            staticCharts.radar(words, 12, { width: 560, height: 400, fontSize: 22 }),
            staticCharts.radar(words, 12, { width: 550, height: 410, fontSize: 22 }),
            staticCharts.radar(words, 12, { width: 550, height: 400, fontSize: 24 }),
            staticCharts.radar(words, 12, { width: 550, height: 400, fontSize: 22, showValue: true }),
        ]
        for (const variant of variants) assert.notEqual(variant, updated)
        assert.equal(calls, 7)
    } finally { echarts.init = init }
})

test('雷达缓存淘汰旧内容，不保留超出字节上限的 SVG', () => {
    const echarts = createRequire(import.meta.url)('echarts/dist/echarts.min.js')
    const init = echarts.init
    let calls = 0
    /** @param {number} index */
    const words = index => [{ name: `淘汰${index}`, value: 2 }, { name: '二', value: 3 }, { name: '三', value: 1 }]
    echarts.init = (/** @type {any} */ dom, /** @type {any} */ theme, /** @type {any} */ options) => { calls++; return init(dom, theme, options) }
    try {
        staticCharts.radar(words(0), 8)
        for (let index = 1; index <= 64; index++) staticCharts.radar(words(index), 8)
        assert.equal(calls, 65)
        staticCharts.radar(words(64), 8)
        assert.equal(calls, 65)
        staticCharts.radar(words(0), 8)
        assert.equal(calls, 66, '超过 64 项后最旧内容应重新生成')
        echarts.init = () => ({ setOption() {}, renderToSVGString: () => '<svg >' + 'x'.repeat(128 * 1024) + '</svg>', dispose() {} })
        const large = staticCharts.radar(words(1000), 8)
        let repeated = false
        echarts.init = () => {
            repeated = true
            return { setOption() {}, renderToSVGString: () => large, dispose() {} }
        }
        staticCharts.radar(words(1000), 8)
        assert.equal(repeated, true, '过大的 SVG 应跳过缓存')
        let byteLimitedCalls = 0
        echarts.init = () => {
            byteLimitedCalls++
            return { setOption() {}, renderToSVGString: () => '<svg >' + 'x'.repeat(70 * 1024) + '</svg>', dispose() {} }
        }
        for (let index = 2000; index < 2040; index++) staticCharts.radar(words(index), 8)
        assert.equal(byteLimitedCalls, 40)
        staticCharts.radar(words(2039), 8)
        assert.equal(byteLimitedCalls, 40)
        staticCharts.radar(words(2000), 8)
        assert.equal(byteLimitedCalls, 41, '少于 64 项但总字节超过 2 MiB 时也应淘汰旧内容')
    } finally { echarts.init = init }
})

test('Shotium 模板在服务器生成图表，Puppeteer 保留原脚本', () => {
    const difficulty = render('difficultyHistory', true)
    assert.match(difficulty, /<polyline /)
    assert.doesNotMatch(difficulty, /const sampleLines|drawDifficultyChart\("difficultyChart"/)
    assert.match(render('difficultyHistory', false), /drawDifficultyChart\("difficultyChart"/)
    for (const page of ['chartInfo', 'chartImg']) {
        const html = render(page, true)
        assert.match(html, /aria-label="谱面标签雷达图"/)
        assert.match(html, /多指/)
        assert.doesNotMatch(html, /echarts\.js|echarts\.init/)
        assert.match(render(page, false), /echarts\.init/)
    }
})

test('共享布局为 Shotium 生成静态主题且不载入主题脚本', () => {
    const star = render('difficultyHistory', true, 'star')
    assert.match(star, /class="phi-static-theme phi-static-stars"/)
    assert.doesNotMatch(star, /theme\/star\/star\.js/)
    const snow = render('difficultyHistory', true, 'snow')
    assert.match(snow, /otherimg\/snow1\.png/)
    assert.equal((snow.match(/class="snow"/g) || []).length, 24)
    assert.doesNotMatch(snow, /theme\/snow\/snow\.js/)
    const text = render('difficultyHistory', true, 'topText')
    assert.match(text, /class="phi-static-theme topTextBox"/)
    assert.doesNotMatch(text, /theme\/topText\/topText\.js/)
    assert.match(render('difficultyHistory', false, 'star'), /theme\/star\/star\.js/)
})
