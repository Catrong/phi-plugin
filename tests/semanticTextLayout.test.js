import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import art from '../model/render/pvisTemplate.js'
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
    rankingList: { users: [{ playerId: '测试玩家', index: 1, me: true, backgroundurl: 'test.png',
        avatar: 'Introduction', rks: 15, ChallengeMode: 1, ChallengeModeRank: 45 }],
        me: { backgroundurl: 'test.png', avatar: 'Introduction', playerId: '测试玩家', rks: 15,
            ChallengeMode: 1, ChallengeModeRank: 45, created: '2026-07-03', updated: '2026-10-11',
            data: '10 MiB', selfIntro: intro, rks_history: [], rks_range: [15, 15], rks_date: ['2026-07-03', '2026-10-11'],
            clg_list: [], b30list: { P3: { title: 'Perfect 3', list: [] }, B3: { title: 'Best 3', list: [] },
                F3: { title: 'Floor 3', list: [] }, L3: { title: 'Overflow 3', list: [] } } } },
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

test('userinfo 简介把换行转成 <br> 并按真实行数缩字，占位文案同样进入 pvis', () => {
    const line = '这是简介的一行，用来确认换行与字号 WithMixedText 3.19.4'
    /** @param {string} selfIntro */
    const renderIntro = selfIntro => art(`${resources}/html/userinfo/userinfo.art`, {
        ...common, renderNoJs: true, staticText,
        ...fixtures.userinfo, gameuser: { ...fixtures.userinfo.gameuser, selfIntro },
    })

    // 换行必须变成 <br>：HTML 会把字面量换行折成空格，pvis 却按行计算，两边对不上就会缩错字号。
    const multi = Array.from({ length: 6 }, (_, index) => `${line}${index + 1}`).join('\n')
    const html = renderIntro(multi)
    const region = html.match(/<div class="Player_profile_box">([\s\S]*?)<\/div>/)?.[1]
    assert.ok(region, '必须渲染简介区')
    assert.equal((region.match(/<br>/g) || []).length, 5, '每个换行都要转成 <br>')

    /** @param {string} source */
    const fontSize = source => {
        const tag = [...source.matchAll(/<p\b[^>]*>/g)].map(match => match[0]).find(tag => /\bname="pvis"/.test(tag))
        assert.ok(tag, '简介必须保留 pvis 标记')
        const size = tag.match(/font-size:\s*([\d.]+)px/)
        assert.ok(size, `简介必须写入字号：${tag}`)
        return Number(size[1])
    }
    assert.ok(fontSize(region) >= 16 && fontSize(region) <= 60, '多行简介字号应落在 16 至 60')

    // 占位文案走的是另一个颜色分支，同样要能被 pvis 命中，否则会一直按 CSS 的 60px 渲染。
    const placeholder = renderIntro('')
    const placeholderRegion = placeholder.match(/<div class="Player_profile_box">([\s\S]*?)<\/div>/)?.[1]
    assert.ok(placeholderRegion?.includes('skyblue'), '空简介应使用占位文案')
    fontSize(placeholderRegion)

    // 更长的简介必须更小，且不低于可读下限。
    const short = renderIntro(line).match(/<div class="Player_profile_box">([\s\S]*?)<\/div>/)?.[1]
    assert.ok(fontSize(region) < fontSize(short), '行数更多的简介字号必须更小')
})

test('两页 DATA 各自限定格子宽度，超长体积单行缩字而不是溢出格子', () => {
    const volume = '1023.99 GiB 1023.99 MiB 1023.99 KiB'
    /** @param {string} page @param {string} value */
    const dataFontSize = (page, value) => {
        const fixture = page === 'userinfo'
            ? { ...fixtures.userinfo, gameuser: { ...fixtures.userinfo.gameuser, data: value } }
            : { ...fixtures.rankingList, me: { ...fixtures.rankingList.me, data: value } }
        const html = art(`${resources}/html/${page}/${page}.art`, { ...common, ...fixture, renderNoJs: true, staticText })
        assert.match(html, /body \[name="pvis"\] \{ min-width: 0; max-width: 100%; \}/, `${page} 必须保留共享的宽度边界`)
        const region = html.match(/<div class="Player_box_value">([\s\S]*?)<\/div>/)?.[1]
        assert.ok(region, `${page} 必须渲染 DATA 区域`)
        const tag = [...region.matchAll(/<[^/][^>]*>/g)].map(match => match[0]).find(value => /\bname="pvis"/.test(value))
        assert.ok(tag, `${page} 的 DATA 必须保留自适应标记`)
        const size = Number(tag.match(/font-size:\s*([\d.]+)px/)?.[1])
        assert.ok(Number.isFinite(size) && size >= 18 && size <= 60, `${page} 字号 ${size} 应在 18 至 60 之间`)
        return size
    }
    for (const page of ['userinfo', 'rankingList']) {
        assert.equal(dataFontSize(page, '1024 MiB'), 60, `${page} 短体积保持模板原字号`)
        assert.ok(dataFontSize(page, volume) < 60, `${page} 超宽体积必须缩小字号`)
    }
    assert.ok(dataFontSize('userinfo', volume) >= dataFontSize('rankingList', volume), '更窄的排行榜格子不应得到更大字号')
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
