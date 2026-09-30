/** @import {KoishiDatabaseRedisOptions, PlatformRedis, RedisExpireOptions, RedisScanOptions, RedisZSetItem} from './types.js' */

const DEFAULT_KEY_VALUE_TABLE = 'phi_redis'
const DEFAULT_ZSET_TABLE = 'phi_redis_zset'

/**
 * @returns {number}
 */
function now() {
    return Date.now()
}

/**
 * @param {string} pattern
 * @param {string} key
 * @returns {boolean}
 */
function matchPattern(pattern, key) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    return new RegExp(`^${escaped}$`).test(key)
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function toRedisValue(value) {
    if (value === undefined || value === null) return ''
    if (Buffer.isBuffer(value)) return value.toString()
    return String(value)
}

/**
 * @param {RedisExpireOptions} [options]
 * @returns {number}
 */
function getExpiresAt(options = {}) {
    if (options.PX) return now() + Number(options.PX)
    if (options.EX) return now() + Number(options.EX) * 1000
    return 0
}

/**
 * @param {unknown} expiresAt
 * @returns {boolean}
 */
function isExpired(expiresAt) {
    const time = Number(expiresAt || 0)
    return time > 0 && time <= now()
}

/**
 * @param {number | string | undefined} cursor
 * @returns {number}
 */
