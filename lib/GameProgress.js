import ByteReader from './ByteReader.js';
import Util from './Util.js'

class GameProgress {
    constructor(data) {
        let Reader = new ByteReader(data)
        let tem = Reader.getByte()
        this.isFirstRun = Util.getBit(tem, 0)
        this.legacyChapterFinished = Util.getBit(tem, 1)
        this.alreadyShowCollectionTip = Util.getBit(tem, 2)
        this.alreadyShowAutoUnlockINTip = Util.getBit(tem, 3)
        this.completed = Reader.getString()
        this.songUpdateInfo = Reader.getVarInt()
        this.challengeModeRank = Reader.getShort()
        this.money = [0, 0, 0, 0, 0];
        this.money[0] = Reader.getVarInt()
        this.money[1] = Reader.getVarInt()
        this.money[2] = Reader.getVarInt()
        this.money[3] = Reader.getVarInt()
        this.money[4] = Reader.getVarInt()
        this.unlockFlagOfSpasmodic = Reader.getByte()
        this.unlockFlagOfIgallta = Reader.getByte()
        this.unlockFlagOfRrharil = Reader.getByte()
        this.flagOfSongRecordKey = Reader.getByte()
        this.randomVersionUnlocked = Reader.getByte()
        tem = Reader.getByte()
        this.chapter8UnlockBegin = Util.getBit(tem, 0)
        this.chapter8UnlockSecondPhase = Util.getBit(tem, 1)
        this.chapter8Passed = Util.getBit(tem, 2)
        this.chapter8SongUnlocked = Reader.getByte()
    }
}

export default GameProgress