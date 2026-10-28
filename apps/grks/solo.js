import Config from '../../components/Config.js'
import logger from '../../components/Logger.js'
import getBanGroup from '../../model/user/getBanGroup.js'
import { UserCredentials } from '../../model/user/userCredentials.js'
import LocalSaveRepository from '../../model/save/getSave.js'
import { addScore } from '../../model/game/gameScore/index.js'
import { playerProfileForUser } from '../../model/game/gameScore/profile.js'
import { getPool } from '../../model/game/grks/pool.js'
import { formatScoreValue, isCorrect, parseGuess, scoreForHintCount } from '../../model/game/grks/score.js'
import { chatTargetFromEvent, chatTargetKey } from '../../components/platform/sendTarget.js'
import { grksMessages, grksSoloMessages } from '../../model/render/messages.js'
import fCompute from '../../model/game/fCompute.js'
import { grksClass } from './grks.js'
import { sendMessage } from '../../model/render/message.js'

/** @import {botEvent} from '../../components/baseClass.js' */
/** @import {grksAnswer, grksKnownData} from './grks.js' */
/** @import {grksViewMessageOptions} from '../../model/render/messages.js' */

/**
 * 猜 RKS 单机模式（房间制）。
 *
 * - 房间以会话为单位：私聊一个房间，群聊一个房间，群内多人共享同一道题与提示进度。
 * - 开局自动给出首条提示，猜错后按提示冷却追加随机提示。
 * - 回答冷却按玩家独立计算，提示冷却按房间独立计算，两者共用 `GrksSoloCd`（默认 5s）。
 * - 首个猜中的玩家得分并结束本局，答案图公开全部成绩。
 */

/**
 * 单机配置。
 * @typedef {object} grksSoloConfig
 * @property {number} cd 回答（每人）与提示（房间）共用的冷却秒数
 * @property {number} timeLength 待机超时秒数
 * @property {number} maxScore 单局满分
 * @property {number} minRecord 出题池要求的最少成绩条数
 * @property {number} poolRefreshHours 出题池缓存有效期（小时）
 * @property {number} tolerance 答案容差
 */

/**
 * 一个进行中的单机房间。
 * @typedef {object} grksSoloRoom
 * @property {string} key 会话键
 * @property {grksClass} game 题目与提示状态
 * @property {botEvent} event 最近一次有效事件（超时结算时使用）
 * @property {number} startedAt 开局时间戳
 * @property {Map<string, number>} answerAtByUser 每位玩家最近一次回答时间戳（回答 CD 按玩家独立）
 * @property {number} lastHintAt 最近一次系统提示时间戳（提示 CD 按房间独立）
 * @property {boolean} settled 是否已结算（防止并发重复结算）
 * @property {ReturnType<typeof setTimeout> | null} timer 待机超时定时器
 */

export class grksSoloClass {

    /** 单次抽题最多尝试的存档数量。 */
    static #DRAW_ATTEMPT_LIMIT = 6

    /** @type {Map<string, grksSoloRoom>} */
    rooms = new Map()

    /** @type {Set<string>} */
    startingRooms = new Set()

    /**
     * 命令前缀。
     * @returns {string}
     */
    cmdPrefix() {
        const head = Config.getUserCfg('config', 'cmdhead')
        return `#${String(head ?? '')} grks`
    }

    /**
     * 读取配置，非法值回退默认。
     * @returns {grksSoloConfig}
     */
    readConfig() {
        return {
            cd: this.#numberCfg('GrksSoloCd', 5),
            timeLength: this.#numberCfg('GrksTimeLength', 600),
            maxScore: this.#numberCfg('GrksMaxScore', 10),
            minRecord: this.#numberCfg('GrksMinRecord', 27),
            poolRefreshHours: this.#numberCfg('GrksPoolRefreshHours', 6),
            tolerance: this.#numberCfg('GrksTolerance', 0.1),
        }
    }

    /**
     * 当前会话是否已有进行中的房间。
     * @param {botEvent} e
     * @returns {boolean}
     */
    hasRoom(e) {
        const key = this.#sessionKey(e)
        return this.rooms.has(key) || this.startingRooms.has(key)
    }

