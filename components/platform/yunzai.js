import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import chokidar from 'chokidar'
import MemoryRedis from './memoryRedis.js'

/** @import {PhiSegment, PlatformAdapter, PlatformEvent, PlatformForwardMessage, PlatformLogger, PlatformMessageInput, PlatformMessageOutput, PlatformPluginConfig, PlatformRendererConfig} from './types.js' */

const rawReplySymbol = Symbol('phi.rawReply')
const wrappedSymbol = Symbol('phi.platformWrapped')
const require = createRequire(import.meta.url)

/**
 * @param {string} specifier
 * @returns {Promise<any | null>}
 */
async function optionalImport(specifier) {
    try {
        return await import(specifier)
    } catch {
        return null
    }
}

/**
 * @param {Partial<PlatformLogger>} [hostLogger]
 * @returns {PlatformLogger}
 */
function createLogger(hostLogger = {}) {
    /**
     * @param {keyof PlatformLogger & string} name
     * @param {string} [fallbackName]
     */
    const pick = (name, fallbackName = name) => {
        const hostValue = hostLogger?.[name]
        const consoleValue = /** @type {Record<string, any>} */ (console)?.[fallbackName]
        if (typeof hostValue === 'function') return hostValue.bind(hostLogger)
        if (typeof consoleValue === 'function') return consoleValue.bind(console)
        return console.log.bind(console)
    }

    const normalized = {
        mark: pick('mark', 'log'),
        info: pick('info', 'info'),
        warn: pick('warn', 'warn'),
        error: pick('error', 'error'),
        debug: pick('debug', 'debug'),
        green: typeof hostLogger?.green === 'function' ? hostLogger.green.bind(hostLogger) : (/** @type {unknown} */ text) => text,
        red: typeof hostLogger?.red === 'function' ? hostLogger.red.bind(hostLogger) : (/** @type {unknown} */ text) => text,
    }

    return /** @type {PlatformLogger} */ (new Proxy(normalized, {
        get(target, prop) {
            if (typeof prop === 'symbol') return undefined
            if (prop in target) return /** @type {Record<string, any>} */ (target)[prop]
            const value = hostLogger?.[prop]
            return typeof value === 'function' ? value.bind(hostLogger) : value
        },
    }))
}

const yunzaiPluginModule = await optionalImport('../../../../lib/plugins/plugin.js')
const yunzaiRendererModule = await optionalImport('../../../../lib/renderer/Renderer.js')
const yunzaiCfgModule = await optionalImport('../../../../lib/config/config.js')

const nativeSegment = await (async () => {
    if (globalThis.segment) return globalThis.segment
    const icqq = await optionalImport('icqq')
    if (icqq?.segment) return icqq.segment
    const oicq = await optionalImport('oicq')
    if (oicq?.segment) return oicq.segment
    return null
})()

class FallbackPlugin {
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
        task = { name: '', fnc: '', cron: '' },
        rule = [],
    } = {}) {
        this.name = name
        this.dsc = dsc
        this.event = event
        this.priority = priority
        this.task = task
        this.rule = rule
        if (handler) {
            this.handler = handler
            this.namespace = namespace || ''
        }
    }

    /**
     * @param {PlatformMessageInput} [msg]
     * @param {boolean} [quote]
     * @param {Record<string, unknown>} [data]
     */
    reply(msg = '', quote = false, data = {}) {
        if (!this.e?.reply || !msg) return false
        return this.e.reply(msg, quote, data)
    }

    setContext() {
        return false
    }

    finish() {
        return false
    }
}

class FallbackRenderer {
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
        this.createDir(this.dir)
    }

    /**
     * @param {string} dirname
     * @returns {boolean}
     */
    createDir(dirname) {
        if (fs.existsSync(dirname)) return true
        if (this.createDir(path.dirname(dirname))) {
            fs.mkdirSync(dirname)
            return true
        }
        return false
    }

    /**
     * @param {string} tpl
     * @param {Record<string, unknown>} data
     * @returns {Promise<string>}
     */
    async renderTemplate(tpl, data) {
        const mod = await optionalImport('art-template')
        if (!mod?.default?.render) throw new Error('art-template is not available')
        return mod.default.render(tpl, data)
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
            this.createDir(`./temp/html/${name}`)
            try {
                this.html[tplFile] = fs.readFileSync(tplFile, 'utf8')
            } catch (error) {
                globalThis.logger?.error?.(`加载html错误：${tplFile}`)
                return false
            }
            this.watch(tplFile)
        }

        data.resPath = './resources/'
        let tmpHtml
        try {
            const template = require('art-template')
            tmpHtml = template.render(this.html[tplFile], data)
        } catch (error) {
            globalThis.logger?.error?.('[phi-plugin] render template failed', error)
            return false
        }
        fs.writeFileSync(savePath, tmpHtml)
        globalThis.logger?.debug?.(`[图片生成][使用模板] ${savePath}`)
        return savePath
    }

    /**
     * @param {string} tplFile
     * @returns {void}
     */
    watch(tplFile) {
        if (this.watcher[tplFile]) return
        const watcher = chokidar.watch(tplFile)
        watcher.on('change', () => {
            delete this.html[tplFile]
            globalThis.logger?.mark?.(`[修改html模板] ${tplFile}`)
        })
        this.watcher[tplFile] = watcher
    }
}

