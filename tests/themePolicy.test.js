import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { ThemePolicyCache } from '../model/theme/policy.js'

test('theme policy cache persists and applies blacklist and whitelist semantics', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phi-theme-policy-'))
    const file = path.join(dir, 'policy.json')
    try {
        const cache = new ThemePolicyCache(file)
        assert.deepEqual(cache.snapshot(), { mode: 'blacklist', entries: [] })
        assert.equal(cache.isAllowed('ocean-salt'), true)
        assert.equal(cache.apply({ mode: 'blacklist', entries: ['ocean-salt', '../bad'] }), true)
        assert.equal(cache.isAllowed('ocean-salt'), false)
        assert.equal(cache.isAllowed('another-theme'), true)

        const reloaded = new ThemePolicyCache(file)
        assert.deepEqual(reloaded.snapshot(), { mode: 'blacklist', entries: ['ocean-salt'] })
        reloaded.apply({ mode: 'whitelist', entries: ['another-theme'] })
        assert.equal(reloaded.isAllowed('ocean-salt'), false)
        assert.equal(reloaded.isAllowed('another-theme'), true)
        assert.equal(reloaded.apply({ mode: 'invalid', entries: [] }), false)
    } finally {
        fs.rmSync(dir, { recursive: true, force: true })
    }
})
