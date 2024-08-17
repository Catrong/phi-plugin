import { _path, dataPath, pluginDataPath } from "./path.js";
import Config from "../components/Config.js";
import readFile from './getFile.js';
import atlas from "./picmodle.js";
import LevelRecord from "./class/LevelRecordInfo.js";
import SongsInfo from './class/SongsInfo.js';
import Save from './class/Save.js';
import PhigrosUser from '../lib/PhigrosUser.js';
import send from './send.js';
import path from 'node:path';
import getSave from './getSave.js';
import getNotes from './getNotes.js'
import getInfo from './getInfo.js';
import pic from './getPic.js';
import { Level } from "./constNum.js";
import getPic from "./getPic.js";
// import { redis } from 'yunzai'


class getdata {


    constructor() {

        this.Level = getInfo.Level //难度映射

        /**头像id */
        this.avatarid = getInfo.avatarid
        /**Tips */
        this.tips = getInfo.tips

        /**原版信息 */
        this.ori_info = getInfo.ori_info
        /**通过id获取曲名 */
        this.songsid = getInfo.songsid
        /**原曲名称获取id */
        this.idssong = getInfo.idssong


        /**含有曲绘的曲目列表，原曲名称 */
        this.illlist = getInfo.illlist

        /**所有曲目曲名列表 */
        this.songlist = getInfo.songlist
    }

    async init() {

        try {
            if (await readFile.FileReader(path.join(_path, 'user_token.json')) || !(await redis.keys("phiPlugin:userToken:*"))[0]) {
                /**之前写错了，一不小心把.json的文件也当成文件夹创建了，这里要去清除空文件夹 */
                readFile.rmEmptyDir(dataPath)
                /**移动json文件 */
                readFile.movJsonFile(dataPath)
            }
        } catch (error) {
            logger.error(error)
        }


    }


    /**
    * 根据参数模糊匹配返回原曲名称
    * @param {string} mic 别名
    * @param {number} [Distance=0.85] 阈值
    * @returns 原曲名称数组，按照匹配程度降序
    */
    fuzzysongsnick(mic, Distance = 0.85) {
        return getInfo.fuzzysongsnick(mic, Distance)
    }

    /**
     * @param {string} [song=undefined] 原曲曲名
     * @param {boolean} [original=false] 是否仅使用原版曲库
     * @returns {SongsInfo|{each:SongsInfo}}
     */
    info(song = undefined, original = false) {
        if (song)
            return getInfo.info(song, original)
        else
            return getInfo.all_info(original)

    }

    /**获取 chos 文件 
     * @param {string}  fileName 文件名称 含后缀 yaml json
     * @param {string}  fatherPath 路径
     * @param {'JSON'|'YAML'|'CSV'|'TXT'} [style=undefined] 指定格式
    */
    async getData(fileName, fatherPath, style = undefined) {
        return await readFile.FileReader(path.join(fatherPath, fileName), style)
    }

    /**修改 chos 文件为 data 
     * @param {string} fileName 文件名称 含后缀 yaml json
     * @param {any} data 覆写内容
     * @param {string} fatherPath 父路径
     * @param {'JSON'|'YAML'|'TXT'} [style=undefined] 文件类型
    */
    async setData(fileName, data, fatherPath, style = undefined) {
        return await readFile.SetFile(path.join(fatherPath, fileName), data, style)
    }

    /**删除 chos.yaml 文件
     * @param {string} fileName 文件名称 含后缀 yaml json
     * @param {string} fatherPath 路径
    */
    async delData(fileName, fatherPath) {
        if (!await readFile.DelFile(path.join(fatherPath, fileName))) {
            logger.info(`[phi插件] ${chos} 已删除`)
            return false
        } else {
            return true
        }
    }


    /**
     * 获取QQ号对应的存档文件
     * @param {String} id user_id
     * @returns save
     */
    async getsave(id) {
        return await getSave.getSave(id)
    }

    /**
     * 保存QQ号对应的存档文件
     * @param {String} id user_id
     * @param {Object} data 
     */
    async putsave(id, data) {
        return await getSave.putSave(id, data)
    }

    /**
     * 删除QQ号对应的存档文件
     * @param {String} id user_id
     */
    async delsave(id) {
        return await getSave.delSave(id)
    }

    /**
     * 删除QQ号对应的娱乐数据
     * @param {String} id user_id
     */
    async delpluginData(id) {
        return this.delData(`${id}_.json`, pluginDataPath)
    }



    /**
     * 获取QQ号对应的娱乐数据
     * @param {String} user_id 
     * @returns save
     */
    async getpluginData(id) {
        return await getNotes.getPluginData(id)
    }

    /**
     * 保存QQ号对应的娱乐数据
     * @param {String} id user_id
     * @param {Object} data 
     */
    async putpluginData(id, data) {
        return await getNotes.putPluginData(id, data)
    }

