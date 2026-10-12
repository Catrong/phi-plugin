import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import YAML from 'yaml'

const load = createRequire(import.meta.url)
const installer = load('../scripts/install-koishi.cjs')

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phi-koishi-install-'))
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'koishi-app', dependencies: { koishi: '^4.18.11' } }))
    fs.writeFileSync(path.join(root, 'koishi.yml'), '# Keep this comment\nplugins:\n  database-sqlite: {}\n')
    /** @type {string[]} */
    const calls = []
    /** @type {{command: string, args: string[], cwd: string}[]} */
    const executions = []
    const options = installer.parseArgs(['--root', root, '--manager', 'npm'])
    const core = path.join(root, 'external', 'phi-plugin')
    const wrapper = path.join(root, 'external', 'koishi-plugin-phi-plugin')
    const coreManifest = JSON.stringify({ name: 'phi-plugin', version: '1.0.2', exports: { './koishi': './koishi.cjs' } })
    const dependencies = {
        loadYaml: () => YAML,
        /** @returns {string} */
        run(/** @type {string} */ command, /** @type {string[]} */ args, /** @type {string} */ cwd = root) {
            calls.push([command, ...args].join(' '))
            executions.push({ command, args, cwd })
            if (command === 'npm' && args[0] === '--version') return '11.0.0'
            if (command === 'git' && args[0] === 'clone') {
                fs.mkdirSync(core, { recursive: true })
                fs.writeFileSync(path.join(core, 'package.json'), coreManifest)
                fs.writeFileSync(path.join(core, 'koishi.cjs'), "module.exports = { name: 'phi-plugin', apply() {}, Config: {} }")
            }
            if (['npm', 'pnpm'].includes(command) && args[0] === 'install' && cwd === root) {
                fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
                for (const [name, target] of [['phi-plugin', core], ['koishi-plugin-phi-plugin', wrapper]]) {
                    const link = path.join(root, 'node_modules', name)
                    if (!fs.existsSync(link)) fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
                }
            }
            return ''
        },
    }
    return { root, options, core, wrapper, calls, executions, coreManifest, dependencies,
        close() {
            const relative = path.relative(os.tmpdir(), root)
            assert.ok(relative.startsWith('phi-koishi-install-') && !relative.includes(path.sep))
            fs.rmSync(root, { recursive: true, force: true })
        },
    }
}

test('first install clones, links, verifies and registers; rerunning preserves source and config', () => {
    const env = fixture()
    try {
        installer.install(env.options, env.dependencies)
        assert.equal(fs.readFileSync(path.join(env.core, 'package.json'), 'utf8'), env.coreManifest)
        const config = fs.readFileSync(path.join(env.root, 'koishi.yml'), 'utf8')
        assert.match(config, /Keep this comment/)
        const parsed = YAML.parse(config)
        assert.deepEqual(parsed.plugins['phi-plugin'], {})
        assert.deepEqual(parsed.plugins.puppeteer, {})
        assert.deepEqual(parsed.plugins['database-sqlite'], {})
        const host = JSON.parse(fs.readFileSync(path.join(env.root, 'package.json'), 'utf8'))
        assert.equal(host.dependencies.puppeteer, '^24.16.2')
        assert.equal(host.dependencies['koishi-plugin-puppeteer'], '^3.9.0')
        assert.equal(Object.hasOwn(host.dependencies, '@pixel.js/shotium'), false)
        const wrapper = JSON.parse(fs.readFileSync(path.join(env.wrapper, 'package.json'), 'utf8'))
        assert.deepEqual(wrapper.koishi.service, { required: ['database'], optional: ['puppeteer'] })
        assert.equal(env.calls.filter(call => call.startsWith('git clone')).length, 1)
        installer.install(env.options, env.dependencies)
        assert.equal(env.calls.filter(call => call.startsWith('git clone')).length, 1)
        assert.equal(fs.readFileSync(path.join(env.root, 'koishi.yml'), 'utf8'), config)
        assert.equal(fs.readFileSync(path.join(env.core, 'package.json'), 'utf8'), env.coreManifest)
        assert.ok(fs.readdirSync(path.join(env.root, '.phi-plugin-install-backups')).length)
    } finally { env.close() }
})

test('dry-run does not execute commands or write package and configuration files', () => {
    const env = fixture()
    try {
        const before = fs.readFileSync(path.join(env.root, 'package.json'), 'utf8')
        installer.install({ ...env.options, dryRun: true }, env.dependencies)
        assert.deepEqual(env.calls, [])
        assert.equal(fs.existsSync(env.core), false)
        assert.equal(fs.readFileSync(path.join(env.root, 'package.json'), 'utf8'), before)
        assert.equal(fs.existsSync(path.join(env.root, '.phi-plugin-install-backups')), false)
    } finally { env.close() }
})

