// 如果不能使用 es6 import，可用 const Vika = require('@vikadata/vika').default; 代替
import { Vika } from "@vikadata/vika";
import Config from "../components/Config.js"

// 通过 datasheetId 来指定要从哪张维格表操作数据。

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
            var response;
            try {
                response = await this.PhigrosDan.records.query({ viewId: "viwpdf3HFtnvG", filterByFormula: `{fldB7Wx6wHX57} = \'${sessionToken}\'`, requestTimeout: 10000 });
            } catch { }
            logger.info(sessionToken)
            logger.info(response)
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
            var response;
            try {
                response = await this.PhigrosDan.records.query({ viewId: "viwpdf3HFtnvG", filterByFormula: `{fld9mDj3ktKD7} = \'${ObjectId}\'`, requestTimeout: 10000 });
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
            var response;
            try {
                response = await this.PhigrosDan.records.query({ viewId: "viwpdf3HFtnvG", filterByFormula: `{fldzkniADAUck} = \'${nickname}\'`, requestTimeout: 10000 });
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
    return {
        sessionToken: response.data.records[0].fields.fldB7Wx6wHX57,
        ObjectId: response.data.records[0].fields.fld9mDj3ktKD7,
        nickname: response.data.records[0].fields.fldzkniADAUck, //常用名
        Dan: response.data.records[0].fields.fldWVwne5p9xg, // 段位
        EX: response.data.records[0].fields.fldbILNU5o7Nl, // 是否EX
        img: response.data.records[0].fields.fldqbC6IK8m3o[0].url, // 截图
        score: (response.data.records[0].fields.fldTszelbRQIu ? response.data.records[0].fields.fldTszelbRQIu.split('\n') : undefined), // 详细成绩
        staffer: response.data.records[0].fields.fldoKAoJoBSJO.name, //审核人
    };
}


export default new VikaData(Config.getDefOrConfig('config', 'VikaToken'));

