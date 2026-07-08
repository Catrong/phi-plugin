import platform from './platform/index.js'

const logger = /** @type {import('./platform/types.js').PlatformLogger} */ (new Proxy({}, {
    get(_target, prop) {
        if (typeof prop === 'symbol') return undefined
        const value = platform.logger?.[prop]
        return typeof value === 'function' ? value.bind(platform.logger) : value
    },
}))

export default logger
