import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
    assertFreshMarketInstallCapacity,
    assertMarketInstallQuota,
    FreshInstallRateLimiter,
    PersistentFreshInstallRateLimiter,
    freshInstallRateLimiter,
    getMarketThemeStorageUsage,
    ThemeInstallCoordinator,
} from '../model/theme/installGuard.js'
import { installLatestMarketTheme, ThemeUseService } from '../model/theme/useService.js'
import themeManager from '../model/theme/manager.js'
import makeRequest from '../model/api/makeRequest.js'
import { themesDir } from '../model/theme/paths.js'

/** @returns {{promise:Promise<void>,resolve:()=>void}} */
function deferred() {
    /** @type {() => void} */ let resolve = () => {}
    const promise = new Promise(resolvePromise => { resolve = () => resolvePromise(undefined) })
    return { promise, resolve }
}

/** @param {string} root @param {string} themeId @param {number} bytes */
async function makeInstalledTheme(root, themeId, bytes) {
    const directory = path.join(root, themeId)
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(path.join(directory, 'payload.bin'), Buffer.alloc(bytes))
    await fs.writeFile(path.join(directory, '.phi-market.json'), JSON.stringify({
        source: 'phi-theme-marketplace',
        slug: themeId,
        version: '1.0.0',
        sha256: 'a'.repeat(64),
    }))
    return directory
}

test('theme install coordinator deduplicates a slug and bounds distinct pending installs', async () => {
    const coordinator = new ThemeInstallCoordinator({ maxPending: 1 })
    const gate = deferred()
    let sameThemeCalls = 0
    const first = coordinator.schedule('same-theme', async () => {
        sameThemeCalls++
        await gate.promise
        return 'installed'
    })
    const duplicate = coordinator.schedule('same-theme', async () => {
        sameThemeCalls++
        return 'duplicate'
    })
    assert.equal(duplicate, first)

    const queued = coordinator.schedule('queued-theme', async () => 'queued')
    await assert.rejects(
        coordinator.schedule('overflow-theme', async () => 'overflow'),
        error => /** @type {any} */ (error)?.code === 'theme_install_queue_full',
    )
    gate.resolve()
    assert.equal(await first, 'installed')
    assert.equal(await duplicate, 'installed')
    assert.equal(await queued, 'queued')
    assert.equal(sameThemeCalls, 1)
})

test('theme install coordinator starts a new flight immediately after await', async () => {
    const coordinator = new ThemeInstallCoordinator()
    let calls = 0
    assert.equal(await coordinator.schedule('repeat-theme', async () => ++calls), 1)
    assert.equal(await coordinator.schedule('repeat-theme', async () => ++calls), 2)
    assert.equal(calls, 2)
})

test('fresh install limiter uses a per-user sliding window', () => {
    let now = 1_000
    const limiter = new FreshInstallRateLimiter({ limit: 2, windowMs: 100, now: () => now })
    assert.equal(limiter.consume('user-a'), true)
    assert.equal(limiter.consume('user-a'), true)
    assert.throws(
        () => limiter.consume('user-a'),
        error => /** @type {any} */ (error)?.code === 'theme_install_rate_limited',
    )
    assert.equal(limiter.consume('user-b'), true)
    now += 101
    assert.equal(limiter.consume('user-a'), true)
})

test('persistent fresh-install limits survive a limiter restart', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-theme-rate-state-'))
    const filePath = path.join(root, 'limits.json')
    try {
        const first = new PersistentFreshInstallRateLimiter({ filePath, limit: 2, windowMs: 100, now: () => 1_000 })
        await first.consume('user-a')
        await first.consume('user-a')
        const restarted = new PersistentFreshInstallRateLimiter({ filePath, limit: 2, windowMs: 100, now: () => 1_001 })
        await assert.rejects(
            restarted.consume('user-a'),
            error => /** @type {any} */ (error)?.code === 'theme_install_rate_limited',
        )
        assert.equal(await restarted.consume('user-b'), true)
    } finally {
        await fs.rm(root, { recursive: true, force: true })
    }
})

