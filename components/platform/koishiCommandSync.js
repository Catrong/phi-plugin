import { createRequire } from 'node:module'

const { Universal } = createRequire(import.meta.url)('koishi')

/** Discord 的名称限制适用于每个层级，而非整个点分名称。 @param {string} name */
export function validateDiscordName(name) {
    if ([...name].length < 1 || [...name].length > 32
        || !/^[-_\p{Ll}\p{Lm}\p{Lo}\p{N}\p{sc=Devanagari}\p{sc=Thai}]+$/u.test(name)
        || name !== name.toLowerCase()) {
        throw new Error(`Discord 指令名无效：${name}（每层须为 1–32 字符，使用小写字母、数字、汉字、- 或 _）`)
    }
}

/** 校验计划树；仅用于注册前提示，超限不再中断注册。 @param {any[]} commands */
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
 * 只向 Koishi 报备：由 Commander 依 `slash` 标记生成快照并交给适配器，
 * 上传时机、重复请求、限流退避与空树清空全部由 Koishi 与平台适配器负责。
 *
 * @param {any} ctx
 * @returns {number} 已请求同步的在线机器人数量
 */
export function requestCommandSync(ctx) {
    const logger = ctx.logger('phi-plugin')
    /** @param {any} bot */
    const report = bot => (/** @type {any} */ error) => logger.warn('指令同步失败 (%s:%s)：%s', bot.platform, bot.selfId, error)
    let count = 0
    for (const bot of ctx.bots || []) {
        if (bot.status !== Universal.Status.ONLINE || typeof bot.updateCommands !== 'function') continue
        count++
        try {
            Promise.resolve(ctx.$commander.updateCommands(bot)).catch(report(bot))
        } catch (error) {
            report(bot)(error)
        }
    }
    return count
}
