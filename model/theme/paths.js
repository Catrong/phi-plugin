import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { pluginResources } from '../filesystem/path.js'

export const themesDir = path.join(pluginResources, 'themes')

const legacyThemeDirs = [
    path.join(pluginResources, 'html', 'b19', 'res', 'themes'),
    path.join(pluginResources, 'html', 'b19', 'themes'),
]
const THEME_ID_RE = /^[a-zA-Z0-9_-]+$/
const RESERVED_IDS = new Set(['default', 'snow', 'star', 'dss2', 'topText', 'foolsDay'])

/**
 * Move themes from historical resource locations and normalize each folder to
 * its declared theme id. Existing destinations are never overwritten.
 * @returns {{from:string,to:string}[]}
 */
export function migrateLegacyThemeDirectories() {
    fs.mkdirSync(themesDir, { recursive: true, mode: 0o700 })
    /** @type {{from:string,to:string}[]} */
    const moved = []
    for (const root of [...legacyThemeDirs, themesDir]) {
        if (!fs.existsSync(root)) continue
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name.startsWith('.phi-market-')) continue
            const source = path.join(root, entry.name)
            let id = ''
            try {
                const info = YAML.parse(fs.readFileSync(path.join(source, 'info.yaml'), 'utf8'))
                id = typeof info?.id === 'string' ? info.id : ''
            } catch { continue }
            if (!THEME_ID_RE.test(id) || RESERVED_IDS.has(id)) continue
            const destination = path.join(themesDir, id)
            if (path.resolve(source) === path.resolve(destination) || fs.existsSync(destination)) continue
            fs.renameSync(source, destination)
            moved.push({ from: source, to: destination })
        }
    }
    return moved
}