test('local and offline-cached selections bypass fresh-install limits', async () => {
    const requesterId = 'test:bot:rate-limited-user'
    await freshInstallRateLimiter.clear(requesterId)
    for (let index = 0; index < freshInstallRateLimiter.limit; index++) {
        await freshInstallRateLimiter.consume(requesterId)
    }
    await assert.rejects(
        freshInstallRateLimiter.consume(requesterId),
        error => /** @type {any} */ (error)?.code === 'theme_install_rate_limited',
    )

    const originals = {
        getTheme: themeManager.getTheme,
        isCustomTheme: themeManager.isCustomTheme,
        isThemeAvailable: themeManager.isThemeAvailable,
    }
    let marketInstalled = false
    themeManager.getTheme = themeId => /** @type {any} */ ({ id: themeId, name: 'Local', marketInstalled, marketVersion: '1.0.0' })
    themeManager.isCustomTheme = () => true
    themeManager.isThemeAvailable = () => true
    let onlineCalls = 0
    const service = new ThemeUseService({
        marketEnabled: () => false,
        getTheme: async () => { onlineCalls++; return /** @type {any} */ ({}) },
        install: async () => { onlineCalls++; return /** @type {any} */ ({}) },
    })
    try {
        const local = await service.use('local-theme', { requesterId })
        assert.equal(local.local, true)
        marketInstalled = true
        const cached = await service.use('cached-theme', { requesterId })
        assert.equal(cached.cached, true)
        assert.equal(cached.offline, true)
        assert.equal(onlineCalls, 0)
    } finally {
        await freshInstallRateLimiter.clear(requesterId)
        themeManager.getTheme = originals.getTheme
        themeManager.isCustomTheme = originals.isCustomTheme
        themeManager.isThemeAvailable = originals.isThemeAvailable
    }
})

test('fresh downloads are rate-limited after authorization while an exact cache hit is not', async () => {
    const requesterId = 'test:bot:cached-user'
    const freshThemeId = `ratelimit${Date.now()}`
    const cachedThemeId = `cachehit${Date.now()}`
    const cachedTarget = path.join(themesDir, cachedThemeId)
    const originalAuthorize = makeRequest.requestThemeDownload
    const sha256 = 'c'.repeat(64)
    /** @param {string} themeId */
    const response = themeId => ({
        ok: true,
        download: {
            downloadId: `download-${themeId}`,
            themeId,
            version: '1.0.0',
            fileName: `${themeId}.zip`,
            contentType: 'application/zip',
            size: 1,
            sha256,
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            downloadUrl: `https://lyh.org.cn:18473/api/themes/${themeId}.zip`,
        },
    })
    await freshInstallRateLimiter.clear(requesterId)
    for (let index = 0; index < freshInstallRateLimiter.limit; index++) {
        await freshInstallRateLimiter.consume(requesterId)
    }
    makeRequest.requestThemeDownload = async ({ themeId }) => response(themeId)

    try {
        await assert.rejects(
            installLatestMarketTheme(freshThemeId, { requesterId }),
            error => /** @type {any} */ (error)?.code === 'theme_install_rate_limited',
        )

        await fs.mkdir(cachedTarget, { recursive: true })
        await fs.writeFile(path.join(cachedTarget, 'info.yaml'), `id: ${cachedThemeId}\nname: Cached Theme\n`)
        await fs.writeFile(path.join(cachedTarget, '.phi-market.json'), JSON.stringify({
            source: 'phi-theme-marketplace',
            slug: cachedThemeId,
            version: '1.0.0',
            sha256,
        }))
        themeManager.scan()
        const cached = await installLatestMarketTheme(cachedThemeId, { requesterId })
        assert.equal(cached.cached, true)
        assert.equal(cached.theme.id, cachedThemeId)
    } finally {
        makeRequest.requestThemeDownload = originalAuthorize
        await freshInstallRateLimiter.clear(requesterId)
        await fs.rm(cachedTarget, { recursive: true, force: true })
        themeManager.scan()
    }
})

