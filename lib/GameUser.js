import ByteReader from './ByteReader.js';
import Util from './Util.js';

class GameUser {
    constructor(data) {
        this.name = "user";
        this.version = 1;
        let Reader = new ByteReader(data)
        this.showPlayerId = Util.getBit(Reader.getByte(), 0);
        this.selfIntro = Reader.getString();
        this.avatar = Reader.getString();
        this.background = Reader.getString();
    }
}

export default GameUser