import Config from '../../components/Config.js'
import logger from '../../components/Logger.js'
import PhigrosUser from '../../lib/PhigrosUser.js'
import { Level, MAX_DIFFICULTY } from '../constNum.js'
import fCompute from '../fCompute.js'
import getInfo from '../getInfo.js'
import getRksRank from '../getRksRank.js'
import makeRequest from '../makeRequest.js'
import LevelRecordInfo from './LevelRecordInfo.js'

export default class Save {

    /**
     * @param {oriSave | PhigrosUser} data 
     * @param {boolean} ignore 跳过存档检查
     */
    constructor(data, ignore = false) {
        this.session = data.session
        /**是否是国际版 */
        this.global = data.global
        if ('apiId' in data) {
            this.apiId = data.apiId
        } else {
            this.apiId = undefined
        }
        this.saveInfo = {
            /**账户创建时间 2022-09-03T10:21:48.613Z */
            createdAt: data.saveInfo.createdAt,
            gameFile: {
                /**文件类型 */
                __type: data.saveInfo.gameFile.__type,
                /**存档bucket */
                bucket: data.saveInfo.gameFile.bucket,
                /**存档创建时间 2023-10-05T07:41:24.503Z */
                createdAt: data.saveInfo.gameFile.createdAt,
                /**gamesaves/{32}/.save */
                key: data.saveInfo.gameFile.key,
                /**metaData */
                metaData: data.saveInfo.gameFile.metaData,
                /**mime_type */
                mime_type: data.saveInfo.gameFile.mime_type,
                /**.save */
                name: data.saveInfo.gameFile.name,
                /**存档id {24} */
                objectId: data.saveInfo.gameFile.objectId,
                /**provider */
                provider: data.saveInfo.gameFile.provider,
                /**存档更新时间 2023-10-05T07:41:24.503Z */
                updatedAt: data.saveInfo.gameFile.updatedAt,
                /**https://rak3ffdi.tds1.tapfiles.cn/gamesaves/{32}/.save */
                url: data.saveInfo.gameFile.url
            },
            /**存档上传时间 {__type："Date", "iso": "2023-10-06T03:46:33.000Z"} */
            modifiedAt: {
                __type: "Date",
                /**存档上传时间 "2023-10-06T03:46:33.000Z" */
                iso: new Date(data.saveInfo.modifiedAt.iso)
            },
            /**用户id {24} 与 gameFile 中的不同 */
            objectId: data.saveInfo.objectId,
            summary: {
                /**插件获取存档时间 2023 Oct.06 11:46:33 */
                updatedAt: data.saveInfo.summary.updatedAt,
                /**存档版本 */
                saveVersion: data.saveInfo.summary.saveVersion,
                /**课题分 */
                challengeModeRank: data.saveInfo.summary.challengeModeRank,
                /**rks */
                rankingScore: Number(data.saveInfo.summary.rankingScore),
                /**客户端版本号 */
                gameVersion: data.saveInfo.summary.gameVersion,
                /**头像 */
                avatar: data.saveInfo.summary.avatar,
                /**完成曲目数量 */
                cleared: data.saveInfo.summary.cleared,
                /**FC曲目数量 */
                fullCombo: data.saveInfo.summary.fullCombo,
                /**AP曲目数量 */
                phi: data.saveInfo.summary.phi
            },
            /**ACL */
            ACL: data.saveInfo.ACL,
            /**authData */
            authData: data.saveInfo.authData,
            /**头像 */
            avatar: data.saveInfo.avatar,
            /**邮箱验证 */
            emailVerified: data.saveInfo.emailVerified,
            /**手机验证 */
            mobilePhoneVerified: data.saveInfo.mobilePhoneVerified,
            /**昵称 */
            nickname: data.saveInfo.nickname,
            /**sessionToken */
            sessionToken: data.saveInfo.sessionToken,
            /**短id */
            shortId: data.saveInfo.shortId,
            /**用户名 */
            username: data.saveInfo.username,
            /**存档上传时间 2023 Oct.06 11:46:33 */
            updatedAt: data.saveInfo.updatedAt,
            /**用户信息 */
            user: data.saveInfo.user,
            /**用户名 */
            PlayerId: data.saveInfo.PlayerId
        }
        this.saveUrl = data.saveUrl
        /**官方存档版本号 */
        this.Recordver = data.Recordver
        this.gameProgress = data.gameProgress ? {
            /**首次运行 */
            isFirstRun: data.gameProgress.isFirstRun,
            /**过去的章节已完成 */
            legacyChapterFinished: data.gameProgress.legacyChapterFinished,
            /**已展示收藏品Tip */
            alreadyShowCollectionTip: data.gameProgress.alreadyShowCollectionTip,
            /**已展示自动解锁IN Tip */
            alreadyShowAutoUnlockINTip: data.gameProgress.alreadyShowAutoUnlockINTip,
            /**剧情完成(显示全部歌曲和课题模式入口) */
            completed: data.gameProgress.completed,
            /**？？？ */
            songUpdateInfo: data.gameProgress.songUpdateInfo,
            /**课题分 */
            challengeModeRank: data.gameProgress.challengeModeRank,
            /**data货币 */
            money: data.gameProgress.money,
            /**痉挛解锁 */
            unlockFlagOfSpasmodic: data.gameProgress.unlockFlagOfSpasmodic,
            /**Igallta解锁 */
            unlockFlagOfIgallta: data.gameProgress.unlockFlagOfIgallta,
            /**Rrhar'il解锁 */
            unlockFlagOfRrharil: data.gameProgress.unlockFlagOfRrharil,
            /**IN达到S(倒霉蛋,船,Shadow,心之所向,inferior,DESTRUCTION 3,2,1,Distorted Fate) */
            flagOfSongRecordKey: data.gameProgress.flagOfSongRecordKey,
            /**Random切片解锁 */
            randomVersionUnlocked: data.gameProgress.randomVersionUnlocked,
            /**第八章入场 */
            chapter8UnlockBegin: data.gameProgress.chapter8UnlockBegin,
            /**第八章第二阶段 */
            chapter8UnlockSecondPhase: data.gameProgress.chapter8UnlockSecondPhase,
            /**第八章通过 */
            chapter8Passed: data.gameProgress.chapter8Passed,
            /**第八章各曲目解锁 */
            chapter8SongUnlocked: data.gameProgress.chapter8SongUnlocked
        } : {
            money: [0, 0, 0, 0, 0]
        }
        this.gameuser = {
            /**user */
            name: data.gameuser?.name || '',
            /**版本 */
            version: data.gameuser?.version || '',
            /**是否展示Id */
            showPlayerId: data.gameuser?.showPlayerId || false,
            /**简介 */
            selfIntro: data.gameuser?.selfIntro || '',
            /**头像 */
            avatar: data.gameuser?.avatar || '',
            /**背景 */
            background: data.gameuser?.background || '',
        }
        if (checkIg(this)) {
            getRksRank.delUserRks(this.session)
            logger.error(`封禁tk ${this.session}`)
            throw new Error(`您的存档rks异常，该 token 已禁用，如有异议请联系机器人管理员。\n${this.session}`)
        }
        /**
         * @type {{[id:idString]: (LevelRecordInfo|null)[]}}
         */
        this.gameRecord = {}

        /**@type {idString[]} */
        const idList = /**@type {any} */ (Object.keys(data.gameRecord))

        for (const id of idList) {
            this.gameRecord[id] = []
            for (let i in data.gameRecord[id]) {
                let level = Number(i)
                if (!data.gameRecord[id][level]) {
                    this.gameRecord[id][level] = null
                    continue
                }
                // this.gameRecord[id][level] = new (import('./LevelRecordInfo')).default(data.gameRecord[id][level], id, level)

                if (!ignore) {
                    if (data.gameRecord[id][level].acc > 100 || data.gameRecord[id][level].acc < 0) {
                        // Starduster.Quree EZ难度 远古存档BUG特判
                        if (id == "Starduster.Quree.0" && level == 0 && data.gameRecord[id][level].acc <= 102.57 && data.gameRecord[id][level].acc >= 0) {
                            continue
                        }
                        logger.error(`acc > 100 封禁tk ${this.session}`)
                        getRksRank.delUserRks(this.session)
                        throw new Error(`您的存档 acc 异常，该 token 已禁用，如有异议请联系机器人管理员。\n${this.session}\n${id} ${level} ${data.gameRecord[id][level].acc}`)
                    }
                    if (data.gameRecord[id][level].score > 1000000 || data.gameRecord[id][level].score < 0) {
                        logger.error(`score > 1000000 封禁tk ${this.session}`)
                        getRksRank.delUserRks(this.session)
                        throw new Error(`您的存档 score 异常，该 token 已禁用，如有异议请联系机器人管理员。\n${this.session}\n${id} ${level} ${data.gameRecord[id][level].score}`)
                    }
                }
                this.gameRecord[id][level] = new LevelRecordInfo(data.gameRecord[id][level], id, level)
            }
        }
    }

