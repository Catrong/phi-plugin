import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { detectEnvironment } from '../components/platform/environment.js'

/** @param {string} source @param {string[]} [flags] */
function run(source, flags = []) {
    const env = { ...process.env }
    delete env.KOISHI_SHARED
    delete env.KOISHI_CONFIG_FILE
    return execFileSync(process.execPath, [...flags, '--input-type=module', '-e', source], {
        cwd: new URL('../', import.meta.url), env, encoding: 'utf8', timeout: 15000,
    })
}

test('recognizes Koishi host signals and otherwise defaults to Yunzai', () => {
    assert.equal(detectEnvironment(undefined, {}), 'yunzai')
    assert.equal(detectEnvironment(undefined, { KOISHI_SHARED: '{}' }), 'koishi')
    assert.equal(detectEnvironment(undefined, { KOISHI_CONFIG_FILE: 'koishi.yml' }), 'koishi')
    assert.equal(detectEnvironment({ middleware() {}, on() {} }, {}), 'koishi')
    assert.equal(detectEnvironment(undefined, { NODE_ENV: 'development', KOISHI_CONFIG_FILE: '' }), 'yunzai')
})

test('Koishi CommonJS entry can be required without initializing business or Yunzai', () => {
    run(`
        import assert from 'node:assert/strict'
        import { createRequire } from 'node:module'
        const plugin = createRequire(import.meta.url)('./')
        assert.equal(typeof plugin.apply, 'function')
        assert.deepEqual(plugin.inject.required, ['database', 'puppeteer'])
        const { getPlatformAdapter } = await import('./components/platform/state.js')
        assert.equal(getPlatformAdapter(), undefined)
    `)
})

test('Koishi ESM entry waits for Context instead of starting Yunzai', () => {
    run(`
        import assert from 'node:assert/strict'
        process.env.KOISHI_SHARED = '{}'
        const plugin = await import('./index.js')
        assert.deepEqual(plugin.apps, {})
        assert.equal(typeof plugin.apply, 'function')
        const { getPlatformAdapter } = await import('./components/platform/state.js')
        assert.equal(getPlatformAdapter(), undefined)
    `)
})

test('Koishi apply loads the installed host and registers middleware', () => {
    run(`
        import assert from 'node:assert/strict'
        import { mock } from 'node:test'
        import { createRequire } from 'node:module'
        // 隔离曲库、网络及浏览器初始化；宿主依赖和平台初始化均使用真实代码。
        mock.module(new URL('./runtime.js', import.meta.url).href, { namedExports: { apps: {} } })
        const require = createRequire(import.meta.url)
        const plugin = require('./')
        let middleware
        let saved
        let dispose
        const ctx = {
            middleware(fn) { middleware = fn },
            on(event, fn) { if (event === 'dispose') dispose = fn },
            scope: { config: { database: false }, update(value) { saved = value } },
        }
        await plugin.apply(ctx, { database: false, renderScale: 125 })
        assert.equal(typeof middleware, 'function')
        const { getPlatformAdapter } = await import('./components/platform/state.js')
        const adapter = getPlatformAdapter()
        assert.equal(adapter.name, 'koishi')
        const image = adapter.segment.image('https://example.com/test.png')
        const expected = require('koishi').h.image('https://example.com/test.png')
        assert.equal(Object.getPrototypeOf(image), Object.getPrototypeOf(expected))
        assert.equal(image.toString(), expected.toString())
        let nextCalled = false
        await middleware({ content: 'hello', userId: '1', bot: {} }, () => { nextCalled = true })
        assert.equal(nextCalled, true)
        const { getHostSettings, writeHostSetting } = await import('./components/settings/host.js')
        assert.equal(getHostSettings().renderScale, 125)
        writeHostSetting('renderScale', 150)
        assert.equal(saved.renderScale, 150)
        assert.equal(saved.database, false)
        dispose()
        assert.deepEqual(getHostSettings(), {})
    `, ['--experimental-test-module-mocks'])
})

test('Koishi adapter is installed before business classes bind their base', () => {
    run(`
        import assert from 'node:assert/strict'
        const { useKoishiAdapter, registerKoishiApps } = await import('./components/platform/koishi.js')
        let middleware
        const ctx = { middleware(fn) { middleware = fn } }
        const adapter = useKoishiAdapter(ctx, { database: false })
        const { default: platform } = await import('./components/platform/index.js')
        assert.equal(platform.name, 'koishi')
        assert.equal(platform.PluginBase, adapter.PluginBase)
        const plugin = await import('./index.js')
        assert.deepEqual(plugin.apps, {})
        let handled = false
        class App extends platform.PluginBase {
            constructor() { super({ rule: [{ reg: '^hello$', fnc: 'hello' }] }) }
            hello() { handled = true }
        }
        registerKoishiApps(ctx, { App }, adapter)
        await middleware({ content: 'hello', userId: '1', bot: {} }, () => {})
        assert.equal(handled, true)
    `)
})

test('default platform still initializes Yunzai', () => {
    run(`
        import assert from 'node:assert/strict'
        const { default: platform } = await import('./components/platform/index.js')
        assert.equal(platform.name, 'yunzai')
        assert.equal(typeof platform.PluginBase, 'function')
    `)
})
