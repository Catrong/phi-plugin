import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import art from 'art-template'
import { dealPvisTemplate, renderPvisSource } from '../model/render/pvisTemplate.js'
import staticText from '../model/render/staticText.js'

const source = `{{set pvis = ({default: [200, 60, large ? 30 : 20, 10, 1.1], '.num': false})}}
<div class="song"><p name="pvis">{{value}}</p></div><div class="num"><p name="pvis">1</p></div>`

test('模板局部配置随条件求值，输入与其他渲染请求保持独立', () => {
    const data = { renderNoJs: true, large: true, value: 'Short' }
    assert.match(renderPvisSource(source, data), /style="font-size: 30px">Short/)
    assert.match(renderPvisSource(source, { ...data, large: false }), /style="font-size: 20px">Short/)
    assert.match(renderPvisSource(source, data), /<div class="num"><p name="pvis">1<\/p>/)
    assert.deepEqual(data, { renderNoJs: true, large: true, value: 'Short' })
    assert.equal(renderPvisSource(source, { ...data, renderNoJs: false }), art.render(source, { ...data, renderNoJs: false }))
})

test('继承模板能导出顶部声明，模板缓存和watch仍归原renderer', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phi-pvis-template-'))
    try {
        const layout = path.join(root, 'layout.art')
        const file = path.join(root, 'page.art')
        fs.writeFileSync(layout, '<html><body>{{block "main"}}{{/block}}</body></html>')
        const template = `{{extend layout}}{{set pvis = [200, 60, large ? 30 : 20, 10, 1.1]}}{{block 'main'}}<p name="pvis">Short</p>{{/block}}`
        fs.writeFileSync(file, template)
        const renderer = {
            /** @type {Record<string, string>} */
            html: {},
            watches: 0,
            /** @param {string} watched */
            watch(watched) { assert.equal(this, renderer); assert.equal(watched, file); this.watches++ },
        }
        /** @this {typeof renderer} @param {string} name @param {any} data */
        function base(name, data) {
            if (!this.html[data.tplFile]) {
                this.html[data.tplFile] = fs.readFileSync(data.tplFile, 'utf8')
                this.watch(data.tplFile)
            }
            const output = path.join(root, name + '.html')
            fs.writeFileSync(output, art.render(this.html[data.tplFile], data))
            return output
        }
        const data = { tplFile: file, layout, renderNoJs: true, large: true }
        const first = dealPvisTemplate(renderer, 'first', data, base)
        const second = dealPvisTemplate(renderer, 'second', { ...data, large: false }, base)
        assert.ok(first && second)
        assert.match(fs.readFileSync(first, 'utf8'), /font-size: 30px/)
        assert.match(fs.readFileSync(second, 'utf8'), /font-size: 20px/)
        assert.equal(renderer.html[file], template)
        assert.equal(renderer.watches, 1)
        assert.equal(Object.hasOwn(data, '__phiPvis'), false)
        delete renderer.html[file]
        fs.writeFileSync(file, template.replace('200, 60', '100, 60'))
        dealPvisTemplate(renderer, 'updated', data, base)
        assert.equal(renderer.watches, 2)
        assert.ok(renderer.html[file].includes('100, 60'))
    } finally {
        fs.rmSync(root, { recursive: true, force: true })
    }
})

test('旧辅助模块缺少fitRule时仍保留设置值的扩展容器', () => {
    const file = path.resolve('resources/html/setting/setting.art')
    const { fitRule, ...legacy } = staticText
    const data = {
        renderNoJs: true, staticText: legacy, theme: 'default', themeInfo: null,
        defaultLayout: path.resolve('resources/html/common/layout/default.art'),
        _res_path: path.resolve('resources').replaceAll('\\', '/') + '/',
        sys: { scale: '' }, Version: { ver: 'test' }, _plugin: 'phi-plugin',
        data: [{ type: 'space', label: '渲染器', value: '跟随宿主（自动选择渲染器）' }],
    }
    const html = renderPvisSource(fs.readFileSync(file, 'utf8'), data)
    assert.match(html, /<div class="line setting-expanded">/)
    assert.match(html, /<p name="pvis">跟随宿主（自动选择渲染器）<\/p>/)
    assert.equal(Object.hasOwn(legacy, 'fitRule'), false)
})
