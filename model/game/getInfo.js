import readFile from '../filesystem/getFile.js'
import { DlcInfoPath, configPath, dataPath, imgPath, infoPath, originalIllPath, ortherIllPath, oldInfoPath, pluginResources } from '../filesystem/path.js'
import path from 'path'
import Config from '../../components/Config.js'
import SongsInfo from './SongsInfo.js'
import fs from 'fs'
import { allLevel, Level, MAX_DIFFICULTY } from './constNum.js'
import fCompute from './fCompute.js'
import logger from '../../components/Logger.js'
import fileWatcherRegistry from '../../components/FileWatcherRegistry.js'
import Chart from './Chart.js'
import Save from '../save/Save.js'


export default new class getInfo {



    /**
     * @typedef csvDifObject
     * @property {idStringWithout0} id 曲目id
     * @property {string} EZ EZ难度
     * @property {string} HD HD难度
     * @property {string} IN IN难度
     * @property {string} [AT] AT难度
     */

    /**
     * @typedef {Object} updatedChartObject
     * @property {number|number[]|undefined} tap
     * @property {number|number[]|undefined} drag
     * @property {number|number[]|undefined} hold
     * @property {number|number[]|undefined} flick
     * @property {number|number[]|undefined} difficulty
     * @property {number|number[]|undefined} combo
     * @property {boolean|undefined} isNew
     */

    /**
     * @typedef {object} versionInfoObject
     * @property {string} version_label 版本号
     * @property {number} update_date 版本更新时间戳(秒)
     * @property {string} whatsnew 版本更新内容
     * @property {number} version_code 版本号（整数）
     * @property {string} version 版本号（整数）字符版
     * 
     */

    /**
     * @typedef {{[versionCode: string]: Record<idString, csvDifObject>}} historyDifficultyByVersionObject
     */

    /**
     * @typedef {Record<idString, {[versionCode: string]: Record<levelKind, number>}>} historyDifficultyBySongIdObject
     */

    /**
     * @typedef {string & { readonly brand: unique symbol }} kongYouId 空游的id
     * 
     * @typedef {Object} kongYouSongListObject
     * @property {idString} id 曲目id
     * @property {kongYouId} kyId 空游id
     * @property {object} videoLink 攻略链接
     * @property {string} videoLink.ez EZ难度攻略链接
     * @property {string} videoLink.hd HD难度攻略链接
     * @property {string} videoLink.in IN难度攻略链接
     * @property {string} videoLink.at AT难度攻略链接
     */

    constructor() {
        /**
         * 难度映射
         * @type {allLevelKind[]}
         */
        this.allLevel = allLevel

        /**
         * 难度映射
         * @type {levelKind[]}
         */
        this.Level = Level

        /**
         * @type {string[]}
         * @description Tips
         */
        this.tips = []


        /**
         * @type {{[key:idString]:Partial<SongsInfo> | undefined}}
         * @description 原版信息
         */
        this.ori_info = {}
        /**
         * @type {{[key:idString]:songString}}
         * @description 通过id获取曲名
         */
        this.songsid = {}
        /**
         * @type {{[key:songString]:idString}}
         * @description 原曲名称获取id
         */
        this.idssong = {}
        /**
         * @type {idString[]}
         * @description 含有曲绘的曲目列表，id名称
         */
        this.illlist = []

        /**
         * @type {{[key:string]: string[]}}
         * @description 章节别名，以别名为key，内容为章节名
         */
        this.chapNick = {}

        /**
         * 按dif分的info
         * @type {Record<string, Chart[]>}
         */
        this.info_by_difficulty = {}


        /**
         * @type {idString[]}
         */
        this.updatedSong = []


        /**
         * @type {Record<idString, Partial<Record<levelKind, updatedChartObject>>>}
         */
        this.updatedChart = {}

        /** @type {{[versionLabel: string]: versionInfoObject}} */
        this.versionInfoByLabel = {}

        /** @type {{[versionCode: string]: versionInfoObject}} */
        this.versionInfoByCode = {}

        /** @type {historyDifficultyByVersionObject} */
        this.historyDifficultyByVersion = {}

        /** @type {historyDifficultyBySongIdObject} */
        this.historyDifficultyBySongId = {}

        /** @type {Record<string, Record<string, {id: idString, rank: levelKind, difficulty: number}[]>>} */
        this.historyDifficultyByVerDifficulty = {}

        /**@type {{title: string, code: number, content: string[]}} */
        this.noticeJson = { title: '', code: 0, content: [] }

        /**@type {Save | null} */
        this.badSave = null;
        
        this.initIng = false
        this.reinitRequested = false

        /** 已注册的信息文件监听 @type {{close: () => Promise<void>}[]} */
        this.infoWatcherLeases = []
        /** @type {Promise<void>} 重载串行链，避免加载与初始化并发 */
        this.infoReloadChain = Promise.resolve()
        /** @type {Set<string>} 待重载的单元 */
        this.pendingReloadUnits = new Set()
        /** @type {ReturnType<typeof setTimeout> | null} */
        this.reloadTimer = null
        /** @type {Record<string, Partial<Record<levelKind, number>>>} 上一版本定数表，用于新曲与改谱对比 */
        this.oldDifList = {}
        /** @type {boolean} 版本历史是否已加载 */
        this.versionHistoryLoaded = false

        /** @type {Record<idString, Partial<Record<levelKind, string[]>>>} 来源于 https://daogemm.github.io/files/infos/charters.json */
        this.charters = {}

        this.setupInfoWatchers()
    }

    /**
     * 信息文件 → 变化时需要重载的单元。
     * 键为 infoPath 下的文件名，值为该文件影响到的数据结构单元。
     */
    static infoReloadMap = {
        'info.csv': ['songs'],
        'infolist.json': ['songs'],
        'notesInfo.json': ['songs'],
        'oldNotesInfo.json': ['songs'],
        'spinfo.json': ['songs'],
        'nicklist.yaml': ['aliases'],
        'chaplist.yaml': ['chapters'],
        'tips.txt': ['tips'],
        'avatar.txt': ['avatar'],
        'jrrp.json': ['jrrp'],
        'notice.json': ['notice'],
        'charters.json': ['charters'],
    }

    /** 全部重载单元，顺序即依赖顺序（songs 依赖 versionHistory 的旧定数表） */
    static infoReloadOrder = ['versionHistory', 'songs', 'aliases', 'chapters', 'tips', 'avatar', 'jrrp', 'notice', 'badSave', 'dlc', 'charters']

    /**
     * 按 watchInfoPath 开关注册监听：每个信息文件只重载它影响的单元；
     * oldInfo 目录、DLC 目录、演示存档与公共别名快照各自单独监听。
     */
    setupInfoWatchers() {
        void this.closeInfoWatchers()
        // 清理旧版整目录监听可能残留的注册
        void fileWatcherRegistry.close('info:directory')
        if (!Config.getUserCfg('config', 'watchInfoPath')) return
        /** 文件只关心内容变化；目录额外覆盖增删；两者都跳过 chokidar 初始扫描事件 */
        const fileEvents = ['change']
        const watchOptions = { ignoreInitial: true }
        for (const [name, units] of Object.entries(getInfo.infoReloadMap)) {
            this.infoWatcherLeases.push(fileWatcherRegistry.watch(
                `info:file:${name}`,
                path.join(infoPath, name),
                () => this.scheduleInfoReload(units),
                fileEvents,
                watchOptions,
            ))
        }
        /** 目录监听额外覆盖增删事件，并跳过 chokidar 初始扫描产生的 add/addDir */
        const dirEvents = ['change', 'add', 'unlink', 'addDir', 'unlinkDir']
        this.infoWatcherLeases.push(fileWatcherRegistry.watch(
            'info:dir:oldInfo',
            oldInfoPath,
            () => this.scheduleInfoReload(['versionHistory', 'songs']),
            dirEvents,
            watchOptions,
        ))
        this.infoWatcherLeases.push(fileWatcherRegistry.watch(
            'info:dir:dlc',
            DlcInfoPath,
            () => this.scheduleInfoReload(['dlc']),
            dirEvents,
            watchOptions,
        ))
        this.infoWatcherLeases.push(fileWatcherRegistry.watch(
            'info:file:badSave',
            path.join(pluginResources, '0608badSave', 'save.json'),
            () => this.scheduleInfoReload(['badSave']),
            fileEvents,
            watchOptions,
        ))
        this.infoWatcherLeases.push(fileWatcherRegistry.watch(
            'info:file:approvedAlias',
            path.join(dataPath, 'alias', 'approved-nicklist.yaml'),
            () => this.scheduleInfoReload(['aliases']),
            fileEvents,
            watchOptions,
        ))
    }

    /** 关闭全部信息文件监听器。 */
    async closeInfoWatchers() {
        const leases = this.infoWatcherLeases
        this.infoWatcherLeases = []
        await Promise.allSettled(leases.map(lease => lease.close()))
    }

    /**
     * 合并同一批文件事件后排队重载，避免编辑器连续写入触发多次加载
     * @param {string[]} units
     */
    scheduleInfoReload(units) {
        for (const unit of units) this.pendingReloadUnits.add(unit)
        if (this.reloadTimer) return
        this.reloadTimer = setTimeout(() => {
            this.reloadTimer = null
            const pending = [...this.pendingReloadUnits]
            this.pendingReloadUnits.clear()
            void this.runInfoReload(pending).catch(err => logger.error('[phi-plugin]热更新曲目信息失败', err))
        }, 100)
        this.reloadTimer.unref?.()
    }

    /**
     * 串行执行重载，保证与初始化、其它重载不并发
     * @param {string[]} units
     * @returns {Promise<void>}
     */
    async runInfoReload(units) {
        const run = this.infoReloadChain.then(() => this.reloadInfoUnits(units))
        this.infoReloadChain = run.catch(() => undefined)
        return run
    }

    /**
     * 按依赖顺序重载指定单元
     * @param {string[]} units
     */
    async reloadInfoUnits(units) {
        const wanted = new Set(units)
        if (wanted.has('songs') && !this.versionHistoryLoaded) wanted.add('versionHistory')
        this.allLevel = allLevel
        this.Level = Level
        for (const unit of getInfo.infoReloadOrder) {
            if (!wanted.has(unit)) continue
            switch (unit) {
                case 'versionHistory': await this.loadVersionHistory(); break
                case 'songs': await this.loadSongs(); break
                case 'aliases': await this.loadAliases(); break
                case 'chapters': await this.loadChapters(); break
                case 'tips': await this.loadTips(); break
                case 'avatar': await this.loadAvatar(); break
                case 'jrrp': await this.loadJrrp(); break
                case 'notice': await this.loadNotice(); break
                case 'badSave': await this.loadBadSave(); break
                case 'dlc': await this.loadDlcInfo(); break
                case 'charters': await this.loadCharters(); break
            }
        }
    }

    /** 全量加载曲目信息（启动与更新曲库后调用） */
    async init() {
        if (!fs.existsSync(path.join(originalIllPath, '.git'))) {
            logger.error(`[phi-plugin] 未下载曲绘文件，建议使用 /phi downill 命令进行下载`)
        }

        if (this.initIng) {
            this.reinitRequested = true
            return
        }

        this.initIng = true
        this.reinitRequested = false

        try {
            logger.info(`[phi-plugin]初始化曲目信息`)
            this.setupInfoWatchers()
            await this.runInfoReload([...getInfo.infoReloadOrder])
            logger.info(`[phi-plugin]初始化曲目信息完成`)
        } finally {
            this.initIng = false
            if (this.reinitRequested) {
                this.reinitRequested = false
                queueMicrotask(() => {
                    void this.init().catch(err => logger.error('[phi-plugin]补跑曲目信息初始化失败', err))
                })
            }
        }
    }

    /** 重载版本历史：oldInfo 目录下的版本信息与定数变更 */
    async loadVersionHistory() {
        this.versionInfoByLabel = {};
        this.versionInfoByCode = {};
        this.historyDifficultyByVersion = {};
        this.historyDifficultyBySongId = {};
        this.historyDifficultyByVerDifficulty = {};

        const historyVersionList = fs.readdirSync(oldInfoPath)

        /**@type {csvDifObject[]} */
        let oldDif = /**@type {any} */({})

        let versionCodes = historyVersionList.map(ver => Number(ver))

        versionCodes = versionCodes.sort((a, b) => a - b)

        let lastVersionCode = versionCodes[versionCodes.length - 2].toFixed(0)

        for (let ver of historyVersionList) {
            /**@type {versionInfoObject} */
            const verInfo = await readFile.FileReader(path.join(oldInfoPath, ver, 'info.json'))
            /**@type {csvDifObject[]} */
            const csvDifInfo = await readFile.FileReader(path.join(oldInfoPath, ver, 'change.csv'))
            /**@type {Record<idString, csvDifObject>} */
            const difInfo = {}
            const verCode = Number(ver)

            if (ver == lastVersionCode) {
                oldDif = csvDifInfo
            }

            csvDifInfo.forEach(item => {
                difInfo[idWithout0ToIdWith0(item.id)] = item
            })
            this.versionInfoByCode[ver] = verInfo
            this.versionInfoByLabel[verInfo.version_label] = verInfo

            this.historyDifficultyByVersion[ver] = difInfo

            this.historyDifficultyByVerDifficulty[ver] = {}

            const ids = fCompute.objectKeys(difInfo)

            for (let id of ids) {
                /** @type {Record<levelKind, number>} */
                const dif = /** @type {any} */ ({})
                Level.forEach(level => {
                    if (!difInfo[id][level]) return;
                    const songDif = Number(difInfo[id][level]);
                    dif[level] = songDif;
                    if (!this.historyDifficultyByVerDifficulty[ver][songDif.toFixed(1)]) {
                        this.historyDifficultyByVerDifficulty[ver][songDif.toFixed(1)] = []
                    }
                    this.historyDifficultyByVerDifficulty[ver][songDif.toFixed(1)].push({
                        id: id,
                        rank: level,
                        difficulty: songDif
                    })
                })
                if (!this.historyDifficultyBySongId[id]) {
                    this.historyDifficultyBySongId[id] = {}
                    this.historyDifficultyBySongId[id][ver] = dif
                } else {
                    this.historyDifficultyBySongId[id][ver] = dif
                }
            }

        }

        /** 上一版本定数表，用于新曲与改谱对比（对应本次重载的版本历史） */
        this.oldDifList = {}
        for (let i in oldDif) {
            this.oldDifList[oldDif[i].id] = {}
            for (let level of Level) {
                if (oldDif[i][level]) {
                    this.oldDifList[oldDif[i].id][level] = Number(oldDif[i][level])
                }
            }
        }
        this.versionHistoryLoaded = true
    }

    /** 重载曲库主数据：info.csv / infolist.json / notesInfo.json / oldNotesInfo.json / spinfo.json */
    async loadSongs() {
        if (!this.versionHistoryLoaded) await this.loadVersionHistory()

        this.ori_info = {};
        this.songsid = {};
        this.idssong = {};
        this.illlist = [];
        this.info_by_difficulty = {};
        this.updatedSong = [];
        this.updatedChart = {};
        /**自定义信息 */
        let user_song = Config.getUserCfg('config', 'otherinfo')
        if (Config.getUserCfg('config', 'otherinfo')) {
            for (let i in user_song) {
                if (user_song[i]['illustration_big']) {
                    this.illlist.push(user_song[i].song)
                }
            }
        }

        /**
         * @type {Record<idString, SongsInfo>}
         * @description SP信息
         */
        const sp_json = (await readFile.FileReader(path.join(infoPath, 'spinfo.json')))

        /**
         * @type {Record<idString, SongsInfo>}
         * @description SP信息
         */
        this.sp_info = {}

        for (let i of fCompute.objectKeys(sp_json)) {
            const id = /** @type {idString} */(i + '.0');
            this.sp_info[id] = { ...sp_json[i] }
            this.sp_info[id].sp_vis = true
            this.sp_info[id].id = id
            this.idssong[/** @type {songString} */ (/** @type {unknown} */ (i))] = id
            this.idssong[this.sp_info[id].song] = id
            if (this.sp_info[id]?.illustration) {
                this.illlist.push(this.sp_info[id].id)
            }
        }

        /**最高定数 */
        this.MAX_DIFFICULTY = 0

        /**
         * 所有曲目曲名列表
         * @type {songString[]}
         */
        this.songlist = []

        /**
         * 曲目id列表
         * @type {idString[]}
         */
        this.idList = []

        /**
         * @typedef {Object} notesInfoObject
         * @property {number} m MaxTime
         * @property {[tap: number, drag: number, hold: number, flick: number, tot: number][]} d note分布 [tap,drag,hold,flick,tot]
         * @property {[number,number,number,number]} t note统计 [tap,drag,hold,flick]
         */
        /**
         * note统计
         * @type {{[x:idStringWithout0]:Record<levelKind, notesInfoObject>}}
         */
        let notesInfo = await readFile.FileReader(path.join(infoPath, 'notesInfo.json'))

        /**
         * @typedef {Object} csvInfoObject
         * @property {idStringWithout0} id 曲目id
         * @property {songString} song 曲目名称
         * @property {string} composer 作曲
         * @property {string} illustrator 插画师
         * @property {string} EZ EZ难度定数
         * @property {string} HD HD难度定数
         * @property {string} IN IN难度定数
         * @property {string|undefined} AT AT难度定数
         * @property {string} EZC EZ难度谱师
         * @property {string} HDC HD难度谱师
         * @property {string} INC IN难度谱师
         * @property {string|undefined} ATC AT难度谱师
         */
        /**
         * 信息文件
         * @type {csvInfoObject[]}
         */
        let CsvInfo = await readFile.FileReader(path.join(infoPath, 'info.csv'))
        let Jsoninfo = await readFile.FileReader(path.join(infoPath, 'infolist.json'))

        /**
         * note统计
         * @type {{[x:idStringWithout0]:Record<levelKind, notesInfoObject>}}
         */
        let oldNotes = await readFile.FileReader(path.join(infoPath, 'oldNotesInfo.json'))

        /** 上一版本定数表，来自版本历史 */
        const OldDifList = this.oldDifList

        // console.info(CsvInfo, Csvdif, Jsoninfo)
        for (let i = 0; i < CsvInfo.length; i++) {

            const id = /**@type {idString} */(CsvInfo[i].id + '.0')
            const idWithout0 = CsvInfo[i].id

            /**比较新曲部分 */
            if (!OldDifList[idWithout0]) {
                this.updatedSong.push(id)
            }

            switch (idWithout0) {
                case 'AnotherMe.DAAN': {
                    CsvInfo[i].song = /** @type {songString} */('Another Me (KALPA)');
                    break;
                }
                case 'AnotherMe.NeutralMoon': {
                    CsvInfo[i].song = /** @type {songString} */('Another Me (Rising Sun Traxx)');
                    break;
                }
                default: {
                    break;
                }
            }


            this.songsid[id] = CsvInfo[i].song
            this.idssong[CsvInfo[i].song] = id

            this.ori_info[id] = { ...Jsoninfo[CsvInfo[i].id] }
            if (!this.ori_info[id]) {
                this.ori_info[id] = { chapter: '', bpm: '', length: '' }
                logger.mark(`[phi-plugin]曲目详情未更新：${id}`)
            }

            this.ori_info[id].id = id
            this.ori_info[id].song = CsvInfo[i].song
            this.ori_info[id].composer = CsvInfo[i].composer
            this.ori_info[id].illustrator = CsvInfo[i].illustrator
            this.ori_info[id].chart = {}
            for (let level of this.Level) {

                if (CsvInfo[i][level]) {

                    if (!this.ori_info[id].chart) {
                        this.ori_info[id].chart = {}
                    }

                    this.ori_info[id].chart[level] = {
                        id: id,
                        rank: level,
                        charter: CsvInfo[i][/**@type {levelKind} */(level + "C")] || '',
                        difficulty: Number(CsvInfo[i][level]),
                        tap: notesInfo[idWithout0][level].t[0],
                        drag: notesInfo[idWithout0][level].t[1],
                        hold: notesInfo[idWithout0][level].t[2],
                        flick: notesInfo[idWithout0][level].t[3],
                        combo: notesInfo[idWithout0][level].t[0] + notesInfo[idWithout0][level].t[1] + notesInfo[idWithout0][level].t[2] + notesInfo[idWithout0][level].t[3],
                        maxTime: notesInfo[idWithout0][level].m,
                        distribution: notesInfo[idWithout0][level].d
                    }

                    /**比较新曲部分 */
                    if (OldDifList[idWithout0]) {
                        if (!OldDifList[idWithout0][level] || OldDifList[idWithout0][level] != this.ori_info[id].chart[level].difficulty || JSON.stringify(oldNotes[idWithout0][level].t) != JSON.stringify(notesInfo[idWithout0][level].t)) {
                            /**
                             * @type {updatedChartObject}
                             */
                            let tem = {
                                tap: undefined,
                                drag: undefined,
                                hold: undefined,
                                flick: undefined,
                                difficulty: undefined,
                                combo: undefined,
                                isNew: undefined
                            }
                            if (!OldDifList[CsvInfo[i].id][level]) {
                                Object.assign(tem, {
                                    tap: notesInfo[idWithout0][level].t[0],
                                    drag: notesInfo[idWithout0][level].t[1],
                                    hold: notesInfo[idWithout0][level].t[2],
                                    flick: notesInfo[idWithout0][level].t[3],
                                    difficulty: this.ori_info[id].chart[level].difficulty,
                                    combo: notesInfo[idWithout0][level].t[0] + notesInfo[idWithout0][level].t[1] + notesInfo[idWithout0][level].t[2] + notesInfo[idWithout0][level].t[3],
                                    isNew: true
                                })
                            } else {
                                if (OldDifList[idWithout0][level] != this.ori_info[id].chart[level].difficulty) {
                                    Object.assign(tem, { difficulty: [OldDifList[idWithout0][level], this.ori_info[id].chart[level].difficulty] })
                                }
                                if (oldNotes[idWithout0][level].t[0] != notesInfo[idWithout0][level].t[0]) {
                                    Object.assign(tem, { tap: [oldNotes[idWithout0][level].t[0], notesInfo[idWithout0][level].t[0]] })
                                }
                                if (oldNotes[idWithout0][level].t[1] != notesInfo[idWithout0][level].t[1]) {
                                    Object.assign(tem, { drag: [oldNotes[idWithout0][level].t[1], notesInfo[idWithout0][level].t[1]] })
                                }
                                if (oldNotes[idWithout0][level].t[2] != notesInfo[idWithout0][level].t[2]) {
                                    Object.assign(tem, { hold: [oldNotes[idWithout0][level].t[2], notesInfo[idWithout0][level].t[2]] })
                                }
                                if (oldNotes[idWithout0][level].t[3] != notesInfo[idWithout0][level].t[3]) {
                                    Object.assign(tem, { flick: [oldNotes[idWithout0][level].t[3], notesInfo[idWithout0][level].t[3]] })
                                }
                                let oldCombo = oldNotes[idWithout0][level].t[0] + oldNotes[idWithout0][level].t[1] + oldNotes[idWithout0][level].t[2] + oldNotes[idWithout0][level].t[3]
                                let newCombo = notesInfo[idWithout0][level].t[0] + notesInfo[idWithout0][level].t[1] + notesInfo[idWithout0][level].t[2] + notesInfo[idWithout0][level].t[3]
                                if (oldCombo != newCombo) {
                                    Object.assign(tem, { combo: [oldCombo, newCombo] })
                                }
                            }
                            if (!this.updatedChart[id]) {
                                this.updatedChart[id] = {}
                            }
                            this.updatedChart[id][level] = tem
                        }
                    }


                    /**最高定数 */
                    this.MAX_DIFFICULTY = Math.max(this.MAX_DIFFICULTY, this.ori_info[id].chart[level].difficulty)
                }
            }
            if (Jsoninfo[idWithout0]?.chart) {
                this.ori_info[id].chart = { ...this.ori_info[id].chart, ...Jsoninfo[idWithout0].chart }
            }
            this.illlist.push(id)
            this.songlist.push(this.ori_info[id].song)
            this.idList.push(id)
        }


        if (this.MAX_DIFFICULTY != MAX_DIFFICULTY) {
            console.error('[phi-plugin] MAX_DIFFICULTY 常量未更新，请回报作者！', MAX_DIFFICULTY, this.MAX_DIFFICULTY)
        }

        for (let songId of this.idList) {
            for (let level of this.allLevel) {
                let info = this.ori_info[songId]
                if (!info?.chart?.[level]?.difficulty) continue;
                const difStr = info.chart[level].difficulty.toFixed(1);
                if (this.info_by_difficulty[difStr]) {
                    this.info_by_difficulty[difStr].push({
                        ...info.chart[level],
                    })
                } else {
                    this.info_by_difficulty[difStr] = [{
                        ...info.chart[level],
                    }]
                }
            }
        }
    }

    /** 重载曲目别名：内置 nicklist.yaml 与公共 approved 快照 */
    async loadAliases() {
        /**
         * 曲目别名列表 (id不带.0)
         * @type {Record<idStringWithout0, string[]>}
         */
        let nicklistTemp = await readFile.FileReader(path.join(infoPath, 'nicklist.yaml')) || {}
        this.baseNicklist = /** @type {Record<idStringWithout0, string[]>} */ (structuredClone(nicklistTemp))
        this.approvedNicklist = /** @type {Record<idStringWithout0, string[]>} */ (
            await readFile.FileReader(path.join(dataPath, 'alias', 'approved-nicklist.yaml')) || {}
        )
        /** 
         * 默认别名，以id为key
         * @type {Record<idString, string[]>} 
         **/
        this.nicklist = {}
        /**
         * 以别名为key
         * @type {Record<string, idString[]>}
         */
        this.songnick = {}


        this.rebuildAliasIndex()
    }

    /** 重载章节别名 */
    async loadChapters() {
        this.chapNick = {};
        /**
         * @type {{[key:string]: string[]}}
         * @description 章节列表，以章节名为key，内容为别名
         */
        this.chapList = await readFile.FileReader(path.join(infoPath, 'chaplist.yaml'))

        for (let i in this.chapList) {
            for (let item of this.chapList[i]) {
                if (this.chapNick[item]) {
                    this.chapNick[item].push(i)
                } else {
                    this.chapNick[item] = [i]
                }
            }
        }
    }

    /** 重载 tips 列表 */
    async loadTips() {
        const raw = await readFile.FileReader(path.join(infoPath, 'tips.txt'))
        this.tips = String(raw ?? '').replace(/\r/g, '').split('\n')
    }

    /** 重载头像可选列表 */
    async loadAvatar() {
        const raw = await readFile.FileReader(path.join(infoPath, 'avatar.txt'))
        this.avatarid = String(raw ?? '').replace(/\r/g, '').split('\n')
    }

    /** 重载 jrrp 词库 */
    async loadJrrp() {
        this.word = await readFile.FileReader(path.join(infoPath, 'jrrp.json'))
    }

    /** 重载公告 */
    async loadNotice() {
        this.noticeJson = await readFile.FileReader(path.join(infoPath, 'notice.json'))
    }

    /** 重载演示存档 */
    async loadBadSave() {
        this.badSave = await readFile.FileReader(path.join(pluginResources, '0608badSave', 'save.json'))
    }

    /** 重载 DLC 扩增曲目信息 */
    async loadDlcInfo() {
        /**
         * @type {Record<string, string[]>}
         * @description 扩增曲目信息
         **/
        this.DLC_Info = {}
        let files = fs.readdirSync(DlcInfoPath).filter(file => file.endsWith('.json'))
        for (const file of files) {
            this.DLC_Info[path.basename(file, '.json')] = await readFile.FileReader(path.join(DlcInfoPath, file))
        }
    }

    async loadCharters() {
        this.charters = await readFile.FileReader(path.join(infoPath, 'charters.json'))
    }

    /** 关闭曲库监听器。 */
    async close() {
        await this.closeInfoWatchers()
    }

    /**
     * 以“内置别名 + Approved 快照”的顺序重建运行时索引。
     * 同一曲目的重复别名按不区分大小写去重，远端快照删除后不会残留。
     * @returns {void}
     */
    rebuildAliasIndex() {
        this.nicklist = {}
        this.songnick = {}
        /** @type {Array<Record<idStringWithout0, string[]>>} */
        const layers = [this.baseNicklist || {}, this.approvedNicklist || {}]
        for (const layer of layers) {
            for (const rawId of Object.keys(layer)) {
                const idWithout0 = /** @type {idStringWithout0} */ (rawId)
                const id = idWithout0ToIdWith0(idWithout0)
                const aliases = Array.isArray(layer[idWithout0]) ? layer[idWithout0] : []
                this.nicklist[id] ||= []
                for (const rawAlias of aliases) {
                    const alias = String(rawAlias).trim()
                    if (!alias) continue
                    if (!this.nicklist[id].some(item => item.toLowerCase() === alias.toLowerCase())) {
                        this.nicklist[id].push(alias)
                    }
                    this.songnick[alias] ||= []
                    if (!this.songnick[alias].includes(id)) this.songnick[alias].push(id)
                }
            }
        }
    }

    /**
     * 原子快照落盘成功后替换 Approved 内存层并立即重建索引。
     * @param {Record<string, string[]>} snapshot 已严格校验的公开 YAML 数据
     * @returns {void}
     */
    setApprovedAliasSnapshot(snapshot) {
        this.approvedNicklist = /** @type {Record<idStringWithout0, string[]>} */ (structuredClone(snapshot || {}))
        this.rebuildAliasIndex()
    }

    /**
     * 
     * @param {idString} id 原曲曲名
     * @param {boolean} [original=false] 仅使用原版
     * @returns {SongsInfo | undefined} 曲目信息对象
     */
    info(id, original = false) {
        let result
        switch (original ? 0 : Config.getUserCfg('config', 'otherinfo')) {
            case 0: {
                result = { ...this.ori_info, ...this.sp_info }
                break;
            }
            case 1: {
                result = { ...this.ori_info, ...this.sp_info, ...Config.getUserCfg('otherinfo') }
                break;
            }
            case 2: {
                result = Config.getUserCfg('otherinfo')
                break;
            }
        }
        return result[id] ? new SongsInfo(result[id]) : undefined
    }

    /**
     * 
     * @param {boolean} [original=false] 仅使用原版
     * @returns {Record<idString, SongsInfo>} 所有曲目信息对象
     */
    all_info(original = false) {
        switch (original ? 0 : Config.getUserCfg('config', 'otherinfo')) {
            case 0: {
                return { ...this.ori_info, ...this.sp_info }
            }
            case 1: {
                return { ...this.ori_info, ...this.sp_info, ...Config.getUserCfg('otherinfo') }
            }
            case 2: {
                return Config.getUserCfg('otherinfo')
            }
            default: {
                return { ...this.ori_info, ...this.sp_info }
            }
        }
    }

    /**
    * 根据参数模糊匹配返回原曲名称
    * @param {string} mic 别名
    * @param {number} [Distance=0.85] 阈值 猜词0.95
    * @param {boolean} [original=false] 仅使用原版
    * @returns {idString[]} 原曲id数组，按照匹配程度降序
    */
    fuzzysongsnick(mic, Distance = 0.85, original = false) {
        /**为空返回空 */
        if (!mic) return []
        /**
         * 按照匹配程度排序
         * @type {{id: idString, dis: number}[]}
         */
        let result = []

        const usernick = Config.getUserCfg('nickconfig')
        const allinfo = this.all_info(original)

        for (let std in this.songnick) {
            let dis = fCompute.jaroWinklerDistance(mic, std)
            if (dis >= Distance) {
                for (let i in this.songnick[std]) {
                    result.push({ id: this.songnick[std][i], dis: dis })
                }
            }
        }

        const ids = fCompute.objectKeys(allinfo);
        for (let std of ids) {
            let dis = fCompute.jaroWinklerDistance(mic, std)
            if (dis >= Distance) {
                result.push({ id: allinfo[std].id, dis: dis })
            }
            if (!allinfo[std]?.id) continue
            dis = fCompute.jaroWinklerDistance(mic, allinfo[std].song)
            if (dis >= Distance) {
                result.push({ id: allinfo[std].id, dis: dis })
            }
        }



        for (let std in usernick) {
            let dis = fCompute.jaroWinklerDistance(mic, std)
            if (dis >= Distance) {
                usernick[std].forEach((id, i) => {
                    if (this.info(id) == undefined) return; //过滤无效id
                    result.push({ id: usernick[std][i], dis: dis })
                })
            }
        }


        result = result.sort((a, b) => b.dis - a.dis)

        /**
         * @type {idString[]}
         */
        let all = []
        for (let i of result) {

            if (all.includes(i.id)) continue //去重
            /**如果有完全匹配的曲目则放弃剩下的 */
            if (result[0].dis == 1 && i.dis < 1) break


            all.push(i.id)
        }

        return all
    }

    /**
     * 设置别名
     * @param {string} mic 原名
     * @param {string} nick 别名
     */
    async setnick(mic, nick) {
        if (!Config.getUserCfg('nickconfig', mic)) {
            Config.modify('nickconfig', nick, [mic])
        } else {
            Config.modifyarr('nickconfig', nick, mic, 'add')
        }
    }

    /**
     * @typedef {'ill'|'illBlur'|'illLow'|'SP'|'chartimg'|'table'|'chap'} onlinePhiIllType
     * @typedef {{baseUrl: string, dirs: Partial<Record<onlinePhiIllType, string>>}} onlinePhiIllSource
     */

    /** @type {onlinePhiIllSource & {dirs: Record<onlinePhiIllType, string>}} */
    static defaultOnlinePhiIllSource = {
        baseUrl: 'https://raw.githubusercontent.com/Catrong/phi-plugin-ill/main',
        dirs: {
            ill: 'ill',
            illBlur: 'illBlur',
            illLow: 'illLow',
            SP: 'SP',
            chartimg: 'chartimg',
            table: 'table',
            chap: 'chap'
        }
    }

    static githubRawHosts = [
        'raw.githubusercontent.com'
    ]

    /** @type {Record<1 | 2 | 3 | 4, onlinePhiIllSource>} */
    static onlinePhiIllSources = {
        1: getInfo.defaultOnlinePhiIllSource,
        2: {
            baseUrl: 'https://gitee.com/Steveeee-e/phi-plugin-ill/raw/main',
            dirs: {
                ill: 'ill',
                illBlur: 'illBlur',
                illLow: 'illLow',
                SP: 'SP',
                chartimg: 'chartimg',
                table: 'table',
                chap: 'chap'
            }
        },
        3: {
            baseUrl: 'https://r-0semi.xtower.site',
            dirs: {
                ill: 'illustration',
                illBlur: 'illustrationBlur',
                illLow: 'illustrationLowRes',
                chap: 'chap'
            }
        },
        4: {
            baseUrl: 'https://cnb.cool/r-0semi/asset-xtower/-/git/raw/master',
            dirs: {
                ill: 'illustration',
                illBlur: 'illustrationBlur',
                illLow: 'illustrationLowRes',
                chap: 'chap'
            }
        }
    }

    /**
     * @param {unknown} baseUrl
     * @returns {string}
     */
    getOnlinePhiIllBaseUrl(baseUrl) {
        const rawBaseUrl = String(baseUrl || getInfo.defaultOnlinePhiIllSource.baseUrl).replace(/\/$/, '')
        let url
        try {
            url = new URL(rawBaseUrl)
        } catch (err) {
            return rawBaseUrl
        }
        if (!getInfo.githubRawHosts.includes(url.hostname)) {
            return rawBaseUrl
        }

        const githubProxy = Config.getUserCfg('config', 'githubProxy')
        if (githubProxy === false || githubProxy === 'false' || githubProxy === '') {
            return rawBaseUrl
        }
        if (!githubProxy) {
            return rawBaseUrl
        }
        return `${String(githubProxy).replace(/\/$/, '')}/${rawBaseUrl}`
    }

    /**
     * @param {onlinePhiIllType} type
     * @param {...string} paths
     * @returns {string}
     */
    getOnlinePhiIllUrl(type, ...paths) {
        const cfg = Config.getUserCfg('config', 'onLinePhiIllUrl')

        let sourceKey = /**@type {1|2|3|4} */(Number(cfg))
        if (![1, 2, 3, 4].includes(sourceKey)) {
            logger.warn(`[phi-plugin] 无效的在线曲绘源配置：${cfg}，将使用默认源`)
            sourceKey = 1;
        }
        const source = getInfo.onlinePhiIllSources[sourceKey]
        const baseSource = source || {
            baseUrl: String(cfg || getInfo.defaultOnlinePhiIllSource.baseUrl),
            dirs: getInfo.defaultOnlinePhiIllSource.dirs
        }
        const dir = baseSource.dirs[type] || getInfo.defaultOnlinePhiIllSource.dirs[type]
        const baseUrl = this.getOnlinePhiIllBaseUrl(baseSource.dirs[type] ? baseSource.baseUrl : getInfo.defaultOnlinePhiIllSource.baseUrl)
        return [baseUrl, dir, ...paths.map(i => encodeURIComponent(i))].join('/')
    }


    /**
     * 获取曲绘，返回地址，曲目id
     * @param {idString} id 曲目id，带.0
     * @param {'common'|'blur'|'low'} [kind='common'] 清晰度
     * @return {string} 网址或文件地址
    */
    getill(id, kind = 'common') {
        const songsinfo = this.all_info()[id]
        let ans = songsinfo?.illustration
        let reg = /^(?:(http|https|ftp):\/\/)((?:[\w-]+\.)+[a-z0-9]+)((?:\/[^/?#]*)+)?(\?[^#]+)?(#.+)?$/i
        if (ans && !reg.test(ans)) {
            ans = path.join(ortherIllPath, ans)
        } else if (this.ori_info?.[id] || this.sp_info?.[id]) {
            if (this.ori_info?.[id]) {
                if (fs.existsSync(path.join(originalIllPath, id.replace(/.0$/, '.png')))) {
                    ans = path.join(originalIllPath, id.replace(/.0$/, '.png'))
                } else if (fs.existsSync(path.join(originalIllPath, "ill", id.replace(/.0$/, '.png')))) {
                    if (kind == 'common') {
                        ans = path.join(originalIllPath, "ill", id.replace(/.0$/, '.png'))
                    } else if (kind == 'blur') {
                        ans = path.join(originalIllPath, "illBlur", id.replace(/.0$/, '.png'))
                    } else if (kind == 'low') {
                        ans = path.join(originalIllPath, "illLow", id.replace(/.0$/, '.png'))
                    }
                } else {
                    if (kind == 'common') {
                        ans = this.getOnlinePhiIllUrl('ill', id.replace(/.0$/, '.png'))
                    } else if (kind == 'blur') {
                        ans = this.getOnlinePhiIllUrl('illBlur', id.replace(/.0$/, '.png'))
                    } else if (kind == 'low') {
                        ans = this.getOnlinePhiIllUrl('illLow', id.replace(/.0$/, '.png'))
                    }
                }
            } else {
                if (fs.existsSync(path.join(originalIllPath, "SP", songsinfo.id.replace(/.0$/, '.png')))) {
                    ans = path.join(originalIllPath, "SP", songsinfo.id.replace(/.0$/, '.png'))
                } else {
                    ans = this.getOnlinePhiIllUrl('SP', songsinfo.id.replace(/.0$/, '.png'))
                }
            }
        } else if (ans) {
            ans = path.join(ortherIllPath, ans)
        }
        if (!ans) {
            logger.warn(id, '背景不存在')
            ans = path.join(imgPath, 'phigros.png')
        }
        return ans
    }

    /**
     * 
     * @param {idString} songId 
     * @param {levelKind} dif 
     */
    getChartImg(songId, dif) {
        const id = songId.replace(/.0$/, '');
        if (fs.existsSync(path.join(originalIllPath, "chartimg", dif, `${id}.png`))) {
            return path.join(originalIllPath, "chartimg", dif, `${id}.png`)
        } else {
            return this.getOnlinePhiIllUrl('chartimg', dif, `${id}.png`)
        }
    }

    /**
     * 返回定数表图片 url
     * @param {number} dif 难度
     */
    getTableImg(dif) {
        if (fs.existsSync(path.join(originalIllPath, "table", `${dif}.png`))) {
            return path.join(originalIllPath, "table", `${dif}.png`)
        } else {
            return this.getOnlinePhiIllUrl('table', `${dif}.png`)
        }
    }

    /**
     * 返回章节封面 url
     * @param {string} name 标准章节名
     */
    getChapIll(name) {
        if (fs.existsSync(path.join(originalIllPath, "chap", `${name}.png`))) {
            return path.join(originalIllPath, "chap", `${name}.png`)
        } else {
            return this.getOnlinePhiIllUrl('chap', `${name}.png`)
        }
    }

    /**
     * 通过id获得头像文件名称
     * @param {string} id 
     * @returns file name
     */
    idgetavatar(id) {
        if (this.avatarid?.includes(id)) {
            if (id == "Cipher : /2&//<|0") {
                return "Cipher1"
            }
            if (id == "Oblivion: PHIN") {
                return "OblivionPHIN"
            }
            return id
        } else {
            return 'Introduction'
        }
    }

    /**
     * 根据曲目id获取原名
     * @param {idString} id 曲目id
     * @returns {songString | undefined} 原名
     */
    idgetsong(id) {
        return this.songsid?.[id]
    }

    /**
     * 通过原曲曲目获取曲目id
     * @param {songString} song 原曲曲名
     * @returns {idString | undefined} 曲目id
     */
    SongGetId(song) {
        return this.idssong?.[song]
    }

    /**
     * 已确认的谱师真实名录（来源于 https://daogemm.github.io/files/infos/charters.json），按字典序排列
     * @param {idString} id 曲目 id
     * @param {levelKind} rank 难度
     * @returns {string[]} 名录，无数据时为空数组
     */
    getCharters(id, rank) {
        const list = this.charters?.[id]?.[rank]
        if (!Array.isArray(list)) return []
        return list.map(name => String(name ?? '').trim()).filter(Boolean).sort()
    }

    /**
     * 谱师真实名录的展示文本，无数据时返回空字符串
     * @param {idString} id 曲目 id
     * @param {levelKind} rank 难度
     * @returns {string}
     */
    getChartersText(id, rank) {
        const names = this.getCharters(id, rank)
        if (!names.length) return ''
        const plainAscii = names.every(name => /^[\x20-\x7E]+$/.test(name))
        return names.join(plainAscii ? ', ' : '、')
    }

    /**
     * 获取角色介绍背景曲绘
     * @param {string} save_background 
     * @returns 
     */
    getBackground(save_background) {
        try {
            switch (save_background) {
                case 'Another Me ': {
                    save_background = 'Another Me (KALPA)'
                    break
                }
                case 'Another Me': {
                    save_background = 'Another Me (Rising Sun Traxx)'
                    break
                }
                case 'Re_Nascence (Psystyle Ver.) ': {
                    save_background = 'Re_Nascence (Psystyle Ver.)'
                    break
                }
                case 'Energy Synergy Matrix': {
                    save_background = 'ENERGY SYNERGY MATRIX'
                    break
                }
                case 'Le temps perdu-': {
                    save_background = 'Le temps perdu'
                    break
                }
                default: {
                    break
                }
            }
            // @ts-ignore
            return this.getill(this.SongGetId(save_background) || save_background)
        } catch (err) {
            logger.error(`获取背景曲绘错误`, err)
            return 'Introduction';
        }
    }

}()

/**
 * 
 * @param {idStringWithout0} idWithout0 
 * @returns {idString}
 */
function idWithout0ToIdWith0(idWithout0) {
    return /** @type {idString} */(idWithout0 + '.0')
}