    /**
     * 获取并初始化 id 插件相关数据
     * @param {String} id 
     * @param {boolean} [islock=false] 是否锁定
     * @returns 整个data对象
     */
    async getNotesData(id, islock = false) {
        return await getNotes.getNotesData(id, islock)
    }

    /**获取本地图片
     * @param {string} img 文件名
     * @param {string} style 文件格式，默认为png
     */
    getimg(img, style = 'png') {
        return getPic.getimg(img, style)
    }

    /**
     * 获取玩家 Dan 数据
     * @param {string} id QQ号
     * @returns dan[0]
     */
    async getDan(id) {
        return await getSave.getDan(id)
    }

    /**
     * 匹配歌曲名称，根据参数返回原曲名称
     * @param {string} mic 别名
     * @returns 原曲名称
     */
    songsnick(mic) {
        return getInfo.songsnick(mic)
    }

    /**设置别名 原名, 别名 */
    async setnick(mic, nick) {
        return await getInfo.setnick(mic, nick)
    }

    /**
     * 获取歌曲图鉴，曲名为原名
     * @param {any} e 消息
     * @param {string} name 曲名
     * @param {any} data 自定义数据
     * @returns 
     */
    async GetSongsInfoAtlas(e, name, data = undefined) {
        return await pic.GetSongsInfoAtlas(e, name, data)
    }

    /**
     * 通过曲目获取曲目图鉴
     * @param {*} e 消息e
     * @param {string} name 原曲名称
     * @param { {illustration:string, illustrator:string} } data 自定义数据
     * @returns 
     */
    async GetSongsIllAtlas(e, name, data = undefined) {
        return await pic.GetSongsIllAtlas(e, name, data)

    }

    /**
     * 更新存档
     * @param {*} e 
     * @param {PhigrosUser} User 
     * @returns {[number,number]} [rks变化值，note变化值]，失败返回 false
     */
    async buildingRecord(e, User) {
        let old = await this.getsave(e.user_id)

        if (old) {
            if (old.session) {
                if (old.session == User.session) {
                    // send.send_with_At(e, `你已经绑定了该sessionToken哦！将自动执行update...\n如果需要删除统计记录请 ⌈/${Config.getUserCfg('config', 'cmdhead')} unbind⌋ 进行解绑哦！`)
                } else {
                    send.send_with_At(e, `检测到新的sessionToken，将自动更换绑定。如果需要删除统计记录请 ⌈/${Config.getUserCfg('config', 'cmdhead')} unbind⌋ 进行解绑哦！`)

                    await getSave.add_user_token(e.user_id, User.session)
                    old = await this.getsave(e.user_id)

                }
            }
        }

        try {
            let save_info = await User.getSaveInfo()
            if (old && old.saveInfo.modifiedAt.iso.toISOString() == save_info.modifiedAt.iso) {
                return [0, 0]
            }
            const err = await User.buildRecord()
            if (err.length) {
                send.send_with_At(e, "以下曲目无信息，可能导致b19显示错误\n" + err.join('\n'))
            }
        } catch (err) {
            send.send_with_At(e, "绑定失败！QAQ\n" + err)
            logger.error(err)
            return false
        }

        try {
            await this.putsave(e.user_id, User)
        } catch (err) {
            send.send_with_At(e, `保存存档失败！` + err)
            logger.error(err)
            return false
        }


        let now = new Save(User)
        // await now.init()
        /**更新 */
        let history = await getSave.getHistory(e.user_id)
        history.update(now)
        getSave.putHistory(e.user_id, history)


        let pluginData = await getNotes.getNotesData(e.user_id)
        /**修正 */
        if (pluginData.update || pluginData.task_update) {
            /**v1.0,取消对当次更新内容的存储，取消对task的记录，更正scoreHistory */
            /**v1.1,更正scoreHistory */
            /**v1.2,由于曲名错误，删除所有记录，曲名使用id记录 */
            delete pluginData.update
            delete pluginData.task_update
        }

        /**note数量变化 */
        let add_money = 0

        let task = pluginData?.plugin_data?.task
        if (task) {
            for (let id in now.gameRecord) {
                for (let i in task) {
                    if (!task[i]) continue
                    if (!task[i].finished && getInfo.songsid[id] == task[i].song) {
                        let level = Level.indexOf(task[i].request.rank)
                        if (!now.gameRecord[id][level]) continue
                        switch (task[i].request.type) {
                            case 'acc': {
                                if (now.gameRecord[id][level].acc >= task[i].request.value) {
                                    pluginData.plugin_data.task[i].finished = true
                                    pluginData.plugin_data.money += task[i].reward
                                    add_money += task[i].reward
                                }
                                break
                            }
                            case 'score': {
                                if (now.gameRecord[id][level].score >= task[i].request.value) {
                                    pluginData.plugin_data.task[i].finished = true
                                    pluginData.plugin_data.money += task[i].reward
                                    add_money += task[i].reward
                                }
                                break
                            }
                        }
                    }
                }
            }
        }
        await this.putpluginData(e.user_id, pluginData)

        /**rks变化 */
        let add_rks = old ? now.saveInfo.summary.rankingScore - old.saveInfo.summary.rankingScore : 0
        return [add_rks, add_money]
    }

