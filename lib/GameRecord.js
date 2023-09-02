import LevelRecord from './LevelRecord.js'
import ByteReader from './ByteReader.js';
import Util from './Util.js'
import get from '../model/getdata.js'

var Level = ['EZ', 'HD', 'IN', 'AT', null] //存档的难度映射

class GameRecord {
    static name = "gameRecord";
    static version = 1;

    /**
     * @param {*} String data
     */
    constructor(data) {
        this.name = "gameRecord";
        this.version = 1;
        this.pluginver = 1.0
        this.data = new ByteReader(data)
        this.Record = {}
        this.songsnum = 0
    }

    async init() {
        this.songsnum = this.data.getVarInt()
        while (this.data.remaining()) {
            var key = this.data.getString()
            // var levelRecords = this.data.getString()
            this.data.skipVarInt()
            let length = this.data.getByte();
            let fc = this.data.getByte();
            let song = [];
            var info = get.idgetsong(key)

            if (!info)
                throw new Error(`未找到${key}的曲目资料`)



            for (let level = 0; level < 5; level++) {
                if (Util.getBit(length, level)) {
                    song[level] = new LevelRecord();
                    song[level].fc = Util.getBit(fc, level);
                    song[level].score = this.data.getInt();
                    song[level].acc = this.data.getFloat();
                    if (level == 4) continue
                    song[level].rank = Level[level] //AT IN HD EZ
                    song[level].difficulty = Number(info["chart"][Level[level]]["difficulty"]) //难度
                    song[level].illustration = info["illustration_big"] //曲绘链接
                    song[level].rks = get.getrks(song[level].acc, song[level].difficulty) //等效rks
                    song[level].song = info.song //曲名
                    song[level].Rating = this.Rating(song[level].score, song[level].fc)
                }
            }
            this.Record[key] = song
        }
    }

    Rating(score, fc) {
        if (score >= 1000000)
            return 'phi'
        else if (fc)
            return 'FC'
        else if (score < 700000)
            return 'F'
        else if (score < 820000)
            return 'C'
        else if (score < 880000)
            return 'B'
        else if (score < 920000)
            return 'A'
        else if (score < 960000)
            return 'S'
        else
            return 'V'
    }
}


export default GameRecord
