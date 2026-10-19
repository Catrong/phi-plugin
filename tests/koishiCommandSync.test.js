import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { setTimeout as pause } from 'node:timers/promises'
import { commandSnapshot, validateDiscordCommands, validateDiscordName } from '../components/platform/koishiCommandSync.js'
import { registerCommands } from '../components/platform/koishiCommands.js'
import { captureWarnings } from './fixtures/logCapture.js'

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
        const fnc = count === 1 ? key : `run${i}`
        instance.rule.push({ reg: '^[/#]help$', fnc })
        instance[fnc] = () => 'ok'
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
        assert.ok(app.$commander.get('phi.help'))
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
            assert.ok(app.$commander.get(`${prefix}help`))
            assert.ok(app.$commander.get(`${prefix}b30`))
        } finally { await app.stop() }
    }
    const app = new App()
    await app.start()
    try {
        for (const name of ['help', 'p', 'phi', 'phigros', 'phi-plugin']) app.command(name)
        assert.throws(() => registerCommands(app, entries('help'), /** @type {any} */ ({}), true, ''), /均已占用/)
        registerCommands(app, entries('help'), /** @type {any} */ ({}), true, 'custom')
        assert.ok(app.$commander.get('custom.help'))
    } finally { await app.stop() }
})

test('invalid Discord names still abort registration before touching the host', async () => {
    const app = new App()
    await app.start()
    try {
        assert.throws(() => registerCommands(app, entries('demo'), /** @type {any} */ ({}), true, 'a'.repeat(33)), /指令名无效/)
        assert.equal(app.$commander.get('phi'), undefined)
        assert.equal(commandSnapshot(app).length, 0)
    } finally { await app.stop() }
})

test('menus outside the Discord limits only warn and still register', async () => {
    const app = new App()
    await app.start()
    const logs = captureWarnings()
    try {
        registerCommands(app, entries('demo', 26), /** @type {any} */ ({}), true, 'phi')
        assert.ok(app.$commander.get('phi'), '单层超限不再中断注册')
        assert.ok(app.$commander.get('phi.demo.run0'))
        assert.ok(logs.some(text => text.includes('超过 25')), logs.join(' | '))
        for (let i = 0; i < 100; i++) app.command(`other${i}`)
        registerCommands(app, entries('extra'), /** @type {any} */ ({}), true, 'pg')
        assert.ok(app.$commander.get('pg'), '全局超限同样只警告')
        assert.ok(logs.some(text => text.includes('超过 100')), logs.join(' | '))
    } finally { await app.stop() }
})

test('registration only reports to Koishi: the commander builds the snapshot for the adapter', async () => {
    const app = new App()
    /** @type {string[][]} */
    const sent = []
    /** @type {any} */
    let bot
    const botFork = app.plugin((/** @type {any} */ ctx) => {
        bot = new Bot(ctx, { slash: true }, 'discord')
        bot.user = { id: 'test' }
        bot.updateCommands = async (/** @type {any[]} */ commands) => { sent.push(commands.map(command => command.name)) }
    })
    await app.start()
    bot._status = Universal.Status.ONLINE
    try {
        registerCommands(app, entries('demo'), /** @type {any} */ ({}), true, 'phi')
        await pause(20)
        assert.deepEqual(sent, [['phi']], '插件只调用 Koishi 的入口，快照与上传由 Commander 与适配器负责')
        bot._status = Universal.Status.OFFLINE
        registerCommands(app, entries('extra'), /** @type {any} */ ({}), true, 'pg')
        await pause(20)
        assert.equal(sent.length, 1, '离线机器人不再被插件主动同步')
    } finally { await botFork.dispose(); await app.stop() }
})
