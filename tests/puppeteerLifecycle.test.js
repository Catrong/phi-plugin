// @ts-nocheck -- Browser doubles intentionally implement only lifecycle methods.
import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import puppeteer from 'puppeteer'
import Puppeteer from '../model/render/puppeteer.js'
import { fileURLToPath } from 'node:url'

function browserDouble(pid = 321) {
    const browser = new EventEmitter()
    const child = { pid, exitCode: null, signalCode: null }
    browser.process = () => child
    browser.wsEndpoint = () => 'test://browser'
    browser.close = async () => { child.exitCode = 0; browser.emit('disconnected') }
    return browser
}

test('disconnect cleanup blocks concurrent relaunch until the old browser exits', async t => {
    const renderer = new Puppeteer({ idleTimeout: 0 })
    const old = browserDouble()
    const next = browserDouble(322)
    let finishClose
    old.close = () => new Promise(resolve => {
        finishClose = () => { old.process().exitCode = 0; resolve() }
    })
    renderer.browser = old
    renderer.browserPid = 321
    const launch = t.mock.method(puppeteer, 'launch', async () => next)
    renderer.onDisconnected(old)
    const first = renderer.browserInit()
    const second = renderer.browserInit()
    await delay(0)
    assert.equal(renderer.closingPid, 321)
    assert.equal(launch.mock.callCount(), 0)
    finishClose()
    assert.equal(await first, next)
    assert.equal(await second, next)
    assert.equal(launch.mock.callCount(), 1)
    await renderer.shutdown()
})

test('shutdown during an in-flight launch closes the new browser and prevents relaunch', async t => {
    const renderer = new Puppeteer({ idleTimeout: 0 })
    const browser = browserDouble()
    let finishLaunch
    t.mock.method(puppeteer, 'launch', () => new Promise(resolve => { finishLaunch = resolve }))
    const launching = renderer.browserInit()
    const shutdown = renderer.shutdown()
    finishLaunch(browser)
    assert.equal(await launching, false)
    await shutdown
    assert.equal(browser.process().exitCode, 0)
    assert.equal(await renderer.browserInit(), false)
})

test('shutdown waits for an existing close without allowing a waiting request to relaunch', async t => {
    const renderer = new Puppeteer({ idleTimeout: 0 })
    const browser = browserDouble()
    let finishClose
    browser.close = () => new Promise(resolve => {
        finishClose = () => { browser.process().exitCode = 0; resolve() }
    })
    renderer.browser = browser
    renderer.browserPid = 321
    const launch = t.mock.method(puppeteer, 'launch', async () => browserDouble(322))
    const closing = renderer.closeBrowser()
    const request = renderer.browserInit()
    let completed = false
    const shutdown = renderer.shutdown().then(() => { completed = true })
    await delay(0)
    assert.equal(completed, false)
    finishClose()
    await Promise.all([closing, shutdown])
    assert.equal(await request, false)
    assert.equal(launch.mock.callCount(), 0)
})

test('concurrent restarts share one close and one replacement launch', async t => {
    const renderer = new Puppeteer({ idleTimeout: 0 })
    const browser = browserDouble()
    renderer.browser = browser
    renderer.browserPid = 321
    const close = t.mock.method(browser, 'close', async () => { browser.process().exitCode = 0 })
    const next = browserDouble(322)
    const launch = t.mock.method(puppeteer, 'launch', async () => next)
    await Promise.all([renderer.restart(true), renderer.restart(true)])
    assert.equal(close.mock.callCount(), 1)
    assert.equal(launch.mock.callCount(), 1)
    assert.equal(renderer.browser, next)
    await renderer.shutdown()
})

test('profile errors do not delete the profile or launch a second browser', async t => {
    const fs = await import('node:fs/promises')
    const renderer = new Puppeteer({ idleTimeout: 0 })
    const rm = t.mock.method(fs.default, 'rm', async () => { throw new Error('must not delete') })
    const launch = t.mock.method(puppeteer, 'launch', async () => {
        throw new Error(`profile in use: ${renderer.config.userDataDir}`)
    })
    assert.equal(await renderer.browserInit(), false)
    assert.equal(launch.mock.callCount(), 1)
    assert.equal(rm.mock.callCount(), 0)
})

for (const failure of ['template-empty', 'template-throw', 'new-page', 'render', 'empty-image']) {
    test(`${failure} restores idle cleanup and closes any created page`, async t => {
        const renderer = new Puppeteer({ idleTimeout: 10, closeTimeout: 50 })
        const browsers = []
        let pageClosed = false
        t.mock.method(puppeteer, 'launch', async () => {
            const browser = browserDouble(321 + browsers.length)
            browser.newPage = async () => {
                if (failure === 'new-page') throw new Error('newPage failure')
                return { isClosed: () => pageClosed, close: async () => { pageClosed = true } }
            }
            browsers.push(browser)
            return browser
        })
        renderer.dealTpl = () => {
            if (failure === 'template-throw') throw new Error('template failure')
            return failure === 'template-empty' ? false : 'test.html'
        }
        renderer.renderPage = async () => {
            if (failure === 'render') throw new Error('render failure')
            return []
        }
        assert.equal(await renderer.screenshot('test/image'), false)
        assert.ok(renderer.idleTimer)
        assert.equal(renderer.shoting.length, 0)
        if (failure === 'render' || failure === 'empty-image') assert.equal(pageClosed, true)
        await delay(40)
        if (renderer.closePromise) await renderer.closePromise
        assert.equal(renderer.browser, false)
        assert.ok(browsers.every(browser => browser.process().exitCode === 0))
        await renderer.shutdown()
    })
}

