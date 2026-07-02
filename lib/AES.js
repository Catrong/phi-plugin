import CryptoJS from 'crypto-js';

const key = CryptoJS.enc.Base64.parse("6Jaa0qVAJZuXkZCLiOa/Ax5tIZVu+taKUN1V1nqwkks=")
const iv = CryptoJS.enc.Base64.parse("Kk/wisgNYwcAV8WVGMgyUw==")

/**
 * 
 * @param {string} text 
 * @returns 
 */
export async function Encrypt(text) {

    let srcs = CryptoJS.enc.Utf8.parse(text);
    // 加密模式为CBC，补码方式为PKCS5Padding（也就是PKCS7）
    let encrypted = CryptoJS.AES.encrypt(srcs, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    //返回base64
    return CryptoJS.enc.Base64.stringify(encrypted.ciphertext);

}

/**
 * 
 * @param {string} word 
 * @returns 
 */
export async function Decrypt(word) {

    // const key = Buffer.from([-24, -106, -102, -46, -91, 64, 37, -101, -105, -111, -112, -117, -120, -26, -65, 3, 30, 109, 33, -107, 110, -6, -42, -118, 80, -35, 85, -42, 122, -80, -110, 75]).toString('base64')
    // const iv = Buffer.from([42, 79, -16, -118, -56, 13, 99, 7, 0, 87, -59, -107, 24, -56, 50, 83]).toString("base64")
    const decrypt = CryptoJS.AES.decrypt(word, key, {
        iv: iv
    })
    let result = decrypt.toString(CryptoJS.enc.Hex)
    return result;
}