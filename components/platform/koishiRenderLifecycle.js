/** 渲染器配置在 Koishi 中原位更新；accept 回调必须同步返回，Promise 会被宿主判成要求重载。 */
export const koishiRenderConfigKeys = [
    'renderer', 'renderNum', 'timeout', 'waitingTimeout', 'renderQueueLimit', 'randerQuality', 'renderScale',
]

/** @param {Record<string, any>} values @param {string[]} keys */
export function pickSettings(values, keys) {
    return Object.fromEntries(keys.filter(key => Object.hasOwn(values, key)).map(key => [key, values[key]]))
}

/**
 * Cordis 的多字段检测会在首个变化处短路；逐项接受，批量变更仍只提交一次。
 * @param {any} ctx @param {string[]} keys @param {(values: Record<string, any>) => void} update
 */
export function acceptKoishiSettings(ctx, keys, update) {
    /** @type {Record<string, any> | undefined} */
    let accepted
    const callback = (/** @type {Record<string, any>} */ values) => {
        if (accepted === values) return
        update(pickSettings(values, keys))
        accepted = values
    }
    for (const key of keys) ctx.accept?.([key], callback)
}

/** 单例业务模块不能同时绑定两个 Context；旧实例释放完毕后才允许接管。 */
export function createKoishiSessionRegistry() {
    /** @type {{owner: object, closing: Promise<void> | null} | null} */
    let current = null
    return {
        /** @param {object} owner @param {() => boolean} [cancelled] */
        async claim(owner, cancelled = () => false) {
            while (current && current.owner !== owner) {
                if (!current.closing) throw new Error('[phi-plugin] 同一进程不支持同时启用多个 Koishi 实例，请先卸载现有实例。')
                await current.closing
                if (cancelled()) return false
            }
            if (cancelled()) return false
            current = { owner, closing: null }
            return true
        },
        /** @param {object} owner @param {Promise<void>} closing */
        markClosing(owner, closing) {
            if (current?.owner === owner) current.closing = closing
        },
        /** @param {object} owner */
        release(owner) {
            if (current?.owner === owner) current = null
        },
    }
}

const registrySymbol = Symbol.for('phi-plugin.koishiSessionRegistry')
const globalStore = /** @type {Record<symbol, any>} */ (globalThis)
const sessionRegistry = globalStore[registrySymbol] ||= createKoishiSessionRegistry()

/**
 * 先预检后端再提交宿主配置；停止时保留旧平台和设置直到全部在途工作结束。
 * @param {object} options
 * @param {any} options.ctx
 * @param {(owner: object, disposed: () => boolean) => Promise<void>} options.initialize
 * @param {(values: Record<string, any>) => void} options.validateConfig
 * @param {(values: Record<string, any>) => void} options.commitConfig
 * @param {() => void | Promise<void>} options.stop
 * @param {() => Promise<void>} options.dispose
 * @param {(error: unknown) => void} options.onError
 * @param {ReturnType<typeof createKoishiSessionRegistry>} [options.registry]
 */
export function createKoishiRenderLifecycle(options) {
    const registry = options.registry || sessionRegistry
    const owner = {}
    let claimed = false
    let disposed = false
    /** @type {Promise<void> | null} */
    let starting = null
    /** @type {Promise<void> | null} */
    let closing = null

    const lifecycle = {
        owner,
        get disposed() { return disposed },
        start() {
            starting ||= (async () => {
                claimed = await registry.claim(owner, () => disposed)
                if (!claimed || disposed) return
                await options.initialize(owner, () => disposed)
            })()
            return starting
        },
        /** @param {Record<string, any>} values */
        update(values) {
            if (disposed) return
            // 每次只拷贝本次接受的字段，避免 API 凭据等其他 acceptor 的更新被旧快照覆盖。
            const requested = { ...values }
            // Cordis 在检查更新后才替换 scope.config；同步抛错可以同时阻止运行态和宿主配置更新。
            options.validateConfig(requested)
            options.commitConfig(requested)
        },
        close() {
            if (closing) return closing
            disposed = true
            // 先同步停止接单，再等异步初始化、预检及在途工作，避免重载接管过早。
            /** @type {void | Promise<void>} */
            let stopped
            try { stopped = options.stop() } catch (error) { options.onError(error) }
            closing = Promise.resolve().then(async () => {
                try {
                    await starting?.catch(() => {})
                    await Promise.resolve(stopped).catch(options.onError)
                    if (claimed) {
                        try { await options.dispose() } catch (error) { options.onError(error) }
                    }
                } finally {
                    registry.release(owner)
                }
            })
            registry.markClosing(owner, closing)
            return closing
        },
    }

    options.ctx.on?.('dispose', () => lifecycle.close())
    return lifecycle
}
