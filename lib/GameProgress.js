class GameProgress {
    constructor() {
        this.isFirstRun = false;
        this.legacyChapterFinished = false;
        this.alreadyShowCollectionTip = false;
        this.alreadyShowAutoUnlockINTip = false;
        this.completed = "";
        this.songUpdateInfo = 0;
        this.challengeModeRank = 0;
        this.money = [0, 0, 0, 0, 0];
        this.unlockFlagOfSpasmodic = 0;
        this.unlockFlagOfIgallta = 0;
        this.unlockFlagOfRrharil = 0;
        this.flagOfSongRecordKey = 0;
        this.randomVersionUnlocked = 0;
        this.chapter8UnlockBegin = false;
        this.chapter8UnlockSecondPhase = false;
        this.chapter8Passed = false;
        this.chapter8SongUnlocked = 0;
    }
}
