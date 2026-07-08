import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import chokidar from 'chokidar'
import MemoryRedis from './memoryRedis.js'
import { createKoishiDatabaseRedis } from './koishiDatabaseRedis.js'
import { setPlatformAdapter } from './index.js'

/** @import {PhiSegment, PlatformAdapter, PlatformEvent, PlatformForwardMessage, PlatformLogger, PlatformMessageInput, PlatformMessageOutput, PlatformPluginConfig, PlatformRendererConfig} from './types.js' */

const rawReplySymbol = Symbol('phi.koishiRawReply')
const rawSessionSymbol = Symbol('phi.koishiSession')
const wrappedSymbol = Symbol('phi.koishiWrapped')
const contextStoreSymbol = Symbol('phi.koishiContexts')
const require = createRequire(import.meta.url)

/**
 * @typedef {object} KoishiAdapterOptions
 * @property {any} [h] Koishi 的 h 工具，建议从 `koishi` 导入后传入。
 * @property {PlatformLogger} [logger]
 * @property {import('./types.js').PlatformRedis} [redis]
 * @property {boolean | import('./types.js').KoishiDatabaseRedisOptions} [database] 是否使用 Koishi database 服务。默认在 `ctx.database` 存在时启用。
 * @property {string} [rootPath]
 * @property {Record<string, unknown>} [botConfig]
 * @property {string} [packageVersion]
 */

/**
 * @typedef {object} KoishiRegisterOptions
 * @property {boolean} [block=true] 处理到匹配规则后是否阻断后续 middleware。
 */

/**
 * @param {string} specifier
 * @returns {any | null}
 */
function optionalRequire(specifier) {
    try {
        return require(specifier)
    } catch {
        return null
    }
}

/**
 * @param {string} dirname
 * @returns {boolean}
 */
