const cleanupManagerSymbol = Symbol.for('phi-plugin.processCleanupManager')
const globalStore = /** @type {Record<symbol, any>} */ (globalThis)

const signalExitCode = /** @type {Partial<Record<NodeJS.Signals, number>>} */ ({
    SIGHUP: 129,
    SIGINT: 130,
    SIGTERM: 143,
    SIGBREAK: 149,
})

export class ProcessCleanupManager {
    /**
     * @param {NodeJS.Process} [target]
     * @param {number} [timeout]
     */
    constructor(target = process, timeout = 10000) {
        this.target = target
        this.timeout = timeout
        this.cleanup = /** @type {() => Promise<unknown>} */ (async () => {})
        this.emergencyCleanup = () => {}
        this.installed = false
        this.handlingSignal = false
        /** @type {Partial<Record<NodeJS.Signals, () => void>>} */
        this.signalHandlers = {}
        this.exitHandler = () => {
            try {
                this.emergencyCleanup()
            } catch { }
        }
    }

    /**
     * @param {() => Promise<unknown>} cleanup
     * @param {() => void} emergencyCleanup
     */
    register(cleanup, emergencyCleanup) {
        const oldCleanup = this.cleanup
        this.cleanup = cleanup
        this.emergencyCleanup = emergencyCleanup
        if (this.installed && oldCleanup !== cleanup) {
            void Promise.resolve().then(() => oldCleanup()).catch(() => {})
        }
        if (!this.installed) this.install()
    }

    install() {
        this.installed = true
        this.target.once('exit', this.exitHandler)
        /** @type {NodeJS.Signals[]} */
        const signals = ['SIGHUP', 'SIGINT', 'SIGTERM']
        if (process.platform === 'win32') signals.push('SIGBREAK')
        for (const signal of signals) {
            const handler = () => { void this.handleSignal(signal, handler) }
            this.signalHandlers[signal] = handler
            this.target.on(signal, handler)
        }
    }

    /**
     * @param {NodeJS.Signals} signal
     * @param {() => void} handler
     */
    async handleSignal(signal, handler) {
        if (this.handlingSignal) return
        this.handlingSignal = true
        const shouldRelaySignal = this.target.listenerCount(signal) === 1
        let timeoutId
        try {
            await Promise.race([
                Promise.resolve().then(() => this.cleanup()),
                new Promise(resolve => { timeoutId = setTimeout(resolve, this.timeout) }),
            ])
        } catch {
            // The synchronous fallback below still runs when graceful cleanup fails.
        } finally {
            if (timeoutId) clearTimeout(timeoutId)
            try {
                this.emergencyCleanup()
            } catch { }
        }

        if (!shouldRelaySignal) return
        this.target.removeListener(signal, handler)
        try {
            this.target.kill(this.target.pid, signal)
        } catch {
            this.target.exit(signalExitCode[signal] || 1)
        }
    }

    dispose() {
        this.target.removeListener('exit', this.exitHandler)
        for (const [signal, handler] of Object.entries(this.signalHandlers)) {
            if (handler) this.target.removeListener(/** @type {NodeJS.Signals} */ (signal), handler)
        }
        this.signalHandlers = {}
        this.installed = false
    }
}

const processCleanupManager = /** @type {ProcessCleanupManager} */ (
    globalStore[cleanupManagerSymbol] ||= new ProcessCleanupManager()
)

/**
 * @param {() => Promise<unknown>} cleanup
 * @param {() => void} emergencyCleanup
 */
export function registerProcessCleanup(cleanup, emergencyCleanup) {
    processCleanupManager.register(cleanup, emergencyCleanup)
}

export default processCleanupManager
