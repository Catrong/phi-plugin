import JSZip from "jszip";
import fs from 'node:fs';
import path from "node:path";
import getFile from "./getFile.js";
import { backupPath, pluginDataPath, savePath, dataPath } from "./path.js";
import saveHistory from "./class/saveHistory.js";
import getSave from "./getSave.js";
import { redisPath } from "./constNum.js";

export default new class getBackup {

    /**备份 */
    async backup() {
        let zip = new JSZip()
        /**data目录下存档 */
        fs.readdirSync(savePath).forEach((folderName) => {
            let folderPath = path.join(savePath, folderName)
            fs.readdirSync(folderPath).forEach((fileName) => { //遍历检测目录中的文件
                let filePath = path.join(folderPath, fileName);
                let file = fs.statSync(filePath); //获取一个文件
                if (file.isDirectory()) {
                    logger.error(filePath, '[phi-plugin] 备份错误：意料之外的文件夹');
                } else {
                    zip.folder('saveData').folder(folderName).file(fileName, fs.readFileSync(filePath)); //压缩目录添加文件
                }
            });
        });
        /**data目录下plugin数据 */
        fs.readdirSync(pluginDataPath).forEach((fileName) => { //遍历检测目录中的文件
            let filePath = path.join(pluginDataPath, fileName);
            let file = fs.statSync(filePath); //获取一个文件
            if (file.isDirectory()) {
                logger.error(filePath, '[phi-plugin] 备份错误：意料之外的文件夹');
            } else {
                zip.folder('pluginData').file(fileName, fs.readFileSync(filePath)); //压缩目录添加文件
            }
        });
        /**提取redis中user_id数据 */
        let user_token = {}
        let keys = await redis.keys(`${redisPath}:userToken:*`)
        for (let key of keys) {
            let user_id = key.split(':')[2]
            user_token[user_id] = await redis.get(key)
        }
        zip.file('user_token.json', JSON.stringify(user_token))
        /**压缩 */
        let zipName = `${(new Date()).toISOString().replace(/[\:\.]/g, '-')}.zip`
        if (!fs.existsSync(backupPath)) {
            // 递归创建目录
            fs.mkdirSync(backupPath, { recursive: true });
        }
        fs.writeFileSync(path.join(backupPath, zipName), await zip.generateAsync({
            type: 'nodebuffer',
            /**压缩算法 */
            compression: "DEFLATE",
            /**压缩等级 */
            compressionOptions: {
                level: 9
            }
        }));
        logger.mark(path.join(backupPath, zipName), '[phi-plugin]备份完成')
        return { zipName: zipName, zip: zip }
    }

    /**
     * 从zip中恢复
     * @param {path} zipPath 
     */
    async restore(zipPath) {
        let zip = await JSZip.loadAsync(fs.readFileSync(zipPath))
        try {
            /**存档相关 */
            zip.folder('saveData').forEach((session) => {
                /**阻止遍历文件夹 */
                if (!session.includes('.json')) {
                    /**history */
                    getFile.FileReader(path.join(savePath, session, 'history.json')).then((old) => {
                        zip.folder('saveData').folder(session).file('history.json').async('string').then((history) => {
                            /**格式化为 JSON */
                            let now = new saveHistory(JSON.parse(history))
                            /**有本地记录，合并；无本地记录，直接覆盖 */
                            now.add(new saveHistory(old))
                            getFile.SetFile(path.join(savePath, session, 'history.json'), now)
                        })
                    })
                    /**save */
                    getFile.FileReader(path.join(savePath, session, 'save.json')).then((old) => {
                        zip.folder('saveData').folder(session).file('save.json').async('string').then((save) => {
                            /**格式化为 JSON */
                            let now = JSON.parse(save)
                            /**有本地记录，保留最新记录；无本地记录，直接覆盖 */
                            if (new Date(old?.saveInfo?.modifiedAt?.iso) > new Date(now?.saveInfo?.modifiedAt?.iso)) { now = old }
                            getFile.SetFile(path.join(savePath, session, 'save.json'), now)

                        })
                    })
                }

            });
        } catch (e) { }
        try {
            /**插件数据相关 */
            zip.folder('pluginData').forEach((fileName, file) => {
                file.async('string').then((data) => {
                    getFile.SetFile(path.join(pluginDataPath, fileName), JSON.parse(data))
                })
            })
        } catch (e) { }
        try {
            /**user_id->tk */
            zip.file('user_token.json').async('string').then((data) => {
                let now = JSON.parse(data)
                for (let user_id in now) {
                    redis.set(`${redisPath}:userToken:${user_id}`, now[user_id])
                }
            })
        } catch (e) { }
    }
}()