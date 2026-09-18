import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { setTimeout as pause } from 'node:timers/promises'
import { commandSnapshot, scheduleCommandSync, validateDiscordCommands, validateDiscordName } from '../components/platform/koishiCommandSync.js'
import { registerCommands } from '../components/platform/koishiCommands.js'

const require = createRequire(import.meta.url)
const { App, Bot, Universal } = /** @type {any} */ (require('koishi'))
const { Discord } = require('@satorijs/adapter-discord')

/** @param {string} name @param {any[]} [children] */
const node = (name, children = []) => ({ name, children, arguments: [], options: [], description: {} })
/** @param {string} key @param {number} [count] */
function entries(key, count = 1) {
    /** @type {any} */
    const instance = { rule: [] }
    for (let i = 0; i < count; i++) {
        instance.rule.push({ reg: '^[/#]help$', fnc: `run${i}` })
        instance[`run${i}`] = () => 'ok'
    }
    return [{ key, instance }]
}

test('Discord names, depth, per-level limits and global count are checked', () => {
    for (const name of ['phi', '曲绘', 'a'.repeat(32), 'abc-123']) validateDiscordName(name)
    for (const name of ['', 'a'.repeat(33), 'Phi', 'a.b', 'hi!', 'a b']) assert.throws(() => validateDiscordName(name), /指令名无效/)
    validateDiscordCommands([node('phi', Array.from({ length: 25 }, (_, i) => node(`phi.m${i}`)))])
    assert.throws(() => validateDiscordCommands([node('phi', Array.from({ length: 26 }, (_, i) => node(`phi.m${i}`)))]), /25/)
    assert.throws(() => validateDiscordCommands([node('phi', [node('phi.mod', Array.from({ length: 26 }, (_, i) => node(`phi.mod.c${i}`)))])]), /25/)
    assert.throws(() => validateDiscordCommands([node('a', [node('a.b', [node('a.b.c', [node('a.b.c.d')])])])]), /3 层/)
    validateDiscordCommands(Array.from({ length: 100 }, (_, i) => node(`c${i}`)))
    assert.throws(() => validateDiscordCommands(Array.from({ length: 101 }, (_, i) => node(`c${i}`))), /100/)
})

test('collision keeps host help intact, including its Discord arguments and action', async () => {
    const app = new App()
    const help = app.command('help [command:string]', '系统帮助').action(() => 'system')
    app.command('p', '已占用')
    await app.start()
    try {
        registerCommands(app, entries('help'), /** @type {any} */ ({}), true, '')
        assert.ok(app.$commander.get('phi.help.run0'))
        assert.deepEqual(help.children, [])
        const encoded = Discord.encodeCommand(help.toJSON())
        assert.equal(encoded.options?.[0].name, 'command')
        assert.equal(encoded.options?.[0].type, 3)
        const encodedPhi = Discord.encodeCommand(app.$commander.get('phi').toJSON())
        assert.equal(encodedPhi.options?.[0].name, 'help')
    } finally { await app.stop() }
})

test('whole-tree conflict fallback follows empty, p, phi, phigros, phi-plugin and honors explicit heads', async () => {
    for (const [occupied, expected] of [
        [[], ''], [['help'], 'p'], [['help', 'p'], 'phi'],
        [['help', 'p', 'phi'], 'phigros'], [['help', 'p', 'phi', 'phigros'], 'phi-plugin'],
    ]) {
        const app = new App()
        await app.start()
        try {
            for (const name of occupied) app.command(name)
            registerCommands(app, [...entries('help'), ...entries('b19')], /** @type {any} */ ({}), true, '')
            const prefix = expected ? `${expected}.` : ''
            assert.ok(app.$commander.get(`${prefix}help.run0`))
            assert.ok(app.$commander.get(`${prefix}b19.run0`))
        } finally { await app.stop() }
    }
    const app = new App()
    await app.start()
    try {
        for (const name of ['help', 'p', 'phi', 'phigros', 'phi-plugin']) app.command(name)
        assert.throws(() => registerCommands(app, entries('help'), /** @type {any} */ ({}), true, ''), /均已占用/)
        registerCommands(app, entries('help'), /** @type {any} */ ({}), true, 'custom')
        assert.ok(app.$commander.get('custom.help.run0'))
    } finally { await app.stop() }
})

test('invalid planned registrations leave no partial commands', async () => {
    const app = new App()
    await app.start()
    try {
        assert.throws(() => registerCommands(app, entries('demo', 26), /** @type {any} */ ({}), true, 'phi'), /25/)
        assert.equal(app.$commander.get('phi'), undefined)
        assert.throws(() => registerCommands(app, entries('demo'), /** @type {any} */ ({}), true, 'a'.repeat(33)), /指令名无效/)
        assert.equal(commandSnapshot(app).length, 0)
        const modules = Array.from({ length: 26 }, (_, i) => entries(`m${i}`)[0])
        assert.throws(() => registerCommands(app, modules, /** @type {any} */ ({}), true, 'phi'), /25/)
        assert.equal(commandSnapshot(app).length, 0)
        for (let i = 0; i < 100; i++) app.command(`other${i}`)
        assert.throws(() => registerCommands(app, entries('demo'), /** @type {any} */ ({}), true, 'phi'), /100/)
        assert.equal(app.$commander.get('phi'), undefined)
    } finally { await app.stop() }
})

