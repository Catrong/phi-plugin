import fs from 'node:fs'
import path from 'node:path'
import { dataPath } from '../filesystem/path.js'

const SLUG_RE = /^[a-z][a-z0-9_-]{0,119}$/

export class ThemePolicyCache {
    /** @param {string} filePath */
    constructor(filePath) {
        this.filePath = filePath
        this.mode = 'blacklist'
        /** @type {Set<string>} */
        this.entries = new Set()
        this.load()
    }

    load() {
        try {
            const value = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
            this.apply(value, false)
        } catch { /* empty blacklist is the safe, documented default */ }
    }

    /** @param {any} value @param {boolean} [persist=true] */
    apply(value, persist = true) {
        if (!value || !['blacklist', 'whitelist'].includes(value.mode) || !Array.isArray(value.entries)) return false
        const entries = value.entries
            .filter((/** @type {unknown} */ entry) => typeof entry === 'string' && SLUG_RE.test(entry))
            .slice(0, 500)
        this.mode = value.mode
        this.entries = new Set(entries)
        if (persist) this.save()
        return true
    }

    save() {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
        const temporary = `${this.filePath}.${process.pid}.tmp`
        fs.writeFileSync(temporary, JSON.stringify({ mode: this.mode, entries: [...this.entries].sort() }), { mode: 0o600 })
        fs.renameSync(temporary, this.filePath)
    }

    /** @param {string} slug */
    isAllowed(slug) {
        const contains = this.entries.has(slug)
        return this.mode === 'blacklist' ? !contains : contains
    }

    snapshot() {
        return { mode: this.mode, entries: [...this.entries] }
    }
}

export default new ThemePolicyCache(path.join(dataPath, 'theme-policy.json'))
