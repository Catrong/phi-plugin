import fetch from 'node-fetch';
import CryptoJS from 'crypto-js';

let AppKey = 'Qr9AEqtuoSVS3zeD6iVbM4ZC0AtkJcQ89tywVyi0';
let ClientId = 'rAK3FfdieFob2Nn8Am';

export default new class LCHelper {
    md5HashHexStringDefaultGetter(input) {
        return CryptoJS.MD5(input).toString(CryptoJS.enc.Hex);
    }

    async loginWithAuthData(data, failOnNotExist = false) {
        let authData = { taptap: data }
        let path = failOnNotExist ? 'users?failOnNotExist=true' : 'users';
        let response = await this.request(path, 'post', { authData });
        return response.json();
    }

    async loginAndGetToken(data, failOnNotExist = false) {
        let response = await this.loginWithAuthData(data, failOnNotExist);
        return response;
    }

    async request(path, method, data = null, queryParams = null, withAPIVersion = true) {
        let url = `https://rak3ffdi.cloud.tds1.tapapis.cn/1.1/users`
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

    buildUrl(path, queryParams, withAPIVersion) {
        let url = "https://rak3ffdi.cloud.tds1.tapapis.cn";
        if (withAPIVersion) {
            url += '/1.1';
        }
        url += `/${path}`;

        if (queryParams) {
            let queryPairs = Object.entries(queryParams)
                .filter(([, value]) => value !== null)
                .map(([key, value]) => `${key}=${encodeURIComponent(value.toString())}`);
            let queries = queryPairs.join('&');
            url += `?${queries}`;
        }
        return url;
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