import LevelRecord from './LevelRecord.js'
import ByteReader from './ByteReader.js';
import Util from './Util.js'
import get from '../model/getdata.js'


class GameRecord {
    static name = "gameRecord";
    static version = 1;

    /**
     * @param {*} String data
     */
    constructor(data) {
        this.name = "gameRecord";
        this.version = 1;
        this.data = new ByteReader(data)
        this.Record = {}
        this.songsnum = 0
    }

    /**
     * 
     * @param {Array} err 错误消息
     */
    async init(err) {
        this.songsnum = this.data.getVarInt()
        while (this.data.remaining() > 0) {
            var key = this.data.getString()
            this.data.skipVarInt()
            let length = this.data.getByte();
            let fc = this.data.getByte();
            let song = [];


            for (let level = 0; level < 5; level++) {
                if (Util.getBit(length, level)) {
                    song[level] = new LevelRecord();
                    song[level].fc = Util.getBit(fc, level);
                    song[level].score = this.data.getInt();
                    song[level].acc = this.data.getFloat();
                }
            }
            if (!get.idgetsong(key)) {
                err.push(key)
            }
            this.Record[key] = song
        }
    }
}


export default GameRecord
