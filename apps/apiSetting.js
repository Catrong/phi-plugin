import Config from '../components/Config.js'
import send from '../model/render/send.js'
import makeRequest from '../model/api/makeRequest.js'
import ProgressBar from "../model/render/progress-bar.js";
import { USER_API_SETTING_META, USER_API_SETTING_OPTIONS } from '../model/game/constNum.js'
import picmodle from '../model/render/picmodle.js'
import getInfo from '../model/game/getInfo.js'
import getBanGroup from '../model/user/getBanGroup.js'
import getComment from '../model/game/getComment.js'
import phiPluginBase from '../components/baseClass.js'
import logger from '../components/Logger.js'
import { UserCredentials } from '../model/user/userCredentials.js'
import userCredentialStore from '../model/user/userCredentialStore.js'
import { getApiAccessState } from '../model/user/apiPermission.js'
import fCompute from '../model/game/fCompute.js'
import platform from '../components/platform/index.js'
import getNotes from '../model/user/getNotes.js'
import { sendMessage } from '../model/render/message.js'
import { apiSettingMessages } from '../model/render/messages.js'


/**@import {botEvent} from '../components/baseClass.js' */
/** @typedef {'allowDataCollection'|'allowLeaderboard'|'allowDataAggregation'|'allowPlayerIdSearch'|'allowUserIdSearch'} apiSettingKey */

/** @type {Record<apiSettingKey, {title: string, description: string}>} */
const API_USER_SETTING_META = {
    allowDataCollection: {
        title: '允许数据收集',
        description: '是否允许平台收集你的成绩数据用于分析。'
    },
    allowLeaderboard: {
        title: '允许排行榜展示',
        description: '是否允许你的数据出现在排行榜相关展示中。'
    },
    allowDataAggregation: {
        title: '允许数据聚合',
        description: '是否允许平台将你的数据用于群体统计聚合。'
    },
    allowPlayerIdSearch: {
        title: '允许按 PlayerId 搜索',
        description: '是否允许他人通过 PlayerId 检索到你的相关信息。'
    },
    allowUserIdSearch: {
        title: '允许按 UserId 搜索',
        description: '是否允许他人通过用户 ID 检索到你的相关信息。'
    }
}

/** @type {Record<string, apiSettingKey>} */
const API_USER_SETTING_KEY_ALIAS = {
    allowdatacollection: 'allowDataCollection',
    datacollection: 'allowDataCollection',
    collection: 'allowDataCollection',
    数据收集: 'allowDataCollection',
    收集: 'allowDataCollection',

    allowleaderboard: 'allowLeaderboard',
    leaderboard: 'allowLeaderboard',
    榜单: 'allowLeaderboard',
    排行榜: 'allowLeaderboard',

    allowdataaggregation: 'allowDataAggregation',
    dataaggregation: 'allowDataAggregation',
    aggregation: 'allowDataAggregation',
    数据聚合: 'allowDataAggregation',
    聚合: 'allowDataAggregation',

    allowplayeridsearch: 'allowPlayerIdSearch',
    playeridsearch: 'allowPlayerIdSearch',
    playerid: 'allowPlayerIdSearch',
    玩家id搜索: 'allowPlayerIdSearch',
    玩家id: 'allowPlayerIdSearch',

    allowuseridsearch: 'allowUserIdSearch',
    useridsearch: 'allowUserIdSearch',
    userid: 'allowUserIdSearch',
    用户id搜索: 'allowUserIdSearch',
    用户id: 'allowUserIdSearch'
}

/** @type {Record<string, boolean>} */
const API_USER_SETTING_BOOL_ALIAS = {
    true: true,
    false: false,
    on: true,
    off: false,
    yes: true,
    no: false,
    开: true,
    关: false,
    开启: true,
    关闭: false,
    允许: true,
    禁止: false,
    是: true,
    否: false,
    1: true,
    0: false
}