function mkdirs(dirname) {
    if (fs.existsSync(dirname)) return true
    fs.mkdirSync(dirname, { recursive: true })
    return true
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeAttr(value) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function stringifyId(value) {
    return value === undefined || value === null ? '' : String(value)
}

/**
 * @param {any} ctx
 * @param {KoishiAdapterOptions} options
 * @returns {any}
 */
function getH(ctx, options) {
    return options.h || ctx?.h || /** @type {any} */ (globalThis).h || null
}

/**
 * @param {any} h
 * @param {string} type
 * @param {Record<string, unknown>} attrs
 * @param {unknown} [children]
 * @returns {unknown}
 */
function hElement(h, type, attrs, children) {
    if (typeof h === 'function') return children === undefined ? h(type, attrs) : h(type, attrs, children)
    return ''
}

/**
 * @param {any} h
 * @param {string} messageId
 * @returns {unknown}
 */
function quoteElement(h, messageId) {
    if (!messageId) return ''
    if (typeof h?.quote === 'function') return h.quote(messageId)
    if (typeof h === 'function') return h('quote', { id: messageId })
    return ''
}

/**
 * @param {unknown} message
 * @returns {string}
 */
function messageToText(message) {
    if (Array.isArray(message)) return message.map(messageToText).join('')
    if (message === false || message === null || message === undefined) return ''
    if (typeof message === 'object' && '__phiSegment' in message) {
        const segment = /** @type {PhiSegment} */ (message)
        if (segment.type === 'at') return `@${segment.userId}`
        if (segment.type === 'markdown' || segment.type === 'text') return segment.text
        if (segment.type === 'image') return '[图片]'
    }
    return String(message)
}

/**
 * @param {unknown} message
 * @returns {unknown[]}
 */
function asArray(message) {
    return Array.isArray(message) ? message : [message]
}

/**
 * @param {PlatformEvent} e
 * @param {boolean} isGroup
 * @returns {string}
 */
function contextKey(e, isGroup) {
    const platform = e.platform || 'koishi'
    if (isGroup) return `${platform}:group:${e.group_id || e.groupId || e.chatId || ''}`
    return `${platform}:user:${e.group_id || e.groupId || 'private'}:${e.user_id || e.userId || ''}`
}

/**
 * @param {unknown} sentMessage
 * @returns {string[]}
 */
function getMessageIds(sentMessage) {
    if (!sentMessage) return []
    if (Array.isArray(sentMessage)) return sentMessage.flatMap(getMessageIds)
    if (typeof sentMessage === 'string' || typeof sentMessage === 'number') return [String(sentMessage)]
    if (typeof sentMessage === 'object') {
        const item = /** @type {{id?: unknown, messageId?: unknown, message_id?: unknown}} */ (sentMessage)
        return [item.message_id, item.messageId, item.id].filter(Boolean).map(String)
    }
    return []
}

/**
 * @param {any} ctx
 * @param {KoishiAdapterOptions} options
 * @returns {PlatformLogger}
 */
function createLogger(ctx, options = {}) {
    const hostLogger = options.logger
        || (typeof ctx?.logger === 'function' ? ctx.logger('phi-plugin') : ctx?.logger)
        || console

    /**
     * @param {string[]} names
     */
    const pick = (...names) => {
        for (const name of names) {
            const value = hostLogger?.[name] || /** @type {Record<string, any>} */ (console)?.[name]
            if (typeof value === 'function') return value.bind(hostLogger?.[name] ? hostLogger : console)
        }
        return console.log.bind(console)
    }

    return /** @type {PlatformLogger} */ ({
        mark: pick('success', 'info', 'log'),
        info: pick('info', 'log'),
        warn: pick('warn'),
        error: pick('error'),
        debug: pick('debug', 'info', 'log'),
        green: text => text,
        red: text => text,
    })
}

/**
 * @param {any} ctx
 * @param {KoishiAdapterOptions} options
 * @param {PlatformLogger} logger
 * @returns {import('./types.js').PlatformRedis}
 */
function createRedis(ctx, options, logger) {
    if (options.redis) return options.redis
    if (options.database === false) return new MemoryRedis()

    if (ctx?.database) {
        try {
            const databaseOptions = typeof options.database === 'object' ? options.database : {}
            return createKoishiDatabaseRedis(ctx, databaseOptions)
        } catch (error) {
            logger.warn('[phi-plugin] Koishi database 初始化失败，已退回内存 Redis 兼容层。', error)
        }
    } else {
        logger.warn('[phi-plugin] 未检测到 Koishi database 服务，已使用内存 Redis 兼容层；重启后缓存数据会丢失。')
    }

    return new MemoryRedis()
}

class KoishiRenderer {
    /**
     * @param {PlatformRendererConfig} [data]
     */
    constructor(data = {}) {
        this.id = data.id || 'renderer'
        this.type = data.type || 'image'
        this.render = /** @type {any} */ (this)[data.render || 'render']
        this.dir = './temp/html'
        /** @type {Record<string, string>} */
        this.html = {}
        /** @type {Record<string, import('chokidar').FSWatcher>} */
        this.watcher = {}
        mkdirs(this.dir)
    }

    /**
     * @param {string} tpl
     * @param {Record<string, unknown>} data
     * @returns {Promise<string>}
     */
    async renderTemplate(tpl, data) {
        const template = optionalRequire('art-template')
        if (!template?.render) throw new Error('art-template is not available')
        return template.render(tpl, data)
    }

    /**
     * @param {string} name
     * @param {{tplFile: string, saveId?: string, resPath?: string, [key: string]: unknown}} data
     * @returns {string | false}
     */
    dealTpl(name, data) {
        let { tplFile, saveId = name } = data
        let savePath = `./temp/html/${name}/${saveId}.html`
        if (!this.html[tplFile]) {
            mkdirs(`./temp/html/${name}`)
            try {
                this.html[tplFile] = fs.readFileSync(tplFile, 'utf8')
            } catch {
                return false
            }
            this.watch(tplFile)
        }

        data.resPath = './resources/'
        const template = optionalRequire('art-template')
        if (!template?.render) return false
        fs.writeFileSync(savePath, template.render(this.html[tplFile], data))
        return savePath
    }

    /**
     * @param {string} tplFile
     */
    watch(tplFile) {
        if (this.watcher[tplFile]) return
        const watcher = chokidar.watch(tplFile)
        watcher.on('change', () => {
            delete this.html[tplFile]
        })
        this.watcher[tplFile] = watcher
    }
}

/**
 * 创建 Koishi 平台适配器。
 *
 * @param {any} ctx Koishi Context
 * @param {KoishiAdapterOptions} [options]
 * @returns {PlatformAdapter & {fromSession(session: any): PlatformEvent}}
 */
export function createKoishiAdapter(ctx, options = {}) {
    const h = getH(ctx, options)
    const logger = createLogger(ctx, options)
    const redis = createRedis(ctx, options, logger)

    /** @type {PlatformAdapter & {fromSession(session: any): PlatformEvent}} */
    const adapter = {
        name: 'koishi',
        PluginBase: /** @type {import('./types.js').PlatformPluginBaseConstructor} */ (/** @type {unknown} */ (class KoishiPluginBase {
            /** @type {PlatformEvent | undefined} */
            e

            /**
             * @param {PlatformPluginConfig} [config]
             */
            constructor({
                name = 'your-plugin',
                dsc = 'none',
                handler,
                namespace,
                event = 'message',
                priority = 5000,
                task = undefined,
                rule = [],
            } = {}) {
                this.name = name
                this.dsc = dsc
                this.handler = handler
                this.namespace = namespace
                this.event = event
                this.priority = priority
                this.task = task
                this.rule = rule
                this[contextStoreSymbol] = new Map()
            }

            /**
             * @param {PlatformMessageInput} [msg]
             * @param {boolean} [quote]
             * @param {Record<string, unknown>} [data]
             */
            reply(msg = '', quote = false, data = {}) {
                if (!this.e) return false
                return adapter.reply(this.e, msg, { quote, ...data })
            }

            /**
             * @param {string} name
             * @param {boolean} [isGroup]
             * @param {number} [timeout]
             * @param {string} [timeoutMsg]
             */
            setContext(name, isGroup = false, timeout = 0, timeoutMsg = '') {
                if (!this.e) return false
                const event = this.e
                const key = contextKey(this.e, isGroup)
                const store = /** @type {Map<string, any>} */ (this[contextStoreSymbol])
                const old = store.get(key)
                if (old?.timer) clearTimeout(old.timer)

                const timer = timeout > 0
                    ? setTimeout(() => {
                        const current = store.get(key)
                        if (!current || current.name !== name) return
                        store.delete(key)
                        if (timeoutMsg) adapter.reply(event, timeoutMsg).catch?.(() => { })
                    }, timeout * 1000)
                    : null
                timer?.unref?.()
                store.set(key, { name, isGroup, timer })
                return true
            }

            /**
             * @param {string} [name]
             * @param {boolean} [isGroup]
             */
            finish(name = '', isGroup = false) {
                if (!this.e) return false
                const key = contextKey(this.e, isGroup)
                const store = /** @type {Map<string, any>} */ (this[contextStoreSymbol])
                const current = store.get(key)
                if (!current || (name && current.name !== name)) return false
                if (current.timer) clearTimeout(current.timer)
                store.delete(key)
                return true
            }

            /**
             * @param {PlatformEvent} e
             */
            getKoishiContext(e) {
                const store = /** @type {Map<string, any>} */ (this[contextStoreSymbol])
                return store.get(contextKey(e, false)) || store.get(contextKey(e, true))
            }
        })),
        RendererBase: /** @type {import('./types.js').PlatformRendererBaseConstructor} */ (/** @type {unknown} */ (KoishiRenderer)),
        redis,
        rootPath: options.rootPath || process.cwd(),
        logger,
        segment: {
            image(data) {
                if (typeof h?.image === 'function') return h.image(data)
                if (typeof h === 'function') return h('image', { url: String(data) })
                return { __phiSegment: true, type: 'image', data }
            },
            at(userId) {
                if (typeof h?.at === 'function') return h.at(String(userId))
                if (typeof h === 'function') return h('at', { id: String(userId) })
                return { __phiSegment: true, type: 'at', userId }
            },
            markdown(text) {
                return text
            },
            text(text) {
                if (typeof h?.text === 'function') return h.text(text)
                return text
            },
        },

        getBotConfig() {
            return options.botConfig || ctx?.config || {}
        },

        getPackageVersion() {
            return options.packageVersion || process.env.npm_package_version || 'unknown'
        },

        getBotNickname(e) {
            const session = /** @type {any} */ (e?.session)
            return stringifyId(e?.bot?.nickname || session?.bot?.username || session?.bot?.selfId || 'Bot')
        },

        getAdapterName(e) {
            const session = /** @type {any} */ (e?.session)
            return stringifyId(e?.platform || session?.platform || session?.bot?.platform || this.name)
        },

        isBotReady() {
            return Boolean(ctx)
        },

        /**
         * @param {PlatformMessageInput} message
         * @returns {PlatformMessageOutput}
         */
        toPlatformMessage(message) {
            if (Array.isArray(message)) {
                return message
                    .filter(item => item !== false && item !== null && item !== undefined)
                    .flatMap(item => asArray(this.toPlatformMessage(item)))
            }
            if (!message || typeof message !== 'object' || !('__phiSegment' in message)) return message

            const segment = /** @type {PhiSegment} */ (message)
            if (segment.type === 'image') return this.segment.image(segment.data)
            if (segment.type === 'at') return this.segment.at(segment.userId)
            if (segment.type === 'markdown') return this.segment.markdown(segment.text)
            if (segment.type === 'text') return segment.text
            return message
        },

        /**
         * @param {any} session
         * @returns {PlatformEvent}
         */
        fromSession(session) {
            const userId = stringifyId(session?.userId || session?.author?.id)
            const channelId = stringifyId(session?.channelId)
            const guildId = stringifyId(session?.guildId)
            const isPrivate = Boolean(session?.isDirect || session?.subtype === 'private' || (!guildId && channelId && channelId === userId))
            const groupId = isPrivate ? '' : (guildId || channelId)
            const content = stringifyId(session?.stripped?.content || session?.content || session?.message || '')

            /** @type {PlatformEvent} */
            const event = {
                msg: content,
                user_id: userId,
                group_id: groupId || undefined,
                self_id: stringifyId(session?.selfId || session?.bot?.selfId),
                isGroup: !isPrivate,
                isPrivate,
                platform: stringifyId(session?.platform || session?.bot?.platform || 'koishi'),
                userId,
                chatId: groupId || channelId || userId,
                groupId: groupId || undefined,
                chatType: isPrivate ? 'private' : 'group',
                text: content,
                session,
                bot: {
                    nickname: stringifyId(session?.bot?.username || session?.bot?.selfId || 'Bot'),
                    adapter: stringifyId(session?.platform || session?.bot?.platform || 'koishi'),
                },
            }

            Object.defineProperty(event, rawSessionSymbol, {
                value: session,
                enumerable: false,
                configurable: true,
            })
            Object.defineProperty(event, rawReplySymbol, {
                value: (msg = '') => session?.send ? session.send(msg) : false,
                enumerable: false,
                configurable: true,
            })
            event.reply = (msg = '', quote = false, data = {}) => this.reply(event, msg, { quote, ...data })
            return this.wrapEvent(event)
        },

        /**
         * @template {PlatformEvent | null | undefined} T
         * @param {T | any} e
         * @returns {T extends PlatformEvent ? T & PlatformEvent : T}
         */
        wrapEvent(e) {
            if (!e) return e
            const event = /** @type {any} */ (e)
            if (event[wrappedSymbol]) return e
            if (event.send && (event.content !== undefined || event.userId !== undefined)) return /** @type {any} */ (this.fromSession(event))

            event.platform = event.platform || this.getAdapterName(event)
            event.userId = event.userId || event.user_id
            event.chatId = event.chatId || event.group_id || event.user_id
            event.chatType = event.chatType || (event.isGroup ? 'group' : 'private')
            event.text = event.text || event.msg || ''
            if (!event.reply) event.reply = (msg = '', quote = false, data = {}) => this.reply(event, msg, { quote, ...data })

            Object.defineProperty(event, wrappedSymbol, {
                value: true,
                enumerable: false,
                configurable: true,
            })
            return event
        },

        /**
         * @template {PlatformEvent} T
         * @param {T} e
         * @param {Partial<PlatformEvent>} [patch]
         * @returns {T & PlatformEvent}
         */
        cloneEvent(e, patch = {}) {
            const cloned = { ...e, ...patch }
            const event = /** @type {any} */ (e)
            const session = event?.[rawSessionSymbol] || event?.session
            if (session) {
                Object.defineProperty(cloned, rawSessionSymbol, {
                    value: session,
                    enumerable: false,
                    configurable: true,
                })
            }
            cloned.reply = (msg = '', quote = false, data = {}) => this.reply(cloned, msg, { quote, ...data })
            return /** @type {T & PlatformEvent} */ (this.wrapEvent(cloned))
        },

        /**
         * @param {PlatformEvent} e
         * @param {PlatformMessageInput} [msg]
         * @param {import('./types.js').PlatformReplyOptions} [options]
         */
        async reply(e, msg = '', options = {}) {
            if (!e || !msg) return false
            const event = this.wrapEvent(e)
            const eventAny = /** @type {any} */ (event)
            const session = eventAny?.[rawSessionSymbol] || eventAny?.session
            const quote = Boolean(options.quote)
            const { quote: _quote, rawReply: _rawReply, recallMsg, ...data } = options
            let content = this.toPlatformMessage(msg)
            if (quote && session?.messageId) {
                const quote = quoteElement(h, stringifyId(session.messageId))
                if (quote) content = [quote, ...asArray(content)]
            }

            const rawReply = /** @type {any} */ (_rawReply || eventAny?.[rawReplySymbol])
            const sent = rawReply && rawReply !== event.reply
                ? await rawReply(content, quote, data)
                : session?.send
                    ? await session.send(content)
                    : false

            const recallSeconds = Number(recallMsg || 0)
            if (sent && recallSeconds > 0) {
                setTimeout(() => {
                    this.recall(event, sent).catch?.(() => { })
                }, recallSeconds * 1000).unref?.()
            }
            return sent
        },

        /**
         * @param {PlatformEvent} e
         * @param {PlatformMessageInput} msg
         * @param {boolean} [quote]
         * @param {Record<string, unknown>} [data]
         */
        async sendWithAt(e, msg, quote = false, data = {}) {
            if (e?.isGroup) {
                const at = this.segment.at(e.user_id || e.userId || '')
                if (typeof msg === 'string') return this.reply(e, [at, ` ${msg}`], { quote, ...data })
                return this.reply(e, [at, ...asArray(msg)], { quote, ...data })
            }
            return this.reply(e, msg, { quote, ...data })
        },

        /**
         * @param {PlatformEvent} e
         * @param {import('./types.js').PlatformUserId} userId
         */
        async pickMember(e, userId) {
            const event = /** @type {any} */ (e)
            const session = event?.[rawSessionSymbol] || event?.session
            const guildId = stringifyId(session?.guildId || e?.group_id || e?.groupId)
            const member = guildId && session?.bot?.getGuildMember
                ? await session.bot.getGuildMember(guildId, userId).catch(() => null)
                : null
            if (!member) return null
            return {
                ...member,
                nickname: member.nick || member.name || member.username,
                card: member.nick || member.name || member.username,
                sendMsg: message => this.sendPrivate(e, message),
            }
        },

        /**
         * @param {PlatformEvent} e
         * @param {PlatformMessageInput} msg
         */
        async sendPrivate(e, msg) {
            const event = this.wrapEvent(e)
            const eventAny = /** @type {any} */ (event)
            const session = eventAny?.[rawSessionSymbol] || eventAny?.session
            const userId = event?.user_id || event?.userId
            if (!userId) return false
            const content = this.toPlatformMessage(msg)
            if (session?.bot?.sendPrivateMessage) return session.bot.sendPrivateMessage(userId, content)
            if (session?.bot?.sendMessage) return session.bot.sendMessage(userId, content)
            return false
        },

        /**
         * @param {import('./types.js').PlatformUserId} userId
         * @param {PlatformMessageInput} msg
         * @param {import('./types.js').PlatformUserId} [botId]
         */
        relpyPrivate(userId, msg, botId) {
            const bot = botId && ctx?.bots?.[botId] ? ctx.bots[botId] : ctx?.bots?.[0]
            if (bot?.sendPrivateMessage) return bot.sendPrivateMessage(userId, this.toPlatformMessage(msg))
            return false
        },

        /**
         * @param {PlatformEvent} e
         * @param {unknown} sentMessage
         */
        async recall(e, sentMessage) {
            const event = /** @type {any} */ (e)
            const session = event?.[rawSessionSymbol] || event?.session
            const channelId = stringifyId(session?.channelId || e?.chatId || e?.group_id)
            const guildId = stringifyId(session?.guildId || e?.group_id || e?.groupId)
            if (!session?.bot?.deleteMessage || !channelId) return false
            const ids = getMessageIds(sentMessage)
            for (const id of ids) {
                await session.bot.deleteMessage(channelId, id, guildId || undefined).catch(() => false)
            }
            return ids.length > 0
        },

        /**
         * @param {PlatformEvent} e
         * @param {PlatformMessageInput[]} [msg]
         * @param {string} [dec]
         */
        async makeForwardMsg(e, msg = [], dec) {
            /** @type {PlatformForwardMessage[]} */
            const forwardMsg = []
            if (dec) forwardMsg.push({ message: dec })
            for (const message of asArray(msg)) {
                forwardMsg.push({ message: this.toPlatformMessage(/** @type {PlatformMessageInput} */ (message)) })
            }
            return forwardMsg.map(item => messageToText(item.message)).join('\n')
        },

        /**
         * @param {number} ms
         * @returns {Promise<void>}
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms))
        },

        /**
         * @param {string} url
         * @param {string} file
         */
        async downFile(url, file) {
            if (typeof fetch !== 'function') return false
            const response = await fetch(url)
            if (!response.ok) return false
            mkdirs(path.dirname(file))
            fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()))
            return true
        },

        mkdirs,

        /**
         * @param {PlatformEvent} e
         * @param {string | Buffer} file
         * @param {string} [filename]
         */
        async uploadFile(e, file, filename) {
            if (typeof h?.file === 'function') return this.reply(e, h.file(file, { filename }))
            if (Buffer.isBuffer(file) && typeof h?.image === 'function') return this.reply(e, h.image(file))
            if (typeof file === 'string' && typeof h?.file === 'function') return this.reply(e, h.file(file, { filename }))
            return false
        },

        async restartBot() {
            return false
        },
    }

    return adapter
}

