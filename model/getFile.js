import common from '../../../lib/common/common.js'
import fs from 'node:fs'
import YAML from 'yaml'
import { dataPath, pluginDataPath, savePath } from "./path.js";
import csv from 'csvtojson'
import path from 'node:path';
import getRksRank from './getRksRank.js';



class readFile {

    /**
     * 读取文件
     * @param {string} filePath 完整路径
     * @param {'JSON'|'YAML'|'CSV'|'TXT'} [style=undefined] 强制设置文件格式
     */
    async FileReader(filePath, style = undefined) {
        try {
            if (!fs.existsSync(filePath)) { return false }
            // console.info(filePath)
            if (!style) {
                style = path.extname(filePath).toUpperCase().replace('.', '')
            }
            switch (style) {
                case 'JSON': {
                    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
                }
                case 'YAML': {
                    return YAML.parse(fs.readFileSync(filePath, 'utf8'))
                }
                case 'CSV': {
                    return (await csv().fromString(fs.readFileSync(filePath, 'utf8')))
                }
                case 'TXT': {
                    return fs.readFileSync(filePath, 'utf8')
                }
                default: {
                    logger.error(`[phi-plugin][Read]不支持的文件格式`, style, filepath)
                    return fs.readFileSync(filePath, 'utf8')
                }
            }
        } catch (error) {
            logger.warn(`[phi-plugin][${filePath}] 读取失败`)
            logger.warn(error)
            return false
        }
    }

    /**
     * 存储文件
     * @param {string} fileName 文件名，含后缀
     * @param {string} fatherPath 父路径
     * @param {any} data 目标数据
     * @param {'JSON'|'YAML'|'TXT'} [style=undefined] 强制指定保存格式
     */
    async SetFile(filepath, data, style = undefined) {
        try {
            const fatherPath = path.dirname(filepath)
            const fileName = path.basename(filepath)
            // console.info(filepath, fatherPath, fileName)
            if (!fs.existsSync(fatherPath)) {
                // 递归创建目录
                fs.mkdirSync(fatherPath, { recursive: true });
            }
            if (!style) {
                style = path.extname(filepath).toUpperCase().replace('.', '')
            }
            switch (style) {
                case 'JSON': {
                    fs.writeFileSync(filepath, JSON.stringify(data), 'utf8')
                    break
                }
                case 'YAML': {
                    fs.writeFileSync(filepath, YAML.stringify(data), 'utf8')
                    break
                }
                case 'TXT': {
                    fs.writeFileSync(filepath, data, 'utf8')
                }
                default: {
                    // logger.error(`[phi-plugin][Set]不支持的文件格式`, style, filepath)
                    fs.writeFileSync(filepath, data, 'utf8')
                    break
                }
            }
            return true
        } catch (error) {
            console.info(error)
            logger.warn(`[phi-plugin]写入文件 ${filepath} 时遇到错误`)
            logger.warn(error)
            return false
        }
    }


    async DelFile(path) {
        try {
            if (!fs.existsSync(`${path}`)) { return false }
            fs.unlink(`${path}`, (err) => {
                if (err) throw err
            })
            return true
        } catch (error) {
            logger.warn(`[phi-plugin][${path}] 删除失败`)
            logger.warn(error)
            return false
        }
    }

    /**
     * 删除指定路径下的所有空文件夹
     * @param {*} _path 
     */
    async rmEmptyDir(_path, level = 0) {
        if (!fs.existsSync(_path)) return false
        if (!fs.lstatSync(_path).isDirectory()) return false
        const files = fs.readdirSync(_path);
        if (files.length > 0) {
            let tempFile = 0;
            files.forEach(file => {
                tempFile++;
                this.rmEmptyDir(`${_path}/${file}`, 1);
            });
            if (tempFile === files.length && level !== 0 && fs.lstatSync(_path).isDirectory()) {
                try {
                    fs.rmdirSync(_path);
                } catch { }
            }
        }
        else {
            if (fs.lstatSync(_path).isDirectory()) {
                try {
                    fs.rmdirSync(_path);
                } catch { }
            }
        }
    }

    /**更改数据储存位置,user_id和sessionToken关系转移到redis中 */
    async movJsonFile(_path) {
        let user_token = await this.FileReader(path.join(_path, 'user_token.json')) || {}
        if (!fs.existsSync(`${_path}`)) { return false }
        const files = fs.readdirSync(_path);

        if (files.length > 0) {

            let tot = 0
            let already = 0
            files.forEach(file => {
                if (!fs.lstatSync(`${_path}/${file}`).isDirectory() && file != 'user_token.json') {
                    ++tot
                }
            });
            files.forEach(file => {
                if (!fs.lstatSync(`${_path}/${file}`).isDirectory() && file != 'user_token.json') {
                    let user_id = file.replace('.json', '')
                    this.FileReader(`${_path}/${file}`).then((json) => {
                        if (json) {
                            let session = json.session
                            /**保存user_id和session映射 */
                            user_token[user_id] = session
                            ++already
                            if (this.SetFile(path.join(savePath, session, 'save.json'), json)) {
                                this.FileReader(path.join(pluginDataPath, `${user_id}_.json`)).then((json_) => {
                                    if (json_) {
                                        let tem_file = {
                                            data: json_.data,
                                            rks: json_.rks,
                                            scoreHistory: json_.scoreHistory,
                                            CLGMOD: json_.CLGMOD,
                                            version: json_.version,
                                        }
                                        this.SetFile(path.join(savePath, session, 'history.json'), tem_file)
                                    }
                                })
                                fs.rmSync(path.join(_path, file))
                            }
                        }
                    })
                }
            });

            async function check() {
                while (already < tot) {
                    logger.mark('[phi-plugin][数据整合，请勿中断进程]', `${already}/${tot}`)
                    await common.sleep(1000);
                }
                logger.mark('[phi-plugin][数据整合]', `${already}/${tot}`)
            }

            await check();

            // let list = await getRksRank.getAllRank()

            // for (let i = 0; i < list.length; i++) {
            //     await getRksRank.delUserRks(list[i])
            // }

            await this.SetFile("user_token.json", user_token)

            let getSave = (await import("./getSave.js")).default
            already = 0
            tot = Object.keys(user_token).length
            for (let id in user_token) {
                logger.mark('[phi-plugin][数据转移，请勿中断进程]', `${already}/${tot}`)
                await getSave.add_user_token(id, user_token[id])
                let save = await getSave.getSave(id)
                if (!save) continue
                if (save.getRks() == NaN) {
                    logger.mark('[phi-plugin][数据转移，请勿中断进程]', `奇怪的rks ${save?.saveInfo?.summary?.rankingScore}`)
                    continue
                }
                // console.info(id, save.getRks())
                try {
                    await getRksRank.addUserRks(user_token[id], save.getRks())
                } catch (err) {
                    logger.error('[phi-plugin][数据转移，请勿中断进程]', err, `跳过该用户${id} ${user_token[id]}`)
                }
                ++already
            }
            logger.mark('[phi-plugin][数据转移，请勿中断进程]', `${already}/${tot}`)

            // list = await getRksRank.getAllRank()


            await this.DelFile(path.join(dataPath, 'user_token.json'));


        }
    }


}

export default new readFile()