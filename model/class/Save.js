
export default class Save {

    /**
     * @param {{
     * session:string,
     * saveInfo: {
     *  createdAt: string,
     *  gameFile: {
     *      createdAt: string,
     *      key: string,
     *      objectId: string,
     *      updatedAt: string,
     *      url: string
     *  },
     *  modifiedAt: {"__type": "Date","iso": Date},
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
     */
    constructor(data) {
        this.session = data.session
        this.saveInfo = {
            /**账户创建时间 2022-09-03T10:21:48.613Z */
            createdAt: data.saveInfo.createdAt,
            gameFile: {
                /**存档创建时间 2023-10-05T07:41:24.503Z */
                createdAt: data.saveInfo.gameFile.createdAt,
                /**gamesaves/{32}/.save */
                key: data.saveInfo.gameFile.key,
                /**存档id {24} */
                objectId: data.saveInfo.gameFile.objectId,
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
                rankingScore: data.saveInfo.summary.rankingScore,
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
            name: data.gameuser.name,
            version: data.gameuser.version,
            showPlayerId: data.gameuser.showPlayerId,
            selfIntro: data.gameuser.selfIntro,
            avatar: data.gameuser.avatar,
            background: data.gameuser.background,
        } : null
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
            for (let level in song) {
                if (level == 4) break
                let tem = this.gameRecord[song][level]
                if (!tem) continue
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
            for (let level in song) {
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
        return minuprks < 0 ? minuprks += 0.01 : minuprks
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
}
