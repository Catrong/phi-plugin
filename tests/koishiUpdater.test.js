import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createGitUpdater, runGit } from '../components/platform/koishiUpdater.js'
import { registerKoishiConsole } from '../components/platform/koishiConsole.js'

test('real Git updates both repositories, refuses dirty trees and does not discard files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-update-'))
    try {
        const remote = path.join(root, 'remote.git')
        const source = path.join(root, 'source')
        const pluginDir = path.join(root, 'plugin')
        const artworkDir = path.join(root, 'artwork')
        await runGit(['init', '--bare', remote], root)
        await runGit(['symbolic-ref', 'HEAD', 'refs/heads/main'], remote)
        await runGit(['clone', remote, source], root)
        await runGit(['config', 'user.name', 'Fixture'], source)
        await runGit(['config', 'user.email', 'fixture@example.invalid'], source)
        await fs.writeFile(path.join(source, 'data.txt'), 'one')
        await runGit(['add', '.'], source)
        await runGit(['commit', '-m', 'one'], source)
        await runGit(['push', '-u', 'origin', 'main'], source)
        await runGit(['clone', remote, pluginDir], root)
        await runGit(['clone', remote, artworkDir], root)
        await fs.writeFile(path.join(source, 'data.txt'), 'two')
        await runGit(['commit', '-am', 'two'], source)
        await runGit(['push'], source)
        const updater = createGitUpdater({ pluginDir, artworkDir, readConfig: () => ({}) })
        assert.throws(() => updater.start('shell'), /未知/)
        assert.equal(updater.start('plugin').state, 'running')
        assert.throws(() => updater.start('artwork'), /正在执行/)
        await updater.wait()
        assert.equal(updater.status()?.state, 'success')
        assert.equal(await fs.readFile(path.join(pluginDir, 'data.txt'), 'utf8'), 'two')
        updater.start('artwork')
        await updater.wait()
        assert.equal(updater.status()?.state, 'success')
        assert.equal(await fs.readFile(path.join(artworkDir, 'data.txt'), 'utf8'), 'two')
        await fs.writeFile(path.join(pluginDir, 'data.txt'), 'local')
        updater.start('plugin')
        await updater.wait()
        assert.equal(updater.status()?.state, 'error')
        assert.match(updater.status()?.message || '', /未提交修改/)
        assert.equal(await fs.readFile(path.join(pluginDir, 'data.txt'), 'utf8'), 'local')
        updater.start('artwork')
        await updater.wait()
        assert.equal(updater.status()?.message, '已经是最新版本。')
    } finally {
        assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep))
        await fs.rm(root, { recursive: true, force: true })
    }
})

test('first artwork download uses saved settings and fixed argv, rejecting unrelated directories', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-update-clone-'))
    /** @type {string[][]} */
    const calls = []
    const artworkDir = path.join(root, 'artwork')
    const updater = createGitUpdater({ pluginDir: root, artworkDir,
        readConfig: () => ({ downIllUrl: 'https://github.com/example/artwork.git', githubProxy: 'https://proxy.example/' }),
        git: async args => { calls.push(args); return '' },
    })
    try {
        updater.start('artwork')
        await updater.wait()
        assert.deepEqual(calls, [['clone', '--depth=1', '--', 'https://proxy.example/https://github.com/example/artwork.git', artworkDir]])
        await fs.mkdir(artworkDir)
        await fs.writeFile(path.join(artworkDir, 'local.png'), 'keep')
        updater.start('artwork')
        await updater.wait()
        assert.equal(updater.status()?.state, 'error')
        assert.equal(calls.length, 1)
    } finally { await fs.rm(root, { recursive: true, force: true }) }
})

test('console actions require admin authority and disappear on plugin disposal', () => {
    /** @type {Record<string, any>} */
    const listeners = {}
    /** @type {(() => void) | undefined} */
    let dispose
    const updates = createGitUpdater({ pluginDir: '.', artworkDir: '.', readConfig: () => ({}) })
    registerKoishiConsole({ inject(/** @type {string[]} */ names, /** @type {any} */ apply) {
        assert.deepEqual(names, ['console'])
        apply({
            console: {
                listeners,
                addEntry() { return { id: 'fixture' } },
                addListener(/** @type {string} */ event, /** @type {any} */ callback, /** @type {any} */ options) { listeners[event] = { callback, ...options } },
            },
            on(/** @type {string} */ event, /** @type {any} */ callback) { if (event === 'dispose') dispose = callback },
        })
    } }, updates)
    const listener = listeners['phi-plugin/update/fixture']
    assert.equal(listener.authority, 4)
    assert.equal(listener.callback('status'), null)
    assert.throws(() => listener.callback('start', 'arbitrary-command'), /未知/)
    dispose?.()
    assert.equal(listeners['phi-plugin/update/fixture'], undefined)
    assert.throws(() => listener.callback('status'), /卸载/)
})
