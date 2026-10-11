import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import art from '../model/render/pvisTemplate.js'
import staticText from '../model/render/staticText.js'

const resources = path.resolve(import.meta.dirname, '../resources').replace(/\\/g, '/')
const mixed = '完整玩家名 Mixed English 中文 😀 '
const longName = mixed.repeat(24)
const longIntro = '第一行保留版本 3.19.4\n第二行 ' + mixed.repeat(40)
const song = { illustration: 'song.png', rank: 'IN', difficulty: 15.6, Rating: 'phi' }

function fixture() {
    return {
        Title: 'RankingScore排行榜', totDataNum: 30, BotNick: '测试机器人',
        users: [
            { playerId: longName, index: 1, me: true, backgroundurl: 'mine.png', avatar: 'Introduction',
                rks: 15.5, ChallengeMode: 1, ChallengeModeRank: 45 },
            { playerId: longName, index: 2, me: false, backgroundurl: 'other.png', avatar: 'Introduction',
                rks: 15.2, ChallengeMode: 2, ChallengeModeRank: 46 },
            { playerId: '无效用户', index: 3 },
        ],
        me: { playerId: '<b>' + longName + '</b>', avatar: 'Introduction', backgroundurl: 'mine.png',
            rks: 15.5, ChallengeMode: 1, ChallengeModeRank: 45, data: '1024 MiB', selfIntro: longIntro,
            created: '2026-07-03', updated: '2026-10-12', rks_history: [[0, 0, 100, 100]],
            rks_range: [14.5, 15.5], rks_date: ['2026-07-03', '2026-10-12'],
            clg_list: [{ ChallengeMode: 1, ChallengeModeRank: 45, date: '2026-10-12' }],
            b30list: { P3: { title: 'Perfect 3', list: [song, null] }, B3: { title: 'Best 3', list: [] },
                F3: { title: 'Floor 3', list: [] }, L3: { title: 'Overflow 3', list: [] } },
        },
    }
}

/** @param {boolean} renderNoJs @param {Record<string, any>} [data] */
function render(renderNoJs, data = fixture()) {
    return art(`${resources}/html/rankingList/rankingList.art`, {
        Math, _res_path: resources + '/', defaultLayout: `${resources}/html/common/layout/default.art`,
        theme: 'default', themeInfo: null, sys: { scale: '' }, Version: { ver: 'test' },
        _plugin: 'Phi-Plugin', staticText, renderNoJs, ...data,
    })
}

/** @param {string} html @param {string} className */
function regions(html, className) {
    return [...html.matchAll(new RegExp(`<div class="${className}">([\\s\\S]*?)</div>`, 'g'))]
        .map(match => match[1])
}

/** @param {string} region */
function markedTag(region) {
    const tag = [...region.matchAll(/<[^/][^>]*>/g)].map(match => match[0])
        .find(value => /\bname="pvis"/.test(value))
    assert.ok(tag, '姓名或简介必须保留自适应标记')
    return tag
}

/** @param {string} region @param {number} min @param {number} max */
function fontSize(region, min, max) {
    const match = markedTag(region).match(/font-size:\s*([\d.]+)px/)
    assert.ok(match, 'Shotium 必须为文字填入字号')
    const size = Number(match[1])
    assert.ok(Number.isFinite(size) && size >= min && size <= max, `字号 ${size} 应在 ${min} 至 ${max} 之间`)
    return size
}

/** @param {string} html */
function assertDocument(html) {
    assert.equal((html.match(/<body\b/g) || []).length, 1)
    assert.equal((html.match(/<\/body>/g) || []).length, 1)
    assert.doesNotMatch(html, /<<<<<<<|=======|>>>>>>>|<\/?content\b|<parameter\b/)
    assert.match(html.trimEnd(), /<\/html>$/)
}