    async init() {
        // for (let id in this.gameRecord) {
        //     for (let i in this.gameRecord[id]) {
        //         let level = Number(i)
        //         if (!this.gameRecord[id][level]) {
        //             continue
        //         }
        //     }
        // }
    }

    checkNoInfo() {
        /**@type {idString[]} */
        let err = []

        /**@type {idString[]} */
        const ids = /**@type {any} */(Object.keys(this.gameRecord))

        ids.forEach(id => {
            if (!getInfo.idgetsong(id)) {
                err.push(id)
            }
        })
        return err
    }

    /**
     * 获取存档
     * @returns 按照 rks 排序的数组
     */
    getRecord() {
        if (this.sortedRecord) {
            return this.sortedRecord
        }
        /**
         * @type {LevelRecordInfo[]}
         */
        let sortedRecord = []
        const ids = fCompute.objectKeys(this.gameRecord)
        for (let id of ids) {
            this.gameRecord[id].forEach((recording, level) => {
                if (level == 4) return; // LEGACY
                let tem = this.gameRecord[id][level]
                if (!tem?.score) return;
                sortedRecord.push(tem)
            })
        }

        sortedRecord.sort((a, b) => { return b.rks - a.rks })
        this.sortedRecord = sortedRecord
        return sortedRecord
    }