test('nested path-based entries retain instance IDs, disabled state, values and comments', () => {
    const source = '# config comment\nplugins:\n  group:test:\n    ~./external/phi-plugin/koishi.cjs:custom:\n      cmdhead: custom\n      apiBotClientSecret: test-secret\n  ~puppeteer: {}\n'
    const result = installer.configure(YAML, source)
    const config = YAML.parse(result.content)
    assert.equal(config.plugins['group:test']['~phi-plugin:custom'].apiBotClientSecret, 'test-secret')
    assert.equal(config.plugins['group:test']['~phi-plugin:custom'].cmdhead, 'custom')
    assert.equal(Object.hasOwn(config.plugins, 'phi-plugin'), false)
    assert.match(result.content, /config comment/)
    assert.equal(result.notices.length, 3)
})

test('duplicate plugin configuration and malformed YAML are rejected', () => {
    assert.throws(() => installer.configure(YAML, 'plugins:\n  phi-plugin:a: {}\n  group:b:\n    phi-plugin:c: {}\n'), /多个/)
    assert.throws(() => installer.configure(YAML, 'plugins: ['), /语法错误/)
})

test('renderer argument accepts all supported backends and rejects unsupported choices', () => {
    for (const renderer of ['puppeteer', 'shotium', 'auto']) {
        assert.equal(installer.parseArgs(['--renderer', renderer]).renderer, renderer)
    }
    assert.throws(() => installer.parseArgs(['--renderer', 'unknown']), /仅支持/)
    assert.throws(() => installer.parseArgs(['--renderer']), /缺少参数/)
})

test('Shotium configuration preserves the existing renderer and inactive Puppeteer without enabling it', () => {
    const source = '# keep\nplugins:\n  group:test:\n    phi-plugin:instance:\n      renderer: shotium # renderer comment\n      cmdhead: pg\n  ~puppeteer:\n    executablePath: C:/chrome.exe # browser comment\n'
    const result = installer.configure(YAML, source)
    const config = YAML.parse(result.content)
    assert.equal(result.renderer, 'shotium')
    assert.equal(config.plugins['group:test']['phi-plugin:instance'].renderer, 'shotium')
    assert.equal(Object.hasOwn(config.plugins, 'puppeteer'), false)
    assert.equal(config.plugins['~puppeteer'].executablePath, 'C:/chrome.exe')
    assert.match(result.content, /renderer comment/)
    assert.match(result.content, /browser comment/)
    assert.ok(!result.notices.some((/** @type {string} */ notice) => notice.includes('Puppeteer')))
    const switched = installer.configure(YAML, result.content, 'puppeteer')
    assert.equal(switched.renderer, 'puppeteer')
    assert.equal(YAML.parse(switched.content).plugins['group:test']['phi-plugin:instance'].renderer, 'puppeteer')
    assert.equal(Object.hasOwn(YAML.parse(switched.content).plugins, 'puppeteer'), false)
    assert.match(switched.content, /renderer comment/)
    assert.ok(switched.notices.some((/** @type {string} */ notice) => notice.includes('Puppeteer')))
})

test('fresh Shotium install adds only its SDK and retains it on an unspecified rerun', () => {
    const env = fixture()
    try {
        installer.install({ ...env.options, renderer: 'shotium' }, env.dependencies)
        let host = JSON.parse(fs.readFileSync(path.join(env.root, 'package.json'), 'utf8'))
        let config = YAML.parse(fs.readFileSync(path.join(env.root, 'koishi.yml'), 'utf8'))
        assert.equal(host.dependencies['@pixel.js/shotium'], '^0.12.2')
        assert.equal(Object.hasOwn(host.dependencies, 'puppeteer'), false)
        assert.equal(Object.hasOwn(host.dependencies, 'koishi-plugin-puppeteer'), false)
        assert.equal(config.plugins['phi-plugin'].renderer, 'shotium')
        assert.equal(Object.hasOwn(config.plugins, 'puppeteer'), false)
        installer.install(env.options, env.dependencies)
        host = JSON.parse(fs.readFileSync(path.join(env.root, 'package.json'), 'utf8'))
        config = YAML.parse(fs.readFileSync(path.join(env.root, 'koishi.yml'), 'utf8'))
        assert.equal(Object.hasOwn(host.dependencies, 'puppeteer'), false)
        assert.equal(config.plugins['phi-plugin'].renderer, 'shotium')
        assert.equal(Object.hasOwn(config.plugins, 'puppeteer'), false)
    } finally { env.close() }
})

