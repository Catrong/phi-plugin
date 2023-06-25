

class SaveModule {
    static loadFromBinary(data) {
        try {
            let index = 0;
            let position = 0;
            for (let field of this.getClass().getFields()) {
                if (field.getType() == boolean.class) {
                    field.setBoolean(this, Util.getBit(data[position], index++));
                    continue;
                }
                if (index != 0) {
                    index = 0;
                    position++;
                }
                // Assuming field is an object with methods like getType, set, setFloat, etc.
                // Assuming data is a buffer or an array of bytes
                // Assuming getShort, getInt, getVarShort are functions defined elsewhere
                if (field.getType() === String) {
                    let length = data[position++];
                    field.set(this, new TextDecoder().decode(data.slice(position, position + length)));
                    position += length;
                } else if (field.getType() === Number) {
                    field.setFloat(this, new DataView(data).getFloat32(position));
                    position += 4;
                } else if (field.getType() === Int16Array) {
                    field.setShort(this, getShort(data, position));
                    position += 2;
                } else if (field.getType() === Array) {
                    let array = field.get(this);
                    for (let i = 0; i < array.length; i++) {
                        array[i] = getVarShort(data, position);
                        position += data[position] >= 0 ? 1 : 2;
                    }
                } else if (field.getType() === Int8Array) {
                    field.setByte(this, data[position++]);
                } else {
                    throw new Error("出现新类型。");
                }

            }
        } catch (e) {
            throw new Error(e);
        }
    }
    // Assuming this is a method of a class
    // Assuming field is an object with methods like getType, getBoolean, getFloat, etc.
    // Assuming int2bytes, short2bytes, varShort2bytes are functions defined elsewhere
    static serialize() {
        let outputStream = [];
        let b = 0;
        let index = 0;
        for (let field of this.constructor().getFields()) {
            if (field.getType() === Boolean) {
                b = Util.modifyBit(b, index++, field.getBoolean(this));
                continue;
            }
            if (b !== 0 && index !== 0) {
                outputStream.push(b);
                b = index = 0;
            }
            if (field.getType() === String) {
                let bytes = new TextEncoder().encode(field.get(this));
                outputStream.push(bytes.length);
                outputStream.push(...bytes);
            } else if (field.getType() === Number) {
                outputStream.push(...int2bytes(new DataView(data).getFloat32(field.getFloat(this))));
            } else if (field.getType() === Int16Array) {
                outputStream.push(...short2bytes(field.getShort(this)));
            } else if (field.getType() === Array) {
                for (let h of field.get(this)) {
                    outputStream.push(...varShort2bytes(h));
                }
            } else if (field.getType() === Int8Array) {
                outputStream.push(field.getByte(this));
            } else {
                throw new Error("出现新类型。");
            }
        }
        return new Uint8Array(outputStream);
    }


    static getInt(data, position) {
        return data[position + 3] << 24 ^ (data[position + 2] & 0xff) << 16 ^ (data[position + 1] & 0xff) << 8 ^ (data[position] & 0xff);
    }

    static int2bytes(num) {
        let bytes = new Array(4);
        bytes[0] = num & 0xff;
        bytes[1] = num >>> 8 & 0xff;
        bytes[2] = num >>> 16 & 0xff;
        bytes[3] = num >>> 24;
        return bytes;
    }

    static getShort(data, position) {
        return (data[position + 1] & 0xff) << 8 ^ (data[position] & 0xff);
    }

    static short2bytes(num) {
        let bytes = new Array(2);
        bytes[0] = num & 0xff;
        bytes[1] = num >>> 8;
        return bytes;
    }

    static getVarShort (data, position) {
        if (data[position] >= 0)
            return data[position];
        else
            return data[position + 1] << 7 ^ data[position] & 0x7f;
    }

    static varShort2bytes(num) {
        if (num < 128)
            return [num];
        else
            return [num & 0x7f | 0b10000000, num >>> 7];
    }
}

class MapSaveModule extends Map {
    constructor() {
        super();
    }

    loadFromBinary(data) {
        this.clear()
        let length = SaveModule.getVarShort(data, 0);
        let position = data[0] < 0 ? 2 : 1;
        let keyLength;
        for (; length > 0; length--) {
            this.putBytes(data, position);
            keyLength = data[position];
            position += keyLength + data[position + keyLength + 1] + 2;
        }
        if (this instanceof GameKey)
            this.lanotaReadKeys = data[position];
    }

    serialize() {
        let outputStream = [];
        outputStream.push(SaveModule.varShort2bytes(size()));
        for (let entry of this.entrySet())
            this.getBytes(outputStream, entry);
        if (this instanceof GameKey)
            outputStream.push(this.lanotaReadKeys);
        return new Uint8Array(outputStream);
    }
}

export {MapSaveModule, SaveModule}