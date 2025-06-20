import Config from "../components/Config.js";
import { redisPath } from "./constNum.js"
import getSave from "./getSave.js";
import makeRequest from "./makeRequest.js";
import makeRequestFnc from "./makeRequestFnc.js";
import send from "./send.js";

export default new class getBanGroup {

    /**
     * @import * from './type/type.js'
     */

    /**
     * @param {string} group 
     * @param {allFnc} fnc 
     * @returns 
     */
    async redis(group, fnc) {
        return await redis.get(`${redisPath}:banGroup:${group}:${fnc}`) ? true : false
    }

    /**
     * 
     * @param {string} group 
     * @param {allFnc} fnc 
     * @returns 
     */
    async get(e, fnc) {
        const { group_id } = e;
        let sessionToken = await getSave.get_user_token(e.user_id)
        if (Config.getUserCfg('config', 'openPhiPluginApi')) {
            let result = false
            try {
                result = await makeRequest.getUserBan(makeRequestFnc.makePlatform(e))
                if (result) {
                    send.send_with_At(e, "当前账户被加入黑名单，详情请联系管理员(1)。")
                    if (sessionToken) {
                        await getSave.banSessionToken(sessionToken)
                    }
                    return true;
                }
            } catch (e) {
                logger.warn('[phi-plugin]API获取用户禁用状态失败', e)
            }
        }
        if (sessionToken) {
            if (await getSave.isBanSessionToken(sessionToken)) {
                send.send_with_At(e, "当前账户被加入黑名单，详情请联系管理员(2)。")
                return true;
            }
        }
        if (!group) {
            return false
        }
        switch (fnc) {
            case 'help':
            case 'tkhelp':
                return await this.redis(group, 'help')
            case 'bind':
            case 'unbind':
                return await this.redis(group, 'bind')
            case 'b19':
            case 'p30':
            case 'lmtAcc':
            case 'arcgrosB19':
            case 'update':
            case 'info':
            case 'list':
            case 'singlescore':
            case 'lvscore':
            case 'chap':
            case 'suggest':
                return await this.redis(group, 'b19')
            case 'bestn':
            case 'data':
                return await this.redis(group, 'wb19')
            case 'song':
            case 'ill':
            case 'chart':
            case 'addtag':
            case 'retag':
            case 'search':
            case 'alias':
            case 'randmic':
            case 'randClg':
            case 'table':
            case 'comment':
            case 'recallComment':
                return await this.redis(group, 'song')
            case 'rankList':
            case 'godList':
                return await this.redis(group, 'ranklist')
            case 'comrks':
            case 'tips':
            case 'newSong':
                return await this.redis(group, 'fnc')
            case 'tipgame':
                return await this.redis(group, 'tipgame')
            case 'guessgame':
                return await this.redis(group, 'guessgame')
            case 'ltrgame':
                return await this.redis(group, 'ltrgame')
            case 'sign':
            case 'send':
            case 'tasks':
            case 'retask':
            case 'jrrp':
                return await this.redis(group, 'sign')
            case 'theme':
                return await this.redis(group, 'setting')
            case 'dan':
            case 'danupdate':
                return await this.redis(group, 'dan')
            case 'auth':
            case 'clearApiData':
            case 'updateHistory':
            case 'setApiToken':
            case 'tokenList':
            case 'tokenManage':
                return await this.redis(group, 'apiSetting')
            default:
                return false;
        }
    }
}()