import JSZip from "jszip";
import fs from 'node:fs';
import path from "node:path";
import { Readable } from 'node:stream';
import getFile from "../filesystem/getFile.js";
import { backupPath, pluginDataPath, savePath, dataPath } from "../filesystem/path.js";
import saveHistory from "./saveHistory.js";
import ProgressBar from "../render/progress-bar.js";
import fCompute from '../game/fCompute.js'
import send from "../render/send.js";
import logger from "../../components/Logger.js";
import Save from "./Save.js";
import userCredentialStore from '../user/userCredentialStore.js';
import { themesDir } from '../theme/paths.js';
import { withMarketInstallLock } from '../theme/installLock.js';

const MaxNum = 1e4
const THEME_DIR_RE = /^[a-zA-Z0-9_-]+$/
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

class LazyFileReadStream extends Readable {
    /** @param {string} file */
    constructor(file) {
        super()
        this.file = file
        /** @type {fs.ReadStream|null} */
        this.source = null
    }

    _read() {
        if (this.source) {
            this.source.resume()
            return
        }
        const source = fs.createReadStream(this.file)
        this.source = source
        source.on('data', chunk => {
            if (!this.push(chunk)) source.pause()
        })
        source.on('end', () => this.push(null))
        source.on('error', error => this.destroy(error))
    }

    /** @param {Error|null} error @param {(error?:Error|null)=>void} callback */
    _destroy(error, callback) {
        this.source?.destroy()
        callback(error)
    }
}

/** @param {JSZip} zip @param {string} source @param {string} relative */
function addThemeDirectory(zip, source, relative) {
    let files = 0
    for (const entry of fs.readdirSync(source, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const fullPath = path.join(source, entry.name)
        const archivePath = `${relative}/${entry.name}`
        const stat = fs.lstatSync(fullPath)
        if (stat.isSymbolicLink()) {
            logger.warn(`[phi-plugin][backup] 跳过主题中的符号链接：${fullPath}`)
            continue
        }
        if (stat.isDirectory()) {
            zip.folder(archivePath)
            files += addThemeDirectory(zip, fullPath, archivePath)
        } else if (stat.isFile()) {
            zip.file(archivePath, new LazyFileReadStream(fullPath))
            files++
        }
    }
    return files
}

/** @param {JSZip} zip Add installed/local themes, excluding transaction directories. */
export function addThemesToBackup(zip) {
    if (!fs.existsSync(themesDir)) return { themes: 0, files: 0 }
    let themes = 0
    let files = 0
    for (const entry of fs.readdirSync(themesDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isDirectory() || entry.name.startsWith('.phi-market-') || !THEME_DIR_RE.test(entry.name)) continue
        zip.folder(`themes/${entry.name}`)
        files += addThemeDirectory(zip, path.join(themesDir, entry.name), `themes/${entry.name}`)
        themes++
    }
    return { themes, files }
}

/** @param {string} name @param {boolean} directory */
function parseThemeArchivePath(name, directory) {
    if (!name.startsWith('themes/') || name.includes('\u0000')) return null
    if (process.platform === 'win32' && /[\\\u0001-\u001f\u007f]/.test(name)) return null
    const relative = name.slice('themes/'.length)
    const segments = relative.split('/')
    if (directory && segments.at(-1) === '') segments.pop()
    if (segments.length < (directory ? 1 : 2)
        || !THEME_DIR_RE.test(segments[0])
        || segments.some(segment => !segment || segment === '.' || segment === '..'
            || (process.platform === 'win32'
                && (segment.includes(':') || /[. ]$/.test(segment) || WINDOWS_RESERVED.test(segment))))) return null
    return segments
}

/** @param {JSZip} zip Restore missing themes atomically; existing themes are preserved. */
async function restoreThemesFromBackupUnlocked(zip) {
    const entries = Object.values(zip.files).filter(file => file.name.startsWith('themes/') && file.name !== 'themes/')
    if (!entries.length) return { restored: 0, skipped: 0 }

    /** @type {{file:import('jszip').JSZipObject,segments:string[],directory:boolean}[]} */
    const parsed = []
    for (const file of entries) {
        const originalName = /** @type {any} */ (file).unsafeOriginalName ?? file.name
        const segments = parseThemeArchivePath(originalName, file.dir)
        if (!segments) throw new Error(`备份中的主题路径不安全：${originalName}`)
        parsed.push({ file, segments, directory: file.dir })
    }

    fs.mkdirSync(themesDir, { recursive: true, mode: 0o700 })
    const stage = await fs.promises.mkdtemp(path.join(themesDir, '.phi-market-restore-'))
    const themeNames = new Set(parsed.map(item => item.segments[0]))
    let restored = 0
    let skipped = 0
    try {
        for (const item of parsed) {
            const output = path.join(stage, ...item.segments)
            const relative = path.relative(stage, output)
            if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
                throw new Error(`备份中的主题路径越界：${item.file.name}`)
            }
            if (item.directory) {
                await fs.promises.mkdir(output, { recursive: true, mode: 0o700 })
            } else {
                await fs.promises.mkdir(path.dirname(output), { recursive: true, mode: 0o700 })
                await fs.promises.writeFile(output, await item.file.async('nodebuffer'), { mode: 0o600, flag: 'wx' })
            }
        }
        for (const themeName of [...themeNames].sort()) {
            const source = path.join(stage, themeName)
            const target = path.join(themesDir, themeName)
            const exists = await fs.promises.lstat(target).then(() => true, () => false)
            if (exists) {
                skipped++
                continue
            }
            await fs.promises.rename(source, target)
            restored++
        }
    } finally {
        await fs.promises.rm(stage, { recursive: true, force: true })
    }
    return { restored, skipped }
}

