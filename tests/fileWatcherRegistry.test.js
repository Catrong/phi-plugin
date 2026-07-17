import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { FileWatcherRegistry } from '../components/FileWatcherRegistry.js'

test('reuses a watcher while replacing stale hot-reload callbacks', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-watcher-'))
    const file = path.join(directory, 'config.yaml')
    const registry = new FileWatcherRegistry()
    await fs.writeFile(file, 'value: 1\n')

    try {
        let staleCalls = 0
        const firstLease = registry.watch('config', file, () => staleCalls++)
        await new Promise(resolve => firstLease.watcher.once('ready', () => resolve(undefined)))

        const changed = new Promise(resolve => {
            const secondLease = registry.watch('config', file, resolve)
            assert.equal(secondLease.watcher, firstLease.watcher)
            void firstLease.close()
        })
        await fs.writeFile(file, 'value: 2\n')
        await changed

        assert.equal(staleCalls, 0)

        const replacementFile = path.join(directory, 'replacement.yaml')
        await fs.writeFile(replacementFile, 'value: 3\n')
        const replacementLease = registry.watch('config', replacementFile, () => {})
        assert.notEqual(replacementLease.watcher, firstLease.watcher)
        await firstLease.close()
        assert.equal(registry.entries.get('config')?.watcher, replacementLease.watcher)

        await registry.closeAll()
        assert.equal(registry.entries.size, 0)
    } finally {
        await registry.closeAll()
        await fs.rm(directory, { recursive: true, force: true })
    }
})
