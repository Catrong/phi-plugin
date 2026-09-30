/** @import {PlatformRedis, RedisExpireOptions, RedisScanOptions, RedisZSetItem} from './types.js' */

function now() {
    return Date.now()
}

/**
 * @param {string} pattern
 * @param {string} key
 */
function matchPattern(pattern, key) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    return new RegExp(`^${escaped}$`).test(key)
}

/** @implements {PlatformRedis} */
class MemoryRedis {
    constructor() {
        /** @type {Map<string, { value: any, expiresAt?: number }>} */
        this.store = new Map()
        /** @type {Map<string, Map<string, number>>} */
        this.zsets = new Map()
    }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    cleanup(key) {
        const entry = this.store.get(key)
        if (entry?.expiresAt && entry.expiresAt <= now()) {
            this.store.delete(key)
            return true
        }
        return false
    }

    /**
     * @param {RedisExpireOptions} [options]
     * @returns {number | undefined}
     */
    getExpiresAt(options = {}) {
        if (options.PX) return now() + Number(options.PX)
        if (options.EX) return now() + Number(options.EX) * 1000
        return undefined
    }

    /**
     * @param {string} key
     * @returns {Promise<any | null>}
     */
    async get(key) {
        if (this.cleanup(key)) return null
        return this.store.get(key)?.value ?? null
    }

    /**
     * @param {string} key
     * @param {any} value
     * @param {RedisExpireOptions} [options]
     * @returns {Promise<'OK'>}
     */
    async set(key, value, options = {}) {
        this.store.set(key, { value, expiresAt: this.getExpiresAt(options) })
        return 'OK'
    }

    /**
     * @param {...(string | string[])} keys
     * @returns {Promise<number>}
     */
    async del(...keys) {
        let count = 0
        for (const key of keys.flat()) {
            if (this.store.delete(key)) count++
            if (this.zsets.delete(key)) count++
        }
        return count
    }

    /**
     * @param {string} [pattern]
     * @returns {Promise<string[]>}
     */
    async keys(pattern = '*') {
        const result = []
        for (const key of this.store.keys()) {
            if (!this.cleanup(key) && matchPattern(pattern, key)) result.push(key)
        }
        for (const key of this.zsets.keys()) {
            if (matchPattern(pattern, key)) result.push(key)
        }
        return result
    }

    /**
     * @param {number | string} [cursor]
     * @param {RedisScanOptions} [options]
     * @returns {Promise<{cursor: number, keys: string[]}>}
     */
    async scan(cursor = 0, options = {}) {
        const keys = await this.keys(options.MATCH || '*')
        const count = Number(options.COUNT || 100)
        const start = Number(cursor || 0)
        const batch = keys.slice(start, start + count)
        const next = start + count >= keys.length ? 0 : start + count
        return { cursor: next, keys: batch }
    }

    /**
     * @param {string} key
     * @returns {Promise<number>}
     */
    async ttl(key) {
        if (this.cleanup(key)) return -2
        const entry = this.store.get(key)
        if (!entry) return -2
        if (!entry.expiresAt) return -1
        return Math.max(0, Math.ceil((entry.expiresAt - now()) / 1000))
    }

    /**
     * @param {string} key
     * @returns {Map<string, number>}
     */
    zset(key) {
        if (!this.zsets.has(key)) this.zsets.set(key, new Map())
        return /** @type {Map<string, number>} */ (this.zsets.get(key))
    }

    /**
     * @param {string} key
     * @param {RedisZSetItem} item
     * @returns {Promise<number>}
     */
    async zAdd(key, item) {
        const zset = this.zset(key)
        const exists = zset.has(item.value)
        zset.set(item.value, Number(item.score))
        return exists ? 0 : 1
    }

    /**
     * @param {string} key
     * @param {string} value
     * @returns {Promise<number>}
     */
    async zRem(key, value) {
        return this.zset(key).delete(value) ? 1 : 0
    }

    /**
     * @param {string} key
     * @returns {string[]}
     */
    sorted(key) {
        return [...this.zset(key).entries()].sort((a, b) => a[1] - b[1]).map(([value]) => value)
    }

    /**
     * @param {string} key
     * @param {string} value
     * @returns {Promise<number | null>}
     */
    async zRank(key, value) {
        const list = this.sorted(key)
        const index = list.indexOf(value)
        return index >= 0 ? index : null
    }

    /**
     * @param {string} key
     * @param {string} value
     * @returns {Promise<number | null>}
     */
    async zScore(key, value) {
        return this.zset(key).get(value) ?? null
    }

    /**
     * @param {string} key
     * @param {number} min
     * @param {number} max
     * @returns {Promise<string[]>}
     */
    async zRange(key, min, max) {
        return this.sorted(key).slice(min, max + 1)
    }

    /**
     * @param {string} key
     * @param {number} min
     * @param {number} max
     * @returns {Promise<number>}
     */
    async zCount(key, min, max) {
        return [...this.zset(key).values()].filter(score => score >= min && score <= max).length
    }

    /**
     * @param {string} key
     * @returns {Promise<number>}
     */
    async zCard(key) {
        return this.zset(key).size
    }
}

export default MemoryRedis
