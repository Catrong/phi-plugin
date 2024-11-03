import { redisPath } from "./constNum.js"

export default new class getBanGroup {

    /**
     * 
     * @param {string} group 
     * @param {string} fnc 
     * @returns 
     */
    async redis(group, fnc) {
        return await redis.get(`${redisPath}:banGroup:${group}:${fnc}`) ? true : false
    }

    /**
     * 
     * @param {string} group 
     * @param {string} fnc 
     * @returns 
     */
    async get(group, fnc) {
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
            case 'search':
            case 'alias':
            case 'randmic':
                return await this.redis(group, 'song')
            case 'rankList':
            case 'godList':
                return await this.redis(group, 'ranklist')
            case 'comrks':
            case 'tips':
            case 'lmtAcc':
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
            default:
                return false;
        }
    }
}()