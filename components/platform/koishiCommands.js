/**
 * 将 Yunzai 风格正则交给 Koishi 的命令执行管线。
 * 普通命令头作为根分组；空命令头直接按模块和功能分级。
 */
import { commandSnapshot, scheduleCommandSync, validateDiscordCommands, validateDiscordName } from './koishiCommandSync.js'

/** @param {RegExp} regexp @param {string} message */
function matches(regexp, message) {
    regexp.lastIndex = 0
    return regexp.test(message)
}

/** @param {RegExp} regexp */
function isCommand(regexp) {
    const prefix = regexp.source.match(/^\^\[([^\]]+)\]/)?.[1]
    return Boolean(prefix?.includes('#') && prefix.includes('/'))
}

/** 正则命令头继续用于匹配；有限字面量分支取第一个作为管理分组。 @param {string} head */
export function commandRoot(head) {
    if (head === '') return ''
    const literal = head.replace(/^\((?:\?:)?(.*)\)$/, '$1').split('|')[0]
    return /^[\p{L}\p{N}_-]+$/u.test(literal) ? literal.toLowerCase().replace(/_/g, '-') : 'phi-plugin'
}

/**
 * @param {any} ctx
 * @param {{key: string, instance: any}[]} apps
 * @param {ReturnType<typeof import('./koishi.js').createKoishiAdapter>} adapter
 * @param {boolean} block
 * @param {string} head
 */
