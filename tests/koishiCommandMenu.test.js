import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
import { registerCommands } from '../components/platform/koishiCommands.js'
import { createKoishiAdapter } from '../components/platform/koishi.js'
import { commandSnapshot, validateDiscordCommands } from '../components/platform/koishiCommandSync.js'
import { commandSpec, commonCommands } from '../components/platform/koishiCommandNames.js'

const require = createRequire(import.meta.url)
const { App, Bot, h } = /** @type {any} */ (require('koishi'))
const { Discord } = require('@satorijs/adapter-discord')
const ts = require('typescript')

// 读取真实规则声明，避免导入业务模块触发 API、资源下载或数据库初始化。
/** @param {string} head @param {string[]} calls */
function actualRules(head, calls) {
    const directory = new URL('../apps/', import.meta.url)
    return fs.readdirSync(directory).filter(file => file.endsWith('.js')).map(file => {
        const source = ts.createSourceFile(file, fs.readFileSync(new URL(file, directory), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
        const scope = vm.createContext({ Config: { getUserCfg: () => head }, getHead: () => head })
        /** @type {any} */
        const instance = { rule: [] }
        const key = file.slice(0, -3)
        /** @param {any} node */
        function visit(node) {
            if (ts.isVariableDeclaration(node) && node.initializer && ['getPrefix', 'games'].includes(node.name.getText(source))) {
                scope[node.name.getText(source)] = vm.runInContext(`(${node.initializer.getText(source)})`, scope)
            }
            if (ts.isObjectLiteralExpression(node)) {
                const reg = node.properties.find((/** @type {any} */ item) => item.name?.getText(source) === 'reg')
                const fnc = node.properties.find((/** @type {any} */ item) => item.name?.getText(source) === 'fnc')
                if (reg && fnc && ts.isPropertyAssignment(reg) && ts.isPropertyAssignment(fnc) && ts.isStringLiteral(fnc.initializer)) {
                    const name = fnc.initializer.text
                    instance.rule.push({ reg: vm.runInContext(`(${reg.initializer.getText(source)})`, scope), fnc: name })
                    instance[name] = (/** @type {any} */ e) => { calls.push(`${key}.${name}:${e.msg}`); return true }
                }
            }
            ts.forEachChild(node, visit)
        }
        visit(source)
        return { key, instance }
    }).filter(entry => entry.instance.rule.length)
}

test('all real commands fit Discord menus: common actions directly, remaining actions grouped', async () => {
    for (const head of ['p', '']) {
        const app = new App()
        await app.start()
        try {
            const entries = actualRules(head, [])
            registerCommands(app, entries, /** @type {any} */ ({}), true, head)
            const snapshot = commandSnapshot(app)
            validateDiscordCommands(snapshot)
            const menu = head ? snapshot[0].children : snapshot
            assert.equal(menu.length, 25)
            for (const name of commonCommands) assert.ok(menu.some((/** @type {any} */ item) => item.name === (head ? `${head}.${name}` : name) && !item.children.length), name)
            assert.ok(app.$commander.get(head ? 'p.songs.alias' : 'songs.alias'))
            assert.ok(app.$commander.get(head ? 'p.account.unbind' : 'account.unbind'))
            /** @param {any[]} tree @returns {number} */
            const leaves = tree => tree.reduce((total, item) => total + (item.children.length ? leaves(item.children) : 1), 0)
            const expected = entries.reduce((total, { instance }) => total + instance.rule.filter((/** @type {any} */ rule) => new RegExp(rule.reg).source.startsWith('^[')).length, 0)
            assert.equal(leaves(snapshot), expected, '每一条真实指令都必须出现在菜单中')
            for (const root of snapshot) {
                const encoded = Discord.encodeCommand(root)
                assert.ok((encoded.options?.length ?? 0) <= 25)
            }
            const b30 = app.$commander.get(head ? 'p.b30' : 'b30').toJSON()
            assert.equal(b30.arguments[0].name, 'args')
            assert.equal(b30.arguments[0].required, false)
        } finally { await app.stop() }
    }
})

test('Discord argv and chat syntax call real rules without repeating the original command', async () => {
    const app = new App({ prefix: ['/'], autoAssign: false })
    /** @type {any} */
    let bot
    const fork = app.plugin((/** @type {any} */ ctx) => {
        bot = new Bot(ctx, {}, 'test')
        bot.user = { id: 'bot' }
        bot.sendMessage = async () => []
    })
    await app.start()
    /** @type {string[]} */
    const calls = []
    try {
        // 空头碰撞后注册为 p，仍应将原生请求转回空头业务正则。
        app.command('help', '系统帮助')
        registerCommands(app, actualRules('', calls), createKoishiAdapter(app, { database: false, h }), true, '')
        const session = () => {
            const s = bot.session({ type: 'message', user: { id: 'user' }, channel: { id: 'group', type: 0 }, guild: { id: 'group' }, message: { id: 'test' } })
            s.user = { authority: 1, permissions: [], async $update() {} }
            return s
        }
        for (const [name, args, expected] of [
            ['p.help', '', 'help.help:/help'],
            ['p.b30', '', 'b19.b19:/b30'],
            ['p.score', '曲名 --help "a b"', 'b19.singlescore:/score 曲名 --help "a b"'],
            ['p.songs.alias', '曲名', 'phisong.alias:/alias 曲名'],
            ['p.account.unbind', '', 'session.unbind:/unbind'],
            ['p.games.open', 'a', 'guessGame.reveal:/open a'],
        ]) {
            const s = session()
            s.event.argv = { name, arguments: args ? [args] : [], options: {} }
            await app.parallel(s, 'interaction/command', s)
            // Koishi 的 interaction 监听器不返回 execute Promise。
            await app.lifecycle.flush()
            await new Promise(resolve => setImmediate(resolve))
            assert.equal(calls.at(-1), expected)
        }
        for (const text of ['/p help', '/p b30', '/p songs alias 曲名']) {
            const s = session()
            s.elements = h.parse(text)
            await app.parallel(s, 'message', s)
        }
        assert.deepEqual(calls.slice(-3), ['help.help:/help', 'b19.b19:/b30', 'phisong.alias:/alias 曲名'])
        app.$commander.get('p.b30').config.permissions = ['test-denied']
        const count = calls.length
        const denied = session()
        denied.event.argv = { name: 'p.b30', arguments: [], options: {} }
        await app.parallel(denied, 'interaction/command', denied)
        await new Promise(resolve => setImmediate(resolve))
        assert.equal(calls.length, count)
    } finally { await fork.dispose(); await app.stop() }
})

test('public command spellings match actual case-sensitive rules', () => {
    for (const { key, instance } of actualRules('p', [])) {
        for (const rule of instance.rule) {
            if (!new RegExp(rule.reg).source.startsWith('^[')) continue
            const spec = commandSpec(key, rule.fnc)
            const prefix = spec.bare ? '/' : '/p '
            const inputs = ['', 'a', '1', ' song'].map(args => `${prefix}${spec.text}${args ? ` ${args}` : ''}`)
            assert.ok(inputs.some(input => new RegExp(rule.reg).test(input)), `${key}.${rule.fnc}: ${spec.text}`)
        }
    }
})
