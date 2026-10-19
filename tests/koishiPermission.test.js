import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createKoishiAdapter, registerKoishiApps } from '../components/platform/koishi.js'

const load = createRequire(import.meta.url)
const { App, Bot, h } = load('koishi')

async function fixture() {
    const app = new App({ prefix: ['/'], autoAssign: false })
    /** @type {string[]} */
    const calls = []
    /** @type {any} */
    let bot
    const botFork = app.plugin((/** @type {any} */ ctx) => {
        bot = new Bot(ctx, {}, 'test')
        bot.user = { id: 'bot' }
        bot.sendMessage = async () => []
    })
    await app.start()
    const adapter = createKoishiAdapter(app, { database: false, h })
    /** @param {Record<string, any>} user @param {string} [content] */
    function session(user, content = '/phiadmin') {
        const s = bot.session({
            type: 'message', user: { id: 'user' }, channel: { id: 'group', type: 0 },
            guild: { id: 'group' }, message: { id: 'test' },
        })
        s.elements = h.parse(content)
        s.user = { permissions: [], async $update() {}, ...user }
        return s
    }
    return {
        app, adapter, calls, session,
        async close() { await botFork.dispose(); await app.stop() },
    }
}

test('Koishi maps permission level 4 and above to master and nothing else', async () => {
    const env = await fixture()
    try {
        for (const [authority, expected] of [
            [5, true], [4, true], ['4', true],
            [3, false], [2, false], [1, false], [0, false], [undefined, false], ['x', false],
        ]) {
            const source = env.session({ authority })
            const event = env.adapter.fromSession(source)
            assert.equal(event.isMaster, expected, `authority=${String(authority)}`)
            assert.equal(source.user.authority, authority, '不修改原始 session')
        }
    } finally { await env.close() }
})

test('master-only rules run for administrators and stay disabled for everyone else', async () => {
    const env = await fixture()
    const instance = {
        rule: [{ reg: '^[/#]phiadmin$', fnc: 'admin' }],
        /** @param {any} e */
        admin(e) { env.calls.push(`admin:${e.isMaster}`); return true },
    }
    try {
        registerKoishiApps(env.app, { demo: instance }, env.adapter, { cmdhead: 'phi' })
        assert.ok(env.app.$commander.get('phi.demo.admin'))
        for (const authority of [4, 1]) {
            const current = env.session({ authority })
            await env.app.parallel(current, 'message', current)
        }
        assert.deepEqual(env.calls, ['admin:true', 'admin:false'])
    } finally { await env.close() }
})
