import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import art from '../model/render/pvisTemplate.js'
import staticText from '../model/render/staticText.js'

const resources = path.resolve(import.meta.dirname, '../resources').replace(/\\/g, '/')
const longTitle = 'Compute It With Some Devilish Alcoholic Steampunk Engines'
const player = '这是很长的玩家名字 Very Long Player ID 测试'
const date = '2026-10-11 15:32:46'
const sampleSong = {
    song: longTitle, num: 1, illustration: 'test.png', rank: 'IN', difficulty: 15.6,
    rks: 15.4, score: 1000000, acc: 100, Rating: 'phi', suggest: '100.00%', suggestType: 2,
    tap: 234, drag: 156, hold: 156, flick: 89, combo: 635,
}

/** @param {string} page @param {boolean} renderNoJs @param {boolean} [helper] */
function render(page, renderNoJs, helper = true) {
    return art(`${resources}/html/${page}.art`, {
        _res_path: `${resources}/`, _imgPath: `${resources}/html/otherimg/`,
        defaultLayout: `${resources}/html/common/layout/default.art`, renderNoJs,
        ...(helper ? { staticText } : {}), theme: 'default', themeInfo: null,
        sys: { scale: '' }, Version: { ver: 'v1.0.3' }, _plugin: 'Phi-Plugin', Date: date,
        gameuser: { PlayerId: player, avatar: 'Introduction', rks: 15.4, ChallengeMode: 1, ChallengeModeRank: 45, data: '1024 MiB', date },
        phi: [sampleSong], b19_list: [sampleSong], songs: [sampleSong], tot_clg: 45, stats: [],
        fCompute: { std_score: (/** @type {number} */ value) => String(value) },
        title: { version: '3.19.4', difficulty: 15.6, total: 1 }, table: [], rows: [{ date, color: 'skyblue', songs: [] }],
        songName: longTitle, PlayerId: player, avatar: 'Introduction', Rks: 15.4, CLGMOD: '获取挑战模式金色评级',
        ChallengeMode: 1, ChallengeModeRank: 45, scoreData: { IN: sampleSong }, history: [],
        ranklist: { selected: 'IN', userRank: 1, totDataNum: 1, users: [{ index: 1, gameuser: { PlayerId: player, avatar: 'Introduction', rankingScore: 15.4, ChallengeMode: 1, ChallengeModeRank: 45 }, record: { ...sampleSong, updated_at: date } }] },
    })
}

test('其他固定曲名栏按盒子调整字号，保留完整长标题且允许多行', () => {
    for (const page of ['arcgrosB19/arcgrosB19', 'clg/clg', 'b19/dss2', 'b19/b19666']) {
        const html = render(page, true)
        const title = html.match(new RegExp(`<p name="pvis" style="font-size: ([\\d.]+)px">${longTitle}</p>`))
        assert.ok(title, page)
        const size = Number(title[1])
        assert.ok(Number.isFinite(size) && size > 0, page)
        assert.match(html, /white-space: normal; overflow-wrap: anywhere; line-height: 1\.1/)
        assert.doesNotMatch(title[0], /phi-fit-line|ellipsis/)
        if (page !== 'clg/clg') assert.ok(html.includes(player))
    }
})

test('成绩页的曲名、玩家名和挑战描述分别缩字，数值和完整日期不进入省略分支', () => {
    for (const page of ['score/score', 'score/scoreRankList']) {
        const html = render(page, true)
        assert.ok(html.includes(longTitle))
        assert.ok(html.includes(player))
        assert.ok(html.includes('获取挑战模式金色评级'))
        assert.ok(html.includes(date))
        assert.match(html, /body \.song_Id \{ min-height: 64px; \}/)
        const entries = [...html.matchAll(/<p name="pvis"[^>]*>/g)]
        assert.equal(entries.length, 4)
        for (const entry of entries) {
            assert.match(entry[0], /style="font-size: [\d.]+px"/)
            assert.doesNotMatch(entry[0], /phi-fit-line|ellipsis/)
        }
    }
})

test('定数表和历史头栏保留玩家完整名，历史日期留出画布空间', () => {
    for (const page of ['table/table', 'historyB30/historyB30']) {
        const html = render(page, true)
        assert.match(html, /<p name="pvis" style="font-size: [\d.]+px">/)
        assert.ok(html.includes(player))
        assert.ok(html.includes(date))
    }
    const history = render('historyB30/historyB30', true)
    assert.match(history, /body \.title \{ padding-top: 26px; margin-bottom: 34px; \}/)
    assert.match(history, /width: 600px; max-width: 100%/)
})

test('其他页面的静态字号规则只在 Shotium 分支生效，旧 helper 缺失仍能热更新出图', () => {
    for (const page of ['arcgrosB19/arcgrosB19', 'clg/clg', 'b19/dss2', 'b19/b19666', 'table/table', 'historyB30/historyB30', 'score/score', 'score/scoreRankList']) {
        const puppet = render(page, false)
        assert.doesNotMatch(puppet, /overflow-wrap: anywhere|<p name="pvis"(?: class="weight-font")? style="font-size:/)
        assert.match(puppet, /function adjustFontSize/)
        const fallback = render(page, true, false)
        assert.ok(fallback.includes(page === 'clg/clg' ? longTitle : player))
        assert.doesNotMatch(fallback, /NaNpx|Infinitypx|undefinedpx/)
        assert.match(fallback, /style="font-size: [\d.]+px"/)
    }
})
