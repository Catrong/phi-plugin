
import { HttpClient, HttpRequest } from './http.js'
import MD5 from 'md5'
import { Encrypt, Decrypt } from './AES.js'
import Summary from './Summary.js';


class SaveManager {
    static baseUrl = "https://rak3ffdi.cloud.tds1.tapapis.cn/1.1";
    static client = new HttpClient();
    static globalRequest = new HttpRequest.Builder().header("X-LC-Id", "rAK3FfdieFob2Nn8Am").header("X-LC-Key", "Qr9AEqtuoSVS3zeD6iVbM4ZC0AtkJcQ89tywVyi0").header("User-Agent", "LeanCloud-CSharp-SDK/1.0.3").header("Accept", "application/json");
    static fileTokens = SaveManager.baseUrl + "/fileTokens";
    static fileCallback = SaveManager.baseUrl + "/fileCallback";
    static save = SaveManager.baseUrl + "/classes/_GameSave";
    static userInfo = SaveManager.baseUrl + "/users/me";
    static files = SaveManager.baseUrl + "/files/"
    saveModel;
    md5;
    user;
    data;

    constructor(user, saveInfo) {
        if (saveInfo) {
            try {
                this.md5 = MD5;
            } catch (e) {
                throw new Error(e);
            }
            this.user = user;
            let saveModel = new SaveModel();
            saveModel.summary = saveInfo.summary;
            saveModel.objectId = saveInfo.objectId;
            saveModel.userObjectId = saveInfo.user.objectId;
            saveInfo = saveInfo.gameFile;
            saveModel.gameObjectId = saveInfo.objectId;
            saveModel.updatedTime = saveInfo.updatedAt;
            saveModel.checksum = saveInfo.metaData._checksum;
            user.saveUrl = URL(saveInfo.url);
            this.saveModel = saveModel;
        } else {
            this(user, SaveManager.saveCheck(user.session));
        }
    }


    static async getPlayerId(session) {
        let request = await this.globalRequest.copy().header("X-LC-Session", session).uri(this.userInfo).build();

        let response = await this.client.send(request);

        return response.nickname;
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
        if (size == 0)
            throw new Error("存档不存在,sessionToken: " + session);
        else {
            let results = []
            for (let i in array) {
                array[i].summary = new Summary(array[i].summary)
                array[i].PlayerId = await this.getPlayerId(session)
                let date = new Date(array[i].updatedAt).toString()
                let time = date.split(' ')
                array[i].updatedAt = `${time[3]} ${time[1]}.${time[2]} ${time[4]}`

                if (array[i].gameFile) {
                    array[i] = {
                        createdAt: array[i].createdAt,
                        gameFile: {
                            createdAt: array[i].gameFile.createdAt,
                            key: array[i].gameFile.key,
                            objectId: array[i].gameFile.objectId,
                            updatedAt: array[i].gameFile.updatedAt,
                            url: array[i].gameFile.url
                        },
                        modifiedAt: array[i].modifiedAt,
                        objectId: array[i].objectId,
                        summary: array[i].summary,
                        updatedAt: array[i].updatedAt,
                        user: array[i].user,
                        PlayerId: array[i].PlayerId
                    };
                    results.push(array[i])
                }

                // array[i].gameFile = await this.client.send(await this.globalRequest.copy().header("X-LC-Session", session).uri(this.files + array[i].gameFile.id).build());
            }
            return results;
        }
    }

    static save(session) {
        let array = saveArray(session);
        let size = array.length;
        if (size == 0)
            throw new Error("存档不存在");
        return array[0];
    }

    static delete(session, objectId) {
        let builder = this.globalRequest.copy();
        builder.DELETE();
        builder.uri(URL(baseUrl + "/classes/_GameSave/" + objectId));
        builder.header("X-LC-Session", session);
        return this.client.send(builder.build()).body();
    }

    static modify(clazz, callback) {
        let request = new HttpRequest.Builder(user.saveUrl).build();
        this.data = this.client.send(request).body();
        if (!this.md5(this.data).equals(saveModel.checksum)) throw new Error("文件校验不一致");
        try {
            let inputStream = new ByteArrayInputStream(this.data)
            try {
                let outputStream = new ByteArrayOutputStream(inputStream.available())
                try {
                    let zipWriter = new ZipOutputStream(outputStream)
                    try {
                        let zipReader = new ZipInputStream(inputStream)
                        let name = clazz.getDeclaredField("name").get(null);
                        let entry;
                        while ((entry = zipReader.getNextEntry()) != null) {
                            let dEntry = new ZipEntry(entry);
                            dEntry.setCompressedSize(-1);
                            zipWriter.putNextEntry(dEntry);
                            if (entry.getName().equals(name)) {
                                let version = clazz.getDeclaredField("version").getByte(null);
                                if (zipReader.read() != version)
                                    throw new Error("存档该部分已升级。");
                                Logger.getGlobal().info(String.valueOf(version));
                                this.data = this.decrypt(zipReader.readAllBytes());
                                let tmp = clazz.getDeclaredConstructor().newInstance();
                                tmp.loadFromBinary(this.data);
                                callback.apply(tmp);
                                this.data = this.encrypt(tmp.serialize());
                                zipWriter.write(version);
                            } else
                                this.data = zipReader.readAllBytes();
                            zipWriter.write(this.data);
                        }
                        zipReader.closeEntry();
                    } catch (e) {
                        throw new Error(e);
                    }
                } catch { return false }
                this.data = outputStream.toByteArray();
            } catch { return false }
        } catch { return false }
    }

