
import { HttpClient, HttpRequest } from './http.js'
import { Encrypt, Decrypt } from './AES.js'
import Summary from './Summary.js';
import axios from 'axios';


export default class SaveManager {

    /**
     * @param {boolean} isGlobal
     */
    constructor(isGlobal) {
        if (isGlobal) {
            this.baseUrl = "https://kviehlel.cloud.ap-sg.tapapis.com/1.1";
            this.headers = {
                "X-LC-Id": "kviehleldgxsagpozb",
                "X-LC-Key": "tG9CTm0LDD736k9HMM9lBZrbeBGRmUkjSfNLDNib",
                "User-Agent": "LeanCloud-CSharp-SDK/1.0.3",
                "Accept": "application/json"
            }
        } else {
            this.baseUrl = "https://rak3ffdi.cloud.tds1.tapapis.cn/1.1";
            this.headers = {
                "X-LC-Id": "rAK3FfdieFob2Nn8Am",
                "X-LC-Key": "Qr9AEqtuoSVS3zeD6iVbM4ZC0AtkJcQ89tywVyi0",
                "User-Agent": "LeanCloud-CSharp-SDK/1.0.3",
                "Accept": "application/json"
            }
        }
        this.fileTokens = this.baseUrl + "/fileTokens";
        this.fileCallback = this.baseUrl + "/fileCallback";
        this.save = this.baseUrl + "/gamesaves/";//+objectId
        this.userInfo = this.baseUrl + "/users/me";
        this.files = this.baseUrl + "/files/"
    }

    /**
     * 
     * @param {string} session 
     * @returns {Promise<playerInfo>} 玩家信息
     * 
     */
    async getPlayerInfo(session) {
        let response = await axios.get(this.userInfo, {
            headers: {
                ...this.headers,
                "X-LC-Session": session
            }
        });

        return response.data;
    }

    /**
     * 
     * @param {String} session 
     * @param {string} objectId 
     * @returns {Promise<saveInfo[]>} 存档数组
     */
    async saveArray(session, objectId) {
        let response = await axios.get(this.save + `?skip=0&limit=100&where={"user":{"__type":"Pointer","className":"_User","objectId":"${objectId}"}}&include=cover,gameFile`, {
            headers: {
                ...this.headers,
                "X-LC-Session": session
            }
        });
        return response.data.results;
    }

    /**
     * 
     * @param {String} session 
     * @returns {Promise<{saveInfo: saveInfo, playerInfo: playerInfo}>} 存档数组
     */
    async saveCheck(session) {
        const userInfo = await this.getPlayerInfo(session);
        let array = await this.saveArray(session, userInfo.objectId);

        let results = []
        for (let i in array) {
            const item = array[i];
            if (!item?.gameFile) continue;
            // @ts-ignore
            item.summary = new Summary(item.summary);
            item.modifiedAt.iso = new Date(item.modifiedAt.iso);
            item.createdAt = new Date(item.createdAt);
            item.updatedAt = new Date(item.updatedAt);
            item.PlayerId = userInfo.nickname;
            results.push(item);
        }
        if (results.length == 0) {
            // console.info(array)
            throw new Error("TK 对应存档列表为空，请检查是否同步存档QAQ！");
        }
        else {
            results = array.sort((a, b) => b.modifiedAt.iso.getTime() - a.modifiedAt.iso.getTime());
            return { saveInfo: results[0], playerInfo: userInfo };
        }
    }

    static key = Buffer.from([-24, -106, -102, -46, -91, 64, 37, -101, -105, -111, -112, -117, -120, -26, -65, 3, 30, 109, 33, -107, 110, -6, -42, -118, 80, -35, 85, -42, 122, -80, -110, 75]).toString('hex')
    static iv = Buffer.from([42, 79, -16, -118, -56, 13, 99, 7, 0, 87, -59, -107, 24, -56, 50, 83]).toString('hex')

    /**
     * @param {string} data Base64编码的字符串
     */
    static async decrypt(data) {
        return Decrypt(data)
    }
    /**
     * @param {string} data Base64编码的字符串
     */
    static async encrypt(data) {
        return Encrypt(data)
    }
}