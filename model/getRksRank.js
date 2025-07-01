// import { redis } from 'yunzai'

import { redisPath } from "./constNum.js"


export default new class getRksRank {
    /**
     * 添加成绩
     * @param {string} sessionToken 
     * @param {number} rks 
     * @returns {Promise<number>}
     */
    async addUserRks(sessionToken, rks) {
        return await redis.zAdd(`${redisPath}:rksRankSet`, { score: rks * -1, value: sessionToken })
    }

    /**
     * 删除成绩
     * @param {string} sessionToken 
     * @returns {Promise<number>}
     */
    async delUserRks(sessionToken) {
        return await redis.zRem(`${redisPath}:rksRankSet`, sessionToken)
    }

    /**
     * 获取用户排名
     * @param {string} sessionToken 
     * @returns {Promise<number>}
     */
    async getUserRank(sessionToken) {
        return await redis.zRank(`${redisPath}:rksRankSet`, sessionToken)
    }

    /**
     * 获取sessionToken rks
     * @param {number} sessionToken 
     * @returns {Promise<number>}
     */
    async getUserRks(sessionToken) {
        return await redis.zScore(`${redisPath}:rksRankSet`, sessionToken)
    }

    /**
     * 获取排名对应的用户
     * @param {number} min 0起
     * @param {number} max 不包含
     * @returns {Promise<Array>}
     */
    async getRankUser(min, max) {
        return await redis.zRange(`${redisPath}:rksRankSet`, min, max - 1, "WITHSCORES")
    }

    /**
     * 获取指定rks的排名
     * @param {number} rks 
     * @returns {Promise<number>}
     */
    async getRankByRks(rks) {
        const rank = await redis.zCount(`${redisPath}:rksRankSet`, rks * -1, -1);
        return rank; // 返回排名，-1表示未找到
    }

    /**
     * 获取所有排名
     * @returns {Promise<Array>}
     */
    async getAllRank() {
        return await redis.zCard(`${redisPath}:rksRankSet`)
    }
}()