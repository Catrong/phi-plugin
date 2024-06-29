export default new class compute {
    /**
     * 计算等效rks
     * @param {number} acc 
     * @param {number} difficulty 
     * @returns 
     */
    rks(acc, difficulty) {
        if (acc == 100) {
            /**满分原曲定数即为有效rks */
            return Number(difficulty)
        } else if (acc < 70) {
            /**无效acc */
            return 0
        } else {
            /**非满分计算公式 [(((acc - 55) / 45) ^ 2) * 原曲定数] */
            return difficulty * (((acc - 55) / 45) * ((acc - 55) / 45))
        }
    }

    /**
     * 计算所需acc
     * @param {Number} rks 目标rks
     * @param {Number} difficulty 定数
     * @param {Number} [count=undefined] 保留位数
     * @returns 所需acc
     */
    suggest(rks, difficulty, count = undefined) {
        let ans = 45 * Math.sqrt(rks / difficulty) + 55

        if (ans >= 100)
            return "无法推分"
        else {
            if (count != undefined) {
                return `${ans.toFixed(count)}%`
            } else {
                return ans
            }
        }
    }

    /**
     * 发送文件
     * @param {*} e 
     * @param {Buffer} file 
     * @param {string} filename 
     */
    async sendFile(e, file, filename) {
        try {
            let res
            if (e.isGroup) {
                if (e.group.sendFile)
                    res = await e.group.sendFile(file, undefined, filename)
                else
                    res = await e.group.fs.upload(file, undefined, filename)
            } else {
                res = await e.friend.sendFile(file, filename)
            }

            if (res) {
                let fileUrl
                if (e.group?.getFileUrl)
                    fileUrl = await e.group.getFileUrl(res.fid)
                else if (e.friend?.getFileUrl)
                    fileUrl = await e.friend.getFileUrl(res)
            }

        } catch (err) {
            logger.error(`文件上传错误：${logger.red(err.stack)}`)
            console.error(err)
            await e.reply(`文件上传错误：${err.stack}`)
        }
    }
}()