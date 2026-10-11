import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import art from 'art-template'
import staticText from '../model/render/staticText.js'

const resources = path.resolve(import.meta.dirname, '../resources').replace(/\\/g, '/')
const intro = '第一行保留版本与日期：3.19.4，2026-07-03。<br>第二行需要完整换行显示，不能变成省略号。'
const common = {
    Math,
    _res_path: resources + '/', defaultLayout: `${resources}/html/common/layout/default.art`,
    theme: 'default', themeInfo: null, sys: { scale: '' }, Version: { ver: 'test' }, _plugin: 'phi-plugin',
}
const fixtures = {
    atlas: { song: '测试曲目', composer: '曲师', length: '2:00', chart: {}, illustration: 'test.png',
        spinfo: '版本 3.19.4\n日期 2026-07-03',
        comment: { command: '/phi comment', list: [{ avatar: 'Introduction', PlayerId: '测试玩家', rks: 15, score: 1000000,
            rank: 'IN', acc: 100, challenge: 145, time: '2026-10-11', thisId: 1, comment: intro }] },
    },
    userinfo: { gameuser: { PlayerId: '测试玩家', avatar: 'Introduction', rks: 15, selfIntro: intro, data: '10 MiB',
        ChallengeMode: 1, ChallengeModeRank: 45 }, rks_history: [], data_history: [], acc_rks_data: [], userstats: [] },
    rankingList: { users: [], me: { backgroundurl: 'test.png', updated: '2026-10-11', selfIntro: intro,
        rks_history: [], clg_list: [], b30list: [] } },
    help: { cmdHead: 'phi', helpGroup: [{ group: '渲染设置', list: [{ title: '/renderer', eg: '/renderer auto', desc: intro }] }] },
    setting: { data: [{ type: 'space', label: '渲染器', bottomHelpMessage: '根据宿主选择合适的渲染器', value: '跟随宿主（自动选择渲染器）' }] },
    jrrp: { bkg: 'test.png', year: 2026, month: 10, day: 11, lucky: 100, luckRank: 0, good: [], bad: [],
        sentence: { hitokoto: '保留完整的一言内容，清晰展示每一个重要信息与日期。', from: '这是需要完整展示的作品来源' } },
    sign: { avatar: 'Introduction', good: [], bad: [], edgeRate: Object.fromEntries(['EZ', 'HD', 'IN', 'AT'].map(rank => [rank, { unlock: 0, fc: 0, phi: 0 }])),
        quote: '保留完整的一言内容，清晰展示每一个重要信息与日期。', dailyTasks: [], notice: { title: '公告', content: [] } },
}

/** @param {keyof typeof fixtures} page @param {boolean} renderNoJs @param {boolean} [withHelper] */
function render(page, renderNoJs, withHelper = true) {
    return art(`${resources}/html/${page}/${page}.art`, {
        ...common, ...fixtures[page], renderNoJs, ...(withHelper ? { staticText } : {}),
    })
}

test('Shotium 多行正文保留显式换行和完整文本，只有昵称等横栏显式使用单行兜底', () => {
    for (const page of /** @type {(keyof typeof fixtures)[]} */ (['atlas', 'userinfo', 'rankingList', 'help'])) {
        const html = render(page, true)
        assert.match(html, /white-space: normal; overflow-wrap: anywhere/)
        assert.ok(html.includes(intro), `${page} 应保留多行原文`)
        for (const p of html.match(/<p\b[^>]*>[\s\S]*?<\/p>/g) || []) {
            if (p.includes(intro)) assert.doesNotMatch(p, /phi-fit-line|ellipsis/, `${page} 正文不应使用单行省略`)
        }
    }
    assert.match(render('atlas', true), /版本 3\.19\.4<br>日期 2026-07-03/)
})

test('Shotium 设置值、帮助描述和一言可完整展示，Puppeteer 保留脚本缩放路径', () => {
    const setting = render('setting', true)
    assert.ok(setting.includes(fixtures.setting.data[0].value))
    assert.match(setting, /class="space setting-value"/)
    for (const page of /** @type {(keyof typeof fixtures)[]} */ (Object.keys(fixtures))) {
        const shotium = render(page, true)
        const puppeteer = render(page, false)
        assert.doesNotMatch(shotium, /function adjustFontSize/)
        assert.match(puppeteer, /function adjustFontSize/)
        assert.doesNotMatch(puppeteer, /white-space: normal; overflow-wrap: anywhere|setting-value|class="phi-fit-line"/)
    }
})

test('静态文字辅助模块未重载时，多行模板仍可渲染', () => {
    for (const page of /** @type {(keyof typeof fixtures)[]} */ (Object.keys(fixtures))) assert.ok(render(page, true, false).includes('<body'))
})

test('Shotium 普通帮助和设置保留原有盒子，一言和简介沿用字体的 normal 行高', () => {
    const help = art(`${resources}/html/help/help.art`, {
        ...common, renderNoJs: true, staticText,
        helpGroup: [{ group: '帮助', list: [{ title: '/update', eg: '/update', desc: '更新游戏存档' }] }],
    })
    assert.match(help, /<div class="line">/)
    assert.doesNotMatch(help, /font-size: 23px|line-height: 1\.25/)
    const setting = art(`${resources}/html/setting/setting.art`, {
        ...common, renderNoJs: true, staticText,
        data: [{ type: 'space', label: '图片质量', value: '95', drc: '%' }],
    })
    assert.match(setting, /<div class="line">/)
    assert.match(setting, /style="font-size: 15px"/)
    assert.match(render('setting', true), /<div class="line setting-expanded">/)
    for (const page of /** @type {(keyof typeof fixtures)[]} */ (['userinfo', 'rankingList', 'jrrp', 'sign'])) {
        const html = render(page, true)
        assert.doesNotMatch(html, /white-space: normal; overflow-wrap: anywhere; line-height: 1\.2/)
    }
})
