import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import art from 'art-template'
import themeManager from '../model/theme/manager.js'
import { pluginResources } from '../model/filesystem/path.js'

const THEMES_DIR = path.join(pluginResources, 'html', 'b19', 'themes')
const RES = 'resources/'

/** 等待条件成立（用于热更新断言） */
/** @param {() => boolean} fn @param {number} [timeout] */
async function waitFor(fn, timeout = 4000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
        if (fn()) return true
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    return fn()
}

test('内置主题注册完整，milthm 作为自定义主题注册成功', () => {
    assert.ok(themeManager.isTheme('default'))
    assert.ok(themeManager.isTheme('snow'))
    assert.ok(themeManager.isTheme('star'))
    assert.ok(themeManager.isTheme('dss2'))
    assert.ok(themeManager.isTheme('milthm'))
    assert.ok(themeManager.isCustomTheme('milthm'))
    assert.ok(!themeManager.isCustomTheme('default'))
    assert.equal(themeManager.getTheme('unknown-id'), null)
})

test('getThemeList 内置在前自定义在后，序号连续', () => {
    const list = themeManager.getThemeList()
    const ids = list.map(t => t.id)
    assert.deepEqual(ids.slice(0, 4), ['default', 'snow', 'star', 'dss2'])
    assert.ok(ids.includes('milthm'))
    assert.equal(list.find(t => t.id === 'milthm')?.src, 'Milthm')
})

test('getThemeOptions 合并内置与自定义，自定义主题序号从 4 开始', () => {
    const options = themeManager.getThemeOptions()
    assert.equal(Object.keys(options)[4], 'milthm')
    assert.match(options.milthm.title, /^\[4\]Milthm$/)
    assert.equal(options.milthm.description, '所有词语，都是雨的旋律')
})

test('getRenderInfo：自定义主题返回模板路径与 themeInfo，资源 url 完整', () => {
    const info = themeManager.getRenderInfo('milthm', RES, 'b19')
    assert.ok(info)
    assert.match(info.tplFile ?? '', /themes[\\/]milthm[\\/]b19\.art$/)
    assert.equal(info.themeInfo.id, 'milthm')
    assert.equal(info.themeInfo.baseUrl, 'resources/html/b19/themes/milthm/')
    assert.equal(info.themeInfo.cssUrl, 'resources/html/b19/themes/milthm/b19.css')
    assert.equal(info.themeInfo.cssMode, 'overlay')
    assert.equal(info.themeInfo.fontUrl, 'resources/html/b19/themes/milthm/font.ttf')
    assert.equal(info.themeInfo.backgroundUrl, 'resources/html/b19/themes/milthm/bg.png')
    assert.equal(info.themeInfo.icons.phi, 'resources/html/b19/themes/milthm/phi.png')
    assert.equal(info.themeInfo.icons.FC, 'resources/html/b19/themes/milthm/FC.png')
    assert.deepEqual(info.themeInfo.colors, { AT: '#555555', IN: '#7b5ea7', HD: '#5b9bd5', EZ: '#7ecb8a' })
})

test('getRenderInfo：按页面选择 CSS，缺省页面保留背景和颜色但不启用主题字体', () => {
    const pages = [
        'b19', 'sign', 'update', 'clg', 'arcgrosB19', 'suggest', 'table',
        'list', 'historyB30', 'setting', 'difficultyHistory', 'help',
    ]
    for (const page of pages) {
        const info = themeManager.getRenderInfo('milthm', RES, `${page}/${page}`)
        assert.ok(info)
        assert.equal(info.themeInfo.cssUrl, `resources/html/b19/themes/milthm/${page}.css`)
        assert.equal(info.themeInfo.cssMode, 'overlay')
        assert.equal(info.themeInfo.fontUrl, 'resources/html/b19/themes/milthm/font.ttf')
    }

    const fallback = themeManager.getRenderInfo('milthm', RES, 'unconfiguredPage')
    assert.ok(fallback)
    assert.equal(fallback.themeInfo.cssUrl, undefined)
    assert.equal(fallback.themeInfo.fontUrl, undefined)
    assert.equal(fallback.themeInfo.backgroundUrl, 'resources/html/b19/themes/milthm/bg.png')
    assert.deepEqual(fallback.themeInfo.colors, { AT: '#555555', IN: '#7b5ea7', HD: '#5b9bd5', EZ: '#7ecb8a' })
})

