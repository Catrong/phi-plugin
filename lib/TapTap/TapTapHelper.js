import fetch from 'node-fetch';
import crypto from 'crypto';
import CompleteQRCodeData from './CompleteQRCodeData.js';

export default new class TapTapHelper {
    constructor() {
        this.TapSDKVersion = '2.1';
        this.WebHost = 'https://accounts.tapapis.com';
        this.ChinaWebHost = 'https://accounts.tapapis.cn';
        this.ApiHost = 'https://open.tapapis.com';
        this.ChinaApiHost = 'https://open.tapapis.cn';
        this.CodeUrl = `${this.WebHost}/oauth2/v1/device/code`;
        this.ChinaCodeUrl = `${this.ChinaWebHost}/oauth2/v1/device/code`;
        this.TokenUrl = `${this.WebHost}/oauth2/v1/token`;
        this.ChinaTokenUrl = `${this.ChinaWebHost}/oauth2/v1/token`;
    }

    async requestLoginQrCode(permissions = ['public_profile'], useGlobalEndpoint = false) {
        let clientId = crypto.randomUUID().replace(/\-/g, '')

        let params = new FormData()
        params.append('client_id', "rAK3FfdieFob2Nn8Am");
        params.append("response_type", "device_code");
        params.append("scope", permissions.join(','));
        params.append("version", this.TapSDKVersion);
        params.append("platform", "unity");
        params.append("info", JSON.stringify({ device_id: clientId }));

        let endpoint = useGlobalEndpoint ? this.CodeUrl : this.ChinaCodeUrl;
        let response = await fetch(endpoint, {
            method: 'POST',
            body: params
        });
        let data = await response.json();
        return { ...data, deviceId: clientId };
    }

    /**
     * 
     * @param {*} qrCodeData 
     * @param {*} useGlobalEndpoint 
     * @returns 
     */
    async checkQRCodeResult(data, useGlobalEndpoint = false) {
        let qrCodeData = new CompleteQRCodeData(data)
        let params = new FormData();
        params.append('grant_type', 'device_token');
        params.append('client_id', "rAK3FfdieFob2Nn8Am");
        params.append("secret_type", "hmac-sha-1");
        params.append("code", qrCodeData.deviceCode);
        params.append("version", "1.0");
        params.append("platform", "unity");
        params.append("info", JSON.stringify({ device_id: qrCodeData.deviceID }));

        let endpoint = useGlobalEndpoint ? this.TokenUrl : this.ChinaTokenUrl;
        try {
            let response = await fetch(endpoint, {
                method: 'POST',
                body: params
            });
            let data = await response.json();
            return data;
        } catch (error) {
            // Handle error here
            console.error('Error checking QR code result:', error);
            return null;
        }
    }

    async getProfile(token, useGlobalEndpoint = false, timestamp = 0) {
        if (!token.scope.includes('public_profile')) {
            throw new Error('Public profile permission is required.');
        }

        let url;
        if (useGlobalEndpoint) {
            url = `${this.ApiHost}/account/profile/v1?client_id=rAK3FfdieFob2Nn8Am`; // Replace with actual client ID
        } else {
            url = `${this.ChinaApiHost}/account/profile/v1?client_id=rAK3FfdieFob2Nn8Am`; // Replace with actual client ID
        }

        let method = 'GET';

        let authorizationHeader = getAuthorization(url, method, token.kid, token.mac_key);

        let response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: authorizationHeader },
        });

        return response.json();
    }
}()

function getAuthorization(requestUrl, method, keyId, macKey) {
    const url = new URL(requestUrl);
    const time = (Math.floor(Date.now() / 1000).toString()).padStart(10, '0');
    const randomStr = getRandomString(16);
    const host = url.hostname;
    const uri = url.pathname + url.search;
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    const other = '';
    const sign = signData(mergeData(time, randomStr, method, uri, host, port, other), macKey);

    return `MAC id="${keyId}", ts="${time}", nonce="${randomStr}", mac="${sign}"`;
}

function getRandomString(length) {
    return crypto.randomBytes(length).toString('base64');
}

function mergeData(time, randomCode, httpType, uri, domain, port, other) {
    let prefix =
        `${time}\n${randomCode}\n${httpType}\n${uri}\n${domain}\n${port}\n`;

    if (!other) {
        prefix += '\n';
    } else {
        prefix += `${other}\n`;
    }

    return prefix;
}

function signData(signatureBaseString, key) {
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(signatureBaseString);
    return hmac.digest('base64');
}