    static uploadZip(score) {
        let response;
        let template = this.globalRequest.copy().header("X-LC-Session", user.session);

        let summary = Base64.decode(saveModel.summary);
        summary[1] = (byte)(score & 0xff);
        summary[2] = (byte)(score >>> 8 & 0xff);
        saveModel.summary = Base64.getEncoder().encodeToString(summary);
        Logger.getGlobal().info(new Summary(saveModel.summary).toString());



        let builder = template.copy();
        builder.uri(URL(fileTokens));
        builder.POST(HttpRequest.BodyPublishers.ofString(Stringformat(`{\"name\":\".save\",\"__type\":\"File\",\"ACL\":{\"%s\":{\"read\":true,\"write\":true}},\"prefix\":\"gamesaves\",\"metaData\":{\"size\":%d,\"_checksum\":\"%s\",\"prefix\":\"gamesaves\"}}`, saveModel.userObjectId, this.data.length, this.md5(this.data))));
        response = this.client.send(builder.build()).body();
        let tokenKey = Base64.getEncoder().encodeToString(JSON.parse(response).key.getBytes());
        let newGameObjectId = JSON.parse(response).objectId;
        let authorization = "UpToken " + JSON.parse(response).token;
        Logger.getGlobal().fine(response);



        builder = new HttpRequestBuilder(URL(Stringformat("https://upload.qiniup.com/buckets/rAK3Ffdi/objects/%s/uploads", tokenKey)));
        builder.header("Authorization", authorization);
        builder.POST(HttpRequest.BodyPublishers.noBody());
        response = this.client.send(builder.build()).body();
        let uploadId = JSON.parse(response).uploadId;
        Logger.getGlobal().fine(response);



        builder = new HttpRequestBuilder(URL(Stringformat("https://upload.qiniup.com/buckets/rAK3Ffdi/objects/%s/uploads/%s/1", tokenKey, uploadId)));
        builder.header("Authorization", authorization);
        builder.header("Content-Type", "application/octet-stream");
        builder.PUT(HttpRequest.BodyPublishers.ofByteArray(this.data));
        response = this.client.send(builder.build()).body();
        let etag = JSON.parse(response).etag;
        Logger.getGlobal().fine(response);



        builder = new HttpRequestBuilder(URL(Stringformat("https://upload.qiniup.com/buckets/rAK3Ffdi/objects/%s/uploads/%s", tokenKey, uploadId)));
        builder.header("Authorization", authorization);
        builder.header("Content-Type", "application/json");
        builder.POST(HttpRequest.BodyPublishers.ofString(Stringformat("{\"parts\":[{\"partNumber\":1,\"etag\":\"%s\"}]}", etag)));
        response = this.client.send(builder.build()).body();
        Logger.getGlobal().fine(response);



        builder = template.copy();
        builder.uri(URL(fileCallback));
        builder.header("Content-Type", "application/json");
        builder.POST(HttpRequest.BodyPublishers.ofString(Stringformat("{\"result\":true,\"token\":\"%s\"}", tokenKey)));
        response = this.client.send(builder.build()).body();
        Logger.getGlobal().fine(response);



        builder = template.copy();
        builder.uri(URL(Stringformat(baseUrl + "/classes/_GameSave/%s?", saveModel.objectId)));
        builder.header("Content-Type", "application/json");
        builder.PUT(HttpRequest.BodyPublishers.ofString(Stringformat("{\"summary\":\"%s\",\"modifiedAt\":{\"__type\":\"Date\",\"iso\":\"%s\"},\"gameFile\":{\"__type\":\"Pointer\",\"className\":\"_File\",\"objectId\":\"%s\"},\"ACL\":{\"%s\":{\"read\":true,\"write\":true}},\"user\":{\"__type\":\"Pointer\",\"className\":\"_User\",\"objectId\":\"%s\"}}", saveModel.summary, Instant.ofEpochMilli(System.currentTimeMillis()), newGameObjectId, saveModel.userObjectId, saveModel.userObjectId)));
        response = this.client.send(builder.build()).body();
        Logger.getGlobal().fine(response);



        builder = template.copy();
        builder.uri(URL(Stringformat(baseUrl + "/files/%s", saveModel.gameObjectId)));
        builder.DELETE();
        response = this.client.send(builder.build()).body();
        Logger.getGlobal().fine(response);
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

    static md5(data) {
        this.md5.reset();
        data = this.md5.digest(data);
        let builder = new StringBuilder();
        for (let b of data) {
            builder.append(Character.forDigit(b >> 4 & 15, 16));
            builder.append(Character.forDigit(b & 15, 16));
        }
        return builder.toString();
    }
}

function Stringformat(args) {
    let result = this;
    if (arguments.length > 0) {
        if (arguments.length == 1 && typeof (args) == "object") {
            for (let key in args) {
                if (args[key] != undefined) {
                    let reg = new RegExp("({" + key + "})", "g");
                    result = result.replace(reg, args[key]);
                }
            }
        }
        else {
            for (let i = 0; i < arguments.length; i++) {
                if (arguments[i] != undefined) {
                    //let reg = new RegExp("({[" + i + "]})", "g");//这个在索引大于9时会有问题
                    let reg = new RegExp("({)" + i + "(})", "g");
                    result = result.replace(reg, arguments[i]);
                }
            }
        }
    }
    return result;
}

export default SaveManager