/** @param {JSZip} zip Restore themes under the same lock used by market installs. */
export function restoreThemesFromBackup(zip) {
    return withMarketInstallLock(() => restoreThemesFromBackupUnlocked(zip))
}

/**@import {botEvent} from "../../components/baseClass.js" */
export default class getBackup {

    /**
     * 备份
     * @param {botEvent} e 
     */
    static async backup(e) {
        let zip = new JSZip()
        /**data目录下存档 */
        /**@type {ProgressBar|undefined} */
        let bar = undefined
        let list = fs.readdirSync(savePath)
        if (list.length >= MaxNum) {
            send.send_with_At(e, `存档数量过多，请手动备份 /data/saveData/ 目录！`)
            console.error('[phi-plugin] 存档数量过多，请手动备份 /data/saveData/ 目录！')
        } else {
            send.send_with_At(e, '开始备份存档，请稍等...')
            console.info('[phi-plugin][backup] 开始备份存档...')
            bar = new ProgressBar('[phi-plugin] 存档备份中', 20)
            list.forEach((folderName, index, array) => {
                let folderPath = path.join(savePath, folderName)
                fs.readdirSync(folderPath).forEach((fileName) => { //遍历检测目录中的文件
                    let filePath = path.join(folderPath, fileName);
                    let file = fs.statSync(filePath); //获取一个文件
                    if (file.isDirectory()) {
                        logger.error(filePath, '[phi-plugin] 备份错误：意料之外的文件夹');
                    } else {
                        zip.folder('saveData')?.folder(folderName)?.file(fileName, fs.readFileSync(filePath)); //压缩目录添加文件
                    }
                });
                bar?.render({ completed: index + 1, total: array.length });
            });
        }
        /**data目录下plugin数据 */
        list = fs.readdirSync(pluginDataPath)
        if (list.length >= MaxNum) {
            send.send_with_At(e, `插件数据数量过多，请手动备份 /data/pluginData/ 目录！`)
            console.error('[phi-plugin] 插件数据数量过多，请手动备份 /data/pluginData/ 目录！')
        } else {
            send.send_with_At(e, '开始备份插件数据，请稍等...')
            console.info('\n[phi-plugin][backup] 开始备份插件数据...')
            bar = new ProgressBar('[phi-plugin] 插件数据备份中', 20)
            list.forEach((fileName, index, array) => { //遍历检测目录中的文件
                let filePath = path.join(pluginDataPath, fileName);
                let file = fs.statSync(filePath); //获取一个文件
                if (file.isDirectory()) {
                    logger.error(filePath, '[phi-plugin] 备份错误：意料之外的文件夹');
                } else {
                    zip?.folder('pluginData')?.file(fileName, fs.readFileSync(filePath)); //压缩目录添加文件
                }
                bar?.render({ completed: index + 1, total: array.length });
            });
        }
        /**提取redis中user_id数据 */
        send.send_with_At(e, '开始备份user_token，请稍等...')
        console.info('\n[phi-plugin][backup] 开始备份user_token数据...')
        /**
         * 获取user_token
         * @type {Record<string, string>}
         */
        let user_token = {}
        console.info('[phi-plugin] 获取user_token列表...')
        const credentialEntries = await userCredentialStore.listSessionCredentials()
        for (const [userId, sessionToken] of credentialEntries) user_token[userId] = sessionToken
        logger.info(`[phi-plugin] 已获取 ${credentialEntries.size} 个 user_token`)
        zip.file('user_token.json', JSON.stringify(user_token))
        /**压缩 */
        let zipName = `${(new Date()).toISOString().replace(/[\:\.]/g, '-')}.zip`
        if (!fs.existsSync(backupPath)) {
            // 递归创建目录
            fs.mkdirSync(backupPath, { recursive: true });
        }
        send.send_with_At(e, '开始压缩备份数据，请稍等...')
        console.info('\n[phi-plugin][backup] 开始压缩备份数据...')
        const outputPath = path.join(backupPath, zipName)
        try {
            await withMarketInstallLock(async () => {
                const themeBackup = addThemesToBackup(zip)
                if (themeBackup.themes) {
                    send.send_with_At(e, `已加入 ${themeBackup.themes} 个主题到备份`)
                    logger.info(`[phi-plugin][backup] 已加入 ${themeBackup.themes} 个主题、${themeBackup.files} 个文件`)
                }
                await new Promise((resolve, reject) => {
                    const archive = zip.generateNodeStream({ streamFiles: true })
                    const output = fs.createWriteStream(outputPath)
                    archive.once('error', reject)
                    output.once('error', reject)
                    output.once('finish', () => resolve(undefined))
                    archive.pipe(output)
                })
            })
        } catch (error) {
            await fs.promises.rm(outputPath, { force: true }).catch(() => {})
            throw error
        }
        console.info('[phi-plugin]备份完成' + outputPath)
        send.send_with_At(e, `${zipName.replace(".zip", '')} 成功备份到 ./backup 目录下`)
        if (e.msg.replace(/^[#/].*backup/, '').includes('back')) {
            await fCompute.sendFile(e, outputPath, zipName)
        }
        return { zipName: zipName, zip: zip }
    }

    /**
     * 从zip中恢复
     * @param {string} zipPath 
     */
    static async restore(zipPath) {
        let zip = await JSZip.loadAsync(fs.readFileSync(zipPath))
        const themeRestore = await restoreThemesFromBackup(zip)
        if (themeRestore.restored || themeRestore.skipped) {
            logger.info(`[phi-plugin][backup] 主题恢复完成：恢复 ${themeRestore.restored} 个，保留现有 ${themeRestore.skipped} 个`)
        }
        /**存档相关 */
        zip.folder('saveData')?.forEach((session) => {
            try {
                /**阻止遍历文件user_token.json */
                if (!session.includes('.json')) {
                    /**history */
                    getFile.FileReader(path.join(savePath, session, 'history.json')).then((/** @type {saveHistoryObject & { version?: number; }} */ old) => {
                        zip.folder('saveData')?.folder(session)?.file('history.json')?.async('string').then((history) => {
                            /**格式化为 JSON */
                            let now = new saveHistory(JSON.parse(history))
                            /**有本地记录，合并；无本地记录，直接覆盖 */
                            now.add(new saveHistory(old))
                            getFile.SetFile(path.join(savePath, session, 'history.json'), now)
                        })
                    })
                    /**save */
                    getFile.FileReader(path.join(savePath, session, 'save.json')).then((/** @type {Save} */ old) => {
                        zip.folder('saveData')?.folder(session)?.file('save.json')?.async('string').then((save) => {
                            /**格式化为 JSON */
                            let now = JSON.parse(save)
                            /**有本地记录，保留最新记录；无本地记录，直接覆盖 */
                            if (new Date(old?.saveInfo?.modifiedAt?.iso) > new Date(now?.saveInfo?.modifiedAt?.iso)) { now = old }
                            getFile.SetFile(path.join(savePath, session, 'save.json'), now)

                        })
                    })
                }
            } catch (e) {
                logger.error(`恢复存档 ${session} 错误：` + e);
            }
        });
        /**插件数据相关 */
        zip.folder('pluginData')?.forEach((fileName, file) => {
            try {
                file.async('string').then((data) => {
                    getFile.SetFile(path.join(pluginDataPath, fileName), JSON.parse(data))
                })
            } catch (e) {
                logger.error(`恢复插件数据 ${fileName} 错误：` + e);
            }
        })
        /**user_id->tk */
        zip.file('user_token.json')?.async('text').then((data) => {
            try {
                let now = JSON.parse(data)
                for (let user_id in now) {
                    try {
                        userCredentialStore.setSessionToken(user_id, now[user_id])
                    } catch (e) {
                        logger.error(`恢复 user_token 对照 [${user_id}]:${now[user_id]} 错误：` + e);
                    }
                }
            } catch (e) {
                logger.error(`恢复 user_token 对照错误：` + e);
            }
        })
    }
}