test('仅配置背景和难度色的主题可用默认 B19 模板与图标渲染', () => {
    const testId = '__theme_colors_only__'
    const testDir = path.join(THEMES_DIR, testId)
    try {
        fs.mkdirSync(testDir, { recursive: true })
        fs.writeFileSync(path.join(testDir, 'info.yaml'), [
            `id: "${testId}"`,
            'name: "Colors only"',
            'background: "background.png"',
            'color:',
            '  AT: "#111111"',
            '  IN: "#222222"',
            '  HD: "#333333"',
            '  EZ: "#444444"',
            '',
        ].join('\n'))
        fs.writeFileSync(path.join(testDir, 'background.png'), 'fixture')
        themeManager.scan()

        const info = themeManager.getRenderInfo(testId, RES, 'b19')
        assert.ok(info)
        assert.equal(info.themeInfo.cssUrl, undefined)
        assert.equal(info.themeInfo.fontUrl, undefined)
        assert.equal(info.themeInfo.icons, undefined)

        const source = fs.readFileSync(path.join(pluginResources, 'html', 'b19', 'b19.art'), 'utf8')
        const html = art.render(source, renderData(testId, info.themeInfo))
        assert.ok(html.includes('html/b19/b19.css'))
        assert.ok(html.includes('html/otherimg/FC.png'))
        assert.ok(html.includes(info.themeInfo.backgroundUrl))
        assert.ok(html.includes('--phi-theme-IN: #222222'))
    } finally {
        fs.rmSync(testDir, { recursive: true, force: true })
        themeManager.scan()
    }
})

test('新版页面 CSS 优先匹配完整渲染目标，再回退到 app 短键', () => {
    const testId = '__theme_page_keys__'
    const testDir = path.join(THEMES_DIR, testId)
    try {
        fs.mkdirSync(testDir, { recursive: true })
        fs.writeFileSync(path.join(testDir, 'info.yaml'), [
            `id: "${testId}"`,
            'name: "Page keys"',
            'font: "font.ttf"',
            'css:',
            '  setting: "setting.css"',
            '  setting/userSetting: "user-setting.css"',
            '  setting/missing: "missing.css"',
            '  invalid/path/extra: "ignored.css"',
            '',
        ].join('\n'))
        for (const file of ['font.ttf', 'setting.css', 'user-setting.css']) {
            fs.writeFileSync(path.join(testDir, file), 'fixture')
        }
        themeManager.scan()

        const exact = themeManager.getRenderInfo(testId, RES, 'setting/userSetting')
        assert.match(exact?.themeInfo.cssUrl ?? '', /\/user-setting\.css$/)
        assert.match(exact?.themeInfo.fontUrl ?? '', /\/font\.ttf$/)

        const fallback = themeManager.getRenderInfo(testId, RES, 'setting/missing')
        assert.match(fallback?.themeInfo.cssUrl ?? '', /\/setting\.css$/)

        const short = themeManager.getRenderInfo(testId, RES, 'setting')
        assert.match(short?.themeInfo.cssUrl ?? '', /\/setting\.css$/)
        assert.equal(themeManager.getTheme(testId)?.css?.['invalid/path/extra'], undefined)
    } finally {
        fs.rmSync(testDir, { recursive: true, force: true })
        themeManager.scan()
    }
})