function normalizeCursor(cursor) {
    const value = Number(cursor || 0)
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/**
 * @param {Array<string | string[]>} keys
 * @returns {string[]}
 */
function normalizeKeys(keys) {
    /** @type {string[]} */
    const result = []
    for (const key of keys) {
        if (Array.isArray(key)) {
            result.push(...key.map(String))
        } else {
            result.push(String(key))
        }
    }
    return [...new Set(result)]
}

/**
 * @param {number} index
 * @param {number} size
 * @returns {number}
 */
function normalizeRangeIndex(index, size) {
    if (index < 0) return Math.max(size + index, 0)
    return Math.min(index, size)
}

/** @implements {PlatformRedis} */
export class KoishiDatabaseRedis {
    /**
     * @param {any} ctx
     * @param {KoishiDatabaseRedisOptions} [options]
     */
    constructor(ctx, options = {}) {
        if (!ctx?.database) throw new Error('Koishi database service is not available')

        this.database = ctx.database
        this.model = ctx.model
        this.keyValueTable = options.keyValueTable || DEFAULT_KEY_VALUE_TABLE
        this.zsetTable = options.zsetTable || DEFAULT_ZSET_TABLE

        if (options.autoExtendModel !== false) this.extendModel()
    }

    /**
     * @returns {void}
     */
    extendModel() {
        if (typeof this.model?.extend !== 'function') {
            throw new Error('Koishi model service is not available')
        }

        this.model.extend(this.keyValueTable, {
            key: 'string(768)',
            value: 'text',
            expiresAt: 'double',
        }, {
            primary: 'key',
        })

        this.model.extend(this.zsetTable, {
            key: 'string(768)',
            value: 'string(768)',
            score: 'double',
        }, {
            primary: ['key', 'value'],
        })
    }

    /**
     * @param {string} table
     * @param {Record<string, unknown>} [query]
     * @param {string[]} [fields]
     * @returns {Promise<any[]>}
     */
    async getRows(table, query = {}, fields) {
        return fields
            ? await this.database.get(table, query, fields)
            : await this.database.get(table, query)
    }

    /**
     * @param {string} table
     * @param {Record<string, unknown>} query
     * @returns {Promise<unknown>}
     */
    async removeRows(table, query) {
        return this.database.remove(table, query)
    }

    /**
     * @param {string} table
     * @param {Record<string, unknown>[]} rows
     * @param {string | string[]} [keys]
     * @returns {Promise<unknown>}
     */
    async upsertRows(table, rows, keys) {
        if (!rows.length) return undefined
        return keys === undefined
            ? await this.database.upsert(table, rows)
            : await this.database.upsert(table, rows, keys)
    }

    /**
     * @param {string} key
     * @returns {Promise<boolean>}
     */
    async cleanupKey(key) {
        const [row] = await this.getRows(this.keyValueTable, { key })
        if (!row || !isExpired(row.expiresAt)) return false
        await this.removeRows(this.keyValueTable, { key })
        return true
    }

    /**
     * @param {any[]} rows
     * @returns {Promise<any[]>}
     */
    async cleanupRows(rows) {
        const expired = rows.filter(row => isExpired(row.expiresAt)).map(row => String(row.key))
        if (expired.length) await this.removeRows(this.keyValueTable, { key: expired })
        return rows.filter(row => !isExpired(row.expiresAt))
    }

    /**
     * @param {string} key
     * @returns {Promise<string | null>}
     */
    async get(key) {
        const [row] = await this.getRows(this.keyValueTable, { key })
        if (!row) return null
        if (isExpired(row.expiresAt)) {
            await this.removeRows(this.keyValueTable, { key })
            return null
        }
        return row.value ?? null
    }

    /**
     * @param {string} key
     * @param {unknown} value
     * @param {RedisExpireOptions} [options]
     * @returns {Promise<'OK'>}
     */
    async set(key, value, options = {}) {
        await this.upsertRows(this.keyValueTable, [{
            key,
            value: toRedisValue(value),
            expiresAt: getExpiresAt(options),
        }], 'key')
        return 'OK'
    }

    /**
     * @param {...(string | string[])} keys
     * @returns {Promise<number>}
     */
    async del(...keys) {
        let count = 0
        for (const key of normalizeKeys(keys)) {
            const [[row], zsetRows] = await Promise.all([
                this.getRows(this.keyValueTable, { key }, ['key', 'expiresAt']),
                this.getRows(this.zsetTable, { key }, ['key']),
            ])
            const hasRow = row && !isExpired(row.expiresAt)
            if (row && isExpired(row.expiresAt)) await this.removeRows(this.keyValueTable, { key })
            if (hasRow || zsetRows.length) count++
            await Promise.all([
                this.removeRows(this.keyValueTable, { key }),
                this.removeRows(this.zsetTable, { key }),
            ])
        }
        return count
    }

    /**
     * @param {string} [pattern]
     * @returns {Promise<string[]>}
     */
    async keys(pattern = '*') {
        const [keyRows, zsetRows] = await Promise.all([
            this.getRows(this.keyValueTable, {}),
            this.getRows(this.zsetTable, {}, ['key']),
        ])
        const activeRows = await this.cleanupRows(keyRows)
        const result = new Set()

        for (const row of activeRows) {
            const key = String(row.key)
            if (matchPattern(pattern, key)) result.add(key)
        }
        for (const row of zsetRows) {
            const key = String(row.key)
            if (matchPattern(pattern, key)) result.add(key)
        }
        return [...result].map(String)
    }

    /**
     * @param {number | string} [cursor]
     * @param {RedisScanOptions} [options]
     * @returns {Promise<{cursor: number, keys: string[]}>}
     */
    async scan(cursor = 0, options = {}) {
        const keys = await this.keys(options.MATCH || '*')
        const count = Number(options.COUNT || 100)
        const start = normalizeCursor(cursor)
        const batch = keys.slice(start, start + count)
        const next = start + count >= keys.length ? 0 : start + count
        return { cursor: next, keys: batch }
    }

    /**
     * @param {string} key
     * @returns {Promise<number>}
     */
    async ttl(key) {
        const [row] = await this.getRows(this.keyValueTable, { key })
        if (!row) return -2
        if (isExpired(row.expiresAt)) {
            await this.removeRows(this.keyValueTable, { key })
            return -2
        }
        const expiresAt = Number(row.expiresAt || 0)
        if (!expiresAt) return -1
        return Math.max(0, Math.ceil((expiresAt - now()) / 1000))
    }

    /**
     * @param {string} key
     * @returns {Promise<Array<{value: string, score: number}>>}
     */
    async zRows(key) {
        const rows = await this.getRows(this.zsetTable, { key }, ['value', 'score'])
        return rows
            .map(row => ({ value: String(row.value), score: Number(row.score) }))
            .sort((a, b) => a.score - b.score || a.value.localeCompare(b.value))
    }

    /**
     * @param {string} key
     * @param {RedisZSetItem} item
     * @returns {Promise<number>}
     */
    async zAdd(key, item) {
        const [old] = await this.getRows(this.zsetTable, { key, value: item.value }, ['key'])
        await this.upsertRows(this.zsetTable, [{
            key,
            value: item.value,
            score: Number(item.score),
        }], ['key', 'value'])
        return old ? 0 : 1
    }

    /**
     * @param {string} key
     * @param {string} value
     * @returns {Promise<number>}
     */
    async zRem(key, value) {
        const [old] = await this.getRows(this.zsetTable, { key, value }, ['key'])
        if (!old) return 0
        await this.removeRows(this.zsetTable, { key, value })
        return 1
    }

    /**
     * @param {string} key
     * @param {string} value
     * @returns {Promise<number | null>}
     */
    async zRank(key, value) {
        const list = await this.zRows(key)
        const index = list.findIndex(item => item.value === value)
        return index >= 0 ? index : null
    }

    /**
     * @param {string} key
     * @param {string} value
     * @returns {Promise<number | null>}
     */
    async zScore(key, value) {
        const [row] = await this.getRows(this.zsetTable, { key, value }, ['score'])
        return row ? Number(row.score) : null
    }

    /**
     * @param {string} key
     * @param {number} min
     * @param {number} max
     * @returns {Promise<string[]>}
     */
    async zRange(key, min, max) {
        const list = await this.zRows(key)
        const start = normalizeRangeIndex(min, list.length)
        const stop = normalizeRangeIndex(max, list.length)
        if (stop < start) return []
        return list.slice(start, stop + 1).map(item => item.value)
    }

    /**
     * @param {string} key
     * @param {number} min
     * @param {number} max
     * @returns {Promise<number>}
     */
    async zCount(key, min, max) {
        const list = await this.zRows(key)
        return list.filter(item => item.score >= min && item.score <= max).length
    }

    /**
     * @param {string} key
     * @returns {Promise<number>}
     */
    async zCard(key) {
        return (await this.zRows(key)).length
    }
}

/**
 * @param {any} ctx
 * @param {KoishiDatabaseRedisOptions} [options]
 * @returns {KoishiDatabaseRedis}
 */
export function createKoishiDatabaseRedis(ctx, options = {}) {
    return new KoishiDatabaseRedis(ctx, options)
}

export default KoishiDatabaseRedis