    /**
     * 筛选满足ACC条件的成绩
     * @param {number} acc ≥acc
     * @param {boolean} [same=false] 是否筛选最高rks
     * @returns 按照rks排序的数组
     */
    findAccRecord(acc, same = false) {
        /**
         * @type {LevelRecordInfo[]}
         */
        let record = []
        const ids = fCompute.objectKeys(this.gameRecord)
        for (const id of ids) {
            if (!this.gameRecord[id]) continue;
            for (let level of [0, 1, 2, 3]) {
                /**LEGACY */
                let tem = this.gameRecord[id]?.[level]
                if (!tem) continue
                if (tem.acc >= acc) {
                    record.push(tem)
                }
            }
        }
        record.sort((a, b) => { return b.rks - a.rks })
        if (same) {
            for (let i = 0; i < record.length - 1; i++) {
                if (record[i].rks != record[i + 1]?.rks) {
                    return record.slice(0, i + 1)
                }
            }
        }
        return record
    }

    /**计算rks+0.01的最低所需要提升的rks */
    minUpRks() {
        /**考虑屁股肉四舍五入原则 */
        let minuprks = Math.floor(this.saveInfo.summary.rankingScore * 100) / 100 + 0.005 - this.saveInfo.summary.rankingScore
        return minuprks < 0 ? minuprks + 0.01 : minuprks
    }

    /**简单检查存档是否存在问题 */
    checkRecord() {
        let error = ``
        const ids = fCompute.objectKeys(this.gameRecord)
        for (const id of ids) {
            if (!this.gameRecord[id]) continue;
            for (let level of [0, 1, 2, 3]) {

                let score = this.gameRecord[id][level]
                if (!score) continue;
                if (score.acc > 100 || score.acc < 0 || score.score > 1000000 || score.score < 0) {
                    error += `\n${id} ${Level[level]} ${score.fc} ${score.acc} ${score.score} 非法的成绩`
                }
                // if (!score.fc && (score.score >= 1000000 || score.acc >= 100)) {
                //     error += `\n${i} ${Level[j]} ${score.fc} ${score.acc} ${score.score} 不符合预期的值`
                // }
                if ((score.score >= 1000000 && score.acc < 100) || (score.score < 1000000 && score.acc >= 100)) {
                    error += `\n${id} ${Level[level]} ${score.fc} ${score.acc} ${score.score} 成绩不自洽`
                }
            }
        }
        return error
    }

    /**
     * 
     * @param {idString} id 曲目id
     * @returns {(LevelRecordInfo | null)[] | undefined} 曲目所有难度的成绩
     */
    getSongsRecord(id) {

        return this.gameRecord[id] ? [...(this.gameRecord[id])] : undefined
    }