test('旧版字符串 css 仅替换 B19 样式，其他页面使用默认 CSS 和字体', () => {
    const testId = '__theme_legacy_css__'
    const testDir = path.join(THEMES_DIR, testId)
    try {
        fs.mkdirSync(testDir, { recursive: true })
        fs.writeFileSync(path.join(testDir, 'info.yaml'), [
            `id: "${testId}"`,
            'name: "Legacy CSS"',
            'font: "font.ttf"',
            'background: "background.png"',
            'css: "b19.css"',
            'icon:',
            '  FC: "FC.png"',
            'color:',
            '  IN: "#123456"',
            '',
        ].join('\n'))
        for (const file of ['font.ttf', 'background.png', 'b19.css', 'FC.png']) {
            fs.writeFileSync(path.join(testDir, file), 'fixture')
        }
        themeManager.scan()

        const b19 = themeManager.getRenderInfo(testId, RES, 'b19')
        assert.ok(b19)
        assert.match(b19.themeInfo.cssUrl, /__theme_legacy_css__\/b19\.css$/)
        assert.equal(b19.themeInfo.cssMode, 'replace')
        assert.match(b19.themeInfo.fontUrl, /__theme_legacy_css__\/font\.ttf$/)

        const source = fs.readFileSync(path.join(pluginResources, 'html', 'b19', 'b19.art'), 'utf8')
        const html = art.render(source, renderData(testId, b19.themeInfo))
        assert.ok(html.includes(b19.themeInfo.cssUrl))
        assert.ok(!html.includes('html/b19/b19.css'))
        assert.equal(html.split(b19.themeInfo.cssUrl).length - 1, 1)

        const sign = themeManager.getRenderInfo(testId, RES, 'sign')
        assert.ok(sign)
        assert.equal(sign.themeInfo.cssUrl, undefined)
        assert.equal(sign.themeInfo.cssMode, undefined)
        assert.equal(sign.themeInfo.fontUrl, undefined)
        assert.match(sign.themeInfo.backgroundUrl, /__theme_legacy_css__\/background\.png$/)
        assert.deepEqual(sign.themeInfo.colors, { IN: '#123456' })
    } finally {
        fs.rmSync(testDir, { recursive: true, force: true })
        themeManager.scan()
    }
})

test('主题资源 URL 使用实际目录名，并拒绝越界路径和符号链接', () => {
    const dirName = '__theme actual#dir%__'
    const testId = '__theme_different_id__'
    const testDir = path.join(THEMES_DIR, dirName)
    const outsideFile = path.join(THEMES_DIR, '__theme_outside.css')
    const nestedDir = path.join(testDir, 'nested styles')
    let symlinkCreated = false
    try {
        fs.mkdirSync(nestedDir, { recursive: true })
        fs.writeFileSync(path.join(testDir, 'info.yaml'), [
            `id: "${testId}"`,
            'name: "Path safety"',
            'background: "background #%.png"',
            'css:',
            '  sign: "nested styles/valid #%.css"',
            '  update: "../__theme_outside.css"',
            '  help: "linked.css"',
            '',
        ].join('\n'))
        fs.writeFileSync(path.join(nestedDir, 'valid #%.css'), 'fixture')
        fs.writeFileSync(path.join(testDir, 'background #%.png'), 'fixture')
        fs.writeFileSync(outsideFile, 'fixture')
        try {
            fs.symlinkSync(outsideFile, path.join(testDir, 'linked.css'))
            symlinkCreated = true
        } catch { }
        themeManager.scan()

        const sign = themeManager.getRenderInfo(testId, RES, 'sign/sign')
        const encodedDir = encodeURIComponent(dirName)
        assert.equal(sign?.themeInfo.baseUrl, `resources/html/b19/themes/${encodedDir}/`)
        assert.equal(sign?.themeInfo.cssUrl,
            `resources/html/b19/themes/${encodedDir}/nested%20styles/valid%20%23%25.css`)
        assert.equal(sign?.themeInfo.backgroundUrl,
            `resources/html/b19/themes/${encodedDir}/background%20%23%25.png`)
        const cssUrl = new URL(sign?.themeInfo.cssUrl ?? '', 'file:///')
        assert.equal(cssUrl.hash, '')
        assert.equal(cssUrl.search, '')

        const escaped = themeManager.getRenderInfo(testId, RES, 'update/update')
        assert.equal(escaped?.themeInfo.cssUrl, undefined)
        if (symlinkCreated) {
            const linked = themeManager.getRenderInfo(testId, RES, 'help/help')
            assert.equal(linked?.themeInfo.cssUrl, undefined)
        }
    } finally {
        fs.rmSync(testDir, { recursive: true, force: true })
        fs.rmSync(outsideFile, { force: true })
        themeManager.scan()
    }
})

