import { pinyin } from 'pinyin-pro'

// Internally distinguish an unrevealed position from a literal "*" in a song title.
export const LETTER_HIDDEN_CHAR = '\uE000'

/** @param {string} name */
export function encryptSongName(name) {
    return Array.from(name, character => {
        return character === ' ' || character === ' ' ? ' ' : LETTER_HIDDEN_CHAR
    }).join('')
}

/** @param {string} blur */
export function hasHiddenCharacters(blur) {
    return blur.includes(LETTER_HIDDEN_CHAR)
}

/**
 * Collect every still-hidden title character. Duplicates are retained so each
 * hidden position has the same probability as before.
 * @param {{ansList: string[], blurlist: (string|null)[]}} currentGame
 * @returns {string[]}
 */
export function getRevealCandidates(currentGame) {
    /** @type {string[]} */
    const candidates = []
    currentGame.blurlist.forEach((blur, songIndex) => {
        if (!blur) return

        const songCharacters = Array.from(currentGame.ansList[songIndex] ?? '')
        const blurCharacters = Array.from(blur)
        blurCharacters.forEach((character, characterIndex) => {
            if (character === LETTER_HIDDEN_CHAR && songCharacters[characterIndex] !== undefined) {
                candidates.push(songCharacters[characterIndex])
            }
        })
    })
    return candidates
}

/**
 * @param {string} songName
 * @param {string} blurName
 * @param {string} symbol
 */
export function revealCharacter(songName, blurName, symbol) {
    const target = symbol.toLowerCase()
    const blurCharacters = Array.from(blurName)

    return Array.from(songName).map((character, index) => {
        const blurredCharacter = blurCharacters[index] ?? LETTER_HIDDEN_CHAR
        if (blurredCharacter !== LETTER_HIDDEN_CHAR) return blurredCharacter

        if (/^[\u4E00-\u9FFF]$/.test(character)) {
            const initial = pinyin(character, { pattern: 'first', toneType: 'none', type: 'string' })
            if (initial.toLowerCase() === target) return character
        }

        return character.toLowerCase() === target ? character : blurredCharacter
    }).join('')
}

/**
 * @param {{letterNum: number, blurlist: (string|null)[]}} currentGame
 */
export function allGuessed(currentGame) {
    if (currentGame.blurlist.length !== currentGame.letterNum) return false
    for (let index = 0; index < currentGame.letterNum; index++) {
        if (!Object.hasOwn(currentGame.blurlist, index) || currentGame.blurlist[index] !== null) {
            return false
        }
    }
    return true
}