    /**
     * 清理指定会话的房间（不发送消息）。
     * @param {string} key
     * @returns {boolean}
     */
    clearRoom(key) {
        const room = this.rooms.get(key)
        return room ? this.dispose(room) : false
    }

    /**
     * 开始一局单机。
     * @param {botEvent} e
     * @param {() => boolean} [isMatching]
     * @returns {Promise<boolean>}
     */
    async start(e, isMatching = () => false) {
        if (await this.banCheck(e)) return false
        if (isMatching()) {
            await sendMessage(e, grksMessages.start.matching(this.cmdPrefix()), { at: true })
            return false
        }
        const key = this.#sessionKey(e)
        if (this.rooms.has(key) || this.startingRooms.has(key)) {
            await sendMessage(e, grksSoloMessages.start.existing(this.cmdPrefix()), { at: true })
            return false
        }

        const cfg = this.readConfig()
        this.startingRooms.add(key)
        let drawn;
        try {
            drawn = await this.drawAnswer(e, cfg)
        } finally {
            this.startingRooms.delete(key)
        }
        if (!drawn.answer) {
            const message = drawn.candidateCount
                ? grksSoloMessages.start.drawFailed()
                : grksSoloMessages.start.noArchive(cfg.minRecord)
            await sendMessage(e, message, { at: true })
            return false
        }

        /** @type {grksSoloRoom} */
        const room = {
            key,
            game: new grksClass(drawn.answer),
            event: e,
            startedAt: Date.now(),
            answerAtByUser: new Map(),
            lastHintAt: 0,
            settled: false,
            timer: null,
        }
        room.game.randomHint()
        room.lastHintAt = room.game.lastTipTime
        this.rooms.set(key, room)
        this.armTimeout(room, cfg)
        await sendMessage(e, await grksSoloMessages.start.opened(e, this.viewOptions(room), {
            cd: cfg.cd, limit: grksClass.MAX_GUESSES,
        }), { at: true })
        return true
    }