test('主题根目录符号链接不会被注册', (t) => {
    const testId = '__theme_linked_root__'
    const linkedDir = path.join(THEMES_DIR, testId)
    const externalDir = fs.mkdtempSync(path.join(path.dirname(THEMES_DIR), '__theme_external_root__'))
    try {
        fs.writeFileSync(path.join(externalDir, 'info.yaml'), `id: "${testId}"\nname: "Linked root"\n`)
        try {
            fs.symlinkSync(externalDir, linkedDir, 'dir')
        } catch {
            t.skip('当前环境不支持创建目录符号链接')
            return
        }
        themeManager.scan()
        assert.ok(!themeManager.isCustomTheme(testId))
    } finally {
        fs.rmSync(linkedDir, { force: true })
        fs.rmSync(externalDir, { recursive: true, force: true })
        themeManager.scan()
    }
})

test('getRenderInfo：dss2 返回内置模板路径且 themeInfo 为 null，default/snow/star 返回 null', () => {
    const dss2 = themeManager.getRenderInfo('dss2', RES)
    assert.ok(dss2)
    assert.match(dss2.tplFile || '', /b19[\\/]dss2\.art$/)
    assert.equal(dss2.themeInfo, null)
    assert.equal(themeManager.getRenderInfo('default', RES), null)
    assert.equal(themeManager.getRenderInfo('snow', RES), null)
    assert.equal(themeManager.getRenderInfo('star', RES), null)
    assert.equal(themeManager.getRenderInfo('unknown', RES), null)
})

test('热更新：新增/修改/删除主题目录无需重启即可生效', async () => {
    const testId = '__theme_hot_reload_test__'
    const testDir = path.join(THEMES_DIR, testId)
    try {
        fs.mkdirSync(testDir, { recursive: true })
        fs.writeFileSync(path.join(testDir, 'info.yaml'),
            `name: "HotReload"\nid: "${testId}"\ndescription: "hot reload test"\n`)
        assert.ok(await waitFor(() => themeManager.isCustomTheme(testId)), '新增主题未被注册')

        const beforeOptions = themeManager.getThemeOptions()
        const before = beforeOptions[testId]
        const beforeIndex = Object.keys(beforeOptions).indexOf(testId)
        fs.writeFileSync(path.join(testDir, 'info.yaml'),
            `name: "HotReloadV2"\nid: "${testId}"\ndescription: "updated"\n`)
        assert.ok(await waitFor(() => themeManager.getThemeOptions()[testId].description === 'updated'), '修改 info.yaml 未生效')

        fs.rmSync(testDir, { recursive: true, force: true })
        assert.ok(await waitFor(() => !themeManager.isCustomTheme(testId)), '删除主题未生效')
        assert.equal(before.title, `[${beforeIndex}]HotReload`)
    } finally {
        fs.rmSync(testDir, { recursive: true, force: true })
    }
})

test('非法主题包：缺少 info.yaml / 非法 id / 冲突 id 均被跳过且不影响注册表', async () => {
    const noYamlDir = path.join(THEMES_DIR, '__theme_no_yaml__')
    const badIdDir = path.join(THEMES_DIR, '__theme_bad_id__')
    const conflictDir = path.join(THEMES_DIR, '__theme_conflict__')
    try {
        fs.mkdirSync(noYamlDir, { recursive: true })
        fs.mkdirSync(badIdDir, { recursive: true })
        fs.writeFileSync(path.join(badIdDir, 'info.yaml'), 'name: "Bad"\nid: "非法 id"\n')
        fs.mkdirSync(conflictDir, { recursive: true })
        fs.writeFileSync(path.join(conflictDir, 'info.yaml'), 'name: "Conflict"\nid: "dss2"\n')
        // 等待热更新扫描
        await new Promise(resolve => setTimeout(resolve, 500))
        assert.ok(!themeManager.isCustomTheme('__theme_no_yaml__'))
        assert.ok(!themeManager.isCustomTheme('__theme_bad_id__'))
        assert.ok(!themeManager.isCustomTheme('dss2')) // 冲突 id 不覆盖内置主题
        assert.ok(themeManager.isTheme('dss2'))
        assert.ok(themeManager.isTheme('milthm')) // 内置与已有自定义不受影响
    } finally {
        for (const dir of [noYamlDir, badIdDir, conflictDir]) {
            fs.rmSync(dir, { recursive: true, force: true })
        }
    }
})

