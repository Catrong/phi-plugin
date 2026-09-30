

class Base64 {
    /**
     * @param {string} data
     */
    decode(data) {
        let result = Buffer.from(data,'base64');
        return result.toString('hex');
    }

    /**
     * @param {string} data
     */
    encode(data) {
        let result = Buffer.from(data,'hex');
        return result.toString('base64');
    }
}


export default new Base64
