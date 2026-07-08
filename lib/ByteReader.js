class ByteReader {
    /**
     * @param {string | Buffer | Uint8Array | ArrayBuffer} data
     * @param {number} [position]
     */
    constructor(data, position = 0) {
        this.data = typeof data === 'string'
            ? Buffer.from(data, 'hex')
            : data instanceof ArrayBuffer
                ? Buffer.from(new Uint8Array(data))
                : Buffer.from(data);
        this.position = position;
    }

    /**返回剩余的字节数 */
    remaining() {
        return this.data.length - this.position
    }

    getByte() {
        return this.data[this.position++];
    }

    /**
     * @param {number} num
     */
    putByte(num) {
        this.data[this.position++] = num;
    }

    /**
     * 
     * @returns {*} base64
     */
    getAllByte() {
        return this.data.toString('base64', this.position)
    }

    getShort() {
        this.position += 2;
        return (this.data[this.position - 1] << 8) ^ (this.data[this.position - 2] & 0xff);
    }

    /**
     * @param {number} num
     */
    putShort(num) {
        this.data[this.position++] = num & 0xff;
        this.data[this.position++] = (num >>> 8) & 0xff;
    }

    getInt() {
        this.position += 4;
        return (
            (this.data[this.position - 1] << 24) ^
            ((this.data[this.position - 2] & 0xff) << 16) ^
            ((this.data[this.position - 3] & 0xff) << 8) ^
            (this.data[this.position - 4] & 0xff)
        );
    }

    /**
     * @param {number} num
     */
    putInt(num) {
        this.data[this.position] = num & 0xff;
        this.data[this.position + 1] = (num >>> 8) & 0xff;
        this.data[this.position + 2] = (num >>> 16) & 0xff;
        this.data[this.position + 3] = (num >>> 24) & 0xff;
        this.position += 4;
    }

    getFloat() {
        this.position += 4;
        return this.data.readFloatLE(this.position - 4)
    }

    /**
     * @param {number} num
     */
    putFloat(num) {
        this.position += 4;
        this.data.writeFloatLE(num, this.position - 4)
    }

    getVarInt() {
        if (this.data[this.position] > 127) {
            this.position += 2;
            return Number(0b01111111 & this.data[this.position - 2]) ^ (this.data[this.position - 1] << 7);
        } else return this.data[this.position++];
    }

    /**
     * @param {number} [num]
     */
    skipVarInt(num) {
        if (num) {
            for (; num > 0; num--) {
                this.skipVarInt();
            }
        } else {
            if (this.data[this.position] < 0) this.position += 2;
            else this.position++;
        }
    }


    getBytes() {
        let length = this.getByte();
        this.position += length;
        return this.data.subarray(this.position - length, this.position);
    }

    getString() {
        let length = this.getVarInt();

        // console.info(length)
        this.position += length;
        // return this.data.toString('hex', this.position - length, this.position - 1)
        return this.data.toString('utf-8', this.position - length, this.position)
    }

    /**
     * @param {string} s
     */
    putString(s) {
        let b = Buffer.from(s);
        this.data[this.position++] = b.length;
        this.data.set(b, this.position);
        this.position += b.length;
    }

    skipString() {
        this.position += this.getByte() + 1;
    }

    /**
     * @param {Uint8Array} bytes
     */
    insertBytes(bytes) {
        let result = new Uint8Array(this.data.length + bytes.length);
        result.set(this.data.subarray(0, this.position), 0);
        result.set(bytes, this.position);
        result.set(this.data.subarray(this.position), this.position + bytes.length);
        this.data = Buffer.from(result);
    }

    /**
     * @param {number} length
     * @param {Uint8Array} bytes
     */
    replaceBytes(length, bytes) {
        if (bytes.length == length) {
            this.data.set(bytes, this.position);
            return;
        }
        let result = new Uint8Array(this.data.length + bytes.length - length);
        result.set(this.data.subarray(0, this.position), 0);
        result.set(bytes, this.position);
        result.set(
            this.data.subarray(this.position + length),
            this.position + bytes.length
        );
        this.data = Buffer.from(result);
    }
}

export default ByteReader
