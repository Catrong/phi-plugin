import { ulid } from 'ulid'
import Config from '../../components/Config.js'
import logger from '../../components/Logger.js'
import platform from '../../components/platform/index.js'
import { chatTargetFromEvent, chatTargetKey } from '../../components/platform/sendTarget.js'
import send from '../../model/render/send.js'
import { grksMatchMessages, grksMatchWords } from '../../model/render/messages.js'
import { addScore, getPlayer } from '../../model/game/gameScore/index.js'
import { playerProfileFromSave } from '../../model/game/gameScore/profile.js'
import { normalizeSlotName, resolveStatsKind } from '../../model/game/grks/hints.js'
import { isCorrect, parseGuess, scoreForHintCount, formatScoreValue } from '../../model/game/grks/score.js'
import { grksClass } from './grks.js'
import { sendMessage } from '../../model/render/message.js'

/** @import {botEvent} from '../../components/baseClass.js' */
/** @import {grksSoloClass} from './solo.js' */
/** @import {grksAnswer, grksKnownData} from './grks.js' */
/** @import {grksMatchMenuOptions, grksFinalMessage} from '../../model/render/messages.js' */
/** @import {gameScoreProfile} from '../../model/game/gameScore/profile.js' */

/**
 * @typedef {'red' | 'blue'} grksTeam
 * @typedef {'hint' | 'answer'} grksMatchStage
 * @typedef {Parameters<grksClass['userHint']>[0]} grksSelectedHint
 */

/**
 * @typedef {object} grksMatchConfig
 * @property {number} maxScore 单局满分
 * @property {number} minRecord 最少有效成绩条数
 * @property {number} tolerance 答案容差
 * @property {number} turnTime 每阶段的时限秒数
 */

/**
 * @typedef {object} grksJoinRequest
 * @property {string} userKey 平台和玩家组成的身份键
 * @property {string} userId 玩家 ID
 * @property {string} sessionKey 入池会话标识
 * @property {botEvent} event 当前会话事件
 */

/**
 * @typedef {object} grksQueueEntry
 * @property {gameScoreProfile} profile 游戏身份快照
 * @property {string} userKey 平台和玩家组成的身份键
 * @property {string} userId 玩家 ID
 * @property {string} sessionKey 入池会话标识
 * @property {botEvent} event 当前会话事件
 * @property {string} nickname 玩家昵称
 * @property {number} joinedAt 入池时间戳
 * @property {grksAnswer} answer 玩家的 B30 答案快照
 * @property {number} matches 已结算匹配场次
 * @property {number | null} accuracy 答题正确率，无样本时为空
 */

/**
 * @typedef {object} grksRoomPlayer
 * @property {gameScoreProfile} profile 游戏身份快照
 * @property {string} userKey 平台和玩家组成的身份键
 * @property {string} userId 玩家 ID
 * @property {string} sessionKey 入池会话标识
 * @property {botEvent} event 最近一次有效操作的会话事件
 * @property {string} nickname 玩家昵称
 * @property {number} joinedAt 入池时间戳
 * @property {grksAnswer} answer 玩家的 B30 答案快照
 * @property {grksTeam} team 红蓝阵营
 * @property {grksClass} game 独立游戏状态
 * @property {grksSelectedHint | null} pendingHint 本轮已锁定的提示
 * @property {number | null} guess 本轮已提交的猜测
 */

/**
 * @typedef {object} grksRoomSides
 * @property {grksRoomPlayer} red 红方玩家
 * @property {grksRoomPlayer} blue 蓝方玩家
 */

/**
 * @typedef {object} grksMatchRoom
 * @property {string} id 房间号
 * @property {grksRoomSides} sides 红蓝双方状态
 * @property {number} turn 当前轮次
 * @property {'playing' | 'settled'} phase 对局状态
 * @property {grksMatchStage} stage 当前阶段
 * @property {grksMatchConfig} config 开局配置快照
 * @property {string} notice 最近一次阶段切换说明
 * @property {string[]} result 结算结果
 * @property {boolean} error 是否因错误中止
 * @property {Promise<void>} pending 串行执行的操作队列
 * @property {ReturnType<typeof setTimeout> | null} timer 阶段计时器
 * @property {ReturnType<typeof setTimeout> | null} cleanupTimer 结果清理计时器
 */

