import LevelRecordInfo from "./LevelRecordInfo.js"

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
     *  modifiedAt: string,
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
     *  user: string,
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
            createdAt: data.saveInfo.createdAt,
            gameFile: {
                createdAt: data.saveInfo.gameFile.createdAt,
                key: data.saveInfo.gameFile.key,
                objectId: data.saveInfo.gameFile.objectId,
                updatedAt: data.saveInfo.gameFile.updatedAt,
                url: data.saveInfo.gameFile.url
            },
            modifiedAt: data.saveInfo.modifiedAt,
            objectId: data.saveInfo.objectId,
            summary: {
                updatedAt: data.saveInfo.summary.updatedAt, //存档更新时间
                saveVersion: data.saveInfo.summary.saveVersion, //存档版本
                challengeModeRank: data.saveInfo.summary.challengeModeRank, //课题分
                rankingScore: data.saveInfo.summary.rankingScore, //rks
                gameVersion: data.saveInfo.summary.gameVersion, //客户端版本号
                avatar: data.saveInfo.summary.avatar, //头像
                cleared: data.saveInfo.summary.cleared, //完成曲目数量
                fullCombo: data.saveInfo.summary.fullCombo, //FC曲目数量
                phi: data.saveInfo.summary.phi //AP曲目数量
            },
            updatedAt: data.saveInfo.updatedAt,
            user: data.saveInfo.user,
            PlayerId: data.saveInfo.PlayerId
        }
        this.saveUrl = data.saveUrl
        this.Recordver = data.Recordver
        this.gameProgress = null
        if (data.gameProgress) {
            this.gameProgress = {
                isFirstRun: data.gameProgress.isFirstRun, //首次运行
                legacyChapterFinished: data.gameProgress.legacyChapterFinished, //过去的章节已完成
                alreadyShowCollectionTip: data.gameProgress.alreadyShowCollectionTip, //已展示收藏品Tip
                alreadyShowAutoUnlockINTip: data.gameProgress.alreadyShowAutoUnlockINTip, //已展示自动解锁IN Tip
                completed: data.gameProgress.completed, //剧情完成(显示全部歌曲和课题模式入口)
                songUpdateInfo: data.gameProgress.songUpdateInfo, //？？？
                challengeModeRank: data.gameProgress.challengeModeRank, //课题分
                money: data.gameProgress.money, //data货币
                unlockFlagOfSpasmodic: data.gameProgress.unlockFlagOfSpasmodic, //痉挛解锁
                unlockFlagOfIgallta: data.gameProgress.unlockFlagOfIgallta, //Igallta解锁
                unlockFlagOfRrharil: data.gameProgress.unlockFlagOfRrharil, //Rrhar'il解锁
                flagOfSongRecordKey: data.gameProgress.flagOfSongRecordKey, //IN达到S(倒霉蛋,船,Shadow,心之所向,inferior,DESTRUCTION 3,2,1,Distorted Fate)
                randomVersionUnlocked: data.gameProgress.randomVersionUnlocked, //Random切片解锁
                chapter8UnlockBegin: data.gameProgress.chapter8UnlockBegin, //第八章入场
                chapter8UnlockSecondPhase: data.gameProgress.chapter8UnlockSecondPhase, //第八章第二阶段
                chapter8Passed: data.gameProgress.chapter8Passed, //第八章通过
                chapter8SongUnlocked: data.gameProgress.chapter8SongUnlocked //第八章各曲目解锁
            }
        }
        this.gameuser = null
        if (data.gameuser) {
            this.gameuser = {
                name: data.gameuser.name,
                version: data.gameuser.version,
                showPlayerId: data.gameuser.showPlayerId,
                selfIntro: data.gameuser.selfIntro,
                avatar: data.gameuser.avatar,
                background: data.gameuser.background,
            }
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
                this.gameRecord[id][level] = new LevelRecordInfo(data.gameRecord[id][level], id, level)
            }
        }
    }

    /**
     * 将存档排序
     * @param {boolean} isSort 是否排序
     * @returns 
     */
    sortRecord(isSort = true) {
        if (this.sortedRecord) {
            return this.sortedRecord
        }
        const sortedRecord = []
        for (let song in this.gameRecord) {
            for (let level in song) {
                if (level == 4) break
                let tem = this.gameRecord[song][level]
                if (!tem) continue
                sortedRecord.push(tem)
            }
        }
        if (!isSort) return sortedRecord

        sortedRecord.sort((a, b) => { return b.rks - a.rks })
        this.sortedRecord = sortedRecord
        return sortedRecord
    }

    /**
     * 筛选满足ACC条件的成绩
     * @param {Function} reg >=reg
     * @returns 按照rks排序的数组
     */
    findRegRecord(reg) {
        let record = []
        for (let song in this.gameRecord) {
            for (let level in song) {
                if (level == 4) break
                let tem = this.gameRecord[song][level]
                if (!tem) continue
                if (tem.acc >= reg) {
                    record.push(tem)
                }
            }
        }
        record.sort((a, b) => { return b.rks - a.rks })
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
