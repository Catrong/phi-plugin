import Config from '../components/Config.js'
import phiPluginBase from '../components/baseClass.js'
import logger from '../components/Logger.js'
import { queryRanking } from '../model/game/gameScore/index.js'
import { grksSoloClass } from './grks/solo.js'
import { grksMatchClass } from './grks/match.js'
import { grksMessages } from '../model/render/messages.js'
import { sendMessage } from '../model/render/message.js'

/** @import {botEvent} from '../components/baseClass.js' */

/** 命令前缀；测试会在 vm 中直接求值该表达式，因此只能依赖 Config。 */
const getPrefix = () => `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)`

/** 单机房间管理器，进程内共享。 */
const solo = new grksSoloClass()
const matches = new grksMatchClass(solo)

/**
 * 猜 RKS 小游戏入口。
 *
 * 单机模式（房间制）：
 * - `#phi grks`               开始一局；群聊内多人共享同一道题
 * - `#phi grks 15.25`         提交猜测；猜错后系统自动给出下一条提示
 * - `#phi grks ans`           放弃并公布答案
 * - `#phi grks match`         加入匹配，互猜对手的 B30
 * - `#phi grks hint B7`       给对手公开自己的 B7
 * - `#phi grks cancel`        退出匹配池或认输
 * - `#phi grks lb match`      查看匹配积分榜
 */
export class phiGrks extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-grks',
            dsc: 'phi-plugin 猜 RKS',
            event: 'message',
            priority: 900,
            rule: [
                {
                    reg: `${getPrefix()}(grks|猜rks)\\s*(match|匹配)\\s*$`,
                    fnc: 'match'
                },
                {
                    reg: `${getPrefix()}(grks|猜rks)\\s*(cancel|取消|退出)\\s*$`,
                    fnc: 'cancel'
                },
                {
                    reg: `${getPrefix()}(grks|猜rks)\\s*(hint|提示)(?:\\s.*|[134PBpb].*)?$`,
                    fnc: 'hint'
                },
                {
                    reg: `${getPrefix()}(grks|猜rks)\\s*$`,
                    fnc: 'start'
                },
                {
                    reg: `${getPrefix()}(grks|猜rks)(\\s*)(\\d+(?:\\.\\d+)?)$`,
                    fnc: 'guess'
                },
                {
                    reg: `${getPrefix()}(grks|猜rks)(\\s*)(ans|答案|放弃)\\s*$`,
                    fnc: 'ans'
                },
                {
                    reg: `${getPrefix()}(?:(grks|猜rks)(\\s*)(lb|榜)|(游戏积分榜|积分榜))(?:\\s*)(.*)$`,
                    fnc: 'rankList'
                }
            ]
        })
    }

    /**
     * 开始单机对局。
     * @param {botEvent} e
     * @returns {Promise<boolean>}
     */
    async start(e) {
        logger.info(`[phi-grks][start] ${e.user_id}`)
        return await solo.start(e, () => matches.isMatching(e))
    }

    /**
     * 提交猜测。
     * @param {botEvent} e
     * @returns {Promise<boolean>}
     */
    async guess(e) {
        const matched = String(e.msg ?? '').match(/(\d+(?:\.\d+)?)\s*$/)
        if (!matched) {
            await sendMessage(e, grksMessages.guess.format(solo.cmdPrefix(), matches.commandState(e)), { at: true })
            return false
        }
        return matches.isMatching(e) || (!solo.hasRoom(e) && matches.findPlayer(e))
            ? await matches.guess(e, matched[1])
            : await solo.guess(e, matched[1])
    }

    /**
     * 放弃单机对局。
     * @param {botEvent} e
     * @returns {Promise<boolean>}
     */
    async ans(e) {
        if (matches.isMatching(e) || (!solo.hasRoom(e) && matches.findPlayer(e))) return await matches.cancel(e)
        return await solo.ans(e)
    }

    /** @param {botEvent} e */
    async match(e) {
        return await matches.join(e)
    }

    /** @param {botEvent} e */
    async cancel(e) {
        return await matches.cancel(e)
    }

    /** @param {botEvent} e */
    async hint(e) {
        const parsed = parseHintArgs(e.msg)
        if (!parsed.type) {
            await sendMessage(e, grksMessages.hint.format(solo.cmdPrefix(), matches.commandState(e)), { at: true })
            return false
        }
        return await matches.hint(e, parsed.type, parsed.arg)
    }

    /**
     * 查看排行榜（积分榜 / 准确率榜）。
     * @param {botEvent} e
     * @returns {Promise<boolean>}
     */
    async rankList(e) {
        const args = parseRankArgs(String(e.msg ?? ''))
        const result = queryRanking({
            gameId: args.gameId,
            mode: args.mode,
            kind: args.kind,
            page: args.page,
            pageSize: 10,
            meId: String(e.user_id || ''),
        })
        if (!result.ok) {
            await sendMessage(e, grksMessages.rankList.unavailable(result.text), { at: true })
            return false
        }
        await sendMessage(e, await grksMessages.rankList.result(e, result), { at: true })
        return true
    }
}

/**
 * 解析匹配提示参数：`hint [1|3|4] [槽位|histogram|range]`。
 * 省略类型时按槽位或统计形式推断。
 * @param {string} msg
 * @returns {{type?: string, arg?: string}}
 */
export function parseHintArgs(msg) {
    const matched = String(msg ?? '').match(/(?:hint|提示)\s*(?:([134])\s*)?([PpBb]\d{1,2}|histogram|range)?\s*$/i)
    if (!matched) return {}
    const typeChar = matched[1]
    const raw = matched[2]
    /** 槽位统一大写，统计形式统一小写 */
    const arg = raw ? (/^[PpBb]/i.test(raw) ? raw.toUpperCase() : raw.toLowerCase()) : undefined
    if (typeChar) return { type: typeChar, arg }
    if (!arg) return {}
    return { type: !/^[PB]\d{1,2}$/.test(arg) ? '3' : '1', arg }
}

/**
 * 解析榜单参数：`[游戏] [模式] [胜率|积分|准确率] [页码]`，顺序不限。
 * @param {string} msg
 * @returns {{gameId?: string, mode?: string, kind: 'score' | 'winRate' | 'accuracy', page: number}}
 */
export function parseRankArgs(msg) {
    const tail = msg.replace(/^[#/]\S*\s*/, '').replace(/^(grks|猜rks)(\s*)(lb|榜)\s*/, '').replace(/^(游戏积分榜|积分榜)\s*/, '')
    const parts = tail.split(/\s+/).filter(Boolean)
    /** @type {'score' | 'winRate' | 'accuracy'} */
    let kind = 'score'
    /** @type {string | undefined} */
    let mode
    /** @type {string | undefined} */
    let gameId
    let page = 1
    for (const part of parts) {
        const text = part.toLowerCase()
        if (text === 'accuracy' || part === '准确率' || part === '准确率榜') {
            kind = 'accuracy'
            continue
        }
        if (text === 'winrate' || part === '胜率' || part === '胜率榜') {
            kind = 'winRate'
            continue
        }
        if (text === 'score' || part === '积分' || part === '积分榜') {
            kind = 'score'
            continue
        }
        if (text === 'normal' || part === '单机') {
            mode = 'normal'
            continue
        }
        if (text === 'match' || part === '匹配') {
            mode = 'match'
            continue
        }
        if (/^\d+$/.test(text)) {
            page = Math.max(1, Number(text))
            continue
        }
        if (!gameId) gameId = text
    }
    return { gameId, mode, kind, page }
}
