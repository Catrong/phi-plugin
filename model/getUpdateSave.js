import { Config } from "../components/index.js";
import logger from "../components/Logger.js";
import PhigrosUser from "../lib/PhigrosUser.js";
import Save from "./class/Save.js";
import { allLevel, LevelNum } from "./constNum.js";
import fCompute from "./fCompute.js";
import getNotes from "./getNotes.js";
import getSave from "./getSave.js";
import getSaveFromApi from "./getSaveFromApi.js";
import makeRequest from "./makeRequest.js";
import makeRequestFnc from "./makeRequestFnc.js";
import send from "./send.js";

/**@import {botEvent} from "../components/baseClass.js" */

export default class getUpdateSave {
    /**
     * 
     * @param {*} e 
     * @param {phigrosToken} [token] sessionToken
     */
    static async getNewSaveFromApi(e, token) {
        let old = await getSaveFromApi.getSave(e.user_id)

        let newSaveInfo = await makeRequest.getCloudSaveInfo({ token: token, ...makeRequestFnc.makePlatform(e) })
        if (newSaveInfo.modifiedAt.iso != old?.saveInfo?.modifiedAt?.iso?.toISOString()) {
            let newSave = await makeRequest.getCloudSaves({ token: token, ...makeRequestFnc.makePlatform(e) })
            getSaveFromApi.putSave(e.user_id, newSave)
            let result = new Save(newSave)
            await result.init()
            await getSaveFromApi.putSave(e.user_id, result);
            if (token) {
                getSave.add_user_token(e.user_id, token)
            }
            let added_rks_notes = await this.buildingRecord(old, newSave, e)
            return { save: result, added_rks_notes }
        } else {
            return { save: old, added_rks_notes: [0, 0] }
        }
    }

    /**
     * 
     * @param {apiUserId} uid 
     * @returns {Promise<Save>}
     */
    static async getUIDSaveFromApi(uid) {
        let newSave = await makeRequest.getCloudSaves({ api_user_id: uid });
        let result = new Save(newSave)
        await result.init()
        return result
    }

    /**
     * 
     * @param {*} e e
     * @param {phigrosToken} token 
     * @param {boolean} [global] 是否是国际服
     * @returns 
     */
    static async getNewSaveFromLocal(e, token, global = undefined) {
        let old = await getSave.getSave(e.user_id)
        token = token ?? old?.session
        let User = new PhigrosUser(token, global || old?.global);
        try {
            let save_info = await User.getSaveInfo()
            if (old && old.saveInfo.modifiedAt.iso.getTime() == new Date(save_info.modifiedAt.iso).getTime()) {
                // return { save: old, added_rks_notes: [0, 0] }
            }
            await User.buildRecord()
        } catch (err) {
            if (e.bot?.adapter?.name !== 'QQBot') {
                send.send_with_At(e, "更新失败！QAQ\n" + err)
            } else {
                send.send_with_At(e, "更新失败！QAQ\n请稍后重试")
            }
            logger.error(err)
            return undefined
        }

        try {
            await getSave.putSave(e.user_id, User)
        } catch (err) {
            send.send_with_At(e, `保存存档失败！` + err)
            logger.error(err)
            return undefined
        }
        let now = new Save(User)

        if (old) {
            if (old.session) {
                if (old.session == User.session) {
                    // send.send_with_At(e, `你已经绑定了该sessionToken哦！将自动执行update...\n如果需要删除统计记录请 ⌈/${Config.getUserCfg('config', 'cmdhead')} unbind⌋ 进行解绑哦！`)
                } else {
                    send.send_with_At(e, `检测到新的sessionToken，将自动更换绑定。如果需要删除统计记录请 ⌈/${Config.getUserCfg('config', 'cmdhead')} unbind⌋ 进行解绑哦！`)

                    await getSave.add_user_token(e.user_id, User.session)
                    old = await getSave.getSave(e.user_id)

                }
            }
        }


        // await now.init()
        /**更新 */
        let history = await getSave.getHistory(e.user_id)
        history.update(now)
        getSave.putHistory(e.user_id, history)

        let added_rks_notes = await this.buildingRecord(old, now, e)
        return { save: now, added_rks_notes }
    }

    /**
     * 更新存档
     * @param {botEvent} e 
     * @param {Save | oriSave | undefined} old
     * @param {Save | oriSave} now 
     * @returns {Promise<[number,number]>} [rks变化值，note变化值]，失败返回 false
     */
    static async buildingRecord(old = undefined, now, e) {


        let notesData = await getNotes.getNotesData(e.user_id)
        /**删除旧字段 */
        // @ts-ignore
        if (notesData.update || notesData.task_update) {
            // @ts-ignore
            delete notesData.update
            // @ts-ignore
            delete notesData.task_update
        }

        /**note数量变化 */
        let add_money = 0

        let task = notesData?.task
        if (task) {
            for (let id of fCompute.objectKeys(now.gameRecord)) {
                for (let i in task) {
                    if (!task[i]) continue
                    if (!task[i].finished && id == task[i].song) {
                        let level = LevelNum[task[i].request.rank]
                        if (!now.gameRecord[id][level]) continue
                        switch (task[i].request.type) {
                            case 'acc': {
                                if (now.gameRecord[id][level].acc >= task[i].request.value) {
                                    notesData.task[i].finished = true
                                    notesData.money += task[i].reward
                                    add_money += task[i].reward
                                }
                                break
                            }
                            case 'score': {
                                if (now.gameRecord[id][level].score >= task[i].request.value) {
                                    notesData.task[i].finished = true
                                    notesData.money += task[i].reward
                                    add_money += task[i].reward
                                }
                                break
                            }
                        }
                    }
                }
            }
        }
        getNotes.putNotesData(e.user_id, notesData)

        /**rks变化 */
        let add_rks = old ? now.saveInfo.summary.rankingScore - old.saveInfo.summary.rankingScore : 0
        return [add_rks, add_money]
    }

    /**
     * 
     * @param {botEvent} e 
     * @param {(keyof saveHistoryObject)[]} field 
     */
    static async getHistoryFromApi(e, field) {
        const sessionToken = await getSave.get_user_token(e.user_id);
        if (!sessionToken) {
            if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
                send.send_with_At(e, "请先绑定sessionToken哦！")
                return null;
            }
            try {
                return await getSaveFromApi.getHistory(e, field)
            } catch (err) {
                logger.warn('[phi-plugin]获取历史记录失败', err)
                send.send_with_At(e, "从API获取历史记录失败，请稍后重试或绑定sessionToken后重试哦");
                return null;
            }
        }
        let oldHistory = await getSave.getHistory(e.user_id);
        if (oldHistory) {
            try {
                await makeRequest.setHistory({ ...makeRequestFnc.makePlatform(e), token: sessionToken, data: oldHistory });
            } catch (err) {
                logger.warn('[phi-plugin]上传历史记录失败', err)
            }
        }
        try {
            return await getSaveFromApi.getHistory(e, field)
        } catch (err) {
            logger.warn('[phi-plugin]获取历史记录失败', err)
            send.send_with_At(e, "从API获取历史记录失败，将使用本地存档的历史记录哦");
            return oldHistory;
        }
    }
}