import { createRequire } from 'node:module'

const { Universal } = createRequire(import.meta.url)('koishi')
/** @type {WeakMap<object, () => void>} */
const schedulers = new WeakMap()

/** Discord 4.6.2 会将 HTTP 错误包装成 `[429] { ... }`，retry_after 的单位为秒。
 * @param {any} error
 * @returns {number | undefined} 等待毫秒数；非限流错误不重试。
 */
export function discordRetryDelay(error) {
    const message = String(error?.message ?? error)
    if (Number(error?.response?.status ?? error?.status) !== 429 && !/^\[429\]\s/.test(message)) return
    let data = error?.response?.data
    if (!data) {
        try { data = JSON.parse(message.slice(message.indexOf('{'))) } catch { /* 缺少有效正文时采用保守退避。 */ }
    }
    const seconds = Number(data?.retry_after)
    return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds * 1000) + 250 : 30_000
}

/** Discord 的名称限制适用于每个层级，而非整个点分名称。 @param {string} name */
export function validateDiscordName(name) {
    if ([...name].length < 1 || [...name].length > 32
        || !/^[-_\p{Ll}\p{Lm}\p{Lo}\p{N}\p{sc=Devanagari}\p{sc=Thai}]+$/u.test(name)
        || name !== name.toLowerCase()) {
        throw new Error(`Discord 指令名无效：${name}（每层须为 1–32 字符，使用小写字母、数字、汉字、- 或 _）`)
    }
}

/** 校验完整快照；失败时不发送部分指令，以免覆盖其他插件。 @param {any[]} commands */
export function validateDiscordCommands(commands) {
    if (commands.length > 100) throw new Error(`Discord 全局斜线指令超过 100 个：${commands.length}`)
    /** @param {any} command @param {number} depth @param {string} parent */
    function visit(command, depth, parent) {
        const name = parent ? command.name.slice(parent.length + 1) : command.name
        validateDiscordName(name)
        if (depth > 3) throw new Error(`Discord 指令层级超过 3 层：${command.name}`)
        const children = command.children || []
        const options = children.length ? children : [...(command.arguments || []), ...(command.options || [])]
        if (options.length > 25) throw new Error(`Discord 指令 ${command.name} 的子项超过 25 个：${options.length}`)
        if (children.length) {
            for (const child of children) visit(child, depth + 1, command.name)
        } else {
            const names = [
                ...(command.arguments || []).map((/** @type {any} */ arg) => arg.name.toLowerCase().replace(/[^a-z0-9]/g, '')),
                ...(command.options || []).map((/** @type {any} */ option) => option.name.toLowerCase()),
            ]
            for (const option of names) validateDiscordName(option)
            if (new Set(names).size !== names.length) throw new Error(`Discord 指令参数重名：${command.name}`)
        }
    }
    for (const command of commands) visit(command, 1, '')
}

/** 复用 Koishi 的过滤和序列化，避免依赖私有命令列表。 @param {any} ctx @returns {any[]} */
export function commandSnapshot(ctx) {
    /** @type {any[]} */
    let snapshot = []
    ctx.$commander.updateCommands({ updateCommands: (/** @type {any[]} */ commands) => { snapshot = commands } })
    return snapshot
}

/**
 * 调度器属于宿主，跨插件重载共用；旧注册移除和新注册合并成一次同步。
 * 根上下文销毁时取消；网络请求串行执行，期间的变更在下一轮读取最新快照。
 * @param {any} ctx
 * @param {number} [delay]
 */
export function scheduleCommandSync(ctx, delay = 500) {
    const root = ctx.root
    let schedule = schedulers.get(root)
    if (!schedule) {
        let stopped = false
        let running = false
        let pending = false
        // Cordis 会按上下文创建 Bot 代理，不能用对象身份保存跨重载的冷却状态。
        /** @type {Map<string, {retryAt: number, signature?: string}>} */
        const states = new Map()
        /** @type {ReturnType<typeof setTimeout> | undefined} */
        let timer
        const logger = root.logger('phi-plugin')
        /** @param {number} wait */
        const arm = wait => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => { void run().catch(error => logger.warn('指令同步失败：%s', error)) }, Math.min(Math.max(0, wait), 2_147_483_647))
            timer.unref?.()
        }
        const run = async () => {
            timer = undefined
            if (stopped || running) return
            running = true
            pending = false
            let retryAt = Infinity
            try {
                const bots = root.bots.filter((/** @type {any} */ bot) => bot.status === Universal.Status.ONLINE
                    && typeof bot.updateCommands === 'function' && (bot.platform !== 'discord' || bot.config.slash !== false))
                const commands = commandSnapshot(root)
                const signature = JSON.stringify(commands)
                for (const bot of bots) {
                    if (stopped) break
                    const identity = `${bot.platform}:${bot.selfId}`
                    let state = states.get(identity)
                    if (!state) states.set(identity, state = { retryAt: 0 })
                    if (state.signature === signature) {
                        if (bot.platform === 'discord') bot.commands = commands
                        continue
                    }
                    if (state.retryAt > Date.now()) {
                        retryAt = Math.min(retryAt, state.retryAt)
                        continue
                    }
                    const previousCommands = bot.commands
                    try {
                        if (bot.platform === 'discord') validateDiscordCommands(commands)
                        // Discord 4.6.2 会忽略空数组，最后一个指令卸载时需显式清空远端。
                        if (bot.platform === 'discord' && !commands.length) {
                            await bot.internal.bulkOverwriteGlobalApplicationCommands(bot.selfId, [])
                            bot.commands = []
                        } else {
                            await bot.updateCommands(commands)
                        }
                        state.signature = signature
                        state.retryAt = 0
                    } catch (error) {
                        // 适配器在 HTTP 成功前就更新 commands，失败时恢复旧交互映射。
                        if (bot.platform === 'discord' && bot.commands === commands) bot.commands = previousCommands
                        const wait = bot.platform === 'discord' ? discordRetryDelay(error) : undefined
                        if (wait !== undefined) {
                            state.retryAt = Date.now() + wait
                            retryAt = Math.min(retryAt, state.retryAt)
                            logger.warn('Discord 指令同步限流 (%s)，%s 秒后自动重试最新指令', bot.selfId, (wait / 1000).toFixed(1))
                        } else {
                            state.retryAt = 0
                            logger.warn('指令同步失败 (%s:%s)：%s', bot.platform, bot.selfId, error)
                        }
                    }
                }
            } finally {
                running = false
                if (pending && !stopped) schedule?.()
                else if (!stopped && Number.isFinite(retryAt)) arm(retryAt - Date.now())
            }
        }
        schedule = () => {
            if (stopped) return
            pending = true
            arm(delay)
        }
        schedulers.set(root, schedule)
        root.on('dispose', () => {
            stopped = true
            if (timer) clearTimeout(timer)
            schedulers.delete(root)
        })
    }
    schedule()
    ctx.on('dispose', schedule)
}
