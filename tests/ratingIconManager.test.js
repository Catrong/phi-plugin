import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ratingIconManager, { RATING_ICONS_DIR, RATING_KEYS } from '../model/ratingIconManager.js'
import PluginData from '../model/class/pluginData.js'

const RES = 'resources/'

test('默认评级图标包与 /myset 选项可用', () => {
    assert.ok(ratingIconManager.isRatingIcon('default'))
    assert.ok(!ratingIconManager.isCustomRatingIcon('default'))
    assert.equal(ratingIconManager.getRatingIcon('unknown-id'), null)

    const options = ratingIconManager.getRatingIconOptions()
    assert.equal(Object.getPrototypeOf(options), null)
    assert.equal(options.default.title, '[0]默认')
    assert.ok(options.default.description)
    assert.equal(options.phira.title, '[1]Phira Rank')

    const phira = ratingIconManager.getRenderInfo('phira', RES)
    assert.ok(phira)
    assert.equal(phira.icons.FC, 'resources/html/otherimg/rating/phira/FC.png')
    assert.equal(phira.icons.NEW, undefined)
    assert.equal(new PluginData({ ratingIcon: 'PHIRA' }).ratingIcon, 'phira')
    assert.equal(new PluginData({ ratingIcon: 'missing' }).ratingIcon, 'default')

    const defaults = ratingIconManager.getDefaultIcons(RES)
    assert.deepEqual(Object.keys(defaults), RATING_KEYS)
    assert.equal(defaults.FC, 'resources/html/otherimg/FC.png')
    assert.equal(defaults.phi, 'resources/html/otherimg/phi.png')
})

test('scan 注册、更新并删除自定义评级图标包，缺失资源回退默认', () => {
    const testId = `__rating_icon_scan_test_${process.pid}__`
    const testDir = path.join(RATING_ICONS_DIR, testId)
    const ratingDirExisted = fs.existsSync(RATING_ICONS_DIR)

    try {
        fs.mkdirSync(path.join(testDir, 'nested'), { recursive: true })
        fs.writeFileSync(path.join(testDir, 'FC.png'), 'fc')
        fs.writeFileSync(path.join(testDir, 'nested', 'phi.png'), 'phi')
        fs.writeFileSync(path.join(testDir, 'hash #?.png'), 'special')
        fs.writeFileSync(path.join(testDir, 'info.yaml'), [
            'name: "Scan Pack"',
            `id: "${testId}"`,
            'author: "Test Author"',
            'description: "scan test"',
            'icon:',
            '  FC: "FC.png"',
            '  phi:',
            '    file: "nested/phi.png"',
            '    offset: { x: "1%", y: 0 }',
            '  NEW: "missing.png"',
            '  A: "hash #?.png"',
            'offset:',
            '  FC: { x: 2, y: -1 }',
            '',
        ].join('\n'))

        ratingIconManager.scan()

        assert.ok(ratingIconManager.isCustomRatingIcon(testId))
        assert.ok(ratingIconManager.isCustomRatingIcon(testId.toUpperCase()))
        const options = ratingIconManager.getRatingIconOptions()
        assert.match(options[testId].title, /^\[\d+\]Scan Pack$/)
        assert.equal(options[testId].description, 'scan test')

        const info = ratingIconManager.getRenderInfo(testId, RES)
        assert.ok(info)
        assert.equal(info.id, testId)
        assert.equal(info.baseUrl, `resources/html/otherimg/rating/${testId}/`)
        assert.equal(info.icons.FC, `${info.baseUrl}FC.png`)
        assert.equal(info.icons.phi, `${info.baseUrl}nested/phi.png`)
        assert.equal(info.icons.A, `${info.baseUrl}hash%20%23%3F.png`)
        assert.notEqual(info.icons.NEW, `${info.baseUrl}missing.png`, '缺失文件不应生成自定义资源 URL')
        assert.deepEqual(info.offsets.FC, { x: '2px', y: '-1px' })
        assert.equal(info.styles.FC, 'translate: 2px -1px;')
        assert.deepEqual(info.offsets.phi, { x: '1%', y: '0px' })

        const resolvedIcons = {
            ...ratingIconManager.getDefaultIcons(RES),
            ...info.icons,
        }
        assert.equal(resolvedIcons.FC, `${info.baseUrl}FC.png`)
        assert.equal(resolvedIcons.NEW, 'resources/html/otherimg/NEW.png')

        fs.writeFileSync(path.join(testDir, 'info.yaml'), [
            'name: "Scan Pack V2"',
            `id: "${testId}"`,
            'description: "updated"',
            'icon:',
            '  FC: "FC.png"',
            '',
        ].join('\n'))
        ratingIconManager.scan()
        assert.equal(ratingIconManager.getRatingIconOptions()[testId].description, 'updated')
        assert.equal(ratingIconManager.getRatingIcon(testId)?.name, 'Scan Pack V2')

        fs.rmSync(testDir, { recursive: true, force: true })
        ratingIconManager.scan()
        assert.ok(!ratingIconManager.isRatingIcon(testId))
        assert.equal(ratingIconManager.getRenderInfo(testId, RES)?.id, 'default')
    } finally {
        fs.rmSync(testDir, { recursive: true, force: true })
        ratingIconManager.scan()
        if (!ratingDirExisted && fs.existsSync(RATING_ICONS_DIR) && fs.readdirSync(RATING_ICONS_DIR).length === 0) {
            fs.rmdirSync(RATING_ICONS_DIR)
        }
    }
})

test('非法 id 与越界资源路径不会进入选项或渲染配置', () => {
    const reservedDir = path.join(RATING_ICONS_DIR, `__rating_icon_reserved_test_${process.pid}__`)
    const numericDir = path.join(RATING_ICONS_DIR, `__rating_icon_numeric_test_${process.pid}__`)
    try {
        fs.mkdirSync(reservedDir, { recursive: true })
        fs.writeFileSync(path.join(reservedDir, 'FC.png'), 'fc')
        fs.writeFileSync(path.join(reservedDir, 'info.yaml'), [
            'name: "Reserved"',
            'id: "__proto__"',
            'icon:',
            '  FC: "FC.png"',
            '',
        ].join('\n'))
        fs.mkdirSync(numericDir, { recursive: true })
        fs.writeFileSync(path.join(numericDir, 'FC.png'), 'fc')
        fs.writeFileSync(path.join(numericDir, 'info.yaml'), [
            'name: "Numeric"',
            'id: "1"',
            'icon:',
            '  FC: "FC.png"',
            '',
        ].join('\n'))

        ratingIconManager.scan()
        const options = ratingIconManager.getRatingIconOptions()
        assert.ok(!Object.hasOwn(options, '__proto__'))
        assert.ok(!ratingIconManager.isRatingIcon('__proto__'))
        assert.ok(!ratingIconManager.isRatingIcon('1'))
        assert.equal(ratingIconManager.normalizeAssetPath('../FC.png'), null)
        assert.equal(ratingIconManager.normalizeAssetPath('..\\FC.png'), null)
        assert.equal(ratingIconManager.normalizeAssetPath('/tmp/FC.png'), null)
        assert.equal(ratingIconManager.normalizeAssetPath('C:\\tmp\\FC.png'), null)
    } finally {
        fs.rmSync(reservedDir, { recursive: true, force: true })
        fs.rmSync(numericDir, { recursive: true, force: true })
        ratingIconManager.scan()
    }
})
