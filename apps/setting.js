import plugin from '../../../lib/plugins/plugin.js';
import Config from '../components/Config.js';
import send from '../model/send.js';
import atlas from '../model/picmodle.js';
import getBackup from '../model/getBackup.js';
import fs from 'node:fs';
import { backupPath } from '../model/path.js';
import path from 'node:path';
import fCompute from '../model/fCompute.js';

export class phiset extends plugin {
    constructor() {
        super({
            name: 'phi-setting',
            dsc: 'phigros屁股肉设置',
            event: 'message',
            priority: 1000,
            rule: [
                // {
                //     reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(禁用|ban).*$`,
                //     fnc: 'ban'
                // },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})\\s*repu$`,
                    fnc: 'restartpu'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})\\s*backup(\\s*back)?$`,
                    fnc: 'backup'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})\\s*restore$`,
                    fnc: 'restore'
                },
            ]
        })

    }

    async ban(e) {
        if (e.msg.match(/guess|(猜)曲绘/g)) {
            Config.getDefOrConfig('config', 'ban').includes(e)
        }
    }

    async restartpu(e) {
        if (!(this.e.is_admin || this.e.isMaster)) {
            return true
        }
        try {
            await atlas.restart()
            send.send_with_At(e, `成功`)
        } catch (err) {
            send.send_with_At(e, err)
        }
    }

    async backup(e) {
        if (!(this.e.is_admin || this.e.isMaster)) {
            return true
        }
        try {
            let zip = await getBackup.backup()
            send.send_with_At(e, `${zip.zipName} 成功备份到 ./backup 目录下`)
            if (e.msg.replace(/^[#/].*backup/, '').includes('back')) {
                fCompute.sendFile(e, await zip.zip.generateAsync({ type: 'nodebuffer' }), zip.zipName)
            }
        } catch (err) {
            logger.info(err)
            send.send_with_At(e, err)
        }
    }

    restore(e) {
        if (!(this.e.is_admin || this.e.isMaster)) {
            return true
        }
        try {
            let msg = ''
            for (let i in fs.readdirSync(backupPath).reverse()) {
                msg += `[${i}]${fs.readdirSync(backupPath)[i]}\n`
            }
            send.send_with_At(e, '请选择需要恢复的备份文件：\n' + msg)
            this.setContext('doRestore', false, 30, '超时已取消，请注意 @Bot 进行回复哦！')
        } catch (err) {
            logger.info(err)
            send.send_with_At(e, err)
        }

    }

    async doRestore() {
        let e = this.e
        if (!(this.e.is_admin || this.e.isMaster)) {
            return true
        }

        try {
            let fileName = fs.readdirSync(backupPath)[Number(e.msg.replace(/\s*/g, ''))]
            let filePath = path.join(backupPath, fileName)
            await getBackup.restore(filePath)
            send.send_with_At(e, `[${e.msg}] ${fs.readdirSync(backupPath).reverse()[e.msg.replace(/\s*/g, '')]} 恢复成功`)
        } catch (err) {
            logger.info(err)
            send.send_with_At(e, [`第[${e.msg}]项不存在QAQ！`, err])
        }
        this.finish('doRestore', false)
    }

}