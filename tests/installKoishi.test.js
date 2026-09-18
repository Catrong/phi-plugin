import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
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
    const options = installer.parseArgs(['--root', root, '--manager', 'npm'])
    const core = path.join(root, 'external', 'phi-plugin')
    const wrapper = path.join(root, 'external', 'koishi-plugin-phi-plugin')
    const coreManifest = JSON.stringify({ name: 'phi-plugin', version: '1.0.2', exports: { './koishi': './koishi.cjs' } })
    const dependencies = {
        loadYaml: () => YAML,
        run(/** @type {string} */ command, /** @type {string[]} */ args) {
            calls.push([command, ...args].join(' '))
            if (command === 'git' && args[0] === 'clone') {
                fs.mkdirSync(core, { recursive: true })
                fs.writeFileSync(path.join(core, 'package.json'), coreManifest)
                fs.writeFileSync(path.join(core, 'koishi.cjs'), "module.exports = { name: 'phi-plugin', apply() {}, Config: {} }")
            }
            if (command === 'npm') {
                fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
                for (const [name, target] of [['phi-plugin', core], ['koishi-plugin-phi-plugin', wrapper]]) {
                    const link = path.join(root, 'node_modules', name)
                    if (!fs.existsSync(link)) fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
                }
            }
            return ''
        },
    }
    return { root, options, core, wrapper, calls, coreManifest, dependencies,
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
        for (const [name, version] of [['koishi', '4.18.11'], ['koishi-plugin-puppeteer', '3.9.0']]) {
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