    /**
     * 提交猜测。回答 CD 按玩家独立计算，提示 CD 按房间计算。
     * @param {botEvent} e
     * @param {string} rawValue
     * @returns {Promise<boolean>}
     */
    async guess(e, rawValue) {
        const room = this.rooms.get(this.#sessionKey(e))
        if (!room) {
            await sendMessage(e, grksSoloMessages.guess.notRunning(this.cmdPrefix()), { at: true })
            return false
        }

        const cfg = this.readConfig()
        const userId = this.#userId(e)
        const now = Date.now()
        const answerRemain = (room.answerAtByUser.get(userId) ?? 0) + cfg.cd * 1000 - now
        if (answerRemain > 0) {
            await sendMessage(e, grksSoloMessages.guess.cooldown(Math.ceil(answerRemain / 1000)), { at: true })
            return false
        }

        const value = parseGuess(rawValue)
        if (value === null) {
            await sendMessage(e, grksSoloMessages.guess.invalidValue(this.cmdPrefix()), { at: true })
            return false
        }

        const answer = room.game.answer
        if (!answer) return false

        room.event = e
        room.answerAtByUser.set(userId, now)

        if (isCorrect(value, answer.rks, cfg.tolerance)) {
            room.game.recordGuess(value, 'correct')
            await this.finish(room, e, cfg, 'correct', value)
            return true
        }

        room.game.recordGuess(value, 'wrong')
        if (room.game.guessHistory.length >= grksClass.MAX_GUESSES) {
            await this.finish(room, e, cfg, 'failed')
            return true
        }
        const hintRemain = room.lastHintAt + cfg.cd * 1000 - now
        let hintGiven = false
        let hintWait = 0
        if (hintRemain > 0) {
            hintWait = Math.ceil(hintRemain / 1000)
        } else if (room.game.hasUnknownHint()) {
            try {
                room.game.randomHint()
                room.lastHintAt = now
                hintGiven = true
            } catch (error) {
                logger.warn('[phi-plugin][grks] 系统提示生成失败')
                logger.warn(error)
            }
        }
        this.armTimeout(room, cfg)

        await sendMessage(e, await grksSoloMessages.guess.wrong(e, this.viewOptions(room), {
            hintGiven, hintWait, cd: cfg.cd,
        }), { at: true })
        return true
    }

    /**
     * 放弃并公布答案。
     * @param {botEvent} e
     * @returns {Promise<boolean>}
     */
    async ans(e) {
        const room = this.rooms.get(this.#sessionKey(e))
        if (!room) {
            await sendMessage(e, grksSoloMessages.guess.notRunning(this.cmdPrefix()), { at: true })
            return false
        }
        await this.finish(room, e, this.readConfig(), 'abandoned')
        return true
    }

    /**
     * 从出题池抽一道题，排除发起者自己的存档；没有其他存档时回退到全部。
     * @param {botEvent} e
     * @param {grksSoloConfig} cfg
     * @returns {Promise<{answer: grksAnswer | null, candidateCount: number}>}
     */
    async drawAnswer(e, cfg) {
        const ownToken = await this.ownToken(e)
        const pool = await getPool({
            minRecord: cfg.minRecord,
            refreshHours: cfg.poolRefreshHours,
        })
        const entries = pool.entries.filter(entry => entry.token !== ownToken)
        const candidates = entries.length ? entries : pool.entries
        const shuffled = fCompute.randArray(candidates)
        for (const entry of shuffled.slice(0, grksSoloClass.#DRAW_ATTEMPT_LIMIT)) {
            const answer = await this.loadAnswer(entry.token)
            if (answer) return { answer, candidateCount: candidates.length }
        }
        return { answer: null, candidateCount: candidates.length }
    }

    /**
     * 发起者自己的 sessionToken；未绑定时为空字符串。
     * @param {botEvent} e
     * @returns {Promise<string>}
     */
    async ownToken(e) {
        try {
            const token = await UserCredentials.fromEvent(e).getSessionToken()
            return token ? String(token) : ''
        } catch {
            return ''
        }
    }

    /**
     * 把一份本地存档转换为 `grksClass` 需要的答案结构。
     * 成绩取 P3（满分最高三条）+ B27（全部成绩最高二十七条）。
     * @param {string} token sessionToken
     * @returns {Promise<grksAnswer | null>}
     */
    async loadAnswer(token) {
        const save = await LocalSaveRepository.getSaveBySessionToken(/** @type {phigrosToken} */ (token))
        if (!save) return null
        return await this.buildAnswer(save)
    }

    /**
     * @param {import('../../model/save/Save.js').default} save
     * @returns {Promise<grksAnswer | null>}
     */
    async buildAnswer(save) {
        const all = save.getRecord().filter(record => record.rks > 0)
        if (all.length < 27) return null
        const phi = all.filter(record => record.score >= 1000000).slice(0, 3)
        if (phi.length < 3) return null
        const record = [...phi, ...all.slice(0, 27)]

        const total = record.reduce((sum, item) => sum + item.rks, 0)
        const rks = Math.round(total / record.length * 10000) / 10000

        const statRows = await save.getStats()
        /** @type {[number, number, number][]} */
        const stats = []
        for (const row of statRows) {
            stats.push([row.cleared, row.fc, row.phi])
        }

        const challenge = Number.isFinite(save.saveInfo.summary.challengeModeRank)
            ? save.saveInfo.summary.challengeModeRank
            : 0
        const modified = save.saveInfo.modifiedAt.iso
        const updateAt = modified instanceof Date && Number.isFinite(modified.getTime())
            ? modified.getTime()
            : Date.now()

        return { rks, record, stats, challenge, updateAt }
    }

    /**
     * 群禁用检查。
     * @param {botEvent} e
     * @returns {Promise<boolean>} 是否被禁用
     */
    async banCheck(e) {
        if (await getBanGroup.get(e, 'grksgame')) {
            await sendMessage(e, grksSoloMessages.start.banned(), { at: true })
            return true
        }
        return false
    }

    /**
     * 重置待机超时。
     * @param {grksSoloRoom} room
     * @param {grksSoloConfig} cfg
     */
    armTimeout(room, cfg) {
        if (room.timer) clearTimeout(room.timer)
        room.timer = setTimeout(() => {
            void this.timeout(room, cfg)
        }, Math.max(30, cfg.timeLength) * 1000)
        room.timer.unref?.()
    }

    /**
     * 超时结算。
     * @param {grksSoloRoom} room
     * @param {grksSoloConfig} cfg
     * @returns {Promise<void>}
     */
    async timeout(room, cfg) {
        if (room.settled) return
        await this.finish(room, room.event, cfg, 'timeout')
    }

    /**
     * 结算并公布答案。
     * @param {grksSoloRoom} room
     * @param {botEvent} e
     * @param {grksSoloConfig} cfg
     * @param {'correct' | 'timeout' | 'abandoned' | 'failed'} reason
     * @param {number | null} [guess] 猜中的数值
     * @returns {Promise<void>}
     */
    async finish(room, e, cfg, reason, guess = null) {
        if (!this.dispose(room)) return
        const answer = room.game.answer
        if (!answer) return

        const hintCount = room.game.hintCnt
        const rks = answer.rks.toFixed(4)
        if (reason === 'timeout' || reason === 'abandoned') {
            room.game.recordGuess(null, reason)
        }

        if (reason === 'correct') {
            const points = scoreForHintCount(hintCount, cfg.maxScore)
            const message = await grksSoloMessages.reveal.correct(e, this.viewOptions(room, true), {
                rks,
                guess: String(guess ?? ''),
                tolerance: cfg.tolerance,
                points: formatScoreValue(points),
                hints: hintCount,
            })
            await sendMessage(e, message, { at: true })
            await this.recordPlay(e, points, hintCount)
            return
        }

        const options = this.viewOptions(room, true)
        const message = reason === 'failed'
            ? await grksSoloMessages.reveal.failed(e, options, grksClass.MAX_GUESSES)
            : reason === 'timeout'
                ? await grksSoloMessages.reveal.timeout(e, options, cfg.timeLength)
                : await grksSoloMessages.reveal.abandoned(e, options)
        await sendMessage(e, message, { at: true })
    }

    /** @param {grksSoloRoom} room @param {boolean} [revealAll] @returns {grksViewMessageOptions} */
    viewOptions(room, revealAll = false) {
        const known = room.game.getKnownData()
        const answer = room.game.answer
        /** @type {grksKnownData} */
        const data = revealAll && answer
            ? {
                records: answer.record,
                info: known.info ?? {
                    stats: answer.stats,
                    challenge: answer.challenge,
                    updateAt: answer.updateAt,
                },
                sheet: known.sheet,
            }
            : known
        const answerRks = revealAll && answer ? answer.rks : null
        return {
            data,
            orderKnown: room.game.knownOrder,
            hintCount: room.game.hintCnt,
            prefix: this.cmdPrefix(),
            answerRks,
            revealAll,
            history: room.game.history.map(entry => ({ ...entry })),
        }
    }

    /**
     * 记录猜中者的积分。
     * @param {botEvent} e
     * @param {number} points
     * @param {number} hints
     * @returns {Promise<void>}
     */
    async recordPlay(e, points, hints) {
        const userId = String(e.user_id ?? '')
        if (!userId) return
        try {
            const profile = await playerProfileForUser(userId)
            await addScore('grks', 'normal', userId, points, { hints, profile })
        } catch (error) {
            logger.warn('[phi-plugin][grks] 记录单机积分失败')
            logger.warn(error)
        }
    }

    /**
     * 清理房间。
     * @param {grksSoloRoom} room
     * @returns {boolean} 是否确实清理了本次房间
     */
    dispose(room) {
        if (room.settled) return false
        room.settled = true
        if (room.timer) clearTimeout(room.timer)
        if (this.rooms.get(room.key) === room) this.rooms.delete(room.key)
        return true
    }

    /**
     * 会话键；私聊与群聊各自独立。
     * @param {botEvent} e
     * @returns {string}
     */
    #sessionKey(e) {
        const key = chatTargetKey(chatTargetFromEvent(e))
        return key || `user:${this.#userId(e)}`
    }

    /**
     * 事件发送者 ID。
     * @param {botEvent} e
     * @returns {string}
     */
    #userId(e) {
        return String(e.user_id ?? '')
    }

    /**
     * 读取数值配置，非法值回退默认。
     * @param {configName} key
     * @param {number} fallback
     * @returns {number}
     */
    #numberCfg(key, fallback) {
        /** @type {unknown} */
        const value = Config.getUserCfg('config', key)
        if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
        if (typeof value === 'string' && value.trim() !== '') {
            const parsed = Number(value)
            return Number.isFinite(parsed) ? parsed : fallback
        }
        return fallback
    }
}
