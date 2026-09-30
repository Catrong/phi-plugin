const MINUTE_MS = 60_000
const HISTORY_WINDOW_MS = 30 * MINUTE_MS

/**
 * 保存最近 30 分钟的绘图压力分钟桶。
 * 同一分钟内发生重连或手动同步时合并窗口，避免重复上报。
 */
export class RenderPressureHistory {
    constructor() {
        /** @type {Array<{
         *  startedAt: string, endedAt: string, capacity: number, active: number, queued: number,
         *  maxActive: number, maxQueued: number, completed: number, failed: number, timedOut: number
         * }>} */
        this.samples = []
    }

    /**
     * @param {{
     *  windowStartedAt: string, capacity: number, active: number, queued: number,
     *  maxActive: number, maxQueued: number, completed: number, failed: number, timedOut: number
     * }} snapshot
     * @param {string} [endedAt]
     */
    record(snapshot, endedAt = new Date().toISOString()) {
        const endedMs = Date.parse(endedAt)
        if (!Number.isFinite(endedMs)) return this.snapshot()

        const minute = Math.floor(endedMs / MINUTE_MS)
        const previous = this.samples.find(sample => Math.floor(Date.parse(sample.endedAt) / MINUTE_MS) === minute)
        if (previous) {
            previous.startedAt = Date.parse(snapshot.windowStartedAt) < Date.parse(previous.startedAt)
                ? snapshot.windowStartedAt
                : previous.startedAt
            previous.endedAt = endedAt
            previous.capacity = snapshot.capacity
            previous.active = snapshot.active
            previous.queued = snapshot.queued
            previous.maxActive = Math.max(previous.maxActive, snapshot.maxActive, snapshot.active)
            previous.maxQueued = Math.max(previous.maxQueued, snapshot.maxQueued, snapshot.queued)
            previous.completed += snapshot.completed
            previous.failed += snapshot.failed
            previous.timedOut += snapshot.timedOut
        } else {
            this.samples.push({
                startedAt: snapshot.windowStartedAt,
                endedAt,
                capacity: snapshot.capacity,
                active: snapshot.active,
                queued: snapshot.queued,
                maxActive: Math.max(snapshot.maxActive, snapshot.active),
                maxQueued: Math.max(snapshot.maxQueued, snapshot.queued),
                completed: snapshot.completed,
                failed: snapshot.failed,
                timedOut: snapshot.timedOut,
            })
        }

        const cutoff = endedMs - HISTORY_WINDOW_MS
        this.samples = this.samples
            .filter(sample => Date.parse(sample.endedAt) > cutoff && Date.parse(sample.endedAt) <= endedMs)
            .sort((a, b) => Date.parse(a.endedAt) - Date.parse(b.endedAt))
            .slice(-30)
        return this.snapshot()
    }

    snapshot() {
        return this.samples.map(sample => ({ ...sample }))
    }
}

export default RenderPressureHistory
