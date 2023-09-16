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
     *  background: string
     * },
     * gameRecord: {}
     * }} data 
     */
    constructor(data) {
        this.session = data.session || undefined
        this.saveInfo = {
            createdAt: data.saveInfo.createdAt || undefined,
            gameFile: {
                createdAt: data.saveInfo.gameFile.createdAt || undefined,
                key: data.saveInfo.gameFile.key || undefined,
                objectId: data.saveInfo.gameFile.objectId || undefined,
                updatedAt: data.saveInfo.gameFile.updatedAt || undefined,
                url: data.saveInfo.gameFile.url || undefined
            },
            modifiedAt: data.saveInfo.modifiedAt || undefined,
            objectId: data.saveInfo.objectId || undefined,
            summary: {
                updatedAt: data.saveInfo.summary.updatedAt || undefined, //存档更新时间
                saveVersion: data.saveInfo.summary.saveVersion || undefined, //存档版本
                challengeModeRank: data.saveInfo.summary.challengeModeRank || undefined, //课题分
                rankingScore: data.saveInfo.summary.rankingScore || undefined, //rks
                gameVersion: data.saveInfo.summary.gameVersion || undefined, //客户端版本号
                avatar: data.saveInfo.summary.avatar || undefined, //头像
                cleared: data.saveInfo.summary.cleared || undefined, //完成曲目数量
                fullCombo: data.saveInfo.summary.fullCombo || undefined, //FC曲目数量
                phi: data.saveInfo.summary.phi || undefined //AP曲目数量
            },
            updatedAt: data.saveInfo.updatedAt || undefined,
            user: data.saveInfo.user || undefined,
            PlayerId: data.saveInfo.PlayerId || undefined
        }
        this.saveUrl = data.saveUrl || undefined
        this.Recordver = data.Recordver || undefined
        this.gameProgress = {
            isFirstRun: data.gameProgress.isFirstRun || undefined, //首次运行
            legacyChapterFinished: data.gameProgress.legacyChapterFinished || undefined, //过去的章节已完成
            alreadyShowCollectionTip: data.gameProgress.alreadyShowCollectionTip || undefined, //已展示收藏品Tip
            alreadyShowAutoUnlockINTip: data.gameProgress.alreadyShowAutoUnlockINTip || undefined, //已展示自动解锁IN Tip
            completed: data.gameProgress.completed || undefined, //剧情完成(显示全部歌曲和课题模式入口)
            songUpdateInfo: data.gameProgress.songUpdateInfo || undefined, //？？？
            challengeModeRank: data.gameProgress.challengeModeRank || undefined, //课题分
            money: data.gameProgress.money || undefined, //data货币
            unlockFlagOfSpasmodic: data.gameProgress.unlockFlagOfSpasmodic || undefined, //痉挛解锁
            unlockFlagOfIgallta: data.gameProgress.unlockFlagOfIgallta || undefined, //Igallta解锁
            unlockFlagOfRrharil: data.gameProgress.unlockFlagOfRrharil || undefined, //Rrhar'il解锁
            flagOfSongRecordKey: data.gameProgress.flagOfSongRecordKey || undefined, //IN达到S(倒霉蛋,船,Shadow,心之所向,inferior,DESTRUCTION 3,2,1,Distorted Fate)
            randomVersionUnlocked: data.gameProgress.randomVersionUnlocked || undefined, //Random切片解锁
            chapter8UnlockBegin: data.gameProgress.chapter8UnlockBegin || undefined, //第八章入场
            chapter8UnlockSecondPhase: data.gameProgress.chapter8UnlockSecondPhase || undefined, //第八章第二阶段
            chapter8Passed: data.gameProgress.chapter8Passed || undefined, //第八章通过
            chapter8SongUnlocked: data.gameProgress.chapter8SongUnlocked || undefined //第八章各曲目解锁

        }
        this.gameuser = {
            name: data.gameuser.name || undefined,
            version: data.gameuser.version || undefined,
            showPlayerId: data.gameuser.showPlayerId || undefined,
            selfIntro: data.gameuser.selfIntro || undefined,
            avatar: data.gameuser.avatar || undefined,
            background: data.gameuser.background || undefined
        }
        this.gameRecord = {}
        for (var id in data.gameRecord) {
            this.gameRecord[id] = []
            for (var i in data.gameRecord[id]) {
                var level = Number(i)
                if(!data.gameRecord[id][level]) {
                    this.gameRecord[id][level] = null
                    continue
                }
                this.gameRecord[id][level] = new LevelRecordInfo(data.gameRecord[id][level], id, level)
                
            }
        }
    }
}