/**
 * 创建并设置当前平台为 Koishi。
 *
 * @param {any} ctx
 * @param {KoishiAdapterOptions} [options]
 */
export function useKoishiAdapter(ctx, options = {}) {
    const adapter = createKoishiAdapter(ctx, options)
    setPlatformAdapter(adapter)
    return adapter
}

/**
 * 将现有 `apps` 规则注册到 Koishi middleware。
 *
 * @param {any} ctx
 * @param {Record<string, any>} apps
 * @param {ReturnType<typeof createKoishiAdapter>} adapter
 * @param {KoishiRegisterOptions} [options]
 */
export function registerKoishiApps(ctx, apps, adapter, options = {}) {
    const block = options.block !== false
    const instances = Object.values(apps)
        .map(App => typeof App === 'function' ? new App() : App)
        .filter(Boolean)
        .sort((a, b) => Number(a.priority || 5000) - Number(b.priority || 5000))

    ctx.middleware(/**
     * @param {any} session
     * @param {any} next
     */
    async (session, next) => {
        const e = adapter.fromSession(session)

        for (const instance of instances) {
            const context = instance.getKoishiContext?.(e)
            if (!context) continue
            const handler = instance[context.name]
            if (typeof handler !== 'function') continue
            instance.e = e
            const result = await handler.call(instance, e)
            if (block && result !== false) return
        }

        for (const instance of instances) {
            for (const rule of instance.rule || []) {
                const reg = rule.reg instanceof RegExp ? rule.reg : new RegExp(rule.reg)
                if (!reg.test(e.msg)) continue
                const handler = instance[rule.fnc]
                if (typeof handler !== 'function') continue
                instance.e = e
                const result = await handler.call(instance, e)
                if (block && result !== false) return
            }
        }

        return next()
    })

    return instances
}

export default createKoishiAdapter
