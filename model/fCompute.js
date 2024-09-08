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

    /**
     * 获取角色介绍背景曲绘
     * @param {string} save_background 
     * @returns 
     */
    async getBackground(save_background) {
        try {
            let getInfo = (await import('./getInfo.js')).default
            switch (save_background) {
                case 'Another Me ': {
                    save_background = 'Another Me (KALPA)'
                    break
                }
                case 'Another Me': {
                    save_background = 'Another Me (Rising Sun Traxx)'
                    break
                }
                case 'Re_Nascence (Psystyle Ver.) ': {
                    save_background = 'Re_Nascence (Psystyle Ver.)'
                    break
                }
                case 'Energy Synergy Matrix': {
                    save_background = 'ENERGY SYNERGY MATRIX'
                    break
                }
                default: {
                    break
                }
            }
            return getInfo.getill(save_background)
        } catch (err) {
            logger.error(`获取背景曲绘错误`, err)
            return false
        }
    }

    /**
     * 为数字添加前导零
     * @param {number} num 原数字
     * @param {number} cover 总位数
     * @returns 前导零数字
     */
    ped(num, cover) {
        return String("0".repeat(cover) + num).slice(-cover)
    }

    /**
     * 标准化分数
     * @param {number} score 分数
     * @returns 标准化的分数 0'000'000
     */
    std_score(score) {
        let s1 = Math.floor(score / 1e6)
        let s2 = Math.floor(score / 1e3) % 1e3
        let s3 = score % 1e3
        return `${s1}'${this.ped(s2, 3)}'${this.ped(s3, 3)}`
    }

    /**
     * 随机数，包含上下界
     * @param {number} min 最小值
     * @param {number} max 最大值
     * @returns 随机数
     */
    randBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min)
    }

    /**
     * 随机打乱数组
     * @param {Array} arr 原数组
     * @returns 随机打乱的数组
     */
    randArray(arr) {
        let newArr = []
        while (arr.length > 0) {
            newArr.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0])
        }
        return newArr
    }

    /**
     * 转换时间格式
     * @param {Date|string} date 时间
     * @returns 2020/10/8 10:08:08
     */
    formatDate(date) {
        date = new Date(date)
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}`
    }

    /**
     * 转换unity富文本
     * @param {string} richText 
     * @param {boolean} [onlyText=false] 是否只返回文本
     * @returns 
     */
    convertRichText(richText, onlyText = false) {
        richText = richText.replace(/</g, '\\<').replace(/>/g, '\\>');
        let reg = [/\\<color\s*=[^\\]*?\\>(.*?)\\<\/color\\>/, /\\<size\s*=[^\\]*?\\>(.*?)\\<\/size\\>/]
        while (1) {
            if (richText.match(reg[0])) {
                let txt = richText.match(reg[0])[1]
                let color = richText.match(reg[0])[0].match(/color\s*=[^>]*?([^>]*)/)[1].replace(/[\s\"\\]/g, '')
                richText = richText.replace(reg[0], onlyText ? txt : `<span style="color:${color}">${txt}</span>`)
                continue
            }
            // if (richText.match(reg[1])) {
            //     let txt = richText.match(reg[1])[1]
            //     let size = richText.match(reg[1])[0].match(/size\s*=[^>]*?([^>]*)/)[1]
            //     return this.convertRichText(richText.replace(reg[1], `<span style="font-size:${size}px">${txt}</span>`))
            // }
            if (richText.match(/\n\r?/)) {
                richText.replace(/\n\r?/g, '<br>')
            }
            break
        }
        if (onlyText) {
            richText = richText.replace(/\\</g, '<').replace(/\\>/g, '>');
        }
        return richText
    }
}()