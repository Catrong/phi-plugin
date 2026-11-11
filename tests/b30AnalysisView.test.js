import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import template from 'art-template'
import { buildB30AnalysisView } from '../model/game/b30AnalysisView.js'

/** @param {string} name @param {number} samples @param {number} weight @param {number} [ceiling] */
function tag(name, samples, weight, ceiling = 16) {
    return { name, rks: 15, ceiling, sampleCount: samples, dimensionWeight: weight,
        contributions: [{ songId: 'song.0', rank: 'IN', rks: 15, difficulty: 16 }] }
}
/** @param {ReturnType<typeof tag>[]} tags */
function response(tags) {
    return { valueUnit: 'rks', minimumTagSamples: 3, insufficient: false,
        categories: [{ name: '读谱', rks: 15, hasVotes: tags.some(t => t.sampleCount >= 3 && t.ceiling >= 14.5) }],
        tagGroups: [{ name: '读谱', tags }] }
}
const image = () => 'test.png'

test('有效词条按维度权重排序，前三项展示最高贡献谱面', () => {
    const data = response([tag('少样本', 2, 20), tag('定数不足', 10, 10, 14.49), tag('甲', 10, 5), tag('乙', 8, 8), tag('丙', 6, 6), tag('丁', 3, 3, 14.5)])
    data.tagGroups[0].tags[3].contributions.unshift({ songId: 'lower.0', rank: 'IN', rks: 14, difficulty: 15 })
    const view = buildB30AnalysisView(data, 15, id => id)
    assert.deepEqual(view.panels[0].cards.map(card => card.name), ['乙', '丙', '甲'])
    assert.equal(view.panels[0].cards[0].illustration, 'song.0')
    assert.equal(view.panels[0].cards[2].sampleCount, 10)
    const rest = view.panels[0].rows.flatMap(row => row.tags)
    assert.equal(rest.find(t => t.name === '丁')?.valid, true)
    assert.equal(rest.find(t => t.name === '少样本')?.valid, false)
    assert.equal(rest.find(t => t.name === '定数不足')?.valid, false)
})

test('无数据保留五个维度并明确显示样本不足', () => {
    const view = buildB30AnalysisView(response([]), 15, image)
    assert.equal(view.panels.length, 5)
    assert.ok(view.panels.every(panel => panel.value === '样本不足' && !panel.cards.length))
    assert.equal(view.complete, false)
})

test('拒绝旧版、异常数值和缺少谱面的有效词条', () => {
    assert.throws(() => buildB30AnalysisView(null, 15, image), /格式错误/)
    assert.throws(() => buildB30AnalysisView({ valueUnit: 'percent' }, 15, image), /第二版/)
    const broken = response([tag('坏数据', 3, 3)])
    broken.tagGroups[0].tags[0].rks = NaN
    assert.throws(() => buildB30AnalysisView(broken, 15, image), /数值无效/)
    broken.tagGroups[0].tags[0].rks = 15
    broken.tagGroups[0].tags[0].contributions = []
    assert.throws(() => buildB30AnalysisView(broken, 15, image), /缺少代表谱面/)
    assert.throws(() => buildB30AnalysisView(response([tag('坏数量', 3.5, 3)]), 15, image), /数量无效/)
})

test('词条增加时分析框扩展，行首沿斜边对齐', () => {
    const view = buildB30AnalysisView(response(Array.from({ length: 16 }, (_, i) => tag(`词条${i}`, 3, 3))), 15, image)
    const panel = view.panels[0]
    assert.ok(panel.height > 320)
    for (const row of panel.rows) {
        assert.ok(Math.abs(row.left + 9 - (panel.height - row.top) * .3 - 18) < .001)
        assert.ok(row.top + 30 < panel.height)
    }
})

test('模板编译成功，转义名称、不渲染无效数值和谱面推荐', () => {
    const analysis = buildB30AnalysisView(response([tag('<script>bad</script>', 2, 2)]), 15, image)
    const source = fs.readFileSync(new URL('../resources/html/b30Analysis/b30Analysis.art', import.meta.url), 'utf8')
    const html = template.compile(source)({ analysis, _res_path: '/resources/', sys: { scale: '' }, Date: '2026/11/11',
        gameuser: { avatar: 'avatar', PlayerId: '<img src=x>', rks: 15, ChallengeMode: 5, ChallengeModeRank: 4 } })
    assert.ok(html.includes('&#60;img src=x&#62;'))
    assert.ok(html.includes('&#60;script&#62;bad&#60;/script&#62;'))
    assert.ok(!html.includes('谱面推荐'))
    assert.ok(!html.includes('随机'))
    assert.ok(!html.includes('class="strength"'))
    assert.match(html, /invalid[^>]*>&#60;script&#62;bad&#60;\/script&#62;<\/span>/)
})
