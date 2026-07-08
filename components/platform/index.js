import yunzaiAdapter from './yunzai.js'

/** @import {PlatformAdapter, PlatformRedis, PlatformSegment} from './types.js' */

/** @type {PlatformAdapter} */
let currentAdapter = yunzaiAdapter

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function bindValue(value) {
    if (typeof value !== 'function') return value
    const source = Function.prototype.toString.call(value)
    if (source.startsWith('class ')) return value
    return /** @type {T} */ (value.bind(currentAdapter))
}

/**
 * @param {Partial<PlatformAdapter>} [adapter]
 */
export function setPlatformAdapter(adapter = {}) {
    currentAdapter = {
        ...currentAdapter,
        ...adapter,
        segment: {
            ...currentAdapter.segment,
            ...(adapter.segment || {}),
        },
        logger: {
            ...currentAdapter.logger,
            ...(adapter.logger || {}),
        },
    }
}

/**
 * @returns {PlatformAdapter}
 */
export function getPlatformAdapter() {
    return currentAdapter
}

export const platform = /** @type {PlatformAdapter} */ (new Proxy({}, {
    get(_target, prop) {
        if (typeof prop === 'symbol') return undefined
        return bindValue(currentAdapter[prop])
    },
    set(_target, prop, value) {
        if (typeof prop === 'symbol') return false
        currentAdapter[prop] = value
        return true
    },
}))

export const redis = /** @type {PlatformRedis} */ (new Proxy({}, {
    get(_target, prop) {
        if (typeof prop === 'symbol') return undefined
        const value = /** @type {Record<string, any>} */ (currentAdapter.redis)?.[prop]
        return typeof value === 'function' ? value.bind(currentAdapter.redis) : value
    },
    set(_target, prop, value) {
        if (typeof prop === 'symbol') return false
        const redisTarget = /** @type {Record<string, any>} */ (currentAdapter.redis)
        redisTarget[prop] = value
        return true
    },
}))

export const segment = /** @type {PlatformSegment} */ (new Proxy({}, {
    get(_target, prop) {
        if (typeof prop === 'symbol') return undefined
        const value = currentAdapter.segment?.[prop]
        return typeof value === 'function' ? value.bind(currentAdapter.segment) : value
    },
}))

export default platform
