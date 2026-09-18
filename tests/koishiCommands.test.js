import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createKoishiAdapter, registerKoishiApps } from '../components/platform/koishi.js'

const load = createRequire(import.meta.url)
const { App, Bot, h } = load('koishi')

/** @param {string} head @param {any} [options] */
async function fixture(head, options = {}) {
    const app = new App({ prefix: options.prefix ?? ['/', ''], autoAssign: false })
    /** @type {string[]} */
    const calls = []
    /** @type {string[]} */
    const sent = []
    /** @type {any} */
    let bot
    const botFork = app.plugin((/** @type {any} */ ctx) => {
        bot = new Bot(ctx, {}, 'test')
        bot.user = { id: 'bot' }
        bot.sendMessage = async (/** @type {string} */ channel, /** @type {any} */ content) => { sent.push(String(content)); return [] }
    })
    await app.start()
    options.setup?.(app)
    const adapter = createKoishiAdapter(app, { database: false, h })
    /** @type {any[]} */
    let instances = []
    /** @param {any} ctx @param {any} config */
    function plugin(ctx, config) {
        const currentHead = config.cmdhead
        const demo = {
            name: '测试指令', priority: 100,
            rule: [
                { reg: `^[#/](${currentHead})(\\s*)help$`, fnc: 'help' },
                { reg: new RegExp(`^[#/](${currentHead})(\\s*)score[\\s\\S]*$`, 'g'), fnc: 'score' },
                { reg: '^.*$', fnc: 'guess' },
            ],
            help(/** @type {any} */ e) { calls.push(`help:${e.msg}`); return e.reply('help-result') },
            score(/** @type {any} */ e) { calls.push(`score:${e.msg}`); return true },
            guess(/** @type {any} */ e) { calls.push(`guess:${e.msg}`); return false },
            ...options.instance,
        }
        instances = registerKoishiApps(ctx, { demo, ...options.apps }, adapter, { ...options, cmdhead: currentHead })
    }
    const fork = app.plugin(plugin, { cmdhead: head })
    /** @param {string} content @param {boolean} [direct] */
    function session(content, direct = false) {
        const s = bot.session({
            type: 'message', user: { id: 'user' }, channel: { id: direct ? 'user' : 'group', type: direct ? 1 : 0 },
            ...(direct ? {} : { guild: { id: 'group' } }), message: { id: 'message' },
        })
        s.elements = h.parse(content)
        s.user = { authority: 1, permissions: [], async $update() {} }
        return s
    }
    return { app, calls, sent, fork, instances, session,
        async receive(/** @type {string} */ text, direct = false) { const s = session(text, direct); await app.parallel(s, 'message', s) },
        async close() { await botFork.dispose(); await app.stop() },
    }
}

test('legacy commands are registered, run once through Koishi, and preserve raw arguments', async () => {
    const env = await fixture('phi')
    try {
        assert.ok(env.app.$commander.get('phi.demo.help'))
        assert.equal(env.app.$commander.get('phi.demo.guess'), undefined)
        await env.receive('/phihelp')
        await env.receive('#phi help')
        const text = '/phi score "a b" --help $(other)\nnext <at id="someone"/>'
        await env.receive(text)
        await env.receive(text)
        assert.deepEqual(env.calls, ['help:/phihelp', 'help:#phi help', `score:${text}`, `score:${text}`])
        assert.deepEqual(env.sent.filter(Boolean), ['help-result', 'help-result'])
    } finally { await env.close() }
})

test('custom, empty and regex heads work with host prefixes and direct messages', async () => {
    /** @type {[string, string[]][]} */
    const cases = [
        ['pg', ['/pghelp', '#pg help', '!pghelp', 'pg help']],
        ['', ['/help', '#help', '!help', 'help']],
        ['(?:phi|pg)', ['/phihelp', '#pg help', '!pghelp', 'phi help']],
    ]
    for (const [head, messages] of cases) {
        const env = await fixture(head, { prefix: ['!'] })
        try {
            for (const message of messages.slice(0, 3)) await env.receive(message)
            await env.receive(messages[3], true)
            assert.equal(env.calls.length, 4)
            assert.ok(env.calls.every(call => call.startsWith('help:')))
            assert.ok(env.app.$commander.get(`${head ? (head === '(?:phi|pg)' ? 'phi' : head) + '.' : ''}demo.help`))
            await env.receive(messages[3])
            assert.equal(env.calls.at(-1), `guess:${messages[3]}`)
        } finally { await env.close() }
    }
})

test('empty Koishi prefix and mentions obey host command intent', async () => {
    const env = await fixture('', { prefix: [''] })
    try {
        await env.receive('help')
        await env.receive('<at id="bot"/> help')
        await env.receive('<at id="other"/> /help')
        assert.deepEqual(env.calls.filter(call => call.startsWith('help:')), ['help:/help', 'help:/help'])
    } finally { await env.close() }
})

test('Koishi command checks cannot be bypassed by legacy syntax or fallback middleware', async () => {
    const env = await fixture('phi')
    try {
        env.app.before('command/execute', (/** @type {any} */ argv) => {
            if (argv.command.name === 'phi.demo.help') return 'denied'
        })
        await env.receive('/phihelp')
        await env.receive('#phi help')
        assert.deepEqual(env.calls, [])
        assert.deepEqual(env.sent.filter(Boolean), ['denied', 'denied'])
    } finally { await env.close() }
})

