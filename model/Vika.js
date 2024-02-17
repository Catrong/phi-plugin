// 如果不能使用 es6 import，可用 const Vika = require('@vikadata/vika').default; 代替
import { Vika } from "@vikadata/vika";
import Config from "../components/Config.js"

// 通过 datasheetId 来指定要从哪张维格表操作数据。

const cfg = {
    viewId: "viwpdf3HFtnvG",
    sort: [{ field: 'fldWVwne5p9xg', order: 'desc' }],
    requestTimeout: 10000,
}

class VikaData {
    constructor(Token) {
        try {
            this.vika = new Vika({ token: Token, fieldKey: "id" });
            this.PhigrosDan = this.vika.datasheet("dstkfifML5zGiURp6h");
        } catch (err) { }
    }

    /**
     * 通过 sessionToken 获取用户的民间段位数据
     * @param {string} ObjectId 用户存档ObjectId
     * @returns 
     */
    async GetUserDanBySstk(sessionToken) {
        if (this.PhigrosDan) {
            let response;
            try {
                response = await this.PhigrosDan.records.query({ ...cfg, filterByFormula: `{fldB7Wx6wHX57} = \'${sessionToken}\'` });
            } catch { }
            logger.info(sessionToken)
            logger.info(response)
            logger.info(Config.getDefOrConfig('config', 'VikaToken'))
            if (response.success) {
                return makeRespones(response);
            }
        }
        return null
    }

    /**
     * 通过 ObjectId 获取用户的民间段位数据
     * @param {string} ObjectId 用户存档ObjectId
     * @returns 
     */
    async GetUserDanById(ObjectId) {
        if (this.PhigrosDan) {
            let response;
            try {
                response = await this.PhigrosDan.records.query({ ...cfg, filterByFormula: `{fld9mDj3ktKD7} = \'${ObjectId}\'` });
            } catch { }
            if (response.success) {
                return makeRespones(response);
            }
        }
        return null
    }

    /**
     * 通过 nickname 获取用户的民间段位数据
     * @param {string} ObjectId 用户存档ObjectId
     * @returns 
     */
    async GetUserDanByName(nickname) {
        if (this.PhigrosDan) {
            let response;
            try {
                response = await this.PhigrosDan.records.query({ ...cfg, filterByFormula: `{fldzkniADAUck} = \'${nickname}\'` });
            } catch { }
            if (response.success) {
                return makeRespones(response);
            }
        }
        return null
    }

}


function makeRespones(response) {
    if (!response.data.records[0]) {
        return undefined
    }
    let ans = []
    for (let i in response.data.records) {
        ans.push({
            sessionToken: response.data.records[i].fields.fldB7Wx6wHX57,
            // ObjectId: response.data.records[i].fields.fld9mDj3ktKD7,
            nickname: response.data.records[i].fields.fldzkniADAUck, //常用名
            Dan: response.data.records[i].fields.fldWVwne5p9xg, // 段位
            EX: (response.data.records[i].fields.fldbILNU5o7Nl == "是" ? true : false), // 是否EX
            img: response.data.records[i].fields.fldqbC6IK8m3o[0].url, // 截图
            score: (response.data.records[i].fields.fldTszelbRQIu ? response.data.records[0].fields.fldTszelbRQIu.split('\n') : undefined), // 详细成绩
            staffer: response.data.records[i].fields.fldoKAoJoBSJO.name, //审核人
        });
    }
    return ans.sort((a, b) => Number(a.Dan.match(/[0-9]+th/g)[0].replace('th')) - Number(b.Dan.match(/[0-9]+th/g)[0].replace('th')));
}


export default new VikaData(Config.getDefOrConfig('config', 'VikaToken'));