/**
 * @typedef {object} grksRoomAction
 * @property {boolean} ok 操作是否成功
 * @property {grksFinalMessage} [message] 操作的完整回复消息
 */

/**
 * @typedef {object} grksPairOptions
 * @property {number} [now] 当前时间戳
 */

export const GRKS_MATCH_QUEUE_RULES = Object.freeze({ timeout: 240 })

/**
 * @param {grksQueueEntry[]} entries
 * @param {grksPairOptions} [options]
 * @returns {[grksQueueEntry, grksQueueEntry] | null}
 */
export function selectPair(entries, options = {}) {
    const now = options.now ?? Date.now()
    /** @type {[grksQueueEntry, grksQueueEntry] | null} */
    let pair = null
    let bestMatchDifference = Infinity
    let bestAccuracyDifference = Infinity
    let earliestJoin = Infinity
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const a = entries[i]
            const b = entries[j]
            if (a.userKey === b.userKey || a.sessionKey === b.sessionKey) continue
            if (now - a.joinedAt >= GRKS_MATCH_QUEUE_RULES.timeout * 1000
                || now - b.joinedAt >= GRKS_MATCH_QUEUE_RULES.timeout * 1000) continue
            const matchDifference = Math.abs(a.matches - b.matches)
            const accuracyDifference = a.accuracy === null || b.accuracy === null
                ? Infinity : Math.abs(a.accuracy - b.accuracy)
            const sameAccuracyDifference = accuracyDifference === bestAccuracyDifference
                || Math.abs(accuracyDifference - bestAccuracyDifference) <= Number.EPSILON
            const latestJoin = Math.max(a.joinedAt, b.joinedAt)
            if (matchDifference < bestMatchDifference
                || (matchDifference === bestMatchDifference && !sameAccuracyDifference && accuracyDifference < bestAccuracyDifference)
                || (matchDifference === bestMatchDifference && sameAccuracyDifference && latestJoin < earliestJoin)) {
                pair = [a, b]
                bestMatchDifference = matchDifference
                bestAccuracyDifference = accuracyDifference
                earliestJoin = latestJoin
            }
        }
    }
    return pair
}

export class grksMatchClass {
    static #SCAN_INTERVAL_MS = 2000
    static #RESULT_RETENTION_MINUTES = 30
    static #MAX_HINT_ROUNDS = grksClass.MAX_GUESSES
    /** @type {Map<string, grksJoinRequest>} */
    joining = new Map()
    /** @type {Map<string, grksQueueEntry>} */
    queue = new Map()
    /** @type {Map<string, grksMatchRoom>} */
    rooms = new Map()
    /** @type {Map<string, string>} */
    userRooms = new Map()
    /** @type {ReturnType<typeof setInterval> | null} */
    scanner = null
    scanning = false

    /** @param {grksSoloClass} solo */
    constructor(solo) {
        this.solo = solo
    }

    readConfig() {
        const config = this.solo.readConfig()
        return {
            maxScore: config.maxScore,
            minRecord: config.minRecord,
            tolerance: config.tolerance,
            turnTime: this.numberConfig('GrksMatchTurnTime', 1),
        }
    }