test('新版排行榜加载真实的共享与页面样式，输出独立且完整的文档', () => {
    const html = render(true)
    assertDocument(html)
    const styles = [...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"/g)].map(match => match[1])
    const expected = ['userinfo/userinfo.css', 'score/score.css', 'rankingList/RankList.css']
        .map(file => `${resources}/html/${file}`)
    const indexes = expected.map(file => styles.indexOf(file))
    assert.ok(indexes.every(index => index >= 0), '三个布局区域必须加载对应样式')
    assert.ok(indexes[0] < indexes[1] && indexes[1] < indexes[2], '排行榜样式应最后覆盖共享布局')
    for (const file of expected) assert.ok(fs.existsSync(file), `样式文件应真实存在：${file}`)
    assert.ok(html.includes('Perfect 3') && html.includes('Floor 3') && html.includes('Overflow 3'))
    assert.ok(html.includes('2026-07-03') && html.includes('2026-10-12') && html.includes('1024 MiB'))
    assert.match(html, /<line\b[^>]*x1="0%"[^>]*x2="100%"/)
    assert.doesNotMatch(html, /function adjustFontSize/)
})

test('Shotium 分别适配玩家名、完整多行简介与排行榜名字，长文字按可读下限缩字', () => {
    const html = render(true)
    const short = fixture()
    short.me.playerId = '短名'
    short.me.selfIntro = '简短介绍'
    short.users[0].playerId = '短名'
    short.users[1].playerId = '短名'
    const shortHtml = render(true, short)
    const player = regions(html, 'Player_Id-right')[0]
    const profile = regions(html, 'Player_profile_box')[0]
    const ranked = regions(html, 'rankUserName')
    assert.ok(player.includes('<b>' + longName + '</b>'), '玩家名应保留完整富文本')
    assert.ok(profile.includes('第一行保留版本 3.19.4<br>第二行 ' + mixed.repeat(40)), '简介应保留显式换行和完整原文')
    assert.doesNotMatch(profile, /phi-fit-line|text-overflow:\s*ellipsis/)
    assert.match(html, /white-space:\s*normal;\s*overflow-wrap:\s*anywhere/)
    assert.equal(ranked.length, 3)
    assert.ok(ranked[0].includes(longName) && ranked[1].includes(longName))
    assert.ok(fontSize(player, 20, 60) < fontSize(regions(shortHtml, 'Player_Id-right')[0], 20, 60))
    assert.ok(fontSize(profile, 16, 60) < fontSize(regions(shortHtml, 'Player_profile_box')[0], 16, 60))
    const shortRanked = regions(shortHtml, 'rankUserName')
    for (let index = 0; index < 2; index++) {
        assert.ok(fontSize(ranked[index], 14, 35) < fontSize(shortRanked[index], 14, 35))
    }
    assert.ok(ranked[2].includes('NO INFO'), '无存档用户仍保留对应排行榜行')
    fontSize(ranked[2], 14, 35)
})

test('空简介、无历史和无效存档仍能安全出图，不产生非法字号与历史坐标', () => {
    const base = fixture()
    const empty = { ...base, users: [], me: { ...base.me, selfIntro: '', rks_history: [],
        rks_range: [], rks_date: [], clg_list: [], b30list: {} } }
    for (const data of [empty, { me: {}, users: [{ playerId: '无效用户', index: 3 }] }]) {
        for (const renderNoJs of [true, false]) {
            const html = render(renderNoJs, data)
            assertDocument(html)
            assert.match(html, /class="ranklist"/)
            const visible = html.replace(/<!--[\s\S]*?-->/g, '')
            assert.doesNotMatch(visible, /(?:NaN|Infinity|undefined)px|(?:NaN|Infinity)%|>undefined</)
            if (data.users.length) assert.ok(html.includes('NO INFO') && html.includes('#3'))
        }
    }
})

test('Puppeteer 仅使用公共自适应脚本，姓名与简介继续通过实际布局缩放', () => {
    const html = render(false)
    assertDocument(html)
    assert.equal((html.match(/function adjustFontSize/g) || []).length, 1)
    for (const className of ['Player_Id-right', 'Player_profile_box', 'rankUserName']) {
        const blocks = regions(html, className)
        assert.ok(blocks.length)
        for (const block of blocks) assert.doesNotMatch(markedTag(block), /font-size:/)
    }
    assert.ok(html.includes('<b>' + longName + '</b>'))
    assert.ok(html.includes('第一行保留版本 3.19.4<br>第二行 ' + mixed.repeat(40)))
})
