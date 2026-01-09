import Config from '../components/Config.js'
import logger from '../components/Logger.js'
import LevelRecordInfo from './class/LevelRecordInfo.js'
import { MAX_DIFFICULTY } from './constNum.js'
import getInfo from './getInfo.js'

export default class fCompute {
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
     * @overload
     * @param {Number} rks 目标rks
     * @param {Number} difficulty 定数
     * @param {Number} count 保留位数
     * @returns {string}
     */
    /**
     * @overload
     * @param {Number} rks 目标rks
     * @param {Number} difficulty 定数
     * @returns {number}
     */
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
            // @ts-ignore
            logger.error(`文件上传错误：${logger.red(err.stack)}`)
            console.error(err)
            // @ts-ignore
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
            return getInfo.getill(/**@type {idString} */(save_background))
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
     * 随机数，不包含上界
     * @param {number} min 最小值
     * @param {number} max 最大值
     * @param {number} [precision=4] 小数位数
     * @returns 随机数
     */
    static randFloatBetween(min, max, precision = 4) {
        return Math.floor((Math.random() * (max - min) + min) * (10 ** precision)) / (10 ** precision)
    }

    /**
     * 随机打乱数组
     * @template T
     * @param {T[]} arr 原数组
     * @returns {T[]} 返回传入类型的数组
     */
    static randArray(arr) {
        const newArr = [...arr];
        return newArr.sort(() => Math.random() - 0.5);
    }

    /**
     * 转换时间格式
     * @param {Date|string|number} [date] 时间
     * @param {boolean} [withDate=true] 是否包含日期
     * @returns 2020/10/08 10:08:08
     */
    static formatDate(date, withDate = true) {
        if (!date) {
            date = new Date()
        }
        date = new Date(date)

        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const day = date.getDate().toString().padStart(2, '0')
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        const seconds = date.getSeconds().toString().padStart(2, '0')

        return (withDate ? `${date.getFullYear()}/${month}/${day} ` : '') + `${hours}:${minutes}:${seconds}`
    }