    /**
     * 
     * @param {number} num B几
     * @returns phi, b19_list
     */
    async getB19(num) {

        let getInfo = (await import('../getInfo.js')).default
        /**计算得到的rks，仅作为测试使用 */
        let sum_rks = 0
        /**满分且 rks 最高的成绩数组 */
        let philist = this.findAccRecord(100)
        /**
         * @type {(LevelRecordInfo & {suggestType?: number, suggest?: string} | undefined)[]}
         */
        let phi = philist.splice(0, Math.min(philist.length, 3))


        // console.info(phi)
        /**处理数据 */

        for (let i = 0; i < 3; ++i) {
            if (!phi[i]) {
                phi[i] = undefined;
                continue;
            }
            const x = phi[i];
            if (x?.rks) {
                const tem = { ...x }
                phi[i] = tem
                const y = phi[i];
                if (!y) continue;
                sum_rks += Number(y.rks) //计算rks
                y.illustration = getInfo.getill(y.id)
                y.suggest = "无法推分"
            }
        }

        /**
         * 所有成绩
         * @type {(LevelRecordInfo & {suggestType?: number, suggest?: string, num?: number|string, accAvg?: number})[]}
         */
        let rkslist = this.getRecord()
        /**真实 rks */
        let userrks = this.saveInfo.summary.rankingScore
        /**考虑屁股肉四舍五入原则的最小上升rks */
        let minuprks = Math.floor(userrks * 100) / 100 + 0.005 - userrks
        if (minuprks < 0) {
            minuprks += 0.01
        }

        const b19Ids = []

        /**bestN 列表 */
        let b19_list = []
        for (let i = 0; i < num && i < rkslist.length; ++i) {
            /**计算rks */
            if (i < 27) sum_rks += Number(rkslist[i].rks)
            /**是 Best 几 */
            rkslist[i].num = i + 1
            /**推分建议 */
            if (rkslist[i].acc < 100) {
                let suggest = fCompute.suggest(Number((i < 26) ? rkslist[i].rks : rkslist[26].rks) + minuprks * 30, rkslist[i].difficulty)
                if (typeof suggest != 'number' && (!phi?.[0] || (rkslist[i].rks > (phi[phi.length - 1]?.rks || 0)))) {
                    suggest = 100;
                }
                if (typeof suggest == 'number') {
                    rkslist[i].suggest = suggest.toFixed(2) + '%'
                    if (suggest < 98.5) {
                        rkslist[i].suggestType = 0
                    } else if (suggest < 99) {
                        rkslist[i].suggestType = 1
                    } else if (suggest < 99.5) {
                        rkslist[i].suggestType = 2
                    } else if (suggest < 99.7) {
                        rkslist[i].suggestType = 3
                    } else if (suggest < 99.85) {
                        rkslist[i].suggestType = 4
                    } else {
                        rkslist[i].suggestType = 5
                    }
                } else {
                    rkslist[i].suggest = "无法推分"
                }
            } else {
                rkslist[i].suggest = "无法推分"
            }
            /**曲绘 */
            rkslist[i].illustration = getInfo.getill(rkslist[i].id, 'common')
            /**b19列表 */
            b19_list.push(rkslist[i])
            b19Ids.push(rkslist[i].id)
        }

        let com_rks = sum_rks / 30

        if (Config.getUserCfg('config', 'openPhiPluginApi')) {
            const res = await makeRequest.getAllSongAccAvg({ songIds: b19Ids, minRks: Math.floor(com_rks / 0.01) * 0.01, maxRks: Math.ceil(com_rks / 0.01) * 0.01 })
            for (let i = 0; i < b19_list.length; ++i) {
                const x = b19_list[i];
                if (x.rank == 'LEGACY') continue;
                const accAvg = res[x.id][x.rank]?.accAvg
                if (accAvg != null && !isNaN(accAvg)) {
                    b19_list[i].accAvg = accAvg
                }
            }
        }

        this.B19List = { phi, b19_list }

        this.b19_rks = b19_list[Math.min(b19_list.length - 1, 26)]?.rks || 0
        return { phi, b19_list, com_rks }
    }

