import Config from '../components/Config.js'
import send from '../model/send.js'
import makeRequest from '../model/makeRequest.js'
import makeRequestFnc from '../model/makeRequestFnc.js'
import getSave from '../model/getSave.js'
import ProgressBar from "../model/progress-bar.js";
import { redisPath, USER_API_SETTING_META, USER_API_SETTING_OPTIONS } from '../model/constNum.js'
import picmodle from '../model/picmodle.js'
import getInfo from '../model/getInfo.js'
import getBanGroup from '../model/getBanGroup.js'
import getComment from '../model/getComment.js'
import phiPluginBase from '../components/baseClass.js'
import logger from '../components/Logger.js'
import getSaveFromApi from '../model/getSaveFromApi.js'
import { getApiAccessState } from '../model/apiPermission.js'
import fCompute from '../model/fCompute.js'


/**@import {botEvent} from '../components/baseClass.js' */
/** @type {Record<string, any>} */
const tokenManageData = {}

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
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*(token|tk)(Manage|mng|manage).*$`,
                    fnc: 'tokenManage'
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
            send.send_with_At(e, '这里没有连接查分平台哦！')
            return false
        }
        if (!access.userEnabled) {
            send.send_with_At(e, '你已在本地用户设置中禁用 API 功能，可在 /myset 中重新开启。')
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

        if (await getBanGroup.get(e, 'setApiToken')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        const sessionToken = await getSave.get_user_token(e.user_id);

        if (!sessionToken) {
            send.send_with_At(e, `本地没有您的tk记录嗷！请先尝试使用tk绑定呐！`)
            return false
        }

        let apiToken = e.msg.replace(/^[#/].*?setApiToken\s*\n?/, '')
        if (!apiToken) {
            send.send_with_At(e, `请输入apiToken！\n格式：\n设置密码：/${Config.getUserCfg('config', 'cmdhead')} setApiToken <新Token> `)
            return true
        }
        if (/[\s\x00-\x1F\x7F'"\\]/.test(apiToken)) {
            send.send_with_At(e, 'API Token 包含非法字符，请检查后重试！\n格式：\n/setApiToken <新Token>')
            return false
        }
        try {
            await makeRequest.setApiToken({ ...makeRequestFnc.makePlatform(e), token: sessionToken, token_new: apiToken })
        } catch (err) {
            send.send_with_At(e, ['设置 API Token 失败: ', err])
            return false
        }
        send.send_with_At(e, 'API Token 已设置为: \n' + apiToken)


        return true
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async tokenList(e) {
        if (await getBanGroup.get(e, 'tokenList')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        const sessionToken = await getSave.get_user_token(e.user_id);
        if (!sessionToken) {
            send.send_with_At(e, `本地没有您的tk记录嗷！请先尝试使用tk绑定呐！`)
            return;
        }
        let tokenList = null
        try {
            tokenList = await makeRequest.tokenList({ ...makeRequestFnc.makePlatform(e), token: sessionToken })
        } catch (err) {
            send.send_with_At(e, ['获取 Token 列表失败: ', err])
            return false
        }

        let resMsg = `已绑定${tokenList.platform_data.length}个平台\n`

        tokenList.platform_data.forEach((item, index) => {
            if (e.bot?.adapter?.name == item.platform_name && e.user_id == item.platform_id) {
                resMsg += `${index + 1}.（当前）\n`
            } else {
                resMsg += `${index + 1}.\n`
            }
            resMsg += `平台: ${item.platform_name}\n`
            resMsg += `平台ID: ${item.platform_id}\n`
            resMsg += `创建时间: ${item.create_at}\n`
            resMsg += `更新时间: ${item.update_at}\n`
            resMsg += `权限: ${item.authentication}\n`
        })

        send.send_with_At(e, resMsg)

        return true
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async tokenManage(e) {
        if (await getBanGroup.get(e, 'tokenManage')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        /** @type {string} */
        let msg = e.msg.replace(/^[#/].*?tokenManage\s*/, '');
        /** @type {'delete'|'rmau'|undefined} */
        let operation = /**@type {any} */ (msg.match(/(delete|rmau)/i)?.[1]);

        if (!operation) {
            send.send_with_At(e, `请指定操作类型！\n类型：\ndelete - 解绑对应编号平台`);
            return false;
        }

        const sessionToken = await getSave.get_user_token(e.user_id);
        if (!sessionToken) {
            send.send_with_At(e, `本地没有您的tk记录嗷！请先尝试使用tk绑定呐！`)
            return;
        }

        let tokenList = null
        try {
            tokenList = await makeRequest.tokenList({ ...makeRequestFnc.makePlatform(e), token: sessionToken });
        } catch (err) {
            send.send_with_At(e, ['获取 Token 列表失败: ', err])
            return false
        }

        let force = msg.match('-f')?.[0] ? true : false;

        let choseNum = Number(msg.match(/[0-9]+/)?.[0]);

        if (choseNum) {
            if (choseNum > tokenList.platform_data.length) {
                send.send_with_At(e, `只找到了${tokenList.platform_data.length}个绑定平台呐QAQ！`);
                return false;
            }
            let index = choseNum - 1;
            let tarPlatform = tokenList.platform_data[index];
            if (force) {
                try {
                    await makeRequest.tokenManage({
                        ...makeRequestFnc.makePlatform(e), token: sessionToken, data: {
                            platform: tarPlatform.platform_name,
                            platform_id: tarPlatform.platform_id,
                            operation
                        }
                    });
                    send.send_with_At(e, `操作成功`);
                } catch (err) {
                    send.send_with_At(e, `操作失败！\n${err}`);
                }
            } else {
                let vis = Date.now()
                tokenManageData[e.user_id] = {
                    vis,
                    tarPlatform,
                    operation
                }
                setTimeout(() => {
                    if (tokenManageData[e.user_id]?.vis == vis) {
                        delete tokenManageData[e.user_id];
                    }
                }, 30000)
                this.setContext('tokenManageChose', false, 30, '超时已取消，请注意 @Bot 进行回复哦！')
                send.send_with_At(e, `请确认操作：\n平台: ${tarPlatform.platform_name}\n平台ID: ${tarPlatform.platform_id}\n操作: ${operation}\n（确认/取消）`);
            }
        } else {
            send.send_with_At(e, '请输入需要操作的平台编号呐QAQ！');
        }
        return true
    }

    /**
     * 
     * @returns 
     */
    async tokenManageChose() {
        let e = this.e;
        /** @type {string} */
        let msg = this.e.msg;

        if (msg.replace(/\s/g, '') == '确认') {
            let { tarPlatform, operation } = tokenManageData[e.user_id];

            const sessionToken = await getSave.get_user_token(e.user_id);
            if (!sessionToken) {
                send.send_with_At(e, `本地没有您的tk记录嗷！请先尝试使用tk绑定呐！`)
                return;
            }

            try {
                await makeRequest.tokenManage({
                    ...makeRequestFnc.makePlatform(e), token: sessionToken, data: {
                        platform: tarPlatform.platform_name,
                        platform_id: tarPlatform.platform_id,
                        operation
                    }
                });
                send.send_with_At(e, `操作成功`);
            } catch (err) {
                send.send_with_At(e, `操作失败！\n${err}`);
            }
        } else {
            send.send_with_At(e, `已取消`);
        }

        delete tokenManageData[e.user_id];

        this.finish('tokenManageChose', false)

    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async auth(e) {

        if (await getBanGroup.get(e, 'auth')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        let apiToken = e.msg.replace(/^[#/].*?auth\s*/, '')
        if (/[\s\x00-\x1F\x7F'"\\]/.test(apiToken)) {
            send.send_with_At(e, 'API Token 包含非法字符，请检查后重试！')
            return false
        }

        const apiId = await getSaveFromApi.get_user_apiId(e.user_id);
        if (!apiId) {
            send.send_with_At(e, `本地没有您的apiId记录嗷！请尝试重新绑定呐！`)
            return;
        }
        let sessionToken = null
        try {
            sessionToken = await makeRequest.getPgrToken({ ...makeRequestFnc.makePlatform(e), api_token: apiToken })
        } catch (err) {
            send.send_with_At(e, ['API Token 验证失败: ', err])
            return false
        }

        send.send_with_At(e, `验证成功！\n您的用户Token为：\n${sessionToken.token}\n请妥善保管您的Token哦~`);

        getSave.add_user_token(e.user_id, sessionToken.token);

        return true
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async clearApiData(e) {
        if (await getBanGroup.get(e, 'clearApiData')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        const sessionToken = await getSave.get_user_token(e.user_id);
        if (!sessionToken) {
            send.send_with_At(e, `本地没有您的tk记录嗷！请先尝试使用tk绑定呐！`)
            return;
        }

        try {
            await makeRequest.clear({ ...makeRequestFnc.makePlatform(e), token: sessionToken })
        } catch (err) {
            send.send_with_At(e, ['清除数据失败: ', err])
            return false
        }

        send.send_with_At(e, '数据已清除')

        return true
    }

    /**
     * @param {botEvent} e 
     * @returns 
     */
    async updateUserToken(e) {
        if (!e.isMaster) {
            e.reply("无权限");
            return false;
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        /**提取redis中user_id数据 */
        send.send_with_At(e, '开始提取user_token，请稍等...')
        console.info('\n[phi-plugin][backup] 开始提取user_token数据...')
        let bar = new ProgressBar('[phi-plugin] user_token提取中', 20)
        /**
         * 获取user_token
         * @type {phigrosToken[]}
         */
        let user_token = []
        console.info('[phi-plugin] 获取user_token列表...')
        // 使用SCAN非阻塞遍历所有userToken键
        let cursor = 0;
        let cnt = 0;
        let vis = 0;
        do {
            /** @type {{cursor:number,keys:string[]}} */
            let info =
                // @ts-ignore
                (await redis.scan(cursor, { MATCH: `${redisPath}:userToken:*`, COUNT: 100 }));
            cursor = info.cursor; // 更新游标
            let keys = info.keys; // 获取当前批次的键
            if (keys.length > 0) {
                // 并发获取本批次所有user_token
                let userIds = keys.map(key => key.replace(`${redisPath}:userToken:`, ''));
                let tokenValues = await Promise.all(keys.map(key =>
                    // @ts-ignore
                    redis.get(key)
                ));
                userIds.forEach((user_id, idx) => {
                    user_token.push(tokenValues[idx]);
                });
                cnt += keys.length;
                if (Math.floor(cnt / 1000) > vis) {
                    vis = Math.floor(cnt / 1000);
                    logger.info(`[phi-plugin] 已获取 ${vis}k 个 user_token`);
                }
            }
        } while (cursor != 0);
        try {
            if (user_token.length > 1000) {
                send.send_with_At(e, `数据量过大，开始分批上传，预计${Math.ceil(user_token.length / 1000) * 5}秒...`);
                for (let i = 0; i < user_token.length; i += 1000) {
                    let batch = user_token.slice(i, i + 1000);
                    await makeRequest.setUsersToken({ data: batch });
                    logger.info(`[phi-plugin] 已上传 ${Math.floor(i / 1000) + 1} / ${Math.ceil(user_token.length / 1000)} 批次`);
                    await new Promise(resolve => setTimeout(resolve, 5000)); // 等待1秒
                }
            } else {
                await makeRequest.setUsersToken({ data: user_token });
            }
            send.send_with_At(e, '上传用户Token成功')

        } catch (err) {
            send.send_with_At(e, ['上传用户Token失败: ', err])
            return false
        }

    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async updateComment(e) {
        if (!e.isMaster) {
            e.reply("无权限");
            return false;
        }

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        send.send_with_At(e, '开始上传评论数据，请稍等...')
        const data = getComment.data;

        /**@type {import('../model/getComment.js').commentObject[]} */
        const updateData = []

        /** @type {idString[]} */
        const ids = /**@type {any} */ (Object.keys(data));

        for (let songId of ids) {
            for (let comment of data[songId]) {
                updateData.push({ ...comment, songId });
            }
        }

        logger.info(await makeRequest.updateComments({ data: updateData }));
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async apiset(e) {

        if (!await this.checkApiEnabled(e)) {
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }

        const token = await getSave.get_user_token(e.user_id)
        if (!token) {
            send.send_with_At(e, `本地没有您的tk记录嗷！请先尝试使用tk绑定呐！`)
            return true;
        }

        let userSetting
        try {
            userSetting = await makeRequest.getUserSetting({ ...makeRequestFnc.makePlatform(e), token });
        } catch (error) {
            send.send_with_At(e, '获取用户设置失败: ' + error);
            return true;
        }

        const usage = [
            '用法：',
            `/${Config.getUserCfg('config', 'cmdhead')} apiset`,
            `/${Config.getUserCfg('config', 'cmdhead')} apiset 数据收集 开`,
            `/${Config.getUserCfg('config', 'cmdhead')} apiset allowLeaderboard false`,
            '可设置项：allowDataCollection / allowLeaderboard / allowDataAggregation / allowPlayerIdSearch / allowUserIdSearch',
            '可选值：true/false、on/off、开/关、允许/禁止'
        ].join('\n')

        const rawArgs = e.msg.replace(new RegExp(`^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*(NOAPI|noapi|apiset)`, 'i'), '').trim()

        if (!rawArgs) {
            await this.renderApiUserSetting(e, userSetting)
            return true
        }

        const normalized = rawArgs.replace(/[：:=]/g, ' ').replace(/\s+/g, ' ').trim()
        const args = normalized.split(' ')
        if (args.length < 2) {
            send.send_with_At(e, `参数不足，请提供“设置项 + 目标值”。\n${usage}`)
            return true
        }

        const keyInput = args[0].toLowerCase()
        const valueInput = args.slice(1).join('').toLowerCase()

        const settingKey = API_USER_SETTING_KEY_ALIAS[keyInput]
        if (!settingKey) {
            send.send_with_At(e, `未知设置项：${args[0]}\n${usage}`)
            return true
        }

        const settingValue = API_USER_SETTING_BOOL_ALIAS[valueInput]
        if (settingValue === undefined) {
            send.send_with_At(e, `无效值：${args.slice(1).join(' ')}\n${usage}`)
            return true
        }

        const patchSetting = {
            [settingKey]: settingValue
        }

        try {
            await makeRequest.setUserSetting({ ...makeRequestFnc.makePlatform(e), token, setting: patchSetting });
            send.send_with_At(e, `设置成功：${API_USER_SETTING_META[settingKey].title} -> ${settingValue ? '开启' : '关闭'}`)
        } catch (error) {
            send.send_with_At(e, '设置失败: ' + error);
            return true;
        }

        try {
            userSetting = await makeRequest.getUserSetting({ ...makeRequestFnc.makePlatform(e), token });
        } catch (error) {
            send.send_with_At(e, '获取最新用户设置失败: ' + error);
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

        send.send_with_At(e, await picmodle.common(e, 'setting', {
            pageTitle: 'Phi-Plugin API 用户设置',
            pageDescription: '以下设置会同步到查分平台账户权限。',
            items: items,
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))]),
            theme: 'default'
        }, 'userSetting'))
    }
}
