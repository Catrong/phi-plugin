import assert from 'node:assert/strict'
import test from 'node:test'
import fCompute from '../model/game/fCompute.js'

const line = (drag, flick, combo, withFlick) => fCompute.getOverLevelLine(drag, flick, combo, withFlick)

test('charts without drag and flick use the base 98.5 line', () => {
    assert.equal(line(0, 0, 500, false), 98.5)
    assert.equal(line(0, 0, 500, true), 98.5)
})

test('drag ratio raises the line by 1.5 points per whole-chart drag', () => {
    // 100 drags out of 500 notes: 98.5 + 1.5 * 100/500
    assert.ok(Math.abs(line(100, 50, 500, false) - 98.8) < 1e-9)
    // all-drag chart reaches 100
    assert.equal(line(500, 0, 500, false), 100)
})

test('flick only counts in when withFlick is set', () => {
    // 300 flicks out of 600 notes are ignored by default
    assert.equal(line(0, 300, 600, false), 98.5)
    assert.ok(Math.abs(line(0, 300, 600, true) - 99.25) < 1e-9)
    // drag + flick together
    assert.ok(Math.abs(line(100, 50, 500, true) - 98.95) < 1e-9)
})

test('charts without note data fall back to 98.5', () => {
    assert.equal(line(undefined, undefined, undefined, false), 98.5)
    assert.equal(line(undefined, undefined, undefined, true), 98.5)
    assert.equal(line(10, 10, 0, true), 98.5)
    assert.equal(line(10, 10, -5, true), 98.5)
})
