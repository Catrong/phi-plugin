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
    const info = themeManager.getRenderInfo('milthm', RES)
    assert.ok(info)
    assert.match(info.tplFile ?? '', /themes[\\/]milthm[\\/]b19\.art$/)
    assert.equal(info.themeInfo.id, 'milthm')
    assert.equal(info.themeInfo.baseUrl, 'resources/html/b19/themes/milthm/')
    assert.equal(info.themeInfo.cssUrl, 'resources/html/b19/themes/milthm/b19.css')
    assert.equal(info.themeInfo.fontUrl, 'resources/html/b19/themes/milthm/font.ttf')
    assert.equal(info.themeInfo.backgroundUrl, 'resources/html/b19/themes/milthm/bg.png')
    assert.equal(info.themeInfo.icons.phi, 'resources/html/b19/themes/milthm/phi.png')
    assert.equal(info.themeInfo.icons.FC, 'resources/html/b19/themes/milthm/FC.png')
    assert.deepEqual(info.themeInfo.colors, { AT: '#555555', IN: '#7b5ea7', HD: '#5b9bd5', EZ: '#7ecb8a' })
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

        const before = themeManager.getThemeOptions()[testId]
        fs.writeFileSync(path.join(testDir, 'info.yaml'),
            `name: "HotReloadV2"\nid: "${testId}"\ndescription: "updated"\n`)
        assert.ok(await waitFor(() => themeManager.getThemeOptions()[testId].description === 'updated'), '修改 info.yaml 未生效')

        fs.rmSync(testDir, { recursive: true, force: true })
        assert.ok(await waitFor(() => !themeManager.isCustomTheme(testId)), '删除主题未生效')
        assert.equal(before.title, '[5]HotReload')
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

test('默认 b19.art 主题感知：有 themeInfo 时切换为主题 css 与图标，缺失图标回退默认', () => {
    const info = themeManager.getRenderInfo('milthm', RES)
    assert.ok(info)
    const source = fs.readFileSync(path.join(pluginResources, 'html', 'b19', 'b19.art'), 'utf8')
    const html = art.render(source, renderData('milthm', info.themeInfo))
    assert.ok(html.includes(info.themeInfo.cssUrl))
    assert.ok(html.includes(info.themeInfo.icons.FC))
    assert.ok(!html.includes('html/b19/b19.css'))
    // NEW 未提供图标 → 回退默认
    const htmlNew = art.render(source, {
        ...renderData('milthm', info.themeInfo),
        b19_list: [{ ...renderData('milthm', null).b19_list[0], Rating: 'NEW' }],
    })
    assert.ok(htmlNew.includes('html/otherimg/NEW.png'))
})

test('milthm b19.art：使用主题 css 与图标，无 snow/star/topText 分支', () => {
    const info = themeManager.getRenderInfo('milthm', RES)
    assert.ok(info)
    const source = fs.readFileSync(path.join(info.themeInfo.baseUrl.replace('resources/', pluginResources.replace(/\\/g, '/') + '/'), 'b19.art'), 'utf8')
    const html = art.render(source, renderData('milthm', info.themeInfo))
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
    const info = themeManager.getRenderInfo('milthm', RES)
    assert.ok(info)

    const html = art.render(source, {
        ...renderData('milthm', info.themeInfo),
        b19_list: [], phi: [],
    })
    assert.ok(html.includes('@font-face'))
    assert.ok(html.includes('font-family: "phi-theme"'))
    assert.ok(html.includes('--AT: #555555'))
    assert.ok(html.includes('--IN: #7b5ea7'))
    assert.ok(html.includes('--HD: #5b9bd5'))
    assert.ok(html.includes('--EZ: #7ecb8a'))
    assert.ok(html.includes(info.themeInfo.backgroundUrl))
    // 主题样式必须位于 css 链接之后：否则会被主题 css @import 的 common.css 同优先级规则覆盖（难度色/字体失效）
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