    /** @param {configName} key @param {number} min */
    numberConfig(key, min) {
        const value = Config.getUserCfg('config', key)
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
            throw new Error(`猜 RKS 配置 ${key} 必须是大于等于 ${min} 的数字`)
        }
        return value
    }

    /** @param {botEvent} e */
    userKey(e) {
        return `${e.platform || e.session?.platform || platform.name}:${e.user_id}`
    }

    /** @param {botEvent} e */
    isMatching(e) {
        const key = this.userKey(e)
        return this.joining.has(key) || this.queue.has(key) || this.findPlayer(e)?.room.phase === 'playing'
    }

    /** @param {botEvent} e */
    findPlayer(e) {
        const key = this.userKey(e)
        const roomId = this.userRooms.get(key)
        const room = roomId ? this.rooms.get(roomId) : null
        if (!room) return null
        const player = Object.values(room.sides).find(side => side.userKey === key)
        return player ? { room, player } : null
    }

    /** @param {botEvent} e */
    async join(e) {
        if (await this.solo.banCheck(e)) return false
        const userKey = this.userKey(e)
        if (this.isMatching(e)) {
            await sendMessage(e, grksMatchMessages.join.alreadyInMatch(this.solo.cmdPrefix(), this.commandState(e)), { at: true })
            return false
        }
        const sessionKey = chatTargetKey(chatTargetFromEvent(e))
        if (!sessionKey || !e.user_id) {
            await sendMessage(e, grksMatchMessages.join.noSession(), { at: true })
            return false
        }
        if (this.solo.hasRoom(e)) {
            await sendMessage(e, grksMatchMessages.join.soloGame(this.solo.cmdPrefix()), { at: true })
            return false
        }
        const cfg = this.readConfig()
        const request = { userKey, userId: String(e.user_id), sessionKey, event: e }
        this.joining.set(userKey, request)
        try {
            const save = await send.getsave_result(e)
            if (this.joining.get(userKey) !== request || !save) return false
            const answer = await this.solo.buildAnswer(save)
            if (this.joining.get(userKey) !== request) return false
            if (!answer || save.getRecord().filter(record => record.rks > 0).length < cfg.minRecord) {
                await sendMessage(e, grksMatchMessages.join.incomplete(cfg.minRecord), { at: true })
                return false
            }
            const profile = await playerProfileFromSave(save)
            if (this.joining.get(userKey) !== request) return false
            await sendMessage(e, grksMatchMessages.join.joined(this.queue.size + 1, GRKS_MATCH_QUEUE_RULES, this.solo.cmdPrefix()), { at: true })
            if (this.joining.get(userKey) !== request) return false
            const record = getPlayer('grks', 'match', request.userId)
            this.detachPlayer(userKey)
            this.queue.set(userKey, {
                ...request,
                nickname: profile.name,
                profile,
                joinedAt: Date.now(),
                answer,
                matches: record?.plays ?? 0,
                accuracy: record?.answers?.total ? record.answers.correct / record.answers.total : null,
            })
            this.startScanner()
        } finally {
            if (this.joining.get(userKey) === request) this.joining.delete(userKey)
        }
        await this.tryMatch()
        const room = this.findPlayer(e)?.room
        return room ? !room.error : this.queue.has(userKey)
    }

    startScanner() {
        if (this.scanner) return
        this.scanner = setInterval(() => {
            void this.tryMatch().catch(error => logger.error('[phi-plugin][grks] 匹配扫描失败', error))
        }, grksMatchClass.#SCAN_INTERVAL_MS)
        this.scanner.unref?.()
    }

    async tryMatch() {
        await this.expireQueue()
        if (this.scanning) return
        this.scanning = true
        try {
            const cfg = this.readConfig()
            let pair;
            while ((pair = selectPair([...this.queue.values()]))) {
                this.queue.delete(pair[0].userKey)
                this.queue.delete(pair[1].userKey)
                await this.createRoom(pair, cfg)
            }
        } finally {
            this.scanning = false
            this.stopIdleScanner()
        }
    }

    async expireQueue() {
        const now = Date.now()
        const expired = []
        for (const entry of this.queue.values()) {
            if (now - entry.joinedAt < GRKS_MATCH_QUEUE_RULES.timeout * 1000) continue
            this.queue.delete(entry.userKey)
            expired.push(entry)
        }
        this.stopIdleScanner()
        const results = await Promise.allSettled(expired.map(entry => sendMessage(
            entry.event, grksMatchMessages.join.timedOut(GRKS_MATCH_QUEUE_RULES.timeout), { at: true },
        )))
        for (const result of results) {
            if (result.status === 'rejected') {
                logger.error('[phi-plugin][grks] 匹配超时通知失败', result.reason)
                continue
            }
            const value = result.value
            if (value === false || (value && typeof value === 'object' && 'error' in value
                && Array.isArray(value.error) && value.error.length)) {
                logger.error('[phi-plugin][grks] 匹配超时通知失败', value)
            }
        }
    }

    stopIdleScanner() {
        if (this.queue.size || !this.scanner) return
        clearInterval(this.scanner)
        this.scanner = null
    }

    /** @param {grksQueueEntry} entry @param {grksTeam} team @returns {grksRoomPlayer} */
    createSide(entry, team) {
        const game = new grksClass(entry.answer)
        game.knownOrder = true
        return { ...entry, team, game, pendingHint: null, guess: null }
    }

    /** @param {[grksQueueEntry, grksQueueEntry]} entries @param {grksMatchConfig} config */
    async createRoom(entries, config) {
        /** @type {grksMatchRoom} */
        const room = {
            id: ulid(),
            sides: { red: this.createSide(entries[0], 'red'), blue: this.createSide(entries[1], 'blue') },
            turn: 1,
            phase: 'playing',
            stage: 'hint',
            config,
            notice: grksMatchWords.started,
            result: [],
            error: false,
            pending: Promise.resolve(),
            timer: null,
            cleanupTimer: null,
        }
        this.rooms.set(room.id, room)
        for (const side of Object.values(room.sides)) this.userRooms.set(side.userKey, room.id)
        await this.runRoom(room, async () => {
            await this.startRound(room)
            return { ok: !room.error }
        })
        return room
    }

    /** @param {grksMatchRoom} room @param {() => Promise<grksRoomAction>} action */
    runRoom(room, action) {
        const task = room.pending.then(() => room.phase === 'settled'
            ? { ok: false, message: grksMatchMessages.guess.ended() } : action())
        room.pending = task.then(() => undefined, async error => {
            room.error = true
            if (this.rooms.get(room.id) === room) {
                this.closeRoom(room)
                await this.notifyRoom(room)
            }
            logger.error('[phi-plugin][grks] 匹配房间执行失败', error)
        })
        return task
    }

    /** @param {grksMatchRoom} room @param {grksRoomPlayer} player */
    opponent(room, player) {
        return room.sides.red === player ? room.sides.blue : room.sides.red
    }

    /** @param {botEvent} e @param {string} type @param {string} [arg] */
    async hint(e, type, arg) {
        const found = this.findPlayer(e)
        if (!found) return await this.noMatch(e)
        const { room, player } = found
        const turn = room.turn
        const stage = room.stage
        const result = await this.runRoom(room, async () => {
            if (room.turn !== turn) return { ok: false, message: grksMatchMessages.guess.staleTurn(this.menuState(room, player)) }
            if (stage !== 'hint' || room.stage !== 'hint') return { ok: false, message: grksMatchMessages.hint.wrongStage(this.menuState(room, player)) }
            if (player.pendingHint) return { ok: false, message: grksMatchMessages.hint.alreadyHinted(this.menuState(room, player)) }
            const invalid = { ok: false, message: grksMatchMessages.hint.invalidHint(this.menuState(room, player)) }
            const hint = this.selectHint(player.game, type, arg)
            if (!hint) return invalid
            player.event = e
            player.pendingHint = hint
            await this.publishHints(room)
            return { ok: !room.error }
        })
        if (result.message) await sendMessage(e, result.message, { at: true })
        return result.ok
    }

    /** @param {grksClass} game @param {string} type @param {string} [arg] @returns {grksSelectedHint | null} */
    selectHint(game, type, arg) {
        if (type === '1') {
            const slot = normalizeSlotName(arg)
            if (!slot) return null
            const index = (slot[0] === 'P' ? 0 : 3) + Number(slot.slice(1)) - 1
            return game.knownRecords[index] ? null : { type: 'record', value: [index] }
        }
        if (type === '3') {
            if (game.knownSheetType || (arg && arg !== 'histogram' && arg !== 'range')) return null
            return { type: 'sheet', value: resolveStatsKind(Config.getUserCfg('config', 'GrksStatsHint'), arg) }
        }
        return type === '4' && !arg && !game.knownInfo ? { type: 'info' } : null
    }

    /** @param {botEvent} e @param {string} rawValue */
    async guess(e, rawValue) {
        const found = this.findPlayer(e)
        if (!found) return await this.noMatch(e)
        const { room, player } = found
        const turn = room.turn
        const stage = room.stage
        const result = await this.runRoom(room, async () => {
            if (room.turn !== turn) return { ok: false, message: grksMatchMessages.guess.staleTurn(this.menuState(room, player)) }
            if (stage !== 'answer' || room.stage !== 'answer') return { ok: false, message: grksMatchMessages.guess.wrongStage(this.menuState(room, player)) }
            const value = parseGuess(rawValue)
            if (value === null) return { ok: false, message: grksMatchMessages.guess.invalidValue(this.solo.cmdPrefix(), this.menuState(room, player)) }
            if (player.guess !== null) return { ok: false, message: grksMatchMessages.guess.alreadyGuessed(this.menuState(room, player)) }
            player.event = e
            player.guess = value
            if (Object.values(room.sides).every(side => side.guess !== null)) await this.settleRound(room)
            return { ok: !room.error }
        })
        if (result.message) await sendMessage(e, result.message, { at: true })
        return result.ok
    }

    /** @param {botEvent} e @returns {grksMatchMenuOptions | 'queue' | undefined} */
    commandState(e) {
        const found = this.findPlayer(e)
        return found ? this.menuState(found.room, found.player) : this.isMatching(e) ? 'queue' : undefined
    }

    /** @param {grksMatchRoom} room @param {grksRoomPlayer} player @returns {grksMatchMenuOptions} */
    menuState(room, player) {
        return {
            stage: room.stage,
            settled: room.phase === 'settled',
            hinted: player.pendingHint !== null,
            guessed: player.guess !== null,
            knownRecords: player.game.knownRecords.slice(),
            knownInfo: player.game.knownInfo,
            knownSheetType: player.game.knownSheetType,
        }
    }

    /** @param {grksMatchRoom} room */
    async publishHints(room) {
        const { red, blue } = room.sides
        if (!red.pendingHint || !blue.pendingHint) return
        red.game.userHint(red.pendingHint)
        blue.game.userHint(blue.pendingHint)
        room.stage = 'answer'
        room.notice = grksMatchWords.hintsPublished
        if (room.timer) clearTimeout(room.timer)
        room.timer = null
        await this.notifyRoom(room)
        this.armTimeout(room)
    }

    /** @param {grksMatchRoom} room */
    async startRound(room) {
        room.stage = 'hint'
        for (const side of Object.values(room.sides)) {
            side.pendingHint = null
            side.guess = null
        }
        await this.notifyRoom(room)
        this.armTimeout(room)
    }

    /** @param {grksMatchRoom} room */
    armTimeout(room) {
        if (room.phase !== 'playing' || this.rooms.get(room.id) !== room) return
        if (room.timer) clearTimeout(room.timer)
        const turn = room.turn
        const stage = room.stage
        room.timer = setTimeout(() => {
            void this.runRoom(room, async () => {
                if (room.turn !== turn || room.stage !== stage) return { ok: false }
                await this.onTimeout(room)
                return { ok: true }
            }).catch(error => logger.error('[phi-plugin][grks] 房间超时处理失败', error))
        }, room.config.turnTime * 1000)
        room.timer.unref?.()
    }

    /** @param {grksMatchRoom} room */
    async onTimeout(room) {
        if (room.stage === 'hint') {
            for (const side of Object.values(room.sides)) {
                if (side.pendingHint) continue
                const index = side.game.knownRecords.indexOf(false)
                side.pendingHint = index >= 0 ? { type: 'record', value: [index] }
                    : !side.game.knownSheetType ? { type: 'sheet', value: 'histogram' } : { type: 'info' }
            }
            await this.publishHints(room)
            return
        }
        const missing = Object.values(room.sides).filter(side => side.guess === null)
        if (missing.length) {
            this.recordAnswers(room, 'timeout')
            await this.finish(room, missing.length === 2 ? null : this.opponent(room, missing[0]), grksMatchWords.answerTimeout)
            return
        }
        await this.settleRound(room)
    }

    /** @param {grksMatchRoom} room */
    async settleRound(room) {
        if (room.timer) clearTimeout(room.timer)
        room.timer = null
        this.recordAnswers(room)
        const hits = Object.values(room.sides).filter(side => side.guess !== null
            && isCorrect(side.guess, this.opponent(room, side).answer.rks, room.config.tolerance))
        if (hits.length) {
            await this.finish(room, hits.length === 2 ? null : hits[0], grksMatchWords.correct)
            return
        }
        if (room.turn >= grksMatchClass.#MAX_HINT_ROUNDS) {
            await this.finish(room, null, grksMatchWords.hintLimit)
            return
        }
        room.notice = grksMatchWords.nextRound(room.turn)
        room.turn += 1
        await this.startRound(room)
    }

    /** @param {grksMatchRoom} room @param {'timeout' | 'abandoned'} [unanswered] */
    recordAnswers(room, unanswered = 'abandoned') {
        if (room.stage !== 'answer') return
        for (const side of Object.values(room.sides)) {
            const opponent = this.opponent(room, side)
            if (opponent.game.history.at(-1)?.result !== 'pending') continue
            const result = side.guess === null ? unanswered
                : isCorrect(side.guess, opponent.answer.rks, room.config.tolerance) ? 'correct' : 'wrong'
            opponent.game.recordGuess(side.guess, result)
        }
    }

    /** @param {botEvent} e */
    async cancel(e) {
        const key = this.userKey(e)
        if (this.joining.has(key) || this.queue.has(key)) {
            this.joining.delete(key)
            this.queue.delete(key)
            this.stopIdleScanner()
            await sendMessage(e, grksMatchMessages.cancel.leftQueue(), { at: true })
            return true
        }
        const found = this.findPlayer(e)
        if (!found) return await this.noMatch(e)
        const result = await this.runRoom(found.room, async () => {
            found.player.event = e
            await this.finish(found.room, this.opponent(found.room, found.player), grksMatchWords.quit(found.player.nickname))
            return { ok: !found.room.error }
        })
        if (result.message) await sendMessage(e, result.message, { at: true })
        return result.ok
    }

    /** @param {grksMatchRoom} room @param {grksRoomPlayer | null} winner @param {string} reason */
    async finish(room, winner, reason) {
        if (room.phase === 'settled') return
        this.recordAnswers(room)
        this.closeRoom(room)
        room.result = [grksMatchWords.settlement(reason)]
        const results = await Promise.all(Object.values(room.sides).map(async side => {
            const opponent = this.opponent(room, side)
            const hit = side.guess !== null && isCorrect(side.guess, opponent.answer.rks, room.config.tolerance)
            const points = side === winner || (!winner && hit)
                ? scoreForHintCount(opponent.game.hintCnt, room.config.maxScore) : 0
            const result = !winner ? 'draw' : side === winner ? 'win' : 'loss'
            const hints = hit ? opponent.game.hintCnt : grksMatchClass.#MAX_HINT_ROUNDS
            const answers = { total: 0, correct: 0 }
            for (const entry of opponent.game.history) {
                if (entry.result === 'correct') answers.correct += 1
                if (entry.result === 'correct' || entry.result === 'wrong' || entry.result === 'timeout') answers.total += 1
            }
            await addScore('grks', 'match', side.userId, points, { result, hints, answers, profile: side.profile })
            return grksMatchWords.result(side.team, side.nickname, result, formatScoreValue(points), side.answer.rks.toFixed(4))
        }))
        room.result.push(...results)
        await this.notifyRoom(room)
    }

    /** @param {grksMatchRoom} room */
    closeRoom(room) {
        room.phase = 'settled'
        if (room.timer) clearTimeout(room.timer)
        room.timer = null
        if (!room.cleanupTimer) {
            room.cleanupTimer = setTimeout(() => this.removeRoom(room), grksMatchClass.#RESULT_RETENTION_MINUTES * 60 * 1000)
            room.cleanupTimer.unref?.()
        }
    }

    /** @param {string} key */
    detachPlayer(key) {
        const id = this.userRooms.get(key)
        this.userRooms.delete(key)
        const room = id ? this.rooms.get(id) : null
        if (room && Object.values(room.sides).every(side => this.userRooms.get(side.userKey) !== room.id)) this.removeRoom(room)
    }

    /** @param {grksMatchRoom} room */
    removeRoom(room) {
        room.phase = 'settled'
        if (room.timer) clearTimeout(room.timer)
        if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
        room.timer = null
        room.cleanupTimer = null
        this.rooms.delete(room.id)
        for (const side of Object.values(room.sides)) {
            if (this.userRooms.get(side.userKey) === room.id) this.userRooms.delete(side.userKey)
        }
    }

    /** @param {grksMatchRoom} room */
    async notifyRoom(room) {
        if (this.rooms.get(room.id) !== room) return false
        const results = await Promise.allSettled(Object.values(room.sides).map(player => this.sendView(room, player)))
        let failed = false
        for (const result of results) {
            if (result.status === 'rejected') {
                failed = true
                logger.error('[phi-plugin][grks] 阶段消息发送失败', result.reason)
                continue
            }
            const value = result.value
            if (value === false || (value && typeof value === 'object' && 'error' in value
                && Array.isArray(value.error) && value.error.length)) {
                failed = true
                logger.error('[phi-plugin][grks] 阶段消息发送失败', value)
            }
        }
        if (failed) {
            room.error = true
            if (this.rooms.get(room.id) === room) this.closeRoom(room)
        }
        return !failed
    }

    /** @param {grksMatchRoom} room @param {grksRoomPlayer} player */
    async sendView(room, player) {
        const event = player.event
        const opponent = this.opponent(room, player)
        const revealAll = room.phase === 'settled'
        /** @type {grksKnownData} */
        const data = revealAll ? {
            records: opponent.answer.record,
            info: { stats: opponent.answer.stats, challenge: opponent.answer.challenge, updateAt: opponent.answer.updateAt },
            sheet: opponent.game.getKnownData().sheet,
        } : opponent.game.getKnownData()
        const status = {
            id: room.id,
            team: player.team,
            opponent: opponent.nickname,
            turn: room.turn,
            maxTurns: grksMatchClass.#MAX_HINT_ROUNDS,
            stage: room.stage,
            settled: revealAll,
            notice: room.notice,
            hinted: player.pendingHint !== null,
            guessed: player.guess !== null,
            opponentHinted: opponent.pendingHint !== null,
            opponentGuessed: opponent.guess !== null,
            error: room.error,
            result: room.result,
            prefix: this.solo.cmdPrefix(),
            seconds: room.config.turnTime,
            tolerance: room.config.tolerance,
        }
        const message = await grksMatchMessages.view(event, {
            data,
            orderKnown: true, hintCount: opponent.game.hintCnt,
            prefix: this.solo.cmdPrefix(), answerRks: revealAll ? opponent.answer.rks : null, revealAll,
            exitCommand: 'cancel',
            history: opponent.game.history.map(entry => ({ ...entry })),
            playerId: grksMatchWords.opponent(player.team),
        }, status, this.menuState(room, player))
        return await sendMessage(event, message, { at: true })
    }

    /** @param {botEvent} e */
    async noMatch(e) {
        await sendMessage(e, grksMatchMessages.hint.noMatch(this.solo.cmdPrefix()), { at: true })
        return false
    }

    reset() {
        if (this.scanner) clearInterval(this.scanner)
        this.scanner = null
        for (const room of this.rooms.values()) this.removeRoom(room)
        this.joining.clear()
        this.queue.clear()
        this.userRooms.clear()
    }
}
