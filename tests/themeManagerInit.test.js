import assert from 'node:assert/strict'
import test from 'node:test'
import themeManager from '../model/theme/manager.js'

test('theme manager initialization can reuse an already-ready watcher', async () => {
    const initialized = await Promise.race([
        themeManager.init(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('theme manager reinitialization timed out')), 2_000)),
    ])
    assert.equal(initialized, themeManager)
})
