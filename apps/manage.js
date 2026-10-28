import Config from '../components/Config.js';
import picmodle from '../model/render/picmodle.js';
import getBackup from '../model/save/getBackup.js';
import fs from 'node:fs';
import { backupPath } from '../model/filesystem/path.js';
import path from 'node:path';
import fCompute from '../model/game/fCompute.js';
import getRksRank from '../model/game/getRksRank.js';
import getSave from '../model/save/getSave.js';
import userCredentialStore from '../model/user/userCredentialStore.js';
import { redisPath } from '../model/game/constNum.js';
import phiPluginBase from '../components/baseClass.js';
import logger from '../components/Logger.js';
import { redis } from '../components/platform/index.js';
import { sendMessage } from '../model/render/message.js';
import { manageMessages } from '../model/render/messages.js';

/**@import {botEvent} from '../components/baseClass.js' */

let banSetting = ["help", "bind", "b19", "wb19", "song", "ranklist", "fnc", "tipgame", "guessgame", "ltrgame", "fribgame", "grksgame", "sign", "setting", "dan", "apiSetting"]

export class phiset extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-manage',
            dsc: 'phigros屁股肉管理',
            event: 'message',
            priority: 1000,
            rule: [
                // {
                //     reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(禁用|ban).*$`,
                //     fnc: 'ban'
                // },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*repu$`,
                    fnc: 'restartpu'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*backup(\\s*back)?$`,
                    fnc: 'backup'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*restore$`,
                    fnc: 'restore'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*get .*$`,
                    fnc: 'get'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*del .*$`,
                    fnc: 'del'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*allow .*$`,
                    fnc: 'allow'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*ban .*$`,
                    fnc: 'ban'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*unban .*$`,
                    fnc: 'unban'
                }
            ]
        })

    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async restartpu(e) {
        if (!this.e.isMaster) {
            return false
        }
        try {
            await picmodle.restart()
            sendMessage(e, manageMessages.restartpu.success, { at: true })
        } catch (/**@type {any} */err) {
            sendMessage(e, manageMessages.restartpu.failed(err), { at: true })
        }
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async backup(e) {
        if (!e.isMaster) {
            return false
        }
        sendMessage(e, manageMessages.backup.starting, { at: true })
        setTimeout(async () => {
            try {
                await getBackup.backup(e)
            } catch (/**@type {any} */err) {
                logger.info(err)
                sendMessage(e, manageMessages.backup.failed(err), { at: true })
            }
        }, 100);
        return true
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    restore(e) {
        if (!e.isMaster) {
            return false
        }
        try {
            let msg = ''
            for (let i in fs.readdirSync(backupPath)) {
                msg += `[${i}]${fs.readdirSync(backupPath)[i]}\n`
            }
            sendMessage(e, manageMessages.restore.chooseList(msg), { at: true })
            this.setContext('doRestore', false, 30, manageMessages.restore.timeout.text)
        } catch (/**@type {any} */err) {
            logger.info(err)
            sendMessage(e, manageMessages.restore.failed(err), { at: true })
        }

    }

    async doRestore() {
        let e = this.e
        if (!e.isMaster) {
            return false
        }

        try {
            let fileName = fs.readdirSync(backupPath)[Number(e.msg.replace(/\s*/g, ''))]
            let filePath = path.join(backupPath, fileName)
            await getBackup.restore(filePath)
            sendMessage(e, manageMessages.doRestore.success(e.msg, fs.readdirSync(backupPath).reverse()[Number(e.msg.replace(/s*/g, ''))]), { at: true })
        } catch (err) {
            logger.info(err)
            sendMessage(e, manageMessages.doRestore.notFound(e.msg), { at: true })
        }
        this.finish('doRestore', false)
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async get(e) {
        if (!e.isMaster) {
            return false
        }
        let msg = Number(e.msg.match(/[0-9]*$/)?.[0])
        if (!msg || msg < 1) {
            sendMessage(e, manageMessages.get.invalidIndex, { at: true })
            return false
        }
        let token = await getRksRank.getRankUser(msg - 1, msg)
        sendMessage(e, manageMessages.get.rankList(token), { at: true })
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async del(e) {
        if (!e.isMaster) {
            return false
        }
        let msg = e.msg.match(/[0-9a-zA-Z]{25}$/)?.[0]
        if (!msg) {
            sendMessage(e, manageMessages.del.invalidToken, { at: true })
            return false
        }
        /**@type {phigrosToken} */
        const sessionToken = /** @type {any} */ (msg);
        await getSave.deleteSaveBySessionToken(sessionToken)
        await userCredentialStore.banSessionToken(sessionToken)
        sendMessage(e, manageMessages.del.success, { at: true })
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async allow(e) {
        if (!e.isMaster) {
            return false
        }
        let msg = e.msg.match(/[0-9a-zA-Z]{25}$/)?.[0]
        if (!msg) {
            sendMessage(e, manageMessages.allow.invalidToken, { at: true })
            return false
        }
        /**@type {phigrosToken} */
        const sessionToken = /** @type {any} */ (msg);
        await userCredentialStore.allowSessionToken(sessionToken)
        sendMessage(e, manageMessages.allow.success, { at: true })
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async ban(e) {
        if (!fCompute.is_admin(e) && !e.isMaster) {
            return false
        }
        if (!e.group_id) {
            sendMessage(e, manageMessages.ban.groupOnly, { at: true })
            return false
        }

        let msg = e.msg.replace(/^.*ban\s*/, '');
        switch (msg) {
            case 'all': {
                for (let i in banSetting) {
                    // @ts-ignore
                    await redis.set(`${redisPath}:banGroup:${e.group_id}:${banSetting[i]}`, 1);
                }
                break
            }
            default: {
                for (let i in banSetting) {
                    if (banSetting[i] == msg) {
                        // @ts-ignore
                        await redis.set(`${redisPath}:banGroup:${e.group_id}:${banSetting[i]}`, 1);
                        break
                    }
                }
                break
            }
        }
        // console.info(await redis.keys(`${redisPath}:banGroup:*`))
        sendMessage(e, manageMessages.ban.bannedList(e.group_id, (await redis.keys(`${redisPath}:banGroup:${e.group_id}:*`)).join('\n').replace(new RegExp(`${redisPath}:banGroup:${e.group_id}:`, 'g'), '')), { at: true })
    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async unban(e) {
        if (!e.isAdmin && !e.isMaster) {
            return false
        }
        if (!e.group_id) {
            sendMessage(e, manageMessages.unban.groupOnly, { at: true })
            return false
        }
        let msg = e.msg.replace(/^.*unban\s*/, '');
        switch (msg) {
            case 'all': {
                for (let i in banSetting) {
                    // @ts-ignore
                    await redis.del(`${redisPath}:banGroup:${e.group_id}:${banSetting[i]}`);
                }
                break
            }
            default: {
                for (let i in banSetting) {
                    if (banSetting[i] == msg) {
                        // @ts-ignore
                        await redis.del(`${redisPath}:banGroup:${e.group_id}:${banSetting[i]}`);
                        break
                    }
                }
                break
            }
        }
        // console.info(await redis.keys(`${redisPath}:banGroup:*`))
        sendMessage(e, manageMessages.unban.bannedList(e.group_id, (await redis.keys(`${redisPath}:banGroup:${e.group_id}:*`)).join('\n').replace(new RegExp(`${redisPath}:banGroup:${e.group_id}:`, 'g'), '')), { at: true })
    }
}
