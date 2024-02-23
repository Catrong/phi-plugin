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
            let key = this.data.getString()
            this.data.skipVarInt()
            let length = this.data.getByte();
            let fc = this.data.getByte();
            let song = [];


            for (let level = 0; level < 5; level++) {
                if (Util.getBit(length, level)) {
                    song[level] = new LevelRecord();
                    song[level].score = this.data.getInt();
                    song[level].acc = this.data.getFloat();
                    song[level].fc = (song[level].score == 1000000 && song[level].acc == 100) ? true : Util.getBit(fc, level);

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
