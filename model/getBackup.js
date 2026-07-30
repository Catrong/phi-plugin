import JSZip from "jszip";
import fs from 'node:fs';
import path from "node:path";
import getFile from "./getFile.js";
import { backupPath, pluginDataPath, savePath, dataPath } from "./path.js";
import saveHistory from "./class/saveHistory.js";
import ProgressBar from "./progress-bar.js";
import fCompute from './fCompute.js'
import send from "./send.js";
import logger from "../components/Logger.js";
import Save from "./class/Save.js";
import userCredentialStore from './userCredentialStore.js';

const MaxNum = 1e4

/**@import {botEvent} from "../components/baseClass.js" */
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
        zip.generateNodeStream({ streamFiles: true })
            .pipe(fs.createWriteStream(path.join(backupPath, zipName)))
            .on('finish', async function () {
                console.info('[phi-plugin]备份完成' + path.join(backupPath, zipName))
                send.send_with_At(e, `${zipName.replace(".zip", '')} 成功备份到 ./backup 目录下`)
                if (e.msg.replace(/^[#/].*backup/, '').includes('back')) {
                    fCompute.sendFile(e, await zip.generateAsync({ type: 'nodebuffer' }), zipName)
                }
            });
        return { zipName: zipName, zip: zip }
    }

    /**
     * 从zip中恢复
     * @param {string} zipPath 
     */
    static async restore(zipPath) {
        let zip = await JSZip.loadAsync(fs.readFileSync(zipPath))
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
