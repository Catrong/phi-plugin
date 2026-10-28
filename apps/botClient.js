import Config from '../components/Config.js';
import Version from '../components/Version.js';
import phiPluginBase from '../components/baseClass.js';
import logger from '../components/Logger.js';
import botApiAuth from '../model/api/botApiAuth.js';
import { getPhiApiUserMessage } from '../model/api/phiApiErrors.js';
import { sendMessage } from '../model/render/message.js';
import { botClientMessages, botClientWords } from '../model/render/messages.js';

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
            const message = botClientWords.resetApiBot.success(issued.clientId, issued.claimUrl);
            if (e.isGroup) {
                sendMessage(e, botClientMessages.resetApiBot.groupOnly, { at: true });
                logger.mark(message);
            } else {
                sendMessage(e, botClientMessages.resetApiBot.details(message), { at: true });
            }
        } catch (/** @type {any} */ error) {
            sendMessage(e, botClientMessages.resetApiBot.failed(getPhiApiUserMessage(error)), { at: true });
        }
        return true;
    }

    /** @param {import('../components/baseClass.js').botEvent} e */
    async claimLink(e) {
        if (!e.isMaster) return false;
        try {
            const claim = await botApiAuth.getClaimLink();
            const message = botClientWords.claimLink.success(claim.claimUrl);
            if (e.isGroup) {
                sendMessage(e, botClientMessages.claimLink.groupOnly, { at: true });
                logger.mark(message);
            } else {
                sendMessage(e, botClientMessages.claimLink.details(message), { at: true });
            }
        } catch (/** @type {any} */ error) {
            sendMessage(e, botClientMessages.claimLink.failed(getPhiApiUserMessage(error)), { at: true });
        }
        return true;
    }
}
