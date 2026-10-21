import Config from '../components/Config.js'
import phiPluginBase from '../components/baseClass.js'
import send from '../model/render/send.js'
import logger from '../components/Logger.js'
import { queryRanking } from '../model/game/gameScore/index.js'
import * as solo from './grks/solo.js'
import * as match from './grks/match.js'

/** @import {botEvent} from '../components/baseClass.js' */

const getHead = () => Config.getUserCfg('config', 'cmdhead')
/** 命令前缀；测试会在 vm 中直接求值该表达式，因此只能依赖 getHead。 */
const getPrefix = () => `^[#/](${getHead()})(\\s*)`

/**
 * 猜 RKS 小游戏入口。
 *
 * 所有子指令都带命令头，避免与 `b30`/`rks` 相关指令以及 guessGame 的普通消息监听冲突：
 * - `#phi grks`               开始单机（开局立即下发第一条提示）
 * - `#phi grks tip`           请求下一条提示
 * - `#phi grks 15.25`         提交猜测
 * - `#phi grks ans`           放弃并公布答案
 * - `#phi grks match`         加入匹配池
 * - `#phi grks cancel`        退出匹配池 / 结束对局
 * - `#phi grks hint 1 B7`     匹配回合给出提示
 * - `#phi grks lb`            查看排行榜（积分 / 胜率 / 准确率）
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
                    reg: `${getPrefix()}(grks|猜rks)\\s*$`,
                    fnc: 'start'
                },
                {
                    reg: `${getPrefix()}(grks|猜rks)(\\s*)(tip|提示)\\s*$`,
                    fnc: 'tip'
                },
                {
                    reg: `${getPrefix()}(grks|猜rks)(\\s*)(hint|提示)(?:\\s*)([134])?(?:\\s*)([PpBb]\\d{1,2}|histogram|range)?\\s*$`,
                    fnc: 'hint'
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
                    reg: `${getPrefix()}(grks|猜rks)(\\s*)(match|匹配)\\s*$`,
                    fnc: 'match'
                },
                {
                    reg: `${getPrefix()}(grks|猜rks)(\\s*)(cancel|取消|退出)\\s*$`,
                    fnc: 'cancel'
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
        if (match.isMatching(String(e.user_id || ''))) {
            await send.send_with_At(e, `你正在匹配中，先发送 ${solo.cmdPrefix()} cancel 结束对局再开单机吧！`)
            return false
        }
        return await solo.start(e)
    }

    /**
     * 请求下一条提示（单机）。
     * @param {botEvent} e
     * @returns {Promise<boolean>}
     */
    async tip(e) {
        return await solo.tip(e)
    }

    /**
     * 匹配回合给出提示。
     * @param {botEvent} e
     * @returns {Promise<boolean>}
     */
    async hint(e) {
        const parsed = parseHintArgs(String(e.msg ?? ''))
        if (!parsed?.type) {
            await send.send_with_At(e, `格式：${solo.cmdPrefix()} hint B7（等价于 hint 1 B7）／${solo.cmdPrefix()} hint 3 [histogram|range]／${solo.cmdPrefix()} hint 4`)
            return false
        }
        return await match.hint(e, parsed.type, parsed.arg)
    }

    /**
     * 提交猜测（自动区分单机/匹配）。
     * @param {botEvent} e
     * @returns {Promise<boolean>}
     */
    async guess(e) {
        const matched = String(e.msg ?? '').match(/(\d+(?:\.\d+)?)\s*$/)
        if (!matched) {
            await send.send_with_At(e, `格式：${solo.cmdPrefix()} 15.25`)
            return false
        }
        if (match.isMatching(String(e.user_id || ''))) {
            return await match.guess(e, matched[1])
        }
        return await solo.guess(e, matched[1])
    }

    /**
     * 放弃单机对局。
     * @param {botEvent} e
     * @returns {Promise<boolean>}
     */
    async ans(e) {
        return await solo.ans(e)
    }

    /**
     * 加入匹配池。
     * @param {botEvent} e
     * @returns {Promise<boolean>}
     */
    async match(e) {
        logger.info(`[phi-grks][match] ${e.user_id}`)
        return await match.join(e)
    }

    /**
     * 退出匹配池或结束对局。
     * @param {botEvent} e
     * @returns {Promise<boolean>}
     */
    async cancel(e) {
        return await match.cancel(e)
    }

    /**
     * 查看排行榜（积分榜 / 胜率榜 / 准确率榜）。
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
            meId: String(e.user_id || ''),
        })
        if (!result.ok) {
            await send.send_with_At(e, result.text)
            return false
        }
        await send.send_with_At(e, result.text)
        return true
    }
}

/**
 * 解析匹配提示参数：`hint [1|3|4] [槽位|histogram|range]`。
 * 省略类型时按参数推断：槽位 → 类型 1，histogram/range → 类型 3。
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