    /**
     * 
     * @param {number} num B几
     * @param {(recordLimit | customRecordLimit)[]} limit
     * @param {boolean} [withPhi=true] 是否包含 phi 
     */
    async getBestWithLimit(num, limit, withPhi = true) {
        let getInfo = (await import('../getInfo.js')).default
        /**计算得到的rks，仅作为测试使用 */
        let sum_rks = 0
        /**满分且 rks 最高的成绩数组 */
        let philist = this.findAccRecord(100)

        /**处理条件 */
        for (let i = 0; i < philist.length; ++i) {
            if (!checkLimit(philist[i], limit)) {
                philist.splice(i, 1)
                i--
            }
        }

        /**
         * @type {(LevelRecordInfo & {suggestType?: number, suggest?: string} | undefined)[] | undefined}
         */
        let phi = undefined;

        /**p3 */
        if (withPhi) {
            phi = philist.splice(0, Math.min(philist.length, 3))

            for (let i = 0; i < 3; ++i) {
                if (!phi[i]) {
                    phi[i] = undefined;
                    continue
                }
                const x = phi[i];
                if (x?.rks) {
                    const tem = { ...x }
                    phi[i] = tem
                    const y = phi[i];
                    if (!y) continue;
                    sum_rks += Number(y.rks) //计算rks
                    y.illustration = getInfo.getill(y.id)
                    y.suggest = "无法推分"
                }
            }
        }

        /**
         * 所有成绩
         * @type {(LevelRecordInfo & {suggestType?: number, suggest?: string, num?: number|string})[]}
         */
        let rkslist = this.getRecord()
        /**真实 rks */
        let userrks = this.saveInfo.summary.rankingScore
        /**考虑屁股肉四舍五入原则的最小上升rks */
        let minuprks = Math.floor(userrks * 100) / 100 + 0.005 - userrks
        if (minuprks < 0) {
            minuprks += 0.01
        }

        /**处理条件 */
        for (let i = 0; i < rkslist.length; ++i) {
            if (!checkLimit(rkslist[i], limit)) {
                rkslist.splice(i, 1)
                i--
            }
        }

        /**bestN 列表 */
        let b19_list = []
        for (let i = 0; i < num && i < rkslist.length; ++i) {
            const x = rkslist[i];
            if (!x?.rks) continue;
            /**计算rks */
            if (i < (withPhi ? 27 : 30)) sum_rks += Number(x.rks)
            /**是 Best 几 */
            x.num = i + 1
            /**推分建议 */
            if (x.acc < 100) {
                x.suggest = fCompute.suggest(Number((i < 26) ? x.rks : rkslist[26].rks) + minuprks * 30, x.difficulty, 2)
                if (x.suggest.includes('无') && (!phi?.[0] || (x.rks > (phi[phi.length - 1]?.rks || 0))) && x.rks < 100) {
                    x.suggest = "100.00%"
                }
            } else {
                x.suggest = "无法推分"
            }
            /**曲绘 */
            x.illustration = getInfo.getill(x.id, 'common')
            /**b19列表 */
            b19_list.push(x)
        }

        let com_rks = sum_rks / 30
        return { phi, b19_list, com_rks }

    }

    /**
     * 
     * @param {idString} id 
     * @param {number} lv 
     * @param {number} count 保留位数
     * @param {number} difficulty 
     * @returns 
     */
    getSuggest(id, lv, count, difficulty) {
        if (this.b19_rks === undefined || this.b0_rks === undefined) {
            let record = this.getRecord()
            this.b19_rks = record.length > 26 ? record[26].rks : 0
            this.b0_rks = this.findAccRecord(100, true)[0]?.rks
        }
        // console.info(this.b19_rks, this.gameRecord[id][lv]?.rks ? this.gameRecord[id][lv].rks : 0, this.gameRecord[id])
        let suggest = ''
        if (!this.gameRecord[id] || !this.gameRecord[id][lv] || !this.gameRecord[id][lv].rks) {
            suggest = fCompute.suggest(Math.max(this.b19_rks, 0) + this.minUpRks() * 30, difficulty, count)
        } else {
            suggest = fCompute.suggest(Math.max(this.b19_rks, this.gameRecord[id][lv].rks) + this.minUpRks() * 30, difficulty, count)
        }
        return suggest.includes('无') ? (difficulty > this.b0_rks + this.minUpRks() * 30 ? Number(100).toFixed(count) + '%' : suggest) : suggest
    }

    /**
     * 获取存档RKS
     * @returns {number}
     */
    getRks() {
        return Number(this.saveInfo.summary.rankingScore)
    }

    /**
     * 获取存档sessionToken
     * @returns {phigrosToken}
     */
    getSessionToken() {
        return this.session
    }

