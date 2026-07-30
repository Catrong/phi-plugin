import Config from '../components/Config.js';
import Version from '../components/Version.js';
import phiPluginBase from '../components/baseClass.js';
import logger from '../components/Logger.js';
import send from '../model/send.js';
import botApiAuth, { getPhiApiUserMessage } from '../model/botApiAuth.js';

export class phiBotClient extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-api-bot-client',
            dsc: '查分API Bot身份管理',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*(重置API Bot身份|resetApiBot)$`,
                    fnc: 'resetApiBot',
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})\\s*(获取Bot认领链接|botClaimLink)$`,
                    fnc: 'claimLink',
                },
            ],
        });
    }

    /** @param {import('../components/baseClass.js').botEvent} e */
    async resetApiBot(e) {
        if (!e.isMaster) return false;
        try {
            const issued = await botApiAuth.reset(Version.ver);
            logger.mark(`[phi-plugin] API Bot身份已由master重置：${issued.clientId}`);
            const message = `API Bot身份已重置。\nclientId: ${issued.clientId}\n认领链接: ${issued.claimUrl || '请重新获取'}`;
            if (e.isGroup) {
                send.send_with_At(e, 'API Bot身份已重置，clientId与认领链接仅在控制台输出。');
                logger.mark(message);
            } else {
                send.send_with_At(e, message);
            }
        } catch (/** @type {any} */ error) {
            send.send_with_At(e, `重置失败：${getPhiApiUserMessage(error)}`);
        }
        return true;
    }

    /** @param {import('../components/baseClass.js').botEvent} e */
    async claimLink(e) {
        if (!e.isMaster) return false;
        try {
            const claim = await botApiAuth.getClaimLink();
            if (e.isGroup) {
                send.send_with_At(e, '认领链接仅在私聊或控制台输出。');
                logger.mark(`[phi-plugin] Bot认领链接：${claim.claimUrl}`);
            } else {
                send.send_with_At(e, `Bot认领链接（15分钟有效）：\n${claim.claimUrl}`);
            }
        } catch (/** @type {any} */ error) {
            send.send_with_At(e, `获取失败：${getPhiApiUserMessage(error)}`);
        }
        return true;
    }
}