export function registerCommands(ctx, apps, adapter, block, head) {
    const requestedRoot = commandRoot(head)
    /** @type {{name: string, instance: any, fnc: string, regexp: RegExp}[]} */
    const routes = []
    /** @type {{instance: any, fnc: string, regexp: RegExp}[]} */
    const listeners = []
    const reserved = new Set()
    if (requestedRoot) validateDiscordName(requestedRoot)
    for (const { key, instance } of apps) {
        for (const rule of instance.rule || []) {
            if (typeof instance[rule.fnc] !== 'function') continue
            const regexp = rule.reg instanceof RegExp ? rule.reg : new RegExp(rule.reg)
            if (!isCommand(regexp)) {
                listeners.push({ instance, fnc: rule.fnc, regexp })
                continue
            }
            const parts = [key, rule.fnc].map(part => part.toLowerCase().replace(/_/g, '-'))
            for (const part of parts) validateDiscordName(part)
            const name = parts.join('.')
            if (routes.some(route => route.name === name && (route.instance !== instance || route.fnc !== rule.fnc))) {
                throw new Error(`规范化后指令重名：${name}`)
            }
            routes.push({ name, instance, fnc: rule.fnc, regexp })
        }
    }

    if (routes.length) {
        const modules = [...new Set(routes.map(route => route.name.split('.')[0]))]
        const candidates = [...new Set([requestedRoot, '', 'p', 'phi', 'phigros', 'phi-plugin'])]
        const root = candidates.find(candidate => (candidate ? [candidate] : modules).every(name => !ctx.$commander.get(name)))
        if (root === undefined) throw new Error('Koishi 指令注册冲突：空头、p、phi、phigros、phi-plugin 均已占用，请设置其他命令头')
        if (root !== requestedRoot) ctx.logger('phi-plugin').warn('指令分组 %s 已占用，整棵树改用 %s', requestedRoot || '空头', root || '空头')
        for (const name of root ? [root] : modules) reserved.add(name)
        if (root) for (const route of routes) route.name = `${root}.${route.name}`
    }

    // 先校验整棵计划树，避免注册到一半才发现超限。
    /** @type {any[]} */
    const planned = []
    for (const { name } of routes) {
        let children = planned
        let full = ''
        for (const part of name.split('.')) {
            full = full ? `${full}.${part}` : part
            let node = children.find(item => item.name === full)
            if (!node) children.push(node = { name: full, children: [] })
            children = node.children
        }
    }
    validateDiscordCommands(planned)
    const total = planned.length ? commandSnapshot(ctx).length + planned.length : 0
    if (total > 100) throw new Error(`Discord 全局斜线指令超过 100 个：${total}`)

    /** @param {any} session */
    function hasContext(session) {
        const e = adapter.fromSession(session)
        return apps.some(({ instance }) => {
            const context = instance.getKoishiContext?.(e)
            return context && typeof instance[context.name] === 'function'
        })
    }

    /** @param {any} session @param {string} content */
    function resolve(session, content) {
        const stripped = session.stripped || {}
        if (stripped.hasAt && !stripped.appel) return
        // 同名系统命令/别名优先；例如空头时 /help 留给 Koishi，#help 仍可用。
        const existing = ctx.$commander.resolve(content.trim().split(/\s+/, 1)[0], session)
        if (existing && !reserved.has(existing.name.split('.')[0])) return
        const original = String(stripped.content ?? session.content ?? '')
        // 原有 /、# 和语音触发方式继续有效；Koishi 的 prefix 另行处理。
        let message = original
        let route = routes.find(item => matches(item.regexp, message))
        if (!route && (session.isDirect || stripped.appel || typeof stripped.prefix === 'string')) {
            message = `/${content}`
            route = routes.find(item => matches(item.regexp, message))
        }
        if (route) return { name: route.name, args: [message], options: {} }
    }

    for (const name of new Set(routes.map(route => route.name))) {
        const own = routes.filter(route => route.name === name)
        const { instance, fnc } = own[0]
        ctx.command(`${name} <message:text>`, [...`${instance.dsc || instance.name || 'Phigros'} · ${fnc}`].slice(0, 100).join(''), {
            authority: 1,
        }).usage('可直接发送原有 phi-plugin 指令。通过本管理标识调用时，message 请填写完整原始指令。')
            .action(async (/** @type {any} */ argv, /** @type {string} */ message) => {
                const index = routes.findIndex(route => route.name === name && matches(route.regexp, message || ''))
                if (index < 0) return '请提供符合当前命令头设置的完整原始指令。'
                const e = adapter.fromSession(argv.session)
                e.msg = e.text = message
                instance.e = e
                const result = await instance[fnc](e)
                if (block && result !== false) return
                // 后续重叠规则也必须经过 Koishi 权限/禁用检查，不能直接调用业务函数。
                const following = routes.slice(index + 1).find(route => route.name !== name && matches(route.regexp, message))
                if (following) {
                    const command = ctx.$commander.resolve(following.name, argv.session)
                    if (!command) return
                    return argv.session.execute({ command, args: [message], options: {} }, () => argv.next(() => ''))
                }
                // 给 Koishi fallback 队列一个结束值，避免无其他响应时互相调用 next。
                return argv.next(() => '')
            })
    }

    if (routes.length) {
        scheduleCommandSync(ctx)
        ctx.before('parse', (/** @type {string} */ content, /** @type {any} */ session) => {
            if (!ctx.filter(session)) return
            // 会话确认优先，由下方 middleware 处理，不把确认消息误当成新命令。
            if (hasContext(session)) return { tokens: [], options: {} }
            return resolve(session, content)
        })
    }

    ctx.middleware(async (/** @type {any} */ session, /** @type {any} */ next) => {
        const e = adapter.fromSession(session)
        let hadContext = false
        for (const { instance } of apps) {
            const context = instance.getKoishiContext?.(e)
            if (!context || typeof instance[context.name] !== 'function') continue
            hadContext = true
            instance.e = e
            const result = await instance[context.name](e)
            if (block && result !== false) return
        }
        if (hadContext) {
            const content = String(session.stripped?.content ?? session.content ?? '')
            const prefix = session.stripped?.prefix ?? ''
            const argv = resolve(session, content.slice(prefix.length))
            if (argv) {
                const command = ctx.$commander.resolve(argv.name, session)
                if (!command) return
                return session.execute({ ...argv, command }, next)
            }
        }
        // 猜曲答案等无指令头的监听仍是普通消息，不注册成捕获所有聊天的命令。
        for (const { instance, fnc, regexp } of listeners) {
            if (!matches(regexp, e.msg)) continue
            instance.e = e
            const result = await instance[fnc](e)
            if (block && result !== false) return
        }
        return next()
    })
}
