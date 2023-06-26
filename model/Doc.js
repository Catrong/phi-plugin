
import fs from 'node:fs'
import YAML from 'yaml'
import { _path } from "./path.js";


class Film {

    /**YAMLReader
     * @param path 真实路径，包含文件后缀
     * @param style 父路径
     */
    async YamlReader(path, style) {
        try {
            if (!fs.existsSync(`${style}`)) { return false }
            return YAML.parse(fs.readFileSync(`${path}`, 'utf8'))
        } catch (error) {
            logger.error(`[phi插件][${path}] 读取失败 ${error}`)
            return false
        }
    }

    /**JSONReader
     * @param path 真实路径，包含文件后缀
     * @param style 父路径
     */
    async JsonReader(path, style) {
        try {
            if (!fs.existsSync(`${style}`)) { return false }
            return JSON.parse(fs.readFileSync(`${path}`, 'utf8'))
        } catch (error) {
            logger.error(`[phi插件][${path}] 读取失败\n${error}`)
            return false
        }

    }

    /**保存Yaml文件
     * @param path 真实路径，包含文件后缀
     * @param data 覆写内容
     * @param style 父路径
     */
    async SetYaml(path, data, style) {
        try {
            if (!fs.existsSync(style)) {
                // 递归创建目录
                fs.mkdirSync(style, { recursive: true });
            }
            fs.writeFileSync(`${path}`, YAML.stringify(data), 'utf8')
        } catch (error) {
            logger.error(`[phi插件]写入文件 ${path} 时遇到错误\n${error}`)
            return false
        }
    }
    
    /**保存Json文件
     * @param path 真实路径，包含文件后缀
     * @param data 覆写内容
     * @param style 父路径
     */
    async SetJson(path, data, style) {
        try {
            if (!fs.existsSync(style)) {
                // 递归创建目录
                fs.mkdirSync(style, { recursive: true });
            }
             fs.writeFileSync(`${path}`, JSON.stringify(data), 'utf8')
        } catch (error) {
            logger.error(`[phi插件]写入文件 ${path} 时遇到错误\n${error}`)
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
            logger.error(`[phi插件][${path}] 删除失败 ${error}`)
            return false
        }
    }
}

export default new Film()