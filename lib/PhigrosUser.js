
import SaveManager from './SaveManager.js';
import JSZip from 'jszip';
import fetch from 'node-fetch';
import ByteReader from './ByteReader.js';
import GameRecord from './GameRecord.js';
import GameProgress from './GameProgress.js';
import GameUser from './GameUser.js';
import GameSettings from './GameSettings.js';
import logger from '../components/Logger.js';
// import Config from '../components/Config.js';


class PhigrosUser {
    /**
     * 
     * @param {phigrosToken} session 
     * @param {boolean} [global] 是否是国际服
     */
    constructor(session, global = false) {
        /** @type {phigrosToken} */
        this.session = session;
        /** @type {saveInfo} */
        this.saveInfo;
        /** @type {gameRecord} */
        this.gameRecord = {}
        /** @type {playerInfo} */
        this.playerInfo;
        if (!session.match(/[a-z0-9A-Z]{25}/))
            throw new Error("SessionToken格式错误");
        this.session = session;
        this.global = global;
    }

    /**
     * 获取 SaveInfo
     */
    async getSaveInfo() {
        if (!this.session) {
            throw new Error("SessionToken未设置");
        }
        const saveManager = new SaveManager(this.global);
        let { saveInfo, playerInfo } = await saveManager.saveCheck(this.session);

        if (!saveInfo) {
            logger.error(`[Phi-Plugin]错误的存档`, this.session)
            logger.error(saveInfo)
            throw new Error("未找到存档QAQ！")
        }

        this.saveInfo = saveInfo;
        this.playerInfo = playerInfo;

        return saveInfo;
    }

    /**
     * 
     * @returns 返回未绑定的信息数组，没有则为false
     */
    async buildRecord() {
        await this.getSaveInfo()
        let saveUrl;
        try {
            saveUrl = new URL(this.saveInfo.gameFile.url);
        } catch (err) {

            logger.error("[phi-plugin]设置saveUrl失败！", this.session, err)

            // @ts-ignore
            throw new Error(err)
        }

        if (!this.saveInfo) {
            throw new Error("未获取到存档信息！")
        }

        if (this.saveInfo.summary.saveVersion == 1) {
            throw new Error("存档版本过低，请更新Phigros！")
        }
        if (saveUrl) {
            /**从saveurl获取存档zip */
            let save = await fetch(saveUrl, { method: 'GET' })

            try {
                var savezip = await JSZip.loadAsync(await save.arrayBuffer())

            } catch (err) {
                logger.error(err, this.session)
                throw new Error("解压zip文件失败！ " + err)

            }


            /**插件存档版本 */
            this.Recordver = 1.0

            /**获取 gameProgress */
            let file = new ByteReader(await savezip.file('gameProgress')?.async('nodebuffer'))
            file.getByte()
            this.gameProgress = new GameProgress(await SaveManager.decrypt(file.getAllByte()))

            /**获取 gameuser */
            file = new ByteReader(await savezip.file('user')?.async('nodebuffer'))
            file.getByte()
            this.gameuser = new GameUser(await SaveManager.decrypt(file.getAllByte()))

            /**获取 gamesetting */
            file = new ByteReader(await savezip.file('settings')?.async('nodebuffer'))
            file.getByte()
            this.gamesettings = new GameSettings(await SaveManager.decrypt(file.getAllByte()))

            /**获取gameRecord */
            file = new ByteReader(await savezip.file('gameRecord')?.async('nodebuffer'))
            if (file.getByte() != GameRecord.version) {
                this.gameRecord = {}

                logger.info("版本号已更新，请更新PhigrosLibrary。", this.session);

                throw new Error("版本号已更新")
            }
            let Record = new GameRecord(await SaveManager.decrypt(file.getAllByte()));
            await Record.init()
            this.gameRecord = Record.Record
        } else {
            logger.info("获取存档链接失败！", this.session)

            throw new Error("获取存档链接失败！")
        }
        return false
    }

}
export default PhigrosUser

