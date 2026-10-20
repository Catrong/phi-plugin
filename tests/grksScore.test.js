import assert from 'node:assert/strict'
import test from 'node:test'
import {
    formatScoreValue,
    isCorrect,
    parseGuess,
    scoreForHintCount,
} from '../model/game/grks/score.js'

test('parses player guesses and rejects malformed input', () => {
    assert.equal(parseGuess('15.2'), 15.2)
    assert.equal(parseGuess(' 15.25 '), 15.25)
    assert.equal(parseGuess('15'), 15)
    assert.equal(parseGuess('15.2345'), 15.2345)
    assert.equal(parseGuess('15,2'), 15.2)
    assert.equal(parseGuess(15.5), 15.5)
    assert.equal(parseGuess(''), null)
    assert.equal(parseGuess('15.2.3'), null)
    assert.equal(parseGuess('abc'), null)
    assert.equal(parseGuess('-15.2'), null)
    assert.equal(parseGuess('100.5'), null)
})

test('judges correctness within the configured tolerance', () => {
    assert.equal(isCorrect(15.6, 15.5, 0.1), true)
    assert.equal(isCorrect(15.4000001, 15.5, 0.1), true)
    assert.equal(isCorrect(15.61, 15.5, 0.1), false)
    assert.equal(isCorrect(15.5, 15.5, 0), true)
    assert.equal(isCorrect(Number.NaN, 15.5), false)
    assert.equal(isCorrect(15.5, 15.5, -1), true)
})

test('scores 10/n with n at least 1', () => {
    assert.equal(scoreForHintCount(0), 10)
    assert.equal(scoreForHintCount(1), 10)
    assert.equal(scoreForHintCount(2), 5)
    assert.equal(scoreForHintCount(3), 3.33)
    assert.equal(scoreForHintCount(7), 1.43)
    assert.equal(scoreForHintCount(2, 20), 10)
    assert.equal(scoreForHintCount(-3), 10)
    assert.equal(formatScoreValue(3.333), '3.33')
    assert.equal(formatScoreValue(Number.NaN), '0.00')
})