test('installing auto prepares both backends while preserving existing dependency versions and services', () => {
    const env = fixture()
    try {
        const hostFile = path.join(env.root, 'package.json')
        const host = JSON.parse(fs.readFileSync(hostFile, 'utf8'))
        host.dependencies['koishi-plugin-puppeteer'] = '^3.8.0'
        host.dependencies.puppeteer = '^24.30.0'
        fs.writeFileSync(hostFile, JSON.stringify(host))
        fs.writeFileSync(path.join(env.root, 'koishi.yml'), 'plugins:\n  database-sqlite: {}\n  ~puppeteer:\n    executablePath: custom-chrome\n')
        installer.install({ ...env.options, renderer: 'auto' }, env.dependencies)
        const installed = JSON.parse(fs.readFileSync(hostFile, 'utf8'))
        const config = YAML.parse(fs.readFileSync(path.join(env.root, 'koishi.yml'), 'utf8'))
        assert.equal(installed.dependencies['@pixel.js/shotium'], '^0.12.2')
        assert.equal(installed.dependencies['koishi-plugin-puppeteer'], '^3.8.0')
        assert.equal(installed.dependencies.puppeteer, '^24.30.0')
        assert.equal(config.plugins['phi-plugin'].renderer, 'auto')
        assert.equal(config.plugins['~puppeteer'].executablePath, 'custom-chrome')
        assert.equal(Object.hasOwn(config.plugins, 'puppeteer'), false)
    } finally { env.close() }
})

test('cold install bootstraps the YAML parser before selecting the existing Shotium backend', () => {
    const env = fixture()
    try {
        fs.writeFileSync(path.join(env.root, 'koishi.yml'), 'plugins:\n  database-sqlite: {}\n  phi-plugin:\n    renderer: shotium\n')
        let attempts = 0
        env.dependencies.loadYaml = () => {
            if (++attempts === 1) {
                throw Object.assign(new Error('yaml unavailable'), { code: 'PHI_YAML_UNAVAILABLE' })
            }
            return YAML
        }
        installer.install(env.options, env.dependencies)
        const host = JSON.parse(fs.readFileSync(path.join(env.root, 'package.json'), 'utf8'))
        const config = YAML.parse(fs.readFileSync(path.join(env.root, 'koishi.yml'), 'utf8'))
        assert.equal(host.dependencies['@pixel.js/shotium'], '^0.12.2')
        assert.equal(Object.hasOwn(host.dependencies, 'puppeteer'), false)
        assert.equal(Object.hasOwn(config.plugins, 'puppeteer'), false)
        assert.equal(env.calls.filter(call => call.startsWith('npm install')).length, 2)
    } finally { env.close() }
})

test('renderer dependency failures preserve the live renderer configuration and backup', () => {
    const env = fixture()
    try {
        const original = fs.readFileSync(path.join(env.root, 'koishi.yml'), 'utf8')
        const runner = env.dependencies.run
        env.dependencies.run = (command, args) => {
            if (command === 'npm') throw new Error('Shotium package failed')
            return runner(command, args)
        }
        assert.throws(() => installer.install({ ...env.options, renderer: 'shotium' }, env.dependencies), /package failed/)
        assert.equal(fs.readFileSync(path.join(env.root, 'koishi.yml'), 'utf8'), original)
        assert.ok(fs.readdirSync(path.join(env.root, '.phi-plugin-install-backups')).length)
    } finally { env.close() }
})

test('configuration edited while dependencies install is preserved instead of being overwritten', () => {
    const env = fixture()
    try {
        const updated = '# New WebUI settings\nplugins:\n  database-sqlite: {}\n  phi-plugin:\n    renderer: puppeteer\n    cmdhead: new-command\n'
        const runner = env.dependencies.run
        env.dependencies.run = (command, args, cwd) => {
            const result = runner(command, args, cwd)
            if (command === 'npm' && args[0] === 'install') fs.writeFileSync(path.join(env.root, 'koishi.yml'), updated)
            return result
        }
        assert.throws(() => installer.install({ ...env.options, renderer: 'shotium' }, env.dependencies), /配置在安装期间发生变化/)
        assert.equal(fs.readFileSync(path.join(env.root, 'koishi.yml'), 'utf8'), updated)
    } finally { env.close() }
})