    /**
     * 获取存档成绩总览
     * @returns 
     */
    async getStats() {

        let getInfo = (await import('../getInfo.js')).default
        /**'EZ', 'HD', 'IN', 'AT' */
        let tot = [0, 0, 0, 0]

        const Record = this.gameRecord
        const Level = getInfo.allLevel

        let stats_ = {
            title: '',
            Rating: '',
            unlock: 0,
            tot: 0,
            cleared: 0,
            fc: 0,
            phi: 0,
            real_score: 0,
            tot_score: 0,
            highest: 0,
            lowest: 18,
        }

        let stats = [{ ...stats_ }, { ...stats_ }, { ...stats_ }, { ...stats_ }]

        const ids = fCompute.objectKeys(Record)
        for (let id of ids) {
            let info = getInfo.ori_info[id]
            if (!info?.chart) continue
            if (info.chart['AT'] && Number(info.chart['AT'].difficulty)) {
                ++tot[3]
            }
            if (info.chart['IN'] && Number(info.chart['IN'].difficulty)) {
                ++tot[2]
            }
            if (info.chart['HD'] && Number(info.chart['HD'].difficulty)) {
                ++tot[1]
            }
            if (info.chart['EZ'] && Number(info.chart['EZ'].difficulty)) {
                ++tot[0]
            }
        }

        stats[0].tot = tot[0]
        stats[0].title = Level[0]

        stats[1].tot = tot[1]
        stats[1].title = Level[1]

        stats[2].tot = tot[2]
        stats[2].title = Level[2]

        stats[3].tot = tot[3]
        stats[3].title = Level[3]

        for (let id of ids) {
            if (!getInfo.info(id)) {
                continue
            }
            let record = Record[id]
            for (let lv in [0, 1, 2, 3]) {
                if (!record[lv]) continue

                ++stats[lv].unlock

                if (record[lv].score >= 700000) {
                    ++stats[lv].cleared
                }
                if (record[lv].fc || record[lv].score == 1000000) {
                    ++stats[lv].fc
                }
                if (record[lv].score == 1000000) {
                    ++stats[lv].phi
                }


                stats[lv].real_score += record[lv].score
                stats[lv].tot_score += 1000000

                stats[lv].highest = Math.max(record[lv].rks, stats[lv].highest)
                stats[lv].lowest = Math.min(record[lv].rks, stats[lv].lowest)
            }
        }

        for (let lv in [0, 1, 2, 3]) {
            stats[lv].Rating = fCompute.rate(stats[lv].real_score, stats[lv].fc == stats[lv].unlock, stats[lv].tot_score)
            if (stats[lv].lowest == 18) {
                stats[lv].lowest = 0
            }
        }

        return stats
    }
}

/**
 * @typedef recordLimit
 * @property {'acc'|'score'|'rks'} type 类型
 * @property {number[]} value 数值范围或自定义函数
 */

/**
 * @typedef customRecordLimit
 * @property {'custom'} type 类型
 * @property {(record: LevelRecordInfo)=>boolean} value 数值范围或自定义函数
 */

/**
 * 
 * @param {LevelRecordInfo} record 
 * @param {(recordLimit | customRecordLimit)[]} limit 
 * @returns 
 */
function checkLimit(record, limit) {
    for (let i in limit) {
        let l = limit[i]
        switch (l.type) {
            case 'acc':
                if (record.acc < l.value[0] || record.acc > l.value[1]) return false
                break
            case 'score':
                if (record.score < l.value[0] || record.score > l.value[1]) return false
                break
            case 'rks':
                if (record.rks < l.value[0] || record.rks > l.value[1]) return false
                break
            case 'custom':
                if (!l.value(record)) return false
                break
        }
    }
    return true
}

/**
 * 检查是否非法存档
 * @param {Save} save 
 * @returns 
 */
function checkIg(save) {
    if (save.saveInfo.summary.rankingScore > MAX_DIFFICULTY) return true
    if (!save.saveInfo.summary.rankingScore && save.saveInfo.summary.rankingScore != 0) return true
    if (save.saveInfo.summary.challengeModeRank % 100 > 51) return true
    if (save.saveInfo.summary.challengeModeRank < 0) return true
    if (save.saveInfo.summary.challengeModeRank % 100 == 0 && save.saveInfo.summary.challengeModeRank != 0) return true
    if (Math.floor(save.saveInfo.summary.challengeModeRank / 100) == 0 && save.saveInfo.summary.challengeModeRank != 0) return true
    if (save.saveInfo.summary.challengeModeRank % 1 != 0) return true
    return false
}