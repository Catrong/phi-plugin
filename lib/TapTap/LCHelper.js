import fetch from 'node-fetch';
import CryptoJS from 'crypto-js';

const AppKey = 'Qr9AEqtuoSVS3zeD6iVbM4ZC0AtkJcQ89tywVyi0';
const ClientId = 'rAK3FfdieFob2Nn8Am';
const AppKeyGB = 'tG9CTm0LDD736k9HMM9lBZrbeBGRmUkjSfNLDNib';
const ClientIdGB = 'kviehleldgxsagpozb';

const UrlLcBase = 'https://rak3ffdi.cloud.tds1.tapapis.cn/1.1';
const UrlLcBaseGB = 'https://kviehlel.cloud.ap-sg.tapapis.com/1.1';

export default new class LCHelper {
    md5HashHexStringDefaultGetter(input) {
        return CryptoJS.MD5(input).toString(CryptoJS.enc.Hex);
    }

    async loginWithAuthData(data, withGlobal = false) {
        let authData = { taptap: data }
        let response = await this.request('post', { authData }, withGlobal);
        return response.json();
    }

    async loginAndGetToken(data, withGlobal = false) {
        let response = await this.loginWithAuthData(data, withGlobal);
        return response;
    }

    async request(method, data = null, withGlobal = false) {
        let url = (withGlobal ? UrlLcBaseGB : UrlLcBase) + '/users';
        let headers = {
            'X-LC-Id': ClientId,
            'Content-Type': 'application/json'
        };

        this.fillHeaders(headers)

        let response = await fetch(url, {
            method,
            headers,
            body: JSON.stringify(data),
        });

        return response
    }

    fillHeaders(headers, reqHeaders = null) {
        if (reqHeaders !== null) {
            Object.entries(reqHeaders).forEach(([key, value]) => {
                headers[key] = value.toString();
            });
        }

        let timestamp = Math.floor(Date.now() / 1000);
        let data = `${timestamp}${AppKey}`;
        let hash = CryptoJS.MD5(data).toString(CryptoJS.enc.Hex);
        let sign = `${hash},${timestamp}`;
        headers['X-LC-Sign'] = sign;
    }
}()