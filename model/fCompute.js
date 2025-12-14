import Config from '../components/Config.js'
import { MAX_DIFFICULTY } from './constNum.js'
import getInfo from './getInfo.js'
export default class compute {
    /**
     * 计算等效rks
     * @param {number} acc 
     * @param {number} difficulty 
     * @returns 
     */
    static rks(acc, difficulty) {
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
    static suggest(rks, difficulty, count = undefined) {
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
    static async sendFile(e, file, filename) {
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
    static async getBackground(save_background) {
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
                case 'Le temps perdu-': {
                    save_background = 'Le temps perdu'
                    break
                }
                default: {
                    break
                }
            }
            return getInfo.getill(getInfo.idgetsong(save_background) || save_background)
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
    static ped(num, cover) {
        return num.toString().padStart(cover, '0')
    }

    /**
     * 标准化分数
     * @param {number} score 分数
     * @returns 标准化的分数 0'000'000
     */
    static std_score(score) {
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
    static randBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min)
    }

    /**
     * 随机打乱数组
     * @param {Array} arr 原数组
     * @returns 随机打乱的数组
     */
    static randArray(arr) {
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
    static formatDate(date) {
        date = new Date(date)
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}`
    }

    static formatDateToNow(date) {
        return `-${((new Date() - new Date(date)) / (24 * 60 * 60 * 1000)).toFixed(0)}d`;
    }

    /**
     * 转换unity富文本
     * @param {string} richText 
     * @param {boolean} [onlyText=false] 是否只返回文本
     * @returns 
     */
    static convertRichText(richText, onlyText = false) {
        if (!richText) {
            return richText
        }
        richText = richText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        let reg = [/&lt;color\s*=\s*.*?&gt;(.*?)&lt;\/color&gt;/, /&lt;size\s*=\s*.*?&gt;(.*?)&lt;\/size&gt;/, /&lt;i&gt;(.*?)&lt;\/i&gt;/, /&lt;b&gt;(.*?)&lt;\/b&gt;/]
        while (1) {
            if (richText.match(reg[0])) {
                let txt = richText.match(reg[0])[1]
                let color = richText.match(reg[0])[0].match(/&lt;color\s*=\s*(.*?)&gt;/)[1].replace(/[\s\"]/g, '')
                richText = richText.replace(reg[0], onlyText ? txt : `<span style="color:${color}">${txt}</span>`)
                continue
            }

            if (richText.match(reg[2])) {
                let txt = richText.match(reg[2])[1]
                richText = richText.replace(reg[2], onlyText ? txt : `<i>${txt}</i>`)
                continue
            }

            if (richText.match(reg[3])) {
                let txt = richText.match(reg[3])[1]
                richText = richText.replace(reg[3], onlyText ? txt : `<b>${txt}</b>`)
                continue
            }
            // if (richText.match(reg[1])) {
            //     let txt = richText.match(reg[1])[1]
            //     let size = richText.match(reg[1])[0].match(/size\s*=[^>]*?([^>]*)/)[1]o
            //     return this.convertRichText(richText.replace(reg[1], `<span style="font-size:${size}px">${txt}</span>`))
            // }
            if (richText.match(/\n\r?/)) {
                richText.replace(/\n\r?/g, '<br>')
            }
            break
        }
        // if (onlyText) {
        //     richText = richText.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        // }
        return richText
    }

    /**是否是管理员 */
    static is_admin(e) {
        //console.info(e)
        if (e?.member?.is_admin) {
            return true;
        }
        if (!e?.member?.permissions) {
            return false;
        }
        switch (e?.member?.permissions[1]) {
            /**频道主 */
            case 4:
            /**超管 */
            case 2:
            /**分组管理 */
            case 7:
            /**子频道管理 */
            case 5:
                return true;
            default:
                return false;
        }
    }

    /**
     * 捕获消息中的范围
     * @param {string} msg 消息字符串
     * @param {Array} range 范围数组
     */
    static match_range(msg, range) {
        if (!range) {
            range[0] = 0
            range[1] = MAX_DIFFICULTY
        }
        if (msg.match(/[0-9]+(\.[0-9]+)?\s*[-～~]\s*[0-9]+(\.[0-9]+)?/g)) {
            /**0-16.9 */
            msg = msg.match(/[0-9]+(\.[0-9]+)?\s*[-～~]\s*[0-9]+(\.[0-9]+)?/g)[0]
            let result = msg.split(/\s*[-～~]\s*/g)
            range[0] = Number(result[0])
            range[1] = Number(result[1])
            if (range[0] > range[1]) {
                let tem = range[1]
                range[1] = range[0]
                range[0] = tem
            }
            if (range[1] % 1 == 0 && !result.includes(".0")) range[1] += 0.9
        } else if (msg.match(/[0-9]+(\.[0-9]+)?\s*[-+]/g)) {
            /**16.9- 15+ */
            msg = msg.match(/[0-9]+(\.[0-9]+)?\s*[-+]/g)[0]
            let result = msg.replace(/\s*[-+]/g, '')
            if (msg.includes('+')) {
                range[0] = result
            } else {
                range[1] = result
                if (range[1] % 1 == 0 && !result.includes(".0")) range[1] += 0.9
            }
        } else if (msg.match(/[0-9]+(\.[0-9]+)?/g)) {
            /**15 */
            msg = msg.match(/[0-9]+(\.[0-9]+)?/g)[0]
            range[0] = range[1] = Number(msg)
            if (!msg.includes('.')) {
                range[1] += 0.9
            }
        }

    }

    /**
     * 匹配消息中对成绩的筛选
     * @param {string} msg 
     * @param {number} max_range 最大范围
     * @returns 
     */
    static match_request(e_msg, max_range) {
        let range = [0, max_range || MAX_DIFFICULTY]

        let msg = e_msg.replace(/^[#/](.*?)(lvsco(re)?)(\s*)/, "")

        /**EZ HD IN AT */
        let isask = [true, true, true, true]

        msg = msg.toUpperCase()

        if (msg.includes('EZ') || msg.includes('HD') || msg.includes('IN') || msg.includes('AT')) {
            isask = [false, false, false, false]
            if (msg.includes('EZ')) { isask[0] = true }
            if (msg.includes('HD')) { isask[1] = true }
            if (msg.includes('IN')) { isask[2] = true }
            if (msg.includes('AT')) { isask[3] = true }
        }
        msg = msg.replace(/(list|AT|IN|HD|EZ)*/g, "")

        let scoreAsk = { NEW: true, F: true, C: true, B: true, A: true, S: true, V: true, FC: true, PHI: true }

        if (msg.includes(' NEW') || msg.includes(' F') || msg.includes(' C') || msg.includes(' B') || msg.includes(' A') || msg.includes(' S') || msg.includes(' V') || msg.includes(' FC') || msg.includes(' PHI')) {
            scoreAsk = { NEW: false, F: false, C: false, B: false, A: false, S: false, V: false, FC: false, PHI: false }
            let rating = ['NEW', 'F', 'C', 'B', 'A', 'S', 'V', 'FC', 'PHI']
            for (let i in rating) {
                if (msg.includes(` ${rating[i]}`)) { scoreAsk[rating[i]] = true }
            }
        }
        if (msg.includes(` AP`)) { scoreAsk.PHI = true }
        msg = msg.replace(/(NEW|F|C|B|A|S|V|FC|PHI|AP)*/g, "")

        this.match_range(e_msg, range)
        return { range, isask, scoreAsk }
    }

    /**
     * 
     * @param {number} real_score 真实成绩
     * @param {number} tot_score 总成绩
     * @param {boolean} fc 是否fc
     * @returns 
     */
    static rate(real_score, tot_score, fc) {

        if (!real_score) {
            return 'F'
        } else if (real_score == tot_score) {
            return 'phi'
        } else if (fc) {
            return 'FC'
        } else if (real_score >= tot_score * 0.96) {
            return 'V'
        } else if (real_score >= tot_score * 0.92) {
            return 'S'
        } else if (real_score >= tot_score * 0.88) {
            return 'A'
        } else if (real_score >= tot_score * 0.82) {
            return 'B'
        } else if (real_score >= tot_score * 0.70) {
            return 'C'
        } else {
            return 'F'
        }
    }


    /**
     * 转换时间格式
     * @param {Date|string} date 时间
     * @returns 2020/10/8 10:08:08
     */
    static date_to_string(date) {
        if (!date) return undefined
        date = new Date(date)

        let month = (date.getMonth() + 1) < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1
        let day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate()

        return `${date.getFullYear()}/${month}/${day} ${date.toString().match(/([0-9])+:([0-9])+:([0-9])+/)[0]}`
    }



    /**
     * 计算百分比
     * @param {Number} value 值
     * @param {Array} range 区间数组 (0,..,1)
     * @returns 百分数，单位%
     */
    static range(value, range) {
        if (range[0] == range[range.length - 1]) {
            return 50
        } else {
            return (value - range[0]) / (range[range.length - 1] - range[0]) * 100
        }
    }

    /**
     * 模糊搜索，返回相似度大于0.8的结果
     * @param {string} str 搜索字符串
     * @param {Object<string, string[]>} data 搜索数组
     * @returns {Array<{ key:string, score:number, value:string }>} 相似度大于0.8的结果
     */
    static fuzzySearch(str, data) {
        let result = []
        for (let key in data) {
            let score = this.jaroWinklerDistance(str, key)
            if (score > 0.8) {
                data[key].forEach((value) => {
                    result.push({ key, score, value })
                })
            }
        }
        return result.sort((a, b) => b.score - a.score)
    }

    /**
     * 采用Jaro-Winkler编辑距离算法来计算str间的相似度，复杂度为O(n)=>n为较长的那个字符出的长度
     * @param {string} s1 
     * @param {string} s2 
     * @returns {number} 相似度 0-1
     */
    static jaroWinklerDistance(s1, s2) {
        if (s1 == s2) {
            return 1
        }
        //首先第一次去除空格和其他符号，并转换为小写
        const pattern = /[\s~`!@#$%^&*()\-=_+\[\]「」『』{}|;:'",<.>/?！￥…（）—【】、；‘’：“”，《。》？↑↓←→]/g
        s1 = s1.replace(pattern, '').toLowerCase()
        s2 = s2.replace(pattern, '').toLowerCase()
        let m = 0 //匹配的字符数量

        //如果任任一字符串为空则距离为0
        if (s1.length === 0 || s2.length === 0) {
            return 0
        }

        //字符串完全匹配，距离为1
        if (s1 === s2) {
            return 1
        }

        let range = (Math.floor(Math.max(s1.length, s2.length) / 2)) - 1, //搜索范围
            s1Matches = new Array(s1.length),
            s2Matches = new Array(s2.length)

        //查找匹配的字符
        for (let i = 0; i < s1.length; i++) {
            let low = (i >= range) ? i - range : 0,
                high = (i + range <= (s2.length - 1)) ? (i + range) : (s2.length - 1)

            for (let j = low; j <= high; j++) {
                if (s1Matches[i] !== true && s2Matches[j] !== true && s1[i] === s2[j]) {
                    ++m
                    s1Matches[i] = s2Matches[j] = true
                    break
                }
            }
        }

        //如果没有匹配的字符，那么捏Jaro距离为0
        if (m === 0) {
            return 0
        }

        //计算转置的数量
        let k = 0, n_trans = 0
        for (let i = 0; i < s1.length; i++) {
            if (s1Matches[i] === true) {
                let j
                for (j = k; j < s2.length; j++) {
                    if (s2Matches[j] === true) {
                        k = j + 1
                        break
                    }
                }

                if (s1[i] !== s2[j]) {
                    ++n_trans
                }
            }
        }

        //计算Jaro距离
        let weight = (m / s1.length + m / s2.length + (m - (n_trans / 2)) / m) / 3,
            l = 0,
            p = 0.1

        //如果Jaro距离大于0.7，计算Jaro-Winkler距离
        if (weight > 0.7) {
            while (s1[l] === s2[l] && l < 4) {
                ++l
            }

            weight = weight + l * p * (1 - weight)
        }

        return weight
    }

    static getAdapterName(e) {
        return e.bot?.adapter?.name || e.bot?.adapter
    }

    /**
     * 多别名的返回消息
     * @param {songString[]} songArr 
     */
    static mutiNick(songArr) {
        /**筛选出重复的别名 */
        const nickCnt = {};
        songArr.forEach((song) => {
            const info = getInfo.info(song);
            (getInfo.nicklist[info.song] || []).forEach((nick) => {
                if (!nickCnt[nick]) {
                    nickCnt[nick] = 1;
                } else {
                    nickCnt[nick]++;
                }
            })
        })
        const nickList = []
        for (let nick in nickCnt) {
            if (nickCnt[nick] > 1) {
                nickList.push(nick);
            }
        }
        /**生成消息 */
        let msg = '你要找的是不是：\n';
        songArr.forEach((song, index) => {
            let info = getInfo.info(song)
            if (info) {
                msg += `${index + 1}. ${info.song}\n-作者：${info.composer}\n`;
                if (getInfo.nicklist?.[info.song]) {
                    for (let nick of getInfo.nicklist[info.song]) {
                        if (!nickList.includes(nick)) {
                            msg += `-其他别名：${nick}\n`;
                            break;
                        }
                    }
                } else {
                    msg += `-其他别名：${info.id.replace('.', ' . ')}\n`;
                }
            } else {
                msg += `${index + 1}. ${id}\n暂无信息\n`;
            }
        })
        msg += `请在${Config.getUserCfg('config', 'mutiNickWaitTimeOut')}秒内回复序号`;
        return msg
    }

    /**
     * 判断是不是1GOOD
     * @param {number} score 
     * @param {number} maxc 总物量
     * @returns 
     */
    static comJust1Good(score, maxc) {
        const tar = 900000 * (1 - (0.35 / maxc)) + 100000;
        return Math.abs(score - tar) <= 2;
    }
}