/**
 * @param {'image' | 'at' | 'markdown' | 'text'} type
 * @param {Record<string, unknown>} [data]
 */
function createPhiSegment(type, data = {}) {
    return /** @type {PhiSegment} */ ({ __phiSegment: true, type, ...data })
}

/**
 * @template T
 * @param {T | T[]} message
 * @returns {T[]}
 */
function asArray(message) {
    return Array.isArray(message) ? message : [message]
}

const memoryRedis = new MemoryRedis()

/** @type {PlatformAdapter} */
const adapter = {
    name: 'yunzai',
    PluginBase: yunzaiPluginModule?.default || FallbackPlugin,
    RendererBase: yunzaiRendererModule?.default || FallbackRenderer,
    redis: globalThis.redis || memoryRedis,
    rootPath: process.cwd(),

    logger: createLogger(globalThis.logger),

    segment: {
        image(data) {
            return nativeSegment?.image ? nativeSegment.image(data) : createPhiSegment('image', { data })
        },
        at(userId) {
            return nativeSegment?.at ? nativeSegment.at(userId) : createPhiSegment('at', { userId })
        },
        markdown(text) {
            if (nativeSegment?.markdown) return nativeSegment.markdown(text)
            return createPhiSegment('markdown', { text })
        },
        text(text) {
            return createPhiSegment('text', { text })
        },
    },

    getBotConfig() {
        return yunzaiCfgModule?.default?.bot || {}
    },

    getPackageVersion() {
        return yunzaiCfgModule?.default?.package?.version || 'unknown'
    },

    getBotNickname(e) {
        return globalThis.Bot?.nickname || e?.bot?.nickname || 'Bot'
    },

    getAdapterName(e) {
        const adapter = e?.bot?.adapter
        return (typeof adapter === 'object' ? adapter.name : adapter) || this.name
    },

    isBotReady() {
        return typeof globalThis.Bot !== 'undefined'
    },

    /**
     * @param {PlatformMessageInput} message
     * @returns {PlatformMessageOutput}
     */
    toPlatformMessage(message) {
        if (Array.isArray(message)) {
            return message
                .filter(item => item !== false && item !== null && item !== undefined)
                .map(item => this.toPlatformMessage(item))
        }
        if (!message || typeof message !== 'object' || !('__phiSegment' in message)) return message
        const phiSegment = /** @type {PhiSegment} */ (message)
        if (phiSegment.type === 'image') return nativeSegment?.image ? nativeSegment.image(phiSegment.data) : phiSegment
        if (phiSegment.type === 'at') return nativeSegment?.at ? nativeSegment.at(phiSegment.userId) : phiSegment
        if (phiSegment.type === 'markdown') return nativeSegment?.markdown ? nativeSegment.markdown(phiSegment.text) : phiSegment.text
        if (phiSegment.type === 'text') return phiSegment.text
        return phiSegment
    },

    /**
     * @template {PlatformEvent | null | undefined} T
     * @param {T} e
     * @returns {T extends PlatformEvent ? T & PlatformEvent : T}
     */
    wrapEvent(e) {
        const eventSymbols = /** @type {Record<symbol, unknown>} */ (/** @type {unknown} */ (e))
        if (!e || eventSymbols[wrappedSymbol]) return /** @type {T extends PlatformEvent ? T & PlatformEvent : T} */ (e)
        if (typeof e.reply === 'function') {
            Object.defineProperty(e, rawReplySymbol, {
                value: e.reply.bind(e),
                enumerable: false,
                configurable: true,
            })
            e.reply = (msg = '', quote = false, data = {}) => this.reply(e, msg, { quote, ...data })
        }

        e.platform = e.platform || this.getAdapterName(e)
        e.userId = e.userId || e.user_id
        e.chatId = e.chatId || e.group_id || e.user_id
        e.chatType = e.chatType || (e.isGroup ? 'group' : 'private')
        e.text = e.text || e.msg || ''

        Object.defineProperty(e, wrappedSymbol, {
            value: true,
            enumerable: false,
            configurable: true,
        })
        return /** @type {T extends PlatformEvent ? T & PlatformEvent : T} */ (e)
    },

    /**
     * @template {PlatformEvent} T
     * @param {T} e
     * @param {Partial<PlatformEvent>} [patch]
     * @returns {T & PlatformEvent}
     */
    cloneEvent(e, patch = {}) {
        const cloned = { ...e, ...patch }
        const eventSymbols = /** @type {Record<symbol, unknown>} */ (/** @type {unknown} */ (e))
        const rawReply = eventSymbols[rawReplySymbol] || (!eventSymbols[wrappedSymbol] && e?.reply?.bind(e))
        if (rawReply) {
            Object.defineProperty(cloned, rawReplySymbol, {
                value: rawReply,
                enumerable: false,
                configurable: true,
            })
            cloned.reply = (msg = '', quote = false, data = {}) => this.reply(cloned, msg, { quote, ...data })
            Object.defineProperty(cloned, wrappedSymbol, {
                value: true,
                enumerable: false,
                configurable: true,
            })
            return /** @type {T & PlatformEvent} */ (cloned)
        }
        return /** @type {T & PlatformEvent} */ (this.wrapEvent(cloned))
    },

    /**
     * @param {PlatformEvent} e
     * @param {PlatformMessageInput} [msg]
     * @param {import('./types.js').PlatformReplyOptions} [options]
     */
    async reply(e, msg = '', options = {}) {
        if (!e || !msg) return false
        const quote = Boolean(options.quote)
        const { quote: _quote, rawReply: _rawReply, ...data } = options
        const eventSymbols = /** @type {Record<symbol, unknown>} */ (/** @type {unknown} */ (e))
        const rawReply = /** @type {any} */ (_rawReply || eventSymbols[rawReplySymbol] || (!eventSymbols[wrappedSymbol] && e.reply?.bind(e)))
        if (!rawReply) return false
        return rawReply(this.toPlatformMessage(msg), quote, data)
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
        if (!e?.group_id && !e?.groupId) return null
        if (globalThis.Bot?.pickMember) return globalThis.Bot.pickMember(e.group_id || e.groupId || '', userId)
        if (e.group?.pickMember) return e.group.pickMember(userId)
        return null
    },

    /**
     * @param {PlatformEvent} e
     * @param {PlatformMessageInput} msg
     */
    async sendPrivate(e, msg) {
        const userId = e?.user_id || e?.userId
        if (!userId) return false
        const member = await this.pickMember(e, userId).catch(() => null)
        if (member?.sendMsg) return member.sendMsg(this.toPlatformMessage(msg))
        if (globalThis.Bot?.sendFriendMsg) return globalThis.Bot.sendFriendMsg(e.self_id, userId, this.toPlatformMessage(msg))
        if (e?.friend?.sendMsg) return e.friend.sendMsg(this.toPlatformMessage(msg))
        return false
    },

    /**
     * @param {import('./types.js').PlatformUserId} userId
     * @param {PlatformMessageInput} msg
     * @param {import('./types.js').PlatformUserId} [botId]
     */
    relpyPrivate(userId, msg, botId) {
        if (globalThis.Bot?.sendFriendMsg) return globalThis.Bot.sendFriendMsg(botId, userId, this.toPlatformMessage(msg))
        return false
    },

    /**
     * @param {PlatformEvent} e
     * @param {unknown} sentMessage
     */
    async recall(e, sentMessage) {
        const messageId = /** @type {import('./types.js').PlatformMessageId | undefined} */ (typeof sentMessage === 'object' && sentMessage !== null
            ? /** @type {{message_id?: import('./types.js').PlatformMessageId}} */ (sentMessage).message_id
            : sentMessage)
        if (!messageId) return false
        if (e?.group?.recallMsg) return e.group.recallMsg(messageId)
        if (e?.friend?.recallMsg) return e.friend.recallMsg(messageId)
        return false
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
            forwardMsg.push({ message: this.toPlatformMessage(message) })
        }
        if (e?.group?.makeForwardMsg) return e.group.makeForwardMsg(forwardMsg)
        if (e?.friend?.makeForwardMsg) return e.friend.makeForwardMsg(forwardMsg)
        if (globalThis.Bot?.makeForwardMsg) return globalThis.Bot.makeForwardMsg(forwardMsg)
        return asArray(msg).join('\n')
    },

    /**
     * @param {number} ms
     * @returns {Promise<void>}
     */
    sleep(ms) {
        if (globalThis.Bot?.sleep) return globalThis.Bot.sleep(ms)
        return new Promise(resolve => setTimeout(resolve, ms))
    },

    /**
     * @param {string} url
     * @param {string} file
     * @param {unknown} [opts]
     */
    async downFile(url, file, opts) {
        if (globalThis.Bot?.download) return globalThis.Bot.download(url, file, opts)
        return false
    },

    /**
     * @param {string} dirname
     * @returns {boolean}
     */
    mkdirs(dirname) {
        if (fs.existsSync(dirname)) return true
        fs.mkdirSync(dirname, { recursive: true })
        return true
    },

    /**
     * @param {PlatformEvent} e
     * @param {string} file
     * @param {string} [filename]
     */
    async uploadFile(e, file, filename) {
        if (e?.isGroup) {
            if (e.group?.sendFile) return e.group.sendFile(file, undefined, filename)
            if (e.group?.fs?.upload) return e.group.fs.upload(file, undefined, filename)
        }
        if (e?.friend?.sendFile) return e.friend.sendFile(file, filename)
        return false
    },

    /**
     * @param {PlatformEvent} [e]
     */
    async restartBot(e) {
        const restartModule = await optionalImport('../../../other/restart.js')
        if (restartModule?.Restart) {
            return new restartModule.Restart(e).restart()
        }
        if (globalThis.Bot?.restart) return globalThis.Bot.restart()
        return false
    },
}

export default adapter
