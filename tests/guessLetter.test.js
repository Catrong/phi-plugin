import assert from 'node:assert/strict'
import test from 'node:test'

import {
    LETTER_HIDDEN_CHAR,
    allGuessed,
    encryptSongName,
    getRevealCandidates,
    hasHiddenCharacters,
    revealCharacter
} from '../apps/guessGame/letterGameUtils.js'

test('literal star remains a valid tip candidate without being confused with the mask', () => {
    const title = '7 colors*'
    const blur = `7 colors${LETTER_HIDDEN_CHAR}`
    const game = { ansList: [title], blurlist: [blur] }

    assert.deepEqual(getRevealCandidates(game), ['*'])

    const revealed = revealCharacter(title, blur, '*')
    assert.equal(revealed, title)
    assert.equal(hasHiddenCharacters(revealed), false)
})

test('mask and reveal operations use Unicode code points consistently', () => {
    const title = 'A😀*'
    const encrypted = encryptSongName(title)

    assert.equal(Array.from(encrypted).length, Array.from(title).length)
    assert.deepEqual(getRevealCandidates({ ansList: [title], blurlist: [encrypted] }), ['A', '😀', '*'])

    const emojiRevealed = revealCharacter(title, encrypted, '😀')
    assert.deepEqual(Array.from(emojiRevealed), [LETTER_HIDDEN_CHAR, '😀', LETTER_HIDDEN_CHAR])
})

test('empty and completed games have no reveal candidates', () => {
    assert.deepEqual(getRevealCandidates({ ansList: ['done'], blurlist: [null] }), [])
    assert.deepEqual(getRevealCandidates({ ansList: [], blurlist: [] }), [])
})

test('repeated tips always finish titles containing literal stars', () => {
    const titles = [
        '7 colors*',
        'Altair (feat. *spiLa*)',
        'cocoro*cosmetic',
        'strawberry*passion'
    ]
    const game = /** @type {{letterNum: number, ansList: string[], blurlist: (string|null)[]}} */ ({
        letterNum: titles.length,
        ansList: titles,
        blurlist: titles.map(encryptSongName)
    })
    const maximumSteps = titles.reduce((total, title) => total + Array.from(title).length, 0)
    let steps = 0

    while (!allGuessed(game)) {
        const symbol = getRevealCandidates(game)[0]
        assert.notEqual(symbol, undefined)

        game.blurlist = game.blurlist.map((blur, index) => {
            if (!blur) return null
            const revealed = revealCharacter(titles[index], blur, symbol)
            return hasHiddenCharacters(revealed) ? revealed : null
        })
        steps++
        assert.ok(steps <= maximumSteps)
    }

    assert.deepEqual(getRevealCandidates(game), [])
})

test('completion requires every configured slot to be an explicit null', () => {
    assert.equal(allGuessed(/** @type {any} */ ({ letterNum: 2, blurlist: [null, null] })), true)

    const sparse = new Array(2)
    sparse[0] = null
    assert.equal(allGuessed(/** @type {any} */ ({ letterNum: 2, blurlist: sparse })), false)
    assert.equal(allGuessed(/** @type {any} */ ({ letterNum: 2, blurlist: [null] })), false)
})