test('the plugin declares both renderer SDKs as optional peers', () => {
    const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    assert.equal(Object.hasOwn(manifest.dependencies, 'puppeteer'), false)
    assert.equal(Object.hasOwn(manifest.dependencies, '@pixel.js/shotium'), false)
    assert.equal(manifest.peerDependencies.puppeteer, '^24.16.2')
    assert.equal(manifest.peerDependencies['@pixel.js/shotium'], '^0.12.2')
    assert.equal(manifest.peerDependenciesMeta.puppeteer.optional, true)
    assert.equal(manifest.peerDependenciesMeta['@pixel.js/shotium'].optional, true)
})

test('pnpm uses npm only to bootstrap shared core dependencies while installing the selected host backend', () => {
    const env = fixture()
    try {
        installer.install({ ...env.options, manager: 'pnpm', renderer: 'shotium' }, env.dependencies)
        const bootstrap = env.executions.find(call => call.cwd === env.core && call.command === 'npm')
        assert.deepEqual(bootstrap?.args, ['install', '--omit=dev', '--omit=peer', '--package-lock=false', '--ignore-scripts', '--no-audit', '--no-fund'])
        assert.ok(env.executions.some(call => call.cwd === env.root && call.command === 'pnpm' && call.args[0] === 'install'))
        assert.ok(!env.executions.some(call => call.cwd === env.core && call.command === 'pnpm'))
        const host = JSON.parse(fs.readFileSync(path.join(env.root, 'package.json'), 'utf8'))
        assert.equal(host.dependencies['@pixel.js/shotium'], '^0.12.2')
        assert.equal(Object.hasOwn(host.dependencies, 'puppeteer'), false)
        assert.equal(fs.readFileSync(path.join(env.core, 'package.json'), 'utf8'), env.coreManifest)
        assert.equal(fs.existsSync(path.join(env.core, 'package-lock.json')), false)
    } finally { env.close() }
})

test('pnpm validates its npm bootstrap tool before writing host or plugin configuration', () => {
    const env = fixture()
    try {
        const original = fs.readFileSync(path.join(env.root, 'package.json'), 'utf8')
        const runner = env.dependencies.run
        env.dependencies.run = (command, args, cwd) => command === 'npm' && args[0] === '--version' ? '6.14.0' : runner(command, args, cwd)
        assert.throws(() => installer.install({ ...env.options, manager: 'pnpm', renderer: 'shotium' }, env.dependencies), /npm 7/)
        assert.equal(fs.existsSync(env.core), false)
        assert.equal(fs.existsSync(env.wrapper), false)
        assert.equal(fs.readFileSync(path.join(env.root, 'package.json'), 'utf8'), original)
    } finally { env.close() }
})

test('installer refuses to overwrite an older independent Koishi plugin', () => {
    const env = fixture()
    try {
        fs.mkdirSync(env.wrapper, { recursive: true })
        fs.writeFileSync(path.join(env.wrapper, 'package.json'), '{"name":"koishi-plugin-phi-plugin"}')
        assert.throws(() => installer.install(env.options, env.dependencies), /其他代码占用/)
        assert.deepEqual(env.calls, [])
    } finally { env.close() }
})

test('failed dependency install leaves live Koishi configuration untouched and makes a backup', () => {
    const env = fixture()
    try {
        const original = fs.readFileSync(path.join(env.root, 'koishi.yml'), 'utf8')
        const runner = env.dependencies.run
        env.dependencies.run = (command, args) => {
            if (command === 'npm') throw new Error('install failed')
            return runner(command, args)
        }
        assert.throws(() => installer.install(env.options, env.dependencies), /install failed/)
        assert.equal(fs.readFileSync(path.join(env.root, 'koishi.yml'), 'utf8'), original)
        assert.ok(fs.readdirSync(path.join(env.root, '.phi-plugin-install-backups')).length)
    } finally { env.close() }
})

test('explicit update refuses dirty repositories before pulling', () => {
    const env = fixture()
    try {
        installer.install(env.options, env.dependencies)
        fs.mkdirSync(path.join(env.core, '.git'))
        const run = env.dependencies.run
        env.dependencies.run = (command, args) => args[0] === 'status' ? ' M index.js' : run(command, args)
        assert.throws(() => installer.install({ ...env.options, update: true }, env.dependencies), /未提交修改/)
        assert.ok(!env.calls.some(call => call.startsWith('git pull')))
    } finally { env.close() }
})

