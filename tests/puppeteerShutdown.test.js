import assert from 'node:assert/strict'
import test from 'node:test'
import Puppeteer from '../model/puppeteer.js'

test('force shutdown kills the tracked browser and prevents relaunch', async () => {
    const renderer = new Puppeteer({ idleTimeout: 0 }, 'shutdown-test')
    renderer.browserPid = 321
    let killedPid
    renderer.killProcess = pid => { killedPid = pid }

    renderer.forceShutdown()

    assert.equal(killedPid, 321)
    assert.equal(renderer.browser, false)
    assert.equal(renderer.browserPid, null)
    assert.equal(await renderer.browserInit(), false)
})
