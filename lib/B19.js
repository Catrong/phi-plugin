import ByteReader from "./ByteReader.js";
import PhigrosUser from "./PhigrosUser.js";


class B19 {
    constructor(data) {
        this.data = data;
        this.reader = new ByteReader(data);
        class B19Iterator {
            constructor(b19) {
                this.b19 = b19;
                this.position = b19.data[0] < 0 ? 2 : 1;
            }
        
            next() {
                if (this.position != this.b19.data.length) {
                    let length = this.b19.data[this.position++];
                    let id = new String(this.b19.data, this.position, length - 2);
                    this.position += length;
                    length = this.b19.data[this.position++];
                    this.b19.reader.position = this.position;
                    this.position += length;
                    return { value: id, done: false };
                } else {
                    return { value: undefined, done: true };
                }
            }
        }
        
    }

    [Symbol.iterator]() {
        let index = 0;
        let length = this.data.length;
        let reader = this.reader;
        return {
            next() {
                if (index < length) {
                    let id = reader.getString();
                    index += id.length + 1;
                    return { value: id, done: false };
                } else {
                    return { value: undefined, done: true };
                }
            }
        };
    }

    getB19(num) {
        let minIndex = 1;
        let b19 = new Array(num + 1);
        b19.fill(new SongLevel());
        for (let id of this) {
            let levels = PhigrosUser.getInfo(id);
            let level = levels.length - 1;
            for (; level >= 0; level--) {
                if (levels[level] <= b19[minIndex].rks && levels[level] <= b19[0].rks)
                    break;
            }
            if (++level == levels.length)
                continue;
            this.length = this.reader.getByte();
            this.fc = this.reader.getByte();
            this.go(level);
            for (; level < levels.length; level++) {
                if (this.levelNotExist(level))
                    continue;
                let songLevel = new SongLevel();
                songLevel.s = this.reader.getInt();
                songLevel.a = this.reader.getFloat();
                if (songLevel.a < 70)
                    continue;
                if (songLevel.s == 1000000) {
                    songLevel.rks = levels[level];
                    if (levels[level] > b19[0].rks) {
                        songLevel.set(id, Level.values()[level], this.getFC(level), levels[level]);
                        b19[0] = songLevel;
                    }
                } else {
                    songLevel.rks = (songLevel.a - 55) / 45;
                    songLevel.rks *= songLevel.rks * levels[level];
                }
                if (songLevel.rks < b19[minIndex].rks)
                    continue;
                songLevel.set(id, Level.values()[level], this.getFC(level), levels[level]);
                b19[minIndex] = songLevel;
                minIndex = min(b19);
            }
        }
        for (minIndex = 1; minIndex < 20; minIndex++) {
            if (b19[minIndex].id == null)
                break;
        }
        b19.sort((a, b) => a.rks - b.rks);
        return b19;
    }

    getExpect(id) {
        for (let songId of this) {
            if (!songId.equals(id))
                continue;
            let minRks = this.getMinRks();
            let levels = PhigrosUser.getInfo(id);
            this.length = this.reader.getByte();
            this.reader.position++;
            let list = [];
            for (let level = 0; level < levels.length; level++) {
                if (this.levelNotExist(level))
                    continue;
                if (levels[level] <= minRks)
                    continue;
                let score = this.reader.getInt();
                if (score == 1000000)
                    continue;
                let acc = this.reader.getFloat();
                let expect = Math.sqrt(minRks / levels[level]) * 45 + 55;
                if (expect > acc)
                    list.push(new SongExpect(id, Level.values()[level], acc, expect));
            }
            return list;
        }
        throw new RuntimeException("不存在该id的曲目。");
    }

    getExpects() {
        let minRks = this.getMinRks();
        let list = [];
        for (let id of this) {
            let levels = PhigrosUser.getInfo(id);
            let level = levels.length - 1;
            for (; level >= 0; level--) {
                if (levels[level] <= minRks)
                    break;
            }
            if (++level == levels.length)
                continue;
            this.length = this.reader.getByte();
            this.reader.position++;
            this.go(level);
            for (; level < levels.length; level++) {
                if (this.levelNotExist(level))
                    continue;
                let score = this.reader.getInt();
                if (score == 1000000) {
                    this.reader.position += 4;
                    continue;
                }
                let acc = this.reader.getFloat();
                let expect = Math.sqrt(minRks / levels[level]) * 45 + 55;
                if (expect > acc)
                    list.push(new SongExpect(id, Level.values()[level], acc, expect));
            }
        }
        let array = list.sort((a, b) => a.rks - b.rks);
        return array;
    }

    getMinRks() {
        let minIndex = 0;
        let b19 = new Array(19);
        b19.fill(0);
        for (let id of this) {
            let levels = PhigrosUser.getInfo(id);
            let level = levels.length - 1;
            for (; level >= 0; level--) {
                if (levels[level] <= b19[minIndex])
                    break;
            }
            if (++level == levels.length)
                continue;
            this.length = this.reader.getByte();
            this.fc = this.reader.getByte();
            this.go(level);
            for (; level < levels.length; level++) {
                if (this.levelNotExist(level))
                    continue;
                let score = this.reader.getInt();
                let acc = this.reader.getFloat();
                if (acc < 70)
                    continue;
                let rks;
                if (score == 1000000)
                    rks = levels[level];
                else {
                    rks = (acc - 55) / 45;
                    rks *= rks * levels[level];
                }
                if (rks <= b19[minIndex])
                    continue;
                b19[minIndex] = rks;
                minIndex = min(b19);
            }
        }
        return b19[minIndex];
    }

    min(array) {
        let index = -1;
        let min = Infinity;
        for (let i = 1; i < array.length; i++) {
            if (array[i].id == null)
                return i;
            if (array[i].rks < min) {
                index = i;
                min = array[i].rks;
            }
        }
        return index;
    }


    min(array) {
        let index = -1;
        let min = 17;
        for (let i = 0; i < 19; i++) {
            if (array[i] == 0)
                return i;
            if (array[i] < min) {
                index = i;
                min = array[i];
            }
        }
        return index;
    }

    go(index) {
        for (let i = 0; i < index; i++) {
            if (Util.getBit(this.length, i))
                this.reader.position += 8;
        }
    }

    levelNotExist(level) {
        return !Util.getBit(this.length, level);
    }


    getFC(index) {
        return Util.getBit(this.fc, index);
    }

    [Symbol.iterator]() {
        return new B19Iterator(this);
    }
}


export default B19