export class phihelp extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-api-set',
            dsc: 'phigrosApi相关指令',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*setApiToken[\\s\\S]*$`,
                    fnc: 'setApiToken'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*(tkls|lstk)$`,
                    fnc: 'tokenList'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*auth.*$`,
                    fnc: 'auth'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*clearApiData$`,
                    fnc: 'clearApiData'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*updateHistory$`,
                    fnc: 'updateHistory'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*updateUserToken$`,
                    fnc: 'updateUserToken'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*updateComment$`,
                    fnc: 'updateComment'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*(apiset)(\\s+.*)?$`,
                    fnc: 'apiset'
                },
            ]
        })

    }

    /**
     * @param {botEvent} e
     * @returns {Promise<boolean>}
     */
    async checkApiEnabled(e) {
        const access = await getApiAccessState(e)
        if (!access.globalEnabled) {
            sendMessage(e, apiSettingMessages.access.notConnected, { at: true })
            return false
        }
        if (!access.capabilityEnabled) {
            sendMessage(e, apiSettingMessages.access.capabilityDisabled, { at: true })
            return false
        }
        if (!access.userEnabled) {
            sendMessage(e, apiSettingMessages.access.userDisabled, { at: true })
            return false
        }
        return true
    }
    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async setApiToken(e) {

        const credentials = UserCredentials.fromEvent(e)

        if (await getBanGroup.get(e, 'setApiToken')) {
            sendMessage(e, apiSettingMessages.setApiToken.banned, { at: true })
            return false
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        const sessionToken = await credentials.getSessionToken()

        if (!sessionToken) {
            sendMessage(e, apiSettingMessages.setApiToken.noLocalTk, { at: true })
            return false
        }

        let apiToken = e.msg.replace(/^[#/].*?setApiToken\s*\n?/, '')
        if (!apiToken) {
            sendMessage(e, apiSettingMessages.setApiToken.specifyToken(), { at: true })
            return true
        }
        if (/[\s\x00-\x1F\x7F'"\\]/.test(apiToken)) {
            sendMessage(e, apiSettingMessages.setApiToken.invalidToken, { at: true })
            return false
        }
        const setTokenResult = await credentials.setApiToken(apiToken)
        if (!setTokenResult) {
            return false
        }
        sendMessage(e, apiSettingMessages.setApiToken.success(apiToken), { at: true })


        return true
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async tokenList(e) {
        const credentials = UserCredentials.fromEvent(e)
        if (await getBanGroup.get(e, 'tokenList')) {
            sendMessage(e, apiSettingMessages.tokenList.banned, { at: true })
            return false
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        const sessionToken = await credentials.getSessionToken()
        if (!sessionToken) {
            sendMessage(e, apiSettingMessages.tokenList.noLocalTk, { at: true })
            return;
        }
        const tokenList = await credentials.listPlatformBindings()
        if (!tokenList) {
            return false
        }

        const currentPlatform = await credentials.platformParams()

        sendMessage(e, apiSettingMessages.tokenList.list(tokenList.platform_data, currentPlatform), { at: true })

        return true
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async auth(e) {

        const credentials = UserCredentials.fromEvent(e)

        if (await getBanGroup.get(e, 'auth')) {
            sendMessage(e, apiSettingMessages.auth.banned, { at: true })
            return false
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        let apiToken = e.msg.replace(/^[#/].*?auth\s*/, '')
        if (/[\s\x00-\x1F\x7F'"\\]/.test(apiToken)) {
            sendMessage(e, apiSettingMessages.auth.invalidToken, { at: true })
            return false
        }

        const apiId = await credentials.getApiId()
        if (!apiId) {
            sendMessage(e, apiSettingMessages.auth.noApiId, { at: true })
            return;
        }
        const sessionToken = await credentials.authenticateApiToken(apiToken)
        if (!sessionToken) {
            return false
        }

        sendMessage(e, apiSettingMessages.auth.success(sessionToken.token), { at: true })

        return true
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async clearApiData(e) {
        const credentials = UserCredentials.fromEvent(e)
        if (await getBanGroup.get(e, 'clearApiData')) {
            sendMessage(e, apiSettingMessages.clearApiData.banned, { at: true })
            return false
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        const sessionToken = await credentials.getSessionToken()
        if (!sessionToken) {
            sendMessage(e, apiSettingMessages.clearApiData.needSstk, { at: true })
            return false;
        }

        this.setContext('confirmClearApiData', false, 30, apiSettingMessages.clearApiData.timeout.text)
        sendMessage(e, apiSettingMessages.clearApiData.confirm, { at: true })

        return true
    }

    async confirmClearApiData() {
        const e = this.e
        const credentials = UserCredentials.fromEvent(e)
        if (e.msg.replace(/\s/g, '') !== '确认') {
            sendMessage(e, apiSettingMessages.confirmClearApiData.cancelled, { at: true })
            this.finish('confirmClearApiData', false)
            return true
        }

        const sessionToken = await credentials.getSessionToken()
        if (!sessionToken) {
            sendMessage(e, apiSettingMessages.clearApiData.needSstk, { at: true })
            this.finish('confirmClearApiData', false)
            return false
        }

        const clearResult = await credentials.deleteApiAccount()
        if (!clearResult) {
            this.finish('confirmClearApiData', false)
            return false
        }

        try {
            await credentials.deleteApiCachedSave()
        } catch (err) {
            logger.warn('[phi-plugin] phi-api 账号已注销，但本地 API 缓存清理失败', err)
        }

        sendMessage(e, apiSettingMessages.confirmClearApiData.cleared, { at: true })
        this.finish('confirmClearApiData', false)

        return true
    }

    /**
     * @param {botEvent} e 
     * @returns 
     */
    async updateUserToken(e) {
        if (!e.isMaster) {
            sendMessage(e, apiSettingMessages.updateUserToken.noPermission)
            return false;
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        /**提取redis中user_id数据 */
        sendMessage(e, apiSettingMessages.updateUserToken.extracting, { at: true })
        console.info('\n[phi-plugin][backup] 开始提取user_token数据...')
        let bar = new ProgressBar('[phi-plugin] user_token提取中', 20)
        /**
         * 获取user_token
         * @type {phigrosToken[]}
         */
        let user_token = []
        console.info('[phi-plugin] 获取user_token列表...')
        const credentialEntries = await userCredentialStore.listSessionCredentials()
        user_token.push(...credentialEntries.values())
        logger.info(`[phi-plugin] 已获取 ${user_token.length} 个 user_token`)
        if (user_token.length > 1000) {
            sendMessage(e, apiSettingMessages.updateUserToken.batchUpload(Math.ceil(user_token.length / 1000) * 5), { at: true })
            for (let i = 0; i < user_token.length; i += 1000) {
                let batch = user_token.slice(i, i + 1000);
                const uploadResult = await makeRequest.setUsersToken(
                    { data: batch },
                    { event: e, errorPrefix: '上传用户Token失败', notifyUser: true },
                )
                if (!uploadResult) {
                    return false
                }
                logger.info(`[phi-plugin] 已上传 ${Math.floor(i / 1000) + 1} / ${Math.ceil(user_token.length / 1000)} 批次`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // 等待1秒
            }
        } else {
            const uploadResult = await makeRequest.setUsersToken(
                { data: user_token },
                { event: e, errorPrefix: '上传用户Token失败', notifyUser: true },
            )
            if (!uploadResult) {
                return false
            }
        }

        sendMessage(e, apiSettingMessages.updateUserToken.success, { at: true })

    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async updateComment(e) {
        if (!e.isMaster) {
            sendMessage(e, apiSettingMessages.updateComment.noPermission)
            return false;
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        sendMessage(e, apiSettingMessages.updateComment.uploading, { at: true })
        const data = getComment.data;

        /**@type {import('../model/game/getComment.js').commentObject[]} */
        const updateData = []

        /** @type {idString[]} */
        const ids = /**@type {any} */ (Object.keys(data));

        for (let songId of ids) {
            for (let comment of data[songId]) {
                updateData.push({ ...comment, songId });
            }
        }

        const updateResult = await makeRequest.updateComments(
            { data: updateData },
            { event: e, errorPrefix: '上传评论数据失败', notifyUser: true },
        )
        if (!updateResult) {
            return false
        }
        logger.info(updateResult);
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async apiset(e) {

        const credentials = UserCredentials.fromEvent(e)

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }

        const token = await credentials.getSessionToken()
        if (!token) {
            sendMessage(e, apiSettingMessages.apiset.noLocalTk, { at: true })
            return true;
        }

        let userSetting = await credentials.getUserSetting()
        if (!userSetting) {
            return true;
        }

        const rawArgs = e.msg.replace(new RegExp(`^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*(NOAPI|noapi|apiset)`, 'i'), '').trim()

        if (!rawArgs) {
            await this.renderApiUserSetting(e, userSetting)
            return true
        }

        const normalized = rawArgs.replace(/[：:=]/g, ' ').replace(/\s+/g, ' ').trim()
        const args = normalized.split(' ')
        if (args.length < 2) {
            sendMessage(e, apiSettingMessages.apiset.missingArgs(), { at: true })
            return true
        }

        const keyInput = args[0].toLowerCase()
        const valueInput = args.slice(1).join('').toLowerCase()

        const settingKey = API_USER_SETTING_KEY_ALIAS[keyInput]
        if (!settingKey) {
            sendMessage(e, apiSettingMessages.apiset.unknownSetting(args[0]), { at: true })
            return true
        }

        const settingValue = API_USER_SETTING_BOOL_ALIAS[valueInput]
        if (settingValue === undefined) {
            sendMessage(e, apiSettingMessages.apiset.invalidValue(args.slice(1).join(' ')), { at: true })
            return true
        }

        const patchSetting = {
            [settingKey]: settingValue
        }

        const setResult = await credentials.setUserSetting(patchSetting)
        if (!setResult) {
            return true;
        }
        sendMessage(e, apiSettingMessages.apiset.success(API_USER_SETTING_META[settingKey].title, settingValue), { at: true })

        userSetting = await credentials.getUserSetting()
        if (!userSetting) {
            return true;
        }

        await this.renderApiUserSetting(e, userSetting)
        return true
    }

    /**
     * 兼容旧命令入口
     * @param {botEvent} e
     */
    async noapi(e) {
        return this.apiset(e)
    }

    /**
     * @param {botEvent} e
        * @param {Partial<Record<apiSettingKey, boolean>>} userSetting
     */
    async renderApiUserSetting(e, userSetting) {
        const pluginData = await getNotes.getNotesData(e.user_id)
        /**
         * @param {keyof typeof USER_API_SETTING_OPTIONS} key
         * @param {string} current
         */
        const buildItem = (key, current) => {
            const options = /** @type {Record<string, { title: string, description: string }>} */ (USER_API_SETTING_OPTIONS[key])
            return {
                key,
                title: USER_API_SETTING_META[key].title,
                description: USER_API_SETTING_META[key].description,
                currentTitle: options[current]?.title || current,
                options: Object.keys(options).map((value) => ({
                    value,
                    title: options[value].title,
                    description: options[value].description,
                    selected: value === current
                }))
            }
        }
        const keys = fCompute.objectKeys(USER_API_SETTING_OPTIONS)

        const items = keys.map(key => {
            return buildItem(key, String(userSetting[key]))
        })

        sendMessage(e, apiSettingMessages.apiset.finalMessage({ image: await picmodle.common(e, 'setting', {
                pageTitle: 'Phi-Plugin API 用户设置',
                pageDescription: '以下设置会同步到查分平台账户权限。',
                items: items,
                background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))]),
                theme: pluginData?.theme || 'default'
            }, 'userSetting') }), { at: true })
    }
}
