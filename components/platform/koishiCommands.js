/**
 * 将 Yunzai 风格正则交给 Koishi 的命令执行管线。
 * 管理标识不包含 cmdhead：cmdhead 是正则，可以为空，不能作为 Koishi 命令名。
 */

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

/**
 * @param {any} ctx
 * @param {{key: string, instance: any}[]} apps
 * @param {ReturnType<typeof import('./koishi.js').createKoishiAdapter>} adapter
 * @param {boolean} block
 */
export function registerCommands(ctx, apps, adapter, block) {
    /** @type {{name: string, instance: any, fnc: string, regexp: RegExp}[]} */
    const routes = []
    /** @type {{instance: any, fnc: string, regexp: RegExp}[]} */
    const listeners = []
    for (const { key, instance } of apps) {
        for (const rule of instance.rule || []) {
            if (typeof instance[rule.fnc] !== 'function') continue
            const regexp = rule.reg instanceof RegExp ? rule.reg : new RegExp(rule.reg)
            if (!isCommand(regexp)) {
                listeners.push({ instance, fnc: rule.fnc, regexp })
                continue
            }
            const name = `phi-plugin.${key}.${rule.fnc}`.toLowerCase().replace(/_/g, '-')
            routes.push({ name, instance, fnc: rule.fnc, regexp })
        }
    }

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
        ctx.command(`${name} <message:text>`, `${instance.dsc || instance.name || 'Phigros'} · ${fnc}`, {
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