test('a same-name local theme is rejected before authorization or rate consumption', async () => {
    const themeId = `localconflict${Date.now()}`
    const target = path.join(themesDir, themeId)
    const originalAuthorize = makeRequest.requestThemeDownload
    let authorizationCalls = 0
    try {
        await fs.mkdir(target, { recursive: true })
        await fs.writeFile(path.join(target, 'info.yaml'), `id: ${themeId}\nname: Local Theme\n`)
        makeRequest.requestThemeDownload = async () => {
            authorizationCalls++
            return /** @type {any} */ ({})
        }
        await assert.rejects(
            installLatestMarketTheme(themeId, { requesterId: 'test:bot:local-conflict' }),
            error => /** @type {any} */ (error)?.code === 'theme_conflicts_with_local_theme',
        )
        assert.equal(authorizationCalls, 0)
    } finally {
        makeRequest.requestThemeDownload = originalAuthorize
        await fs.rm(target, { recursive: true, force: true })
        themeManager.scan()
    }
})

test('market theme count and disk quotas include only valid marketplace installs', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-theme-quota-'))
    try {
        const existing = await makeInstalledTheme(root, 'existing-theme', 64)
        await fs.mkdir(path.join(root, 'local-theme'))
        await fs.writeFile(path.join(root, 'local-theme', 'payload.bin'), Buffer.alloc(1_024))

        const usage = await getMarketThemeStorageUsage({ root })
        assert.equal(usage.count, 1)
        assert.equal(usage.byTheme.has('existing-theme'), true)
        assert.equal(usage.byTheme.has('local-theme'), false)
        assert.equal((await assertFreshMarketInstallCapacity('existing-theme', { root, maxInstalled: 1 })).fresh, false)
        await assert.rejects(
            assertFreshMarketInstallCapacity('new-theme', { root, maxInstalled: 1 }),
            error => /** @type {any} */ (error)?.code === 'theme_install_count_quota_exceeded',
        )

        const stage = path.join(root, '.stage')
        await fs.mkdir(stage)
        await fs.writeFile(path.join(stage, 'large.bin'), Buffer.alloc(256))
        await assert.rejects(
            assertMarketInstallQuota('new-theme', stage, {
                root,
                maxInstalled: 2,
                maxDiskBytes: usage.totalBytes + 128,
            }),
            error => /** @type {any} */ (error)?.code === 'theme_install_disk_quota_exceeded',
        )

        await fs.writeFile(path.join(existing, 'payload.bin'), Buffer.alloc(512))
        const updatedUsage = await getMarketThemeStorageUsage({ root })
        const replacement = await assertMarketInstallQuota('existing-theme', stage, {
            root,
            maxInstalled: 1,
            maxDiskBytes: updatedUsage.totalBytes,
        })
        assert.equal(replacement.count, 1)
        assert.ok(replacement.totalBytes < updatedUsage.totalBytes)
    } finally {
        await fs.rm(root, { recursive: true, force: true })
    }
})

test('market quota reserves a hidden interrupted-install backup', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-theme-backup-quota-'))
    const themeId = 'reserved-theme'
    const target = await makeInstalledTheme(root, themeId, 64)
    const backup = path.join(root, `.phi-market-backup-${themeId}-${crypto.randomUUID()}`)
    try {
        await fs.rename(target, backup)
        const usage = await getMarketThemeStorageUsage({ root })
        assert.equal(usage.count, 1)
        assert.equal(usage.byTheme.has(themeId), true)
        await assert.rejects(
            assertFreshMarketInstallCapacity('another-theme', { root, maxInstalled: 1 }),
            error => /** @type {any} */ (error)?.code === 'theme_install_count_quota_exceeded',
        )
    } finally {
        await fs.rm(root, { recursive: true, force: true })
    }
})