/** 组装渲染数据（对齐 dealTpl 的 data 结构） */
/** @param {string} theme @param {any} themeInfo */
function renderData(theme, themeInfo) {
    const song = {
        num: 1,
        illustration: 'ill.png',
        rank: 'IN',
        difficulty: { toFixed: () => '15.5' },
        rks: { toFixed: () => '15.12' },
        song: 'TestSong',
        Rating: 'FC',
        score: 1000000,
        acc: { toFixed: () => '100.00' },
        suggest: 'test',
        suggestType: 2,
    }
    return {
        _res_path: RES,
        defaultLayout: path.join(pluginResources, 'html', 'common', 'layout', 'default.art'),
        sys: { scale: 'style="transform:scale(1)"' },
        theme,
        themeInfo,
        background: undefined,
        _plugin: 'phi-plugin',
        Version: { ver: 'test' },
        gameuser: {
            avatar: 'avatar1',
            PlayerId: 'TestPlayer',
            rks: { toFixed: () => '15.0000' },
            ChallengeMode: '0',
            ChallengeModeRank: '12',
            data: '100',
        },
        Date: '2026-08-10',
        stats: [{ title: 'EZ', cleared: 1, fc: 1, phi: 0 }],
        phi: [{ ...song, num: 0 }],
        b19_list: [song],
    }
}

test('默认 b19.art：themeInfo 为 null 时保持原样（默认 css 与 otherimg 图标）', () => {
    const source = fs.readFileSync(path.join(pluginResources, 'html', 'b19', 'b19.art'), 'utf8')
    const html = art.render(source, renderData('default', null))
    assert.ok(html.includes('html/b19/b19.css'))
    assert.ok(html.includes('html/otherimg/FC.png'))
    assert.ok(!html.includes('themes/milthm'))
})

test('默认 b19.art 主题感知：新版覆盖样式后置，图标缺失时回退默认', () => {
    const info = themeManager.getRenderInfo('milthm', RES, 'b19')
    assert.ok(info)
    const source = fs.readFileSync(path.join(pluginResources, 'html', 'b19', 'b19.art'), 'utf8')
    const html = art.render(source, renderData('milthm', info.themeInfo))
    assert.ok(html.includes(info.themeInfo.cssUrl))
    assert.ok(html.includes(info.themeInfo.icons.FC))
    assert.ok(html.includes('html/b19/b19.css'))
    assert.ok(html.indexOf('html/b19/b19.css') < html.indexOf(info.themeInfo.cssUrl))
    // NEW 未提供图标 → 回退默认
    const htmlNew = art.render(source, {
        ...renderData('milthm', info.themeInfo),
        b19_list: [{ ...renderData('milthm', null).b19_list[0], Rating: 'NEW' }],
    })
    assert.ok(htmlNew.includes('html/otherimg/NEW.png'))
})

test('milthm b19.art：使用主题 css 与图标，无 snow/star/topText 分支', () => {
    const info = themeManager.getRenderInfo('milthm', RES, 'b19')
    assert.ok(info)
    const source = fs.readFileSync(path.join(info.themeInfo.baseUrl.replace('resources/', pluginResources.replace(/\\/g, '/') + '/'), 'b19.art'), 'utf8')
    const html = art.render(source, renderData('milthm', info.themeInfo))
    assert.ok(html.includes('html/b19/b19.css'))
    assert.ok(html.includes(info.themeInfo.cssUrl))
    assert.ok(html.includes(info.themeInfo.icons.FC))
    assert.ok(html.includes('phi_song'))
    assert.ok(!html.includes('snow-box'))
    assert.ok(!html.includes('topTextBox'))
    assert.ok(!html.includes('id="stars"'))
})

