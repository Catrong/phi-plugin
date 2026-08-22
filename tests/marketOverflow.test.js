import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { buildMarketQuickMarkdown } from '../model/game/markdown.js'

test('market Markdown collapses control whitespace in displayed theme names', () => {
    const markdown = buildMarketQuickMarkdown([{
        slug: 'ocean-salt',
        name: 'Ocean\r\nSalt\tTheme\u0000Name',
        botDownloadAllowed: true,
    }])
    assert.match(markdown, /Ocean Salt Theme Name/)
    assert.doesNotMatch(markdown, /Ocean\r|Salt\t|\u0000/)
})

test('market styles constrain long content to the fixed render width', () => {
    const css = fs.readFileSync(new URL('../resources/html/market/market.css', import.meta.url), 'utf8')
    assert.match(css, /body\s*\{[^}]*overflow-x:\s*hidden/)
    assert.match(css, /\.theme-card\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/)
    assert.match(css, /\.detail-description\s*\{[^}]*overflow-wrap:\s*anywhere/)
    assert.match(css, /\.release-notes p\s*\{[^}]*overflow-wrap:\s*anywhere/)
    assert.match(css, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/)
})
