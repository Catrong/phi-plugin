
import { HttpClient, HttpRequest } from './http.js'
import MD5 from 'md5'
import { Encrypt, Decrypt } from './AES.js'
import Summary from './Summary.js';


export default class SaveManager {
    static baseUrl = "https://rak3ffdi.cloud.tds1.tapapis.cn/1.1";
    static client = new HttpClient();
    static globalRequest = new HttpRequest.Builder()
        .header("X-LC-Id", "rAK3FfdieFob2Nn8Am")
        .header("X-LC-Key", "Qr9AEqtuoSVS3zeD6iVbM4ZC0AtkJcQ89tywVyi0")
        .header("User-Agent", "LeanCloud-CSharp-SDK/1.0.3")
        .header("Accept", "application/json");
    static fileTokens = this.baseUrl + "/fileTokens";
    static fileCallback = this.baseUrl + "/fileCallback";
    static save = this.baseUrl + "/classes/_GameSave";
    static userInfo = this.baseUrl + "/users/me";
    static files = this.baseUrl + "/files/"
    static async getPlayerId(session) {
        let request = await this.globalRequest.copy().header("X-LC-Session", session).uri(this.userInfo).build();

        let response = await this.client.send(request);

        return response;
    }

    /**
     * 
     * @param {String} session 
     * @returns Array
     */
    static async saveArray(session) {
        let request = await this.globalRequest.copy().header("X-LC-Session", session).uri(this.save).build();


        let response = await this.client.send(request);

        // return response

        return response.results;
    }

    /**
     * 
     * @param {String} session 
     * @returns Array|Objct
     */
    static async saveCheck(session) {
        let array = await this.saveArray(session);

        let size = array.length;
        if (size == 0) {
            // console.info(array)
            throw new Error("TK 对应存档列表为空，请检查是否同步存档QAQ！");

        }
        else {
            let results = []
            for (let i in array) {
                array[i].summary = new Summary(array[i].summary)
                array[i] = { ...array[i], ...await this.getPlayerId(session) }
                let date = new Date(array[i].updatedAt).toString()
                let time = date.split(' ')
                array[i].updatedAt = `${time[3]} ${time[1]}.${time[2]} ${time[4]}`

                if (array[i].gameFile) {
                    // array[i] = {
                    //     createdAt: array[i].createdAt,
                    //     gameFile: {
                    //         createdAt: array[i].gameFile.createdAt,
                    //         key: array[i].gameFile.key,
                    //         objectId: array[i].gameFile.objectId,
                    //         updatedAt: array[i].gameFile.updatedAt,
                    //         url: array[i].gameFile.url
                    //     },
                    //     modifiedAt: array[i].modifiedAt,
                    //     objectId: array[i].objectId,
                    //     summary: array[i].summary,
                    //     updatedAt: array[i].updatedAt,
                    //     user: array[i].user,
                    //     PlayerId: array[i].PlayerId
                    // };
                    array[i].PlayerId = array[i].nickname
                    results.push(array[i])
                }

                // array[i].gameFile = await this.client.send(await this.globalRequest.copy().header("X-LC-Session", session).uri(this.files + array[i].gameFile.id).build());
            }
            return results;
        }
    }

    static key = Buffer.from([-24, -106, -102, -46, -91, 64, 37, -101, -105, -111, -112, -117, -120, -26, -65, 3, 30, 109, 33, -107, 110, -6, -42, -118, 80, -35, 85, -42, 122, -80, -110, 75]).toString('hex')
    static iv = Buffer.from([42, 79, -16, -118, -56, 13, 99, 7, 0, 87, -59, -107, 24, -56, 50, 83]).toString('hex')

    static async decrypt(data) {
        try {
            return Decrypt(data, this.key, this.iv)
        } catch (e) {
            throw new Error(e);
        }
    }
    static async encrypt(data) {
        try {
            return Encrypt(data, this.key, this.iv)
        } catch (e) {
            throw new Error(e);
        }
    }
}