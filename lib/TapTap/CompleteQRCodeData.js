// PhigrosLibraryCSharp.Cloud.Login.DataStructure.CompleteQRCodeData 的 JavaScript 实现

/**
 * @typedef {object} PartialQRCodeData
 * @property {string} deviceId
 * @property {object} data
 * @property {string} data.device_code
 * @property {number} data.expires_in
 * @property {string} data.qrcode_url
 * @property {number} data.interval
 */

/**
 * 完整的 TapTap QR 码数据集合。
 */
export default class CompleteQRCodeData {
    /**
     * @param {PartialQRCodeData} code - 部分 TapTap QR 码数据对象。
     */
    constructor(code) {
        this.deviceID = code.deviceId;
        this.deviceCode = code.data.device_code;
        this.expiresInSeconds = code.data.expires_in;
        this.url = code.data.qrcode_url;
        this.interval = code.data.interval;
    }
}
