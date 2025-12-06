import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import makeRequest from '../model/makeRequest.js'
import makeRequestFnc from '../model/makeRequestFnc.js'
import getFile from '../model/getFile.js'
import getSave from '../model/getSave.js'
import ProgressBar from "../model/progress-bar.js";
import { redisPath } from '../model/constNum.js'
import getBanGroup from '../model/getBanGroup.js'
import getComment from '../model/getComment.js'


const tokenManageData = {}

export class phihelp extends plugin {
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
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*(NOAPI|noapi)$`,
                    fnc: 'noapi'
                },
            ]
        })

    }

    async setApiToken(e) {

        if (await getBanGroup.get(e, 'setApiToken')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, '这里没有连接查分平台哦！')
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
        if (apiToken.includes('\n')) {
            let lines = apiToken.split('\n');
            if (lines.length == 2) {
                try {
                    await makeRequest.setApiToken({ ...makeRequestFnc.makePlatform(e), token: sessionToken, api_token: lines[0], token_new: lines[1] })
                } catch (err) {
                    send.send_with_At(e, '设置 API Token 失败: ' + err.message)
                    return false
                }
                send.send_with_At(e, 'API Token 已设置为: \n' + lines[1])
            } else {
                send.send_with_At(e, '请使用正确的格式设置 API Token！\n格式：\n/setApiToken（换行）<旧Token>（换行）<新Token>\n或\n/setApiToken <新Token>')
                return false
            }
        } else {
            if (/[\s\x00-\x1F\x7F'"\\]/.test(apiToken)) {
                send.send_with_At(e, 'API Token 包含非法字符，请检查后重试！\n格式：\n/setApiToken（换行）<旧Token>（换行）<新Token>\n或\n/setApiToken <新Token>')
                return false
            }
            try {
                await makeRequest.setApiToken({ ...makeRequestFnc.makePlatform(e), token: sessionToken, token_new: apiToken })
            } catch (err) {
                send.send_with_At(e, '设置 API Token 失败: ' + err.message)
                return false
            }
            send.send_with_At(e, 'API Token 已设置为: \n' + apiToken)
        }


        return true
    }

    async tokenList(e) {
        if (await getBanGroup.get(e, 'tokenList')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, '这里没有连接查分平台哦！')
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
            send.send_with_At(e, '获取 Token 列表失败: ' + err.message)
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

    async tokenManage(e) {
        if (await getBanGroup.get(e, 'tokenManage')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, '这里没有连接查分平台哦！')
            return false
        }

        /** @type {string} */
        let msg = e.msg.replace(/^[#/].*?tokenManage\s*/, '');
        let operation = msg.match(/(delete|rmau)/i)?.[1];

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
            send.send_with_At(e, '获取 Token 列表失败: ' + err.message)
            return false
        }

        let force = msg.match('-f')?.[0] ? true : false;

        let choseNum = msg.match(/[0-9]+/)?.[0];

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

    async auth(e) {

        if (await getBanGroup.get(e, 'auth')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, '这里没有连接查分平台哦！')
            return false
        }

        let apiToken = e.msg.replace(/^[#/].*?auth\s*/, '')
        if (/[\s\x00-\x1F\x7F'"\\]/.test(apiToken)) {
            send.send_with_At(e, 'API Token 包含非法字符，请检查后重试！')
            return false
        }

        const sessionToken = await getSave.get_user_token(e.user_id);
        if (!sessionToken) {
            send.send_with_At(e, `本地没有您的tk记录嗷！请先尝试使用tk绑定呐！`)
            return;
        }

        try {
            await makeRequest.setApiToken({ ...makeRequestFnc.makePlatform(e), token: sessionToken, token_new: apiToken })
        } catch (err) {
            send.send_with_At(e, 'API Token 验证失败: ' + err.message)
            return false
        }

        send.send_with_At(e, '验证成功')

        return true
    }

    async clearApiData(e) {
        if (await getBanGroup.get(e, 'clearApiData')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, '这里没有连接查分平台哦！')
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
            send.send_with_At(e, '清除数据失败: ' + err.message)
            return false
        }

        send.send_with_At(e, '数据已清除')

        return true
    }

    async updateUserToken(e) {
        if (!e.isMaster) {
            e.reply("无权限");
            return false;
        }

        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, '这里没有连接查分平台哦！')
            return false
        }

        /**提取redis中user_id数据 */
        send.send_with_At(e, '开始提取user_token，请稍等...')
        console.info('\n[phi-plugin][backup] 开始提取user_token数据...')
        let bar = new ProgressBar('[phi-plugin] user_token提取中', 20)
        /**获取user_token */
        let user_token = []
        console.info('[phi-plugin] 获取user_token列表...')
        // 使用SCAN非阻塞遍历所有userToken键
        let cursor = 0;
        let cnt = 0;
        let vis = 0;
        do {
            let info = await redis.scan(cursor, { MATCH: `${redisPath}:userToken:*`, COUNT: 100 });
            cursor = info.cursor; // 更新游标
            let keys = info.keys; // 获取当前批次的键
            if (keys.length > 0) {
                // 并发获取本批次所有user_token
                let userIds = keys.map(key => key.replace(`${redisPath}:userToken:`, ''));
                let tokenValues = await Promise.all(keys.map(key => redis.get(key)));
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
            send.send_with_At(e, '上传用户Token失败: ' + err.message)
            return false
        }

    }

    async updateComment(e) {
        if (!e.isMaster) {
            e.reply("无权限");
            return false;
        }

        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, '这里没有连接查分平台哦！')
            return false
        }

        send.send_with_At(e, '开始上传评论数据，请稍等...')
        const data = getComment.data;

        const updateData = []

        for (let songId in data) {
            for (let comment of data[songId]) {
                updateData.push({ ...comment, songId });
            }
        }
        logger.info(updateData);
        logger.info(await makeRequest.updateComments({ data: { comments: updateData } }));
    }

    async noapi(e) {

        if (!Config.getUserCfg('config', 'openPhiPluginApi')) {
            send.send_with_At(e, '这里没有连接查分平台哦！')
            return false
        }

        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }
        let userSetting
        try {
            userSetting = await makeRequest.getUserSetting({ ...makeRequestFnc.makePlatform(e) });
        } catch (error) {
            send.send_with_At(e, '获取用户设置失败: ' + error.message);
            return true;
        }
        if (!userSetting.allowDataCollection) {
            try {
                await makeRequest.setUserSetting({ ...makeRequestFnc.makePlatform(e), setting: { allowDataCollection: true } });
            } catch (error) {
                send.send_with_At(e, '设置失败: ' + error.message);
                return true;
            }
            send.send_with_At(e, '感谢您参与数据统计！');
        } else {
            try {
                await makeRequest.setUserSetting({ ...makeRequestFnc.makePlatform(e), setting: { allowDataCollection: false } });
            } catch (error) {
                send.send_with_At(e, '设置失败: ' + error.message);
                return true;
            }
            send.send_with_At(e, '退出数据统计计划成功！');
        }
    }
}
