
import fs from 'fs'
import lodash from 'lodash'
import cfg from '../../../lib/config/config.js'
const Plugin_Path = `${process.cwd()}/plugins/phi-plugin`
const README_path = `${Plugin_Path}/README.md`
const CHANGELOG_path = `${Plugin_Path}/CHANGELOG.md`
const yunzai_ver = `v${cfg.package.version}`

let logs = {}
let changelogs = []
let currentVersion
let versionCount = -1

const getLine = function (line) {
    line = line.replace(/(^\s*\*|\r)/g, '')
    line = line.replace(/\s*`([^`]+`)/g, '<span class="cmd">$1')
    line = line.replace(/`\s*/g, '</span>')
    line = line.replace(/\s*\*\*([^*]+\*\*)/g, '<span class="strong">$1')
    line = line.replace(/\*\*\s*/g, '</span>')
    line = line.replace(/ⁿᵉʷ/g, '<span class="new"></span>')
    return line
}

try {
    if (fs.existsSync(CHANGELOG_path)) {
        logs = fs.readFileSync(CHANGELOG_path, 'utf8') || ''
        logs = logs.replace(/\t/g, '   ').split('\n')
        let temp = {}
        let lastLine = {}
        lodash.forEach(logs, (line) => {
            if (versionCount <= -1) {
                return false
            }
            let versionRet = /^#\s*([0-9a-zA-Z\\.~\s]+?)\s*$/.exec(line.trim())
            if (versionRet && versionRet[1]) {
                let v = versionRet[1].trim()
                if (!currentVersion) {
                    currentVersion = v
                } else {
                    changelogs.push(temp)
                    if (/0\s*$/.test(v) && versionCount > 0) {
                        // versionCount = 0
                        versionCount--
                    } else {
                        versionCount--
                    }
                }
                temp = {
                    version: v,
                    logs: []
                }
            } else {
                if (!line.trim()) {
                    return
                }
                if (/^\*/.test(line)) {
                    lastLine = {
                        title: getLine(line),
                        logs: []
                    }
                    if (!temp.logs) {
                        temp = {
                            version: line,
                            logs: []
                        }
                    }
                    temp.logs.push(lastLine)
                } else if (/^\s{2,}\*/.test(line)) {
                    lastLine.logs.push(getLine(line))
                }
            }
        })
    }
} catch (e) {
    logger.error(e)
    // do nth
}

try {
    if (fs.existsSync(README_path)) {
        let README = fs.readFileSync(README_path, 'utf8') || ''
        let reg = /https:\/\/img.shields.io\/badge\/%E7%89%88%E6%9C%AC-(.*)-9cf\?style=for-the-badge/.exec(README)
        if (reg) {
            currentVersion = 'v' + reg[1]
        }
    }
} catch (err) { }

let Version = {
    get ver() {
        return currentVersion
    },
    get yunzai() {
        return yunzai_ver
    },
    get logs() {
        return changelogs
    }
}
export default Version
