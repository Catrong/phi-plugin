import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { withReliableTemplateCache } from '../components/platform/yunzai.js'
import { dealPvisTemplate } from '../model/render/pvisTemplate.js'

test('TRSS 静态模板接口不遮住插件方法，独立缓存支持 pvis 和原子替换', async () => {
    class StaticHostRenderer {
        static html = { host: 'keep' }
        static watcher = { host: 'keep' }
        constructor() { this.dealTpl = StaticHostRenderer.dealTpl.bind(StaticHostRenderer) }
        static dealTpl() { throw new Error('不可使用宿主静态模板缓存') }
    }
    const ReliableRenderer = withReliableTemplateCache(StaticHostRenderer)
    class PluginRenderer extends ReliableRenderer {
        /** @param {string} name @param {any} data */
        dealTpl(name, data) { return dealPvisTemplate(this, name, data, super.dealTpl) }
    }
    const first = new PluginRenderer()
    const second = new PluginRenderer()
    assert.equal(Object.hasOwn(first, 'dealTpl'), false)
    assert.notEqual(first.html, second.html)
    assert.notEqual(first.watcher, second.watcher)
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-trss-template-'))
    const name = `phi-trss-template-${process.pid}`
    const output = path.resolve('temp/html', name)
    const tplFile = path.join(root, 'page.art')
    const source = '{{set pvis = [200, 60, 30, 10]}}<p name="pvis">Short</p>'
    try {
        await fs.writeFile(tplFile, source)
        const file = first.dealTpl(name, { tplFile, saveId: 'one', renderNoJs: true })
        assert.equal(first.html[tplFile], source)
        assert.match(await fs.readFile(String(file), 'utf8'), /font-size: 30px/)
        assert.equal(Object.keys(second.html).length, 0)
        await fs.writeFile(path.join(root, 'replacement.art'), 'replacement {{value}}')
        await fs.rename(path.join(root, 'replacement.art'), tplFile)
        const replaced = first.dealTpl(name, { tplFile, saveId: 'two', value: 'works' })
        assert.equal(await fs.readFile(String(replaced), 'utf8'), 'replacement works')
        assert.deepEqual(StaticHostRenderer.html, { host: 'keep' })
        assert.deepEqual(StaticHostRenderer.watcher, { host: 'keep' })
    } finally {
        await Promise.all(Object.values(first.watcher).map(watcher => watcher.close()))
        await fs.rm(root, { recursive: true, force: true })
        await fs.rm(output, { recursive: true, force: true })
    }
})
