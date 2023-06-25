import MapSaveModule from './SaveModule.js'

class GameKey extends MapSaveModule {
    constructor() {
        super();
        this.name = "gameKey";
        this.version = 1;
        this.lanotaReadKeys = 0;
    }

    getBytes(outputStream, entry) {
        let strBytes = entry.getKey().getBytes();
        outputStream.write(strBytes.length);
        outputStream.writeBytes(strBytes);
        let value = entry.getValue();
        let length = 0;
        let num = 1;
        for (let index = 0; index < 5; index++) {
            if (value.get(index) != 0) {
                length = Util.modifyBit(length, index, true);
                num++;
            }
        }
        outputStream.write(num);
        outputStream.write(length);
        for (let index = 0; index < 5; index++) {
            if (value.get(index) != 0) {
                outputStream.write(value.get(index));
            }
        }
    }

    putBytes(data, position) {
        let key = new String(data, position + 1, data[position]);
        position += data[position] + 2;
        let length = data[position++];
        let value = new GameKeyValue();
        for (let index = 0; index < 5; index++) {
            if (Util.getBit(length, index))
                value.set(index, data[position++]);
        }
        this.put(key, value);
    }
}