test('rapid head reloads send one complete snapshot; unload removes stale commands and empty snapshot clears Discord', async () => {
    const app = new App()
    /** @type {any[]} */
    const sent = []
    /** @type {any} */
    let bot
    const botFork = app.plugin((/** @type {any} */ ctx) => {
        bot = new Bot(ctx, { slash: true }, 'discord')
        bot.user = { id: 'test' }
        bot.updateCommands = async (/** @type {any[]} */ commands) => { sent.push(commands) }
        bot.internal = { bulkOverwriteGlobalApplicationCommands: async (/** @type {string} */ id, /** @type {any[]} */ commands) => { assert.equal(id, 'test'); sent.push(commands) } }
    })
    await app.start()
    bot._status = Universal.Status.ONLINE
    // 设置测试专用短防抖周期，生产默认 500ms。
    scheduleCommandSync(app, 20)
    const other = app.command('other', '其他插件')
    const plugin = (/** @type {any} */ ctx, /** @type {any} */ config) => registerCommands(ctx, entries('demo'), /** @type {any} */ ({}), true, config.head)
    const fork = app.plugin(plugin, { head: 'phi' })
    try {
        fork.update({ head: 'pg' })
        await app.lifecycle.flush()
        fork.update({ head: '' })
        await app.lifecycle.flush()
        await pause(70)
        assert.equal(sent.length, 1)
        assert.deepEqual(sent[0].map((/** @type {any} */ cmd) => cmd.name).sort(), ['demo', 'other'])
        await fork.dispose()
        await pause(70)
        assert.deepEqual(sent.at(-1).map((/** @type {any} */ cmd) => cmd.name), ['other'])
        other.dispose()
        scheduleCommandSync(app)
        await pause(70)
        assert.deepEqual(sent.at(-1), [])
    } finally { await botFork.dispose(); await app.stop() }
})

test('invalid full snapshot is not uploaded, failed requests are caught and later updates recover', async () => {
    const app = new App()
    /** @type {any} */
    let bot
    let requests = 0
    const botFork = app.plugin((/** @type {any} */ ctx) => {
        bot = new Bot(ctx, { slash: true }, 'discord')
        bot.updateCommands = async () => { if (++requests === 1) throw new Error('test network error') }
    })
    await app.start()
    bot._status = Universal.Status.ONLINE
    const invalid = app.command('x'.repeat(33))
    try {
        scheduleCommandSync(app, 10)
        await pause(40)
        assert.equal(requests, 0)
        invalid.dispose()
        app.command('valid')
        scheduleCommandSync(app)
        await pause(40)
        assert.equal(requests, 1)
        scheduleCommandSync(app)
        await pause(40)
        assert.equal(requests, 2)
    } finally { await botFork.dispose(); await app.stop() }
})

test('in-flight updates serialize and take a fresh snapshot; disabled/offline bots and disposed host do not sync', async () => {
    const app = new App()
    /** @type {any} */
    let bot
    /** @type {(() => void) | undefined} */
    let release
    /** @type {string[][]} */
    const sent = []
    let active = 0
    const botFork = app.plugin((/** @type {any} */ ctx) => {
        bot = new Bot(ctx, { slash: true }, 'discord')
        bot.updateCommands = async (/** @type {any[]} */ commands) => {
            assert.equal(++active, 1)
            sent.push(commands.map(command => command.name))
            if (sent.length === 1) await new Promise(resolve => { release = () => resolve(undefined) })
            active--
        }
    })
    await app.start()
    const first = app.command('first')
    try {
        scheduleCommandSync(app, 10)
        await pause(40)
        assert.equal(sent.length, 0)
        bot._status = Universal.Status.ONLINE
        bot.config.slash = false
        scheduleCommandSync(app)
        await pause(40)
        assert.equal(sent.length, 0)
        bot.config.slash = true
        scheduleCommandSync(app)
        await pause(40)
        assert.deepEqual(sent, [['first']])
        first.dispose()
        app.command('latest')
        scheduleCommandSync(app)
        await pause(40)
        assert.equal(sent.length, 1)
        release?.()
        await pause(40)
        assert.deepEqual(sent, [['first'], ['latest']])
        scheduleCommandSync(app)
    } finally {
        release?.()
        await botFork.dispose()
        await app.stop()
    }
    await pause(40)
    assert.equal(sent.length, 2)
})
