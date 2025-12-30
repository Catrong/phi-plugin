
import SaveManager from './SaveManager.js';
import JSZip from 'jszip';
import fetch from 'node-fetch';
import ByteReader from './ByteReader.js';
import GameRecord from './GameRecord.js';
import GameProgress from './GameProgress.js';
import GameUser from './GameUser.js';
import GameSettings from './GameSettings.js';
import SaveManagerGB from './SaveManagerGB.js';
import Config from '../components/Config.js';


class PhigrosUser {
    /**
     * 
     * @param {phigrosToken} session 
     * @param {boolean} [global] 是否是国际服
     */
    constructor(session, global = Config.getUserCfg('config', 'defaultGlobal')) {
        /** @type {phigrosToken} */
        this.session =/** @type {any} */ ('');
        /** @type {saveInfo} */
        this.saveInfo =/** @type {any} */ ({})
        /** @type {gameRecord} */
        this.gameRecord = {}
        if (!session.match(/[a-z0-9A-Z]{25}/))
            throw new Error("SessionToken格式错误");
        this.session = session;
        this.global = global;
    }

    /**
     * 获取 SaveInfo
     */
    async getSaveInfo() {
        this.saveInfo = this.global ? await SaveManagerGB.saveCheck(this.session) : await SaveManager.saveCheck(this.session);

        // console.info(this.saveInfo)

        if (this.saveInfo[0] && this.saveInfo[0].createdAt) {
            /**多个存档默认选择第一个 */
            // this.saveInfo = this.saveInfo[0]
            this.saveInfo = this.saveInfo[0]
        } else {
            logger.error(`[Phi-Plugin]错误的存档`, this.session)
            logger.error(this.saveInfo)
            throw new Error("未找到存档QAQ！")
        }

        try {
            this.saveUrl = new URL(this.saveInfo.gameFile.url);
        } catch (err) {

            logger.error("[phi-plugin]设置saveUrl失败！", this.session, err)

            throw new Error(err)
        }
        return this.saveInfo
    }

    /**
     * 
     * @returns 返回未绑定的信息数组，没有则为false
     */
    async buildRecord() {
        if (!this.saveUrl) {

            await this.getSaveInfo()

        }

        if (this.saveInfo.summary.saveVersion == '1') {
            throw new Error("存档版本过低，请更新Phigros！")
        }
        if (this.saveUrl) {
            /**从saveurl获取存档zip */
            let save = await fetch(this.saveUrl, { method: 'GET' })

            try {
                var savezip = await JSZip.loadAsync(await save.arrayBuffer())

            } catch (err) {
                logger.error(err, this.session)
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

