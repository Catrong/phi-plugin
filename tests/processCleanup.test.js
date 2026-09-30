import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { ProcessCleanupManager } from '../components/ProcessCleanup.js'

class FakeProcess extends EventEmitter {
    constructor() {
        super()
        this.pid = 123
        /** @type {{pid: number, signal: NodeJS.Signals}[]} */
        this.killed = []
        /** @type {(number | undefined)[]} */
        this.exitCodes = []
    }

    /**
     * @param {number} pid
     * @param {NodeJS.Signals} signal
     */
    kill(pid, signal) {
        this.killed.push({ pid, signal })
        return true
    }

    /** @param {number | undefined} code */
    exit(code) {
        this.exitCodes.push(code)
    }
}

test('gracefully cleans up and then relays an exit signal', async () => {
    const target = /** @type {NodeJS.Process} */ (/** @type {unknown} */ (new FakeProcess()))
    const manager = new ProcessCleanupManager(target, 100)
    let gracefulCalls = 0
    let emergencyCalls = 0
    manager.register(async () => { gracefulCalls++ }, () => { emergencyCalls++ })

    target.emit('SIGTERM')
    await new Promise(resolve => setImmediate(resolve))

    assert.equal(gracefulCalls, 1)
    assert.equal(emergencyCalls, 1)
    const fakeTarget = /** @type {FakeProcess} */ (/** @type {unknown} */ (target))
    assert.deepEqual(fakeTarget.killed, [{ pid: 123, signal: 'SIGTERM' }])
    manager.dispose()
})

test('runs synchronous emergency cleanup during process exit', () => {
    const target = /** @type {NodeJS.Process} */ (/** @type {unknown} */ (new FakeProcess()))
    const manager = new ProcessCleanupManager(target)
    let emergencyCalls = 0
    manager.register(async () => {}, () => { emergencyCalls++ })

    target.emit('exit', 0)

    assert.equal(emergencyCalls, 1)
    manager.dispose()
})