test('false results pass to overlapping registered commands and ordinary chat remains a listener', async () => {
    const env = await fixture('phi', {
        instance: { help() { return false } },
        apps: { other: { priority: 200, rule: [{ reg: '^[/#]phi\\s*help$', fnc: 'help' }], help(/** @type {any} */ e) { return e.reply('other-result') } } },
    })
    try {
        await env.receive('/phihelp')
        assert.deepEqual(env.sent.filter(Boolean), ['other-result'])
        assert.deepEqual(env.calls, [])
        await env.receive('answer')
        assert.deepEqual(env.calls, ['guess:answer'])
    } finally { await env.close() }
})

test('active confirmations precede command parsing and unloading removes routes and hooks', async () => {
    let active = true
    const env = await fixture('phi', { instance: {
        getKoishiContext() { return active ? { name: 'confirm' } : undefined },
        confirm(/** @type {any} */ e) { active = false; return e.reply('confirmed') },
    } })
    try {
        await env.receive('/phihelp')
        assert.deepEqual(env.calls, [])
        assert.deepEqual(env.sent.filter(Boolean), ['confirmed'])
        await env.receive('/phihelp')
        assert.equal(env.calls.length, 1)
        await env.fork.dispose()
        assert.equal(env.app.$commander.get('phi.demo.help'), undefined)
        await env.receive('/phihelp')
        assert.equal(env.calls.length, 1)
    } finally { await env.close() }
})

test('native command names and aliases use the same action and permissions', async () => {
    const env = await fixture('phi')
    try {
        const command = env.app.$commander.get('phi.demo.help')
        command.alias('phi-test-help')
        await env.receive('/phi.demo.help /phi help')
        await env.receive('/phi-test-help #phihelp')
        assert.deepEqual(env.calls, ['help:/phi help', 'help:#phihelp'])
        await env.receive('/phi.demo.score /phi score <at id="someone"/>')
        assert.equal(env.calls.at(-1), 'score:/phi score <at id="someone"/>')
        command.config.permissions = ['phi-test-denied']
        await env.receive('/phihelp')
        await env.receive('/phi-test-help #phihelp')
        assert.equal(env.calls.length, 3)
    } finally { await env.close() }
})

test('disabled aliases on overlapping commands cannot be bypassed by fallthrough', async () => {
    const env = await fixture('phi', {
        instance: { help() { return false } },
        apps: { other: { priority: 200, rule: [{ reg: '^[/#]phihelp$', fnc: 'help' }], help() { assert.fail('disabled command ran') } } },
    })
    try {
        env.app.$commander.get('phi.other.help')._aliases['phi.other.help'].filter = false
        await env.receive('/phihelp')
        assert.deepEqual(env.calls, [])
    } finally { await env.close() }
})

test('block false executes later commands once then continues ordinary middleware', async () => {
    let following = 0
    const env = await fixture('phi', { block: false,
        apps: { other: { priority: 200, rule: [{ reg: '^[/#]phihelp$', fnc: 'help' }], help() { following++; return false } } },
    })
    try {
        await env.receive('/phihelp')
        assert.deepEqual(env.calls, ['help:/phihelp', 'guess:/phihelp'])
        assert.equal(following, 1)
    } finally { await env.close() }
})

test('changing command head rebuilds the hierarchy and removes previous registrations', async () => {
    const env = await fixture('phi')
    try {
        env.fork.update({ cmdhead: 'pg' })
        await env.app.lifecycle.flush()
        assert.equal(env.app.$commander.get('phi.demo.help'), undefined)
        assert.ok(env.app.$commander.get('pg.demo.help'))
        await env.receive('/pghelp')
        env.fork.update({ cmdhead: '' })
        await env.app.lifecycle.flush()
        assert.equal(env.app.$commander.get('pg.demo.help'), undefined)
        assert.ok(env.app.$commander.get('demo.help'))
        await env.receive('/help')
        await env.receive('/demo.help /help')
        assert.deepEqual(env.calls, ['help:/pghelp', 'help:/help', 'help:/help'])
    } finally { await env.close() }
})

test('empty-head collision preserves system help execution and Phi remains callable', async () => {
    const env = await fixture('', {
        setup(/** @type {any} */ app) { app.command('help [command:string]', '系统帮助').action(() => 'system-help') },
        apps: { help: { rule: [{ reg: '^[/#]phihelp$', fnc: 'help' }], help(/** @type {any} */ e) { return e.reply('phi-help') } } },
    })
    try {
        assert.ok(env.app.$commander.get('p.help.help'))
        assert.equal(env.app.$commander.get('help').children.length, 0)
        await env.receive('/help')
        assert.deepEqual(env.sent.filter(Boolean), ['system-help'])
        assert.deepEqual(env.calls, [])
        await env.receive('#help')
        assert.deepEqual(env.calls, ['help:#help'])
        await env.receive('/p.help.help /phihelp')
        assert.equal(env.sent.at(-1), 'phi-help')
    } finally { await env.close() }
})
