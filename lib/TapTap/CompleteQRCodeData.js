// PhigrosLibraryCSharp.Cloud.Login.DataStructure.CompleteQRCodeData 的 JavaScript 实现

/**
 * 完整的 TapTap QR 码数据集合。
 */
export default class CompleteQRCodeData {
    /**
     * @param {} code - 部分 TapTap QR 码数据对象。
     */
    constructor(code) {
        this.deviceID = code.deviceId;
        this.deviceCode = code.data.device_code;
        this.expiresInSeconds = code.data.expires_in;
        this.url = code.data.qrcode_url;
        this.interval = code.data.interval;
    }
}