import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execute = promisify(execFile)

/** @param {string[]} args @param {string} cwd */
export async function runGit(args, cwd) {
    try {
        const result = await execute('git', args, {
            cwd, windowsHide: true, timeout: 10 * 60_000, maxBuffer: 4 * 1024 * 1024,
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        })
        return result.stdout.trim()
    } catch (error) {
        const detail = /** @type {any} */ (error)
        throw new Error(String(detail.stderr || detail.message || 'Git 执行失败').slice(-2000))
    }
}

/** @param {string} directory */
async function exists(directory) {
    return fs.stat(directory).then(() => true, error => {
        if (error.code === 'ENOENT') return false
        throw error
    })
}

/**
 * 固定两个更新目标；客户端不能传入目录、命令或仓库地址。
 * @param {{pluginDir: string, artworkDir: string, readConfig: () => Record<string, any>, git?: typeof runGit}} options
 */
export function createGitUpdater({ pluginDir, artworkDir, readConfig, git = runGit }) {
    /** @type {{target: string, state: 'running' | 'success' | 'error', message: string} | null} */
    let job = null
    let completion = Promise.resolve()

    /** @param {'plugin' | 'artwork'} target */
    async function update(target) {
        const directory = target === 'plugin' ? pluginDir : artworkDir
        if (!await exists(path.join(directory, '.git'))) {
            if (target === 'plugin') throw new Error('插件目录不是 Git 仓库，无法更新。')
            if (await exists(directory) && (await fs.readdir(directory)).length) {
                throw new Error('曲绘目录已有文件且不是 Git 仓库，请先处理后重试。')
            }
            const config = readConfig()
            const url = new URL(String(config.downIllUrl || ''))
            if (!['https:', 'http:'].includes(url.protocol)) throw new Error('曲绘仓库地址需要使用 HTTP(S)。')
            let repository = url.href
            const proxy = config.githubProxy
            if (url.hostname === 'github.com' && proxy && proxy !== 'false') {
                const base = new URL(String(proxy))
                if (!['https:', 'http:'].includes(base.protocol)) throw new Error('GitHub 代理需要使用 HTTP(S)。')
                repository = `${base.href.replace(/\/$/, '')}/${repository}`
            }
            await fs.mkdir(path.dirname(directory), { recursive: true })
            await git(['clone', '--depth=1', '--', repository, directory], path.dirname(directory))
            return '曲绘库下载完成。'
        }
        const actual = await fs.realpath(directory)
        const root = await fs.realpath(await git(['rev-parse', '--show-toplevel'], directory))
        if (root !== actual) throw new Error('更新目录与 Git 仓库根目录不一致。')
        if (await git(['status', '--porcelain'], directory)) throw new Error('仓库有未提交修改，请先提交或保存修改后重试。')
        const before = await git(['rev-parse', 'HEAD'], directory)
        await git(['pull', '--ff-only'], directory)
        const after = await git(['rev-parse', 'HEAD'], directory)
        if (before === after) return '已经是最新版本。'
        return target === 'plugin' ? '插件更新完成，请重载插件；如依赖有变化，请重新运行安装脚本。' : '曲绘库更新完成。'
    }

    return {
        status() { return job ? { ...job } : null },
        /** @param {unknown} target */
        start(target) {
            if (target !== 'plugin' && target !== 'artwork') throw new Error('未知更新目标。')
            if (job?.state === 'running') throw new Error('已有更新任务正在执行，请稍后再试。')
            /** @type {NonNullable<typeof job>} */
            const current = { target, state: 'running', message: target === 'plugin' ? '正在更新插件…' : '正在更新曲绘库…' }
            job = current
            completion = update(target).then(message => {
                current.state = 'success'
                current.message = message
            }, error => {
                current.state = 'error'
                current.message = error instanceof Error ? error.message : String(error)
            })
            return { ...current }
        },
        wait() { return completion },
    }
}
