
import SaveManager from './SaveManager.js';
import B19 from './B19.js';
import JSZip from 'jszip';
import Summary from './Summary.js';
import { HttpRequest } from './http.js'
import fetch from 'node-fetch';
import ByteReader from './ByteReader.js';
import { SaveModule } from './SaveModule.js';
import GameRecord from './GameRecord.js';
import GameProgress from './GameProgress.js';
import GameUser from './GameUser.js';
import GameSettings from './GameSettings.js';

/**
 * @param {String}  session
 * @param {URL}  url
 * @param {Object} saveInfo 可能为Array，此时buildRecord返回1
 * @param {JSZip} savezip
 * @param {GameRecord} gameRecord
 */

class PhigrosUser {


    constructor(e) {
        this.session = ''
        this.saveInfo = {}
        this.saveUrl = ''
        this.gameRecord = {}
        if (typeof e == 'string') {
            if (!e.match(/[a-z0-9]{25}/))
                throw new Error("SessionToken格式错误");
            this.session = e;
        } else {
            try {
                this.saveUrl = new URL(e);
            } catch (err) {
                throw new Error("设置saveUrl失败！" + err)
            }
        }
    }

    /**多个存档问题的解决方案 */
    chooseSave(choose) {
        if (this.saveInfo[choose]) {
            this.saveInfo = [this.saveInfo[choose]]
            return true
        }
        return false
    }

    /**
     * 
     * @returns 返回未绑定的信息数组，没有则为false
     */
    async buildRecord() {
        if (this.session) {

            this.saveInfo = await SaveManager.saveCheck(this.session)

            if (this.saveInfo[0] && this.saveInfo[0].createdAt) {
                /**多个存档默认选择第一个 */
                this.saveInfo = this.saveInfo[0]
            } else {
                logger.error(`[Phi-Plugin]错误的存档 ${this.saveInfo}`)
                logger.error(this.saveInfo)
                throw new Error("未找到存档QAQ！")
            }

            try {
                this.saveUrl = new URL(this.saveInfo.gameFile.url);
            } catch (err) {

                console.error("[phi-plugin]设置saveUrl失败！" + err)

                throw new Error("设置saveUrl失败 " + err)
            }


        }
        if (this.saveUrl) {
            /**从saveurl获取存档zip */
            let save = await fetch(this.saveUrl, { method: 'GET' })

            try {
                var savezip = await JSZip.loadAsync(await save.arrayBuffer())

            } catch (err) {
                console.error(err)
                throw new Error("解压zip文件失败！ " + err)

            }


            /**插件存档版本 */
            this.Recordver = 1.0

            /**获取 gameProgress */
            let file = new ByteReader(await savezip.file('gameProgress').async('nodebuffer'))
            file.getByte()
            this.gameProgress = new GameProgress(await SaveManager.decrypt(file.getAllByte()))

            /**获取 gameuser */
            file = new ByteReader(await savezip.file('user').async('nodebuffer'))
            file.getByte()
            this.gameuser = new GameUser(await SaveManager.decrypt(file.getAllByte()))

            /**获取 gamesetting */
            file = new ByteReader(await savezip.file('settings').async('nodebuffer'))
            file.getByte()
            this.gamesettings = new GameSettings(await SaveManager.decrypt(file.getAllByte()))

            /**获取gameRecord */
            file = new ByteReader(await savezip.file('gameRecord').async('nodebuffer'))
            if (file.getByte() != GameRecord.version) {
                this.gameRecord = {}

                console.info("版本号已更新，请更新PhigrosLibrary。");

                throw new Error("版本号已更新")
            }
            let Record = new GameRecord(await SaveManager.decrypt(file.getAllByte()));
            const err = []
            await Record.init(err)
            this.gameRecord = Record.Record
            if (err) {
                return err
            }

        } else {
            console.info("获取存档链接失败！")

            throw new Error("获取存档链接失败！")
        }
        return false
    }

    static info = {}

    static readInfo(reader) {
        info = {};
        let lineString;
        while ((lineString = reader.readLine()) != null) {
            let line = lineString.split(",");
            if (line.length != 4 && line.length != 5)
                throw new Error(String.format("曲目%s的定数数量错误。", line[0]));
            let difficulty = new Array(line.length - 1);
            for (let i = 0; i < line.length - 1; i++) {
                difficulty[i] = Number(line[i + 1]);
            }
            info[line[0]] = difficulty;
        }
    }
    static getInfo(id) {
        let songInfo = info[id];
        if (songInfo == null)
            throw new Error(String.format("缺少%s的信息。", id));
        return songInfo;
    }

    getSaveInfo() {
        return this.saveInfo;
    }

    getPlayerId() {
        return SaveManager.getPlayerId(this.session);
    }

    update() {
        let json = SaveManager.Save(this.session);
        this.saveUrl = URL(json.gameFile.url);
        // Logger.getGlobal().info(this.saveUrl.toString());
        let summary = new Summary(json.summary);
        summary.updatedAt = json.updatedAt;
        // Logger.getGlobal().info(summary.toString());
        return summary;
    }

    getB19() {
        return new B19(this.extractZip(GameRecord.constructor)).getB19(19);
    }
    getBestN(num) {
        return new B19(this.extractZip(GameRecord.constructor)).getB19(num);
    }
    getExpect(id) {
        return new B19(this.extractZip(GameRecord.constructor)).getExpect(id);
    }
    getExpects() {
        return new B19(this.extractZip(GameRecord.constructor)).getExpects();
    }

    /** */
    get(clazz) {
        try {
            let saveModule = new SaveModule()
            saveModule.loadFromBinary(this.extractZip(clazz));
            return saveModule;
        } catch (e) {
            throw new Error(e);
        }
    }

    modify(clazz, strategy) {
        let saveManagement = new SaveManager(this);
        saveManagement.modify(clazz, strategy);
        saveManagement.uploadZip(3);
    }

    modify(clazz, strategy, saveInfo) {
        let saveManagement = new SaveManager(this, saveInfo);
        saveManagement.modify(clazz, strategy);
        saveManagement.uploadZip(3);
    }

    downloadSave(path) {
        Files.write(path, this.getData(), StandardOpenOption.CREATE, StandardOpenOption.WRITE);
    }
    uploadSave(path) {
        let saveManager = new SaveManager(this);
        saveManager.data = Files.readAllBytes(path);
        saveManager.uploadZip(3);
    }

    extractZip(clazz) {

    }
    getData() {
        let response = SaveManager.client.send(HttpRequest.Builder(this.saveUrl).build());
        if (response.statusCode() == 404) throw new RuntimeException("存档文件不存在");
        return response.body();
    }
}
export default PhigrosUser

