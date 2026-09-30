import assert from 'node:assert/strict'
import test from 'node:test'
import { useKoishiAdapter, KoishiRenderer } from '../components/platform/koishi.js'

test('Koishi renderer imports with its platform base and uses the host configured Chrome', async () => {
    const browser = { process: () => ({ spawnfile: '/host/running/chrome' }) }
    useKoishiAdapter({ puppeteer: { config: { executablePath: '/host/configured/chrome' }, browser } }, { database: false })
    const { default: Renderer } = await import('../model/render/puppeteer.js')
    const renderer = new Renderer({}, 'koishi-configured')
    assert.ok(renderer instanceof KoishiRenderer)
    assert.equal(renderer.config.executablePath, '/host/configured/chrome')
    assert.equal(renderer.browser, false)
    await renderer.shutdown()
})

test('Koishi auto-detected Chrome path comes from the running browser without taking ownership', async () => {
    let closed = false
    const browser = {
        process: () => ({ spawnfile: '/host/detected/chrome', pid: 123 }),
        close() { closed = true },
    }
    useKoishiAdapter({ puppeteer: { config: {}, browser } }, { database: false })
    const { default: Renderer } = await import('../model/render/puppeteer.js')
    const renderer = new Renderer({}, 'koishi-detected')
    assert.equal(renderer.config.executablePath, '/host/detected/chrome')
    assert.equal(renderer.browserPid, null)
    assert.equal(renderer.browser, false)
    await renderer.shutdown()
    renderer.forceShutdown()
    assert.equal(closed, false)
})

test('an explicit plugin Chrome path takes precedence and missing host paths retain Puppeteer fallback', async () => {
    useKoishiAdapter({ puppeteer: { config: { executablePath: '/host/chrome' } } }, { database: false })
    const { default: Renderer } = await import('../model/render/puppeteer.js')
    const explicit = new Renderer({ chromiumPath: '/plugin/chrome' }, 'koishi-explicit')
    assert.equal(explicit.config.executablePath, '/plugin/chrome')
    await explicit.shutdown()
    useKoishiAdapter({}, { database: false })
    const fallback = new Renderer({}, 'koishi-fallback')
    assert.equal(fallback.config.executablePath, undefined)
    await fallback.shutdown()
})