test('manager detection prefers the existing unique lock and requires a choice for conflicts', () => {
    const env = fixture()
    try {
        fs.writeFileSync(path.join(env.root, 'package-lock.json'), '{}')
        assert.equal(installer.detectManager(env.root, { packageManager: 'yarn@4.1.0' }), 'npm')
        fs.writeFileSync(path.join(env.root, 'yarn.lock'), '')
        assert.throws(() => installer.detectManager(env.root, {}), /多种/)
        assert.throws(() => installer.parseArgs(['--manager', 'anything']), /仅支持/)
    } finally { env.close() }
})

test('real npm installation links the wrapper and preserves the core manifest', { timeout: 60000 }, () => {
    const env = fixture()
    try {
        env.dependencies.run('git', ['clone'])
        const host = { name: 'koishi-app', private: true, dependencies: /** @type {Record<string, string>} */ ({}) }
        for (const [name, version] of [['koishi', '4.18.11'], ['koishi-plugin-puppeteer', '3.9.0'], ['puppeteer', '24.16.2']]) {
            const dir = path.join(env.root, 'fixtures', name)
            fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version }))
            host.dependencies[name] = `file:fixtures/${name}`
        }
        fs.writeFileSync(path.join(env.root, 'package.json'), JSON.stringify(host))
        installer.install(env.options, { loadYaml: () => YAML })
        assert.equal(fs.readFileSync(path.join(env.core, 'package.json'), 'utf8'), env.coreManifest)
        installer.verifyInstallation(env.root)
        const lock = JSON.parse(fs.readFileSync(path.join(env.root, 'package-lock.json'), 'utf8'))
        assert.equal(lock.packages['node_modules/phi-plugin'].link, true)
        assert.equal(lock.packages['node_modules/koishi-plugin-phi-plugin'].link, true)
    } finally { env.close() }
})

const hasPnpm = spawnSync('pnpm', ['--version'], { shell: process.platform === 'win32', stdio: 'ignore' }).status === 0
test('real pnpm Shotium installation leaves unused renderer peers out of core and host', { timeout: 60000, skip: !hasPnpm }, () => {
    const env = fixture()
    try {
        env.dependencies.run('git', ['clone'])
        const host = { name: 'koishi-app', private: true, dependencies: /** @type {Record<string, string>} */ ({}) }
        for (const [name, version] of [['koishi', '4.18.11'], ['@pixel.js/shotium', '0.12.2']]) {
            const dir = path.join(env.root, 'fixtures', name)
            fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version }))
            host.dependencies[name] = `file:fixtures/${name}`
        }
        fs.writeFileSync(path.join(env.root, 'package.json'), JSON.stringify(host))
        const coreManifest = JSON.stringify({
            ...JSON.parse(env.coreManifest),
            peerDependencies: { '@pixel.js/shotium': '^0.12.2', puppeteer: '^24.16.2' },
            peerDependenciesMeta: { '@pixel.js/shotium': { optional: true }, puppeteer: { optional: true } },
        })
        fs.writeFileSync(path.join(env.core, 'package.json'), coreManifest)
        const coreLock = 'lockfileVersion: "9.0"\nimporters:\n  .: {}\n'
        fs.writeFileSync(path.join(env.core, 'pnpm-lock.yaml'), coreLock)
        installer.install({ ...env.options, manager: 'pnpm', renderer: 'shotium' }, { loadYaml: () => YAML })
        installer.verifyInstallation(env.root)
        assert.equal(fs.readFileSync(path.join(env.core, 'package.json'), 'utf8'), coreManifest)
        assert.equal(fs.readFileSync(path.join(env.core, 'pnpm-lock.yaml'), 'utf8'), coreLock)
        assert.equal(fs.existsSync(path.join(env.core, 'package-lock.json')), false)
        const requireHost = createRequire(path.join(env.root, 'package.json'))
        assert.equal(requireHost('@pixel.js/shotium/package.json').version, '0.12.2')
        assert.throws(() => requireHost.resolve('puppeteer'), { code: 'MODULE_NOT_FOUND' })
        assert.throws(() => requireHost.resolve('koishi-plugin-puppeteer'), { code: 'MODULE_NOT_FOUND' })
        const requireCore = createRequire(path.join(env.core, 'package.json'))
        assert.throws(() => requireCore.resolve('puppeteer'), { code: 'MODULE_NOT_FOUND' })
        const config = YAML.parse(fs.readFileSync(path.join(env.root, 'koishi.yml'), 'utf8'))
        assert.equal(config.plugins['phi-plugin'].renderer, 'shotium')
        assert.equal(Object.hasOwn(config.plugins, 'puppeteer'), false)
    } finally { env.close() }
})
