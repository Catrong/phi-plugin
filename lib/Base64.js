

class Base64 {
    decode(data) {
        let result = Buffer.from(data,'base64');
        return result.toString('hex');
    }

    encode(data) {
        let result = Buffer.from(data,'hex');
        return result.toString('base64');
    }
}


export default new Base64