test('close timeout kills the tracked browser and waits for process exit', async () => {
    const renderer = new Puppeteer({ idleTimeout: 0, closeTimeout: 10 })
    const browser = browserDouble()
    browser.close = () => new Promise(() => {})
    let killedPid
    renderer.killProcess = pid => { killedPid = pid; browser.process().signalCode = 'SIGKILL' }
    await renderer.stop(browser, 321)
    assert.equal(killedPid, 321)
    assert.equal(browser.process().signalCode, 'SIGKILL')
})

test('render timeout closes the old browser and the replacement is reclaimed when idle', async t => {
    const renderer = new Puppeteer({ idleTimeout: 10, puppeteerTimeout: 10 })
    const browsers = []
    t.mock.method(puppeteer, 'launch', async () => {
        const browser = browserDouble(321 + browsers.length)
        browser.newPage = async () => ({ isClosed: () => false, close: async () => {} })
        browsers.push(browser)
        return browser
    })
    renderer.dealTpl = () => 'test.html'
    renderer.renderPage = () => new Promise(() => {})
    // Keep the test event loop alive while the renderer's unref'ed timeout fires.
    const [result] = await Promise.all([renderer.screenshot('test/image'), delay(20)])
    assert.equal(result, false)
    assert.equal(browsers.length, 2)
    assert.equal(browsers[0].process().exitCode, 0)
    await delay(40)
    if (renderer.closePromise) await renderer.closePromise
    assert.equal(renderer.browser, false)
    assert.equal(browsers[1].process().exitCode, 0)
})

test('failed process cleanup retains PID and blocks replacement launch', async t => {
    const renderer = new Puppeteer({ idleTimeout: 0, closeTimeout: 10 })
    renderer.browser = browserDouble()
    renderer.browser.close = async () => {}
    renderer.browserPid = 321
    renderer.killProcess = () => {}
    const launch = t.mock.method(puppeteer, 'launch', async () => browserDouble(322))
    await assert.rejects(renderer.closeBrowser(), /仍未退出/)
    assert.equal(renderer.closingPid, 321)
    await assert.rejects(renderer.browserInit(), /仍未退出/)
    assert.equal(launch.mock.callCount(), 0)
    renderer.forceShutdown()
})

test('POSIX fallback kills the dedicated process group instead of only the parent', t => {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    t.after(() => Object.defineProperty(process, 'platform', descriptor))
    const kill = t.mock.method(process, 'kill', () => true)
    const renderer = new Puppeteer({ idleTimeout: 0 })
    renderer.killProcess(321)
    assert.deepEqual(kill.mock.calls[0].arguments, [-321, 'SIGKILL'])
})

test('permanent shutdown closes real template watchers and drops template caches', async () => {
    const renderer = new Puppeteer({ idleTimeout: 0 })
    const file = fileURLToPath(import.meta.url)
    renderer.watch(file)
    const watcher = renderer.watcher[file]
    try {
        await new Promise(resolve => watcher.once('ready', resolve))
        renderer.html[file] = 'cached template'
        await renderer.closeBrowser()
        assert.equal(watcher.closed, false, 'idle browser closure must keep template watching')
        await Promise.all([renderer.shutdown(), renderer.shutdown()])
        assert.equal(watcher.closed, true)
        assert.deepEqual(renderer.watcher, {})
        assert.deepEqual(renderer.html, {})
        assert.deepEqual(renderer.phiTemplateIdentity, {})
        assert.equal(renderer.phiTemplateWatchers.size, 0)
        renderer.watch(file)
        assert.deepEqual(renderer.watcher, {}, 'shutdown renderer cannot create another watcher')
    } finally {
        await watcher.close()
    }
})

test('watchers are released even when browser cleanup fails', async () => {
    const renderer = new Puppeteer({ idleTimeout: 0 })
    let closed = 0
    renderer.watcher = { one: { close: async () => { closed++ } } }
    renderer.closeBrowser = async () => { throw new Error('browser cleanup failed') }
    await assert.rejects(renderer.shutdown(), /browser cleanup failed/)
    assert.equal(closed, 1)
    assert.deepEqual(renderer.watcher, {})
})

for (const mode of ['hang', 'reject']) {
    test(`page close ${mode} recycles its browser and lets screenshot finish`, { timeout: 2000 }, async () => {
        const renderer = new Puppeteer({ pageCloseTimeout: 10, closeTimeout: 10, idleTimeout: 10 })
        const browser = browserDouble()
        browser.newPage = async () => ({
            isClosed: () => false,
            close: () => mode === 'hang' ? new Promise(() => {}) : Promise.reject(new Error('close failed')),
        })
        renderer.browser = browser
        renderer.browserPid = 321
        renderer.dealTpl = () => 'test.html'
        renderer.renderPage = async () => { renderer.renderNum++; return [Buffer.from('image')] }
        assert.deepEqual(await renderer.screenshot('test/image'), Buffer.from('image'))
        assert.equal(browser.process().exitCode, 0)
        assert.equal(renderer.browser, false)
        assert.equal(renderer.shoting.length, 0)
        await renderer.shutdown()
    })
}

test('late page close timeout never closes a replacement browser', { timeout: 2000 }, async () => {
    const renderer = new Puppeteer({ pageCloseTimeout: 10, idleTimeout: 0 })
    const old = browserDouble()
    const replacement = browserDouble(322)
    renderer.browser = replacement
    await renderer.closePage({ close: () => new Promise(() => {}) }, old)
    assert.equal(renderer.browser, replacement)
    assert.equal(replacement.process().exitCode, null)
    await renderer.shutdown()
})
