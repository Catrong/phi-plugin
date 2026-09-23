import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

const execute = promisify(execFile)

/** @param {string} cwd @param {string[]} args */
async function git(cwd, ...args) {
    const result = await execute('git', ['-c', 'protocol.file.allow=always', ...args], {
        cwd, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    return result.stdout.trim()
}

/** 与 ill_runUpdate() 中的命令链保持一致 @param {string} directory */
async function runArtworkUpdate(directory) {
    await git(directory, 'fetch', '--all', '--prune', '--depth=1')
    await git(directory, 'reset', '--hard', 'origin/main')
    await git(directory, 'clean', '-fd')
    await git(directory, 'reflog', 'expire', '--expire=now', '--expire-unreachable=now', '--all')
    await git(directory, 'repack', '-a', '-d', '-q')
}

/** 统计仓库中所有对象（含不可达）里的 blob 数量 @param {string} directory */
async function blobCount(directory) {
    const listed = await git(directory, 'cat-file', '--batch-all-objects', '--batch-check=%(objecttype)')
    return listed.split('\n').filter(line => line === 'blob').length
}

/** @param {string} directory */
async function shallowBounds(directory) {
    const file = path.join(directory, '.git', 'shallow')
    if (!fs.existsSync(file)) return []
    return (await fs.promises.readFile(file, 'utf8')).trim().split('\n').filter(Boolean)
}

test('downill fetches at depth 1, drops the reflog and repacks so .git stops growing', () => {
    const source = fs.readFileSync(new URL('../apps/update.js', import.meta.url), 'utf8')
    assert.match(source, /git -C \$\{repoPath\} fetch --all --prune --depth=1`/)
    assert.match(source, /git -C \$\{repoPath\} reflog expire --expire=now --expire-unreachable=now --all`/)
    assert.match(source, /git -C \$\{repoPath\} repack -a -d/)
})

test('artwork updates keep the clone at depth 1 instead of accumulating history', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'phi-ill-depth-'))
    const remote = path.join(root, 'remote.git')
    const source = path.join(root, 'source')
    const artwork = path.join(root, 'artwork')
    try {
        await git(root, 'init', '--bare', '--quiet', remote)
        await git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main')
        await git(root, 'clone', '--quiet', remote, source)
        await git(source, 'config', 'user.name', 'Fixture')
        await git(source, 'config', 'user.email', 'fixture@example.invalid')
        for (const content of ['one', 'two', 'three']) {
            await fs.promises.writeFile(path.join(source, 'data.txt'), content)
            await git(source, 'add', '.')
            await git(source, 'commit', '--quiet', '-m', content)
        }
        await git(source, 'push', '--quiet', '-u', 'origin', 'main')

        // 首次安装：ill_clone() 的 --depth=1
        await git(root, 'clone', '--quiet', '--depth=1', pathToFileURL(remote).href, artwork)

        // 连续三次更新，每次远程都产生一个新提交
        for (const content of ['four', 'five', 'six']) {
            await fs.promises.writeFile(path.join(source, 'data.txt'), content)
            await git(source, 'commit', '--quiet', '-am', content)
            await git(source, 'push', '--quiet')
            await runArtworkUpdate(artwork)
        }

        // 历史被截断回单个提交，且被替换掉的旧曲绘对象真的从 .git 里消失了
        assert.equal(await git(artwork, 'rev-list', '--count', 'HEAD'), '1')
        assert.equal((await shallowBounds(artwork)).length, 1)
        assert.equal(await blobCount(artwork), 1)

        // 远程没有新提交时同样执行命令链：优化不依赖「本次是否有更新」
        await runArtworkUpdate(artwork)
        await runArtworkUpdate(artwork)

        assert.equal(await git(artwork, 'rev-list', '--count', 'HEAD'), '1')
        assert.equal((await shallowBounds(artwork)).length, 1)
        assert.equal(await blobCount(artwork), 1)
        assert.equal(await fs.promises.readFile(path.join(artwork, 'data.txt'), 'utf8'), 'six')
    } finally {
        assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep))
        await fs.promises.rm(root, { recursive: true, force: true })
    }
})