    /**
     * 转换时间格式
     * @param {Date|string|number} date 时间
     * @returns {string} -100d
     */
    static formatDateToNow(date) {
        return `-${((new Date().getTime() - new Date(date).getTime()) / (24 * 60 * 60 * 1000)).toFixed(0)}d`;
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
        let reg = [
            /&lt;color\s*=\s*.*?&gt;(.*?)&lt;\/color&gt;/,
            /&lt;size\s*=\s*.*?&gt;(.*?)&lt;\/size&gt;/,
            /&lt;i&gt;(.*?)&lt;\/i&gt;/, /&lt;b&gt;(.*?)&lt;\/b&gt;/
        ]
        while (1) {
            let matched = richText.match(reg[0])
            if (matched?.[1]) {
                let txt = matched[1]
                let colorTag = matched[0].match(/&lt;color\s*=\s*(.*?)&gt;/)
                let color = colorTag?.[1].replace(/[\s\"]/g, '') || 'inherit'
                richText = richText.replace(reg[0], onlyText ? txt : `<span style="color:${color}">${txt}</span>`)
                continue
            }

            matched = richText.match(reg[2])
            if (matched) {
                let txt = matched[1]
                richText = richText.replace(reg[2], onlyText ? txt : `<i>${txt}</i>`)
                continue
            }

            matched = richText.match(reg[3])
            if (matched) {
                let txt = matched[1]
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

    /**
     * 是否是管理员
     * @param {any} e
     */
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
     * @param {number[]} range 范围数组
     */
    static match_range(msg, range) {
        if (!range) {
            range = [0, MAX_DIFFICULTY]
        }
        if (msg.match(/[0-9]+(\.[0-9]+)?\s*[-～~]\s*[0-9]+(\.[0-9]+)?/g)) {
            /**0-16.9 */
            let matched = msg.match(/[0-9]+(\.[0-9]+)?\s*[-～~]\s*[0-9]+(\.[0-9]+)?/g)?.[0]
            if (!matched) return range;
            let result = matched.split(/\s*[-～~]\s*/g)
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
            let matched = msg.match(/[0-9]+(\.[0-9]+)?\s*[-+]/g)?.[0]
            if (!matched) return range;
            let result = matched.replace(/\s*[-+]/g, '')
            if (matched.includes('+')) {
                range[0] = Number(result)
            } else {
                range[1] = Number(result)
                if (range[1] % 1 == 0 && !result.includes(".0")) range[1] += 0.9
            }
        } else if (msg.match(/[0-9]+(\.[0-9]+)?/g)) {
            /**15 */
            let matched = msg.match(/[0-9]+(\.[0-9]+)?/g)?.[0]
            if (!matched) return range;
            range[0] = range[1] = Number(matched)
            if (!matched.includes('.')) {
                range[1] += 0.9
            }
        }

    }

    /**
     * 匹配消息中对成绩的筛选
     * @param {string} e_msg 
     * @param {number} [max_range] 最大范围
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
            /** @type {(keyof typeof scoreAsk)[]}*/
            let rating = /** @type {any}*/(Object.keys(scoreAsk))
            for (let rate of rating) {
                if (msg.includes(` ${rate}`)) { scoreAsk[rate] = true }
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
     * @param {boolean | number} fc 是否fc
     * @param {number} [tot_score=1000000] 
     * @returns 
     */
    static rate(real_score, fc, tot_score = 1000000) {

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
     * 计算百分比
     * @param {Number} value 值
     * @param {number[]} range 区间数组 (0,..,1)，只考虑首尾
     * @returns 百分数，单位%
     */
    static range(value, range) {
        if (range[0] == range[range.length - 1]) {
            return 50
        } else {
            return Math.abs((value - range[0]) / (range[range.length - 1] - range[0]) * 100)
        }
    }

    /**
     * 模糊搜索，返回相似度大于0.8的结果
     * @param {string} str 搜索字符串
     * @param {Object<string, string[]>} data 搜索数组
     * @returns {Array<{ key:string, score:number, value:string }>} 相似度大于0.8的结果
     */
    static fuzzySearch(str, data) {
        /**
         * @type {{ key:string, score:number, value:string }[]}
         */
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

    /**
     * 获取BOT平台名称
     * @param {any} e 
     * @returns 
     */
    static getAdapterName(e) {
        return e.bot?.adapter?.name || e.bot?.adapter
    }

    /**
     * 多别名的返回消息
     * @param {idString[]} idArr 
     */
    static mutiNick(idArr) {
        /**
         * 筛选出重复的别名
         * @type {Record<string, number>}
         */
        const nickCnt = {};
        idArr.forEach((id) => {
            (getInfo?.nicklist?.[id] || []).forEach((nick) => {
                if (!nickCnt[nick]) {
                    nickCnt[nick] = 1;
                } else {
                    nickCnt[nick]++;
                }
            })
        })
        /**
         * @type {string[]}
         */
        const nickList = []
        for (let nick in nickCnt) {
            if (nickCnt[nick] > 1) {
                nickList.push(nick);
            }
        }
        /**生成消息 */
        let msg = '你要找的是不是：\n';
        idArr.forEach((id, index) => {
            let info = getInfo.info(id);
            if (info) {
                msg += `${index + 1}. ${info.song}\n-作者：${info.composer}\n`;
                if (getInfo.nicklist?.[id]) {
                    for (let nick of getInfo.nicklist[id]) {
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

    /**
     * 从Record中获取key数组
     * @template {Record<PropertyKey, unknown>} T
     * @param {T} record 
     * @returns {(keyof T)[]} key数组
     */
    static objectKeys(record) {
        return /**@type {(keyof T)[]} */(Object.keys(record));
    }

    /**
     * 
     * @param {{phi: LevelRecordInfo[], b27: LevelRecordInfo[]}} b30List 
     * @param {LevelRecordInfo[]} newRecords 
     */
    static updateB30(b30List, newRecords) {
        let phi = [...b30List.phi];
        let b27 = [...b30List.b27];
        newRecords = newRecords.sort((a, b) => b.rks - a.rks);
        const newPhis = newRecords.filter(record => record.acc >= 100);

        const newPhiKeys = newPhis.map(item => `${item.id}-${item.difficulty}`);
        const newRecordKeys = newRecords.map(item => `${item.id}-${item.difficulty}`);

        phi = phi.filter(item => !newPhiKeys.includes(`${item.id}-${item.difficulty}`));
        b27 = b27.filter(item => !newRecordKeys.includes(`${item.id}-${item.difficulty}`));

        phi.push(...newPhis);
        phi = phi.sort((a, b) => b.rks - a.rks);
        phi = phi.slice(0, 3);
        b27.push(...newRecords);
        b27 = b27.sort((a, b) => b.rks - a.rks);
        b27 = b27.slice(0, 27);
        return { phi, b27 };
    }

    /**
     * 定义一个函数，接受一个整数参数，返回它的十六进制形式
     * @param {number} num 
     * @returns 
     */
    static toHex(num) {
        // 如果数字小于 16，就在前面补一个 0
        if (num < 16) {
            return "0" + num.toString(16);
        } else {
            return num.toString(16);
        }
    }

    // 定义一个函数，不接受参数，返回一个随机的背景色
    static getRandomBgColor() {
        // 生成三个 0 到 200 之间的随机整数，分别代表红、绿、蓝分量
        let red = Math.floor(Math.random() * 201);
        let green = Math.floor(Math.random() * 201);
        let blue = Math.floor(Math.random() * 201);
        // 将三个分量转换为十六进制形式，然后拼接成一个 RGB 颜色代码
        let hexColor = "#" + this.toHex(red) + this.toHex(green) + this.toHex(blue);
        // 返回生成的颜色代码
        return hexColor;
    }

}