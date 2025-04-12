import { MAX_DIFFICULTY } from '../constNum.js'
import fCompute from '../fCompute.js'
import getRksRank from '../getRksRank.js'

export default class Save {

    /**
     * @param {{
     * session:string,
     * saveInfo: {
     *  createdAt: string,
     *  gameFile: {
     *      __type: 'File',
     *      bucket: string,
     *      createdAt: string,
     *      key: string,
     *      metaData: object,
     *      mime_type: 'application/octet-stream',
     *      name: '.save',
     *      objectId: string,
     *      provider: string,
     *      updatedAt: string,
     *      url: string
     *  },
     *  modifiedAt: {"__type": "Date","iso": Date},
     *  name: 'save',
     *  objectId: string,
     *  summary: {
     *      updatedAt: string,
     *      saveVersion: number,
     *      challengeModeRank: number,
     *      rankingScore: number,
     *      gameVersion: number,
     *      avatar: string,
     *      cleared: [number, number, number, number],
     *      fullCombo: [number, number, number, number],
     *      phi: [number, number, number, number]
     *  },
     *  ACL: { '*': Object },
     *  authData: { taptap: Object },
     *  avatar: string,
     *  emailVerified: boolean,
     *  mobilePhoneVerified: boolean,
     *  nickname: string,
     *  sessionToken: string,
     *  shortId: string,
     *  username: string,
     *  updatedAt: string,
     *  user: {__type: "Pointer",className: "_User",objectId: string},
     *  PlayerId: string
     * },
     * saveUrl: string,
     * Recordver: number,
     * gameProgress: {
     *  isFirstRun: boolean,
     *  legacyChapterFinished: boolean,
     *  alreadyShowCollectionTip: boolean,
     *  alreadyShowAutoUnlockINTip: boolean,
     *  completed: string,
     *  songUpdateInfo: number,
     *  challengeModeRank: number,
     *  money: [number, number, number, number, number],
     *  unlockFlagOfSpasmodic: number,
     *  unlockFlagOfIgallta: number,
     *  unlockFlagOfRrharil: number,
     *  flagOfSongRecordKey: number,
     *  randomVersionUnlocked: number,
     *  chapter8UnlockBegin: boolean,
     *  chapter8UnlockSecondPhase: boolean,
     *  chapter8Passed: boolean,
     *  chapter8SongUnlocked: number
     * },
     * gameuser: {
     *  name: string,
     *  version: string,
     *  showPlayerId: boolean,
     *  selfIntro: string,
     *  avatar: string,
     *  background: string,
     *  CLGMOD: string,
     * },
     * gameRecord: {}
     * }} data 
     * @param {boolean} ignore 跳过存档检查
     */
    constructor(data, ignore = false) {
        this.session = data.session
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
        } : null
        this.gameuser = data.gameuser ? {
            /**user */
            name: data.gameuser.name,
            /**版本 */
            version: data.gameuser.version,
            /**是否展示Id */
            showPlayerId: data.gameuser.showPlayerId,
            /**简介 */
            selfIntro: data.gameuser.selfIntro,
            /**头像 */
            avatar: data.gameuser.avatar,
            /**背景 */
            background: data.gameuser.background,
        } : null
        if (checkIg(this)) {
            getRksRank.delUserRks(this.session)
            logger.error(`封禁tk ${this.session}`)
            throw new Error(`您的存档rks异常，该 token 已禁用，如有异议请联系机器人管理员。\n${this.session}`)
        }
        this.gameRecord = {}
        for (let id in data.gameRecord) {
            this.gameRecord[id] = []
            for (let i in data.gameRecord[id]) {
                let level = Number(i)
                if (!data.gameRecord[id][level]) {
                    this.gameRecord[id][level] = null
                    continue
                }
                // this.gameRecord[id][level] = new (import('./LevelRecordInfo')).default(data.gameRecord[id][level], id, level)
                this.gameRecord[id][level] = {
                    id: id,
                    level: level,
                    fc: data.gameRecord[id][level].fc,
                    score: data.gameRecord[id][level].score,
                    acc: data.gameRecord[id][level].acc
                }
                if (ignore) continue
                if (data.gameRecord[id][level].acc > 100 || data.gameRecord[id][level].acc < 0) {
                    logger.error(`acc > 100 封禁tk ${this.session}`)
                    getRksRank.delUserRks(this.session)
                    throw new Error(`您的存档 acc 异常，该 token 已禁用，如有异议请联系机器人管理员。\n${this.session}`)
                }
                if (data.gameRecord[id][level].score > 1000000 || data.gameRecord[id][level].score < 0) {
                    logger.error(`score > 1000000 封禁tk ${this.session}`)
                    getRksRank.delUserRks(this.session)
                    throw new Error(`您的存档 score 异常，该 token 已禁用，如有异议请联系机器人管理员。\n${this.session}`)
                }
            }
        }
    }

    async init() {
        let LevelRecordInfo = (await import('./LevelRecordInfo.js')).default
        for (let id in this.gameRecord) {
            for (let i in this.gameRecord[id]) {
                let level = Number(i)
                if (!this.gameRecord[id][level]) {
                    continue
                }
                this.gameRecord[id][level] = new LevelRecordInfo(this.gameRecord[id][level], this.gameRecord[id][level].id, this.gameRecord[id][level].level)
            }
        }

    }

    /**
     * 获取存档
     * @returns 按照 rks 排序的数组
     */
    getRecord() {
        if (this.sortedRecord) {
            return this.sortedRecord
        }
        let sortedRecord = []
        for (let song in this.gameRecord) {
            for (let level in this.gameRecord[song]) {
                if (level == 4) break
                let tem = this.gameRecord[song][level]
                if (!tem?.score) continue
                sortedRecord.push(tem)
            }
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
        let record = []
        for (let song in this.gameRecord) {
            for (let level in this.gameRecord[song]) {
                /**LEGACY */
                if (level == 4) break
                let tem = this.gameRecord[song][level]
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
        const Level = ['EZ', 'HD', 'IN', 'AT', 'LEGACY']
        for (let i in this.gameRecord) {
            for (let j in this.gameRecord[i]) {
                let score = this.gameRecord[i][j]
                if (score.acc > 100 || score.acc < 0 || score.score > 1000000 || score.score < 0) {
                    error += `\n${i} ${Level[j]} ${score.fc} ${score.acc} ${score.score} 非法的成绩`
                }
                // if (!score.fc && (score.score >= 1000000 || score.acc >= 100)) {
                //     error += `\n${i} ${Level[j]} ${score.fc} ${score.acc} ${score.score} 不符合预期的值`
                // }
                if ((score.score >= 1000000 && score.acc < 100) || (score.score < 1000000 && score.acc >= 100)) {
                    error += `\n${i} ${Level[j]} ${score.fc} ${score.acc} ${score.score} 成绩不自洽`
                }
            }
        }
        return error
    }

    /**
     * 
     * @param {string} id 曲目id
     * @returns {{LevelRecordInfo}}
     */
    getSongsRecord(id) {
        return { ...this.gameRecord[id] }
    }

    /**
     * 
     * @param {number} num B几
     * @returns phi, b19_list
     */
    async getB19(num) {

        if (this.B19List) {
            return this.B19List
        }
        let getInfo = (await import('../getInfo.js')).default
        /**计算得到的rks，仅作为测试使用 */
        let sum_rks = 0
        /**满分且 rks 最高的成绩数组 */
        let philist = this.findAccRecord(100)
        /**p3 */
        let phi = philist.splice(0, Math.min(philist.length, 3))


        // console.info(phi)
        /**处理数据 */

        for (let i = 0; i < 3; ++i) {
            if (!phi[i]) {
                phi[i] = false
                continue
            }
            if (phi[i]?.rks) {
                let tem = {}
                Object.assign(tem, phi[i])
                phi[i] = tem
                sum_rks += Number(phi[i].rks) //计算rks
                phi[i].illustration = getInfo.getill(phi[i].song)
                phi[i].suggest = "无法推分"
            }
        }

        /**所有成绩 */
        let rkslist = this.getRecord()
        /**真实 rks */
        let userrks = this.saveInfo.summary.rankingScore
        /**考虑屁股肉四舍五入原则的最小上升rks */
        let minuprks = Math.floor(userrks * 100) / 100 + 0.005 - userrks
        if (minuprks < 0) {
            minuprks += 0.01
        }

        /**bestN 列表 */
        let b19_list = []
        for (let i = 0; i < num && i < rkslist.length; ++i) {
            /**计算rks */
            if (i < 27) sum_rks += Number(rkslist[i].rks)
            /**是 Best 几 */
            rkslist[i].num = i + 1
            /**推分建议 */
            if (rkslist[i].rks < 100) {
                rkslist[i].suggest = fCompute.suggest(Number((i < 26) ? rkslist[i].rks : rkslist[26].rks) + minuprks * 30, rkslist[i].difficulty, 2)
                if (rkslist[i].suggest.includes('无') && (!phi?.[0] || (rkslist[i].rks > phi[phi.length - 1].rks)) && rkslist[i].rks < 100) {
                    rkslist[i].suggest = "100.00%"
                }
            } else {
                rkslist[i].suggest = "无法推分"
            }
            /**曲绘 */
            rkslist[i].illustration = getInfo.getill(rkslist[i].song, 'common')
            /**b19列表 */
            b19_list.push(rkslist[i])
        }

        let com_rks = sum_rks / 30

        this.B19List = { phi, b19_list }

        this.b19_rks = b19_list[Math.min(b19_list.length - 1, 26)].rks
        return { phi, b19_list, com_rks }
    }

    /**
     * 
     * @param {[{type: string,value: any}]} limit 
     */
    async getBestWithLimit(num, limit) {
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


        /**p3 */
        let phi = philist.splice(0, Math.min(philist.length, 3))


        // console.info(phi)
        /**处理数据 */

        for (let i = 0; i < 3; ++i) {
            if (!phi[i]) {
                phi[i] = false
                continue
            }
            if (phi[i]?.rks) {
                let tem = {}
                Object.assign(tem, phi[i])
                phi[i] = tem
                sum_rks += Number(phi[i].rks) //计算rks
                phi[i].illustration = getInfo.getill(phi[i].song)
                phi[i].suggest = "无法推分"
            }
        }

        /**所有成绩 */
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
            /**计算rks */
            if (i < 27) sum_rks += Number(rkslist[i].rks)
            /**是 Best 几 */
            rkslist[i].num = i + 1
            /**推分建议 */
            if (rkslist[i].rks < 100) {
                rkslist[i].suggest = fCompute.suggest(Number((i < 26) ? rkslist[i].rks : rkslist[26].rks) + minuprks * 30, rkslist[i].difficulty, 2)
                if (rkslist[i].suggest.includes('无') && (!phi?.[0] || (rkslist[i].rks > phi[phi.length - 1].rks)) && rkslist[i].rks < 100) {
                    rkslist[i].suggest = "100.00%"
                }
            } else {
                rkslist[i].suggest = "无法推分"
            }
            /**曲绘 */
            rkslist[i].illustration = getInfo.getill(rkslist[i].song, 'common')
            /**b19列表 */
            b19_list.push(rkslist[i])
        }

        let com_rks = sum_rks / 30
        return { phi, b19_list, com_rks }

    }

    /**
     * 
     * @param {string} id 
     * @param {number} lv 
     * @param {number} count 保留位数
     * @param {number} difficulty 
     * @returns 
     */
    getSuggest(id, lv, count, difficulty) {
        if (!this.b19_rks) {
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
     * @returns {SaveInfo}
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

        let Record = this.gameRecord
        let Level = getInfo.Level

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

        for (let song in getInfo.ori_info) {
            let info = getInfo.ori_info[song]
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

        for (let id in Record) {
            if (!getInfo.idgetsong(id)) {
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
            stats[lv].Rating = fCompute.rate(stats[lv].real_score, stats[lv].tot_score, stats[lv].fc == stats[lv].unlock)
            if (stats[lv].lowest == 18) {
                stats[lv].lowest = 0
            }
        }

        return stats
    }
}


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
        }
    }
    return true
}

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