test('default.art 布局：themeInfo 注入字体/难度色/背景，无 themeInfo 时与现状一致', () => {
    const layout = path.join(pluginResources, 'html', 'common', 'layout', 'default.art')
    const source = fs.readFileSync(layout, 'utf8')
    const info = themeManager.getRenderInfo('milthm', RES, 'b19')
    assert.ok(info)

    const html = art.render(source, {
        ...renderData('milthm', info.themeInfo),
        b19_list: [], phi: [],
    })
    assert.ok(html.includes('@font-face'))
    assert.ok(html.includes('font-family: "phi-theme"'))
    assert.ok(html.includes('--AT: #555555'))
    assert.ok(html.includes('--phi-theme-AT: #555555'))
    assert.ok(html.includes('--phi-theme-AT-dark: color-mix(in srgb, #555555 50%, black)'))
    assert.ok(html.includes('--IN: #7b5ea7'))
    assert.ok(html.includes('--phi-theme-IN: #7b5ea7'))
    assert.ok(html.includes('--HD: #5b9bd5'))
    assert.ok(html.includes('--EZ: #7ecb8a'))
    assert.ok(html.includes(info.themeInfo.backgroundUrl))
    assert.ok(html.includes('class="background theme-background"'))
    assert.ok(html.includes('body > .background:not(.theme-background) { display: none; }'))
    // 清单颜色与字体必须位于主题 CSS 之后，保证清单配置优先。
    assert.ok(html.indexOf(info.themeInfo.cssUrl) < html.indexOf('@font-face'),
        '主题样式应注入在 css 链接之后，以保证覆盖 common.css 默认值')

    const plain = art.render(source, { ...renderData('default', null), b19_list: [], phi: [] })
    assert.ok(!plain.includes('phi-theme'))
    assert.ok(!plain.includes('--AT: #555555'))
    assert.ok(plain.includes('html/otherimg/phigros.png'))
    // star 分支不受影响
    const star = art.render(source, { ...renderData('star', null), b19_list: [], phi: [] })
    assert.ok(star.includes('Star1.png'))
})

test('默认页面 CSS 从主题别名读取难度色', () => {
    for (const page of ['b19', 'list', 'suggest', 'difficultyHistory', 'arcgrosB19']) {
        const css = fs.readFileSync(path.join(pluginResources, 'html', page, `${page}.css`), 'utf8')
        for (const rank of ['AT', 'IN', 'HD', 'EZ']) {
            assert.ok(css.includes(`--phi-theme-${rank}`), `${page} 未读取 ${rank} 主题色`)
        }
    }
    const table = fs.readFileSync(path.join(pluginResources, 'html', 'table', 'table.css'), 'utf8')
    assert.ok(table.includes('var(--phi-theme-IN, #ff5d5d)'))
})

test('sign.art：页面主题样式后置；未配置页面样式时使用默认字体', () => {
    const source = fs.readFileSync(path.join(pluginResources, 'html', 'sign', 'sign.art'), 'utf8')
    const signData = {
        ...renderData('milthm', null),
        PlayerId: 'TestPlayer',
        Rks: '15.0000',
        avatar: 'avatar1',
        ChallengeMode: '0',
        ChallengeModeRank: '12',
        Date: '2026-08-16',
        Notes: 100,
        signDays: 5,
        lucky: 80,
        good: [],
        bad: [],
        quote: 'Test quote',
        edgeRate: Object.fromEntries(['EZ', 'HD', 'IN', 'AT'].map(rank => [
            rank,
            { unlock: '50%', fc: '40%', phi: '30%' },
        ])),
        dailyTasks: [],
        notice: null,
        calendar: { title: '2026 年 8 月', weekdays: [], weeks: [] },
    }

    const themed = themeManager.getRenderInfo('milthm', RES, 'sign')
    assert.ok(themed)
    const themedHtml = art.render(source, { ...signData, themeInfo: themed.themeInfo })
    assert.ok(themedHtml.includes('html/sign/sign.css'))
    assert.ok(themedHtml.includes('themes/milthm/sign.css'))
    assert.ok(themedHtml.includes('font-family: "phi-theme"'))
    assert.ok(themedHtml.indexOf('html/sign/sign.css') < themedHtml.indexOf('themes/milthm/sign.css'))

    const fallback = themeManager.getRenderInfo('milthm', RES, 'unconfiguredPage')
    assert.ok(fallback)
    const fallbackHtml = art.render(source, { ...signData, themeInfo: fallback.themeInfo })
    assert.ok(fallbackHtml.includes('html/sign/sign.css'))
    assert.ok(fallbackHtml.includes(fallback.themeInfo.backgroundUrl))
    assert.ok(fallbackHtml.includes('--IN: #7b5ea7'))
    assert.ok(fallbackHtml.includes('--phi-theme-IN: #7b5ea7'))
    assert.ok(!fallbackHtml.includes('@font-face'))
    assert.ok(!fallbackHtml.includes('font-family: "phi-theme"'))
    assert.ok(!fallbackHtml.includes('themes/milthm/sign.css'))
})