    /**获取best19图片 */
    async getb19(e, data) {
        return await atlas.b19(e, data)
    }

    /**获取update图片 */
    async getupdate(e, data) {
        return await atlas.update(e, data)
    }

    /**获取任务列表图片 */
    async gettasks(e, data) {
        return await atlas.tasks(e, data)
    }

    /**获取个人信息图片 */
    async getuser_info(e, data, kind) {
        return await atlas.user_info(e, data, kind)
    }

    /**获取定级区间成绩 */
    async getlvsco(e, data) {
        return await atlas.lvsco(e, data)
    }

    /**获取单曲成绩 */
    async getsingle(e, data) {
        return await atlas.score(e, data)
    }

    /**获取曲绘图鉴 */
    async getillatlas(e, data) {
        return await atlas.ill(e, data)
    }

    /**获取猜曲绘图片 */
    async getguess(e, data) {
        return await atlas.guess(e, data)
    }

    /**获取随机曲目图片 */
    async getrand(e, data) {
        return await atlas.rand(e, data)
    }

    /**获取曲绘，返回地址，原名
     * @param {string} name 原名
     * @param {'common'|'blur'|'low'} [kind='common'] 
     * @return 网址或文件地址
    */
    getill(name, kind = 'common') {
        return getInfo.getill(name, kind)
    }

    /**
     * 通过id获得头像文件名称
     * @param {string} id 头像id
     * @returns {string} file name
     */
    idgetavatar(id) {
        return getInfo.idgetavatar(id)
    }

    /**
     * 根据曲目id获取原名
     * @param {String} id 曲目id
     * @returns 原名
     */
    idgetsong(id) {
        return getInfo.idgetsong(id)
    }

    /**
     * 通过原曲曲目获取曲目id
     * @param {String} song 原曲曲名
     * @returns 曲目id
     */
    SongGetId(song) {
        return getInfo.SongGetId(song)
    }

    /**
     * 计算等效rks
     * @param {number} acc 
     * @param {number} difficulty 
     * @returns 
     */
    getrks(acc, difficulty) {
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
    comsuggest(rks, difficulty, count = undefined) {
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

}

let get = new getdata()
await get.init()
export default get


/**
 * 处理新成绩
 * @param {Object} pluginData
 * @param {EZ|HD|IN|AT|LEGACY} level 
 * @param {String} id 曲目id
 * @param {LevelRecord} nowRecord 当前成绩
 * @param {LevelRecord} oldRecord 旧成绩
 * @param {Date} new_date 新存档时间
 * @param {Date} old_date 旧存档时间
 */
function add_new_score(pluginData, level, nowRecord) {


    // if (!pluginData.scoreHistory) {
    //     pluginData.scoreHistory = {}
    // }
    // let song = get.idgetsong(songsid)
    // if (!pluginData.scoreHistory[songsid]) {
    //     pluginData.scoreHistory[songsid] = {}
    //     if (oldRecord) {
    //         pluginData.scoreHistory[songsid][level] = [scoreHistory.create(oldRecord.acc, oldRecord.score, old_date, oldRecord.fc)]
    //     }
    // }
    // if (!pluginData.scoreHistory[songsid][level]) {
    //     pluginData.scoreHistory[songsid][level] = []
    // }
    // pluginData.scoreHistory[songsid][level].push(scoreHistory.create(nowRecord.acc, nowRecord.score, new_date, nowRecord.fc))

    let task = pluginData?.plugin_data?.task
    let add_money = 0
    if (task) {
        for (let i in task) {
            if (!task[i]) continue
            if (!task[i].finished && song == task[i].song && level == task[i].request.rank) {
                switch (task[i].request.type) {
                    case 'acc': {
                        if (nowRecord.acc >= task[i].request.value) {
                            pluginData.plugin_data.task[i].finished = true
                            pluginData.plugin_data.money += task[i].reward
                            add_money += task[i].reward
                        }
                        break
                    }
                    case 'score': {
                        if (nowRecord.score >= task[i].request.value) {
                            pluginData.plugin_data.task[i].finished = true
                            pluginData.plugin_data.money += task[i].reward
                            add_money += task[i].reward
                        }
                        break
                    }
                }
            }
        }
    }
    return add_money
}
