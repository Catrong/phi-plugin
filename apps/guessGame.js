import Config from '../components/Config.js';
import send from '../model/render/send.js';
import guessTips from './guessGame/guessTips.js';
import guessLetter from './guessGame/guessLetter.js';
import guessIll from './guessGame/guessIll.js';
import frib19 from './guessGame/frib19.js';
import getBanGroup from '../model/user/getBanGroup.js';
import phiPluginBase from '../components/baseClass.js';
import logger from '../components/Logger.js';

let games = "(提示猜曲|tipgame|(ltr|letter|开字母).*|guess|猜曲绘|(弗一把|([Ff][Rr][Ii][Bb][Ee][Rr][Gg])|([Ff][Ii][Bb])|([Ff][Rr][Ii])))"

/**@import {botEvent} from '../components/baseClass.js' */

/**
 * @typedef {Record<string, {gameType: string}>} GameList
 */

/**
 * 进行中的游戏列表
 * @type {GameList}
 */
let gameList = {}

export class phiGames extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-games',
            dsc: 'phi-plugin 猜曲游戏',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)${games}\\s*((\\-[lL]\\s*\\d+)|(([Ee][Zz]|[Hh][Dd]|[Ii][Nn]|[Aa][Tt])(\\s*\\d+(\\.\\d+)?\\s*\\+?)?)|(\\d+(\\.\\d+)?\\s*\\+))?$`,
                    fnc: 'start'
                },
                {
                    reg: `^.*$`,
                    fnc: 'guess',
                    log: false
                },
                {
                    reg: `^[#/](出|开|翻|揭|看|翻开|打开|揭开|open)(\\s*)[a-zA-Z\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\d\S]$`,
                    fnc: 'reveal'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(tip|提示)$`,
                    fnc: 'getTip'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(ans|答案|结束)$`,
                    fnc: 'ans'
                }
            ]
        })
    }

    /**
     * 开始游戏
     * @param {botEvent} e 
     * @returns 
     */
    async start(e) {
        let msg = e.msg.match(new RegExp(games))?.[0]
        if (!e.group_id) {
            send.send_with_At(e, '请在群聊中使用这个功能嗷！')
            return false
        }
        if (gameList[e.group_id]) {
            send.send_with_At(e, `当前存在其他未结束的游戏嗷！如果想要开启新游戏请 /${Config.getUserCfg('config', 'cmdhead')} ans 结束进行的游戏嗷！`)
            return false
        }
        if (!msg) {
            return false
        }
        /** 弗一把的英文别名大小写不敏感 */
        const gameName = msg.toLowerCase()
        switch (gameName) {
            case "tipgame":
            case "提示猜曲": {

                if (await getBanGroup.get(e, 'tipgame')) {
                    send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
                    return false
                }

                return await guessTips.start(e, gameList)
            }
            case "guess":
            case "猜曲绘": {

                if (await getBanGroup.get(e, 'guessgame')) {
                    send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
                    return false
                }

                return await guessIll.start(e, gameList)
            }
            case "弗一把":
            case "friberg":
            case "fib":
            case "fri": {

                if (await getBanGroup.get(e, 'fribgame')) {
                    send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
                    return false
                }

                return await frib19.start(e, gameList)
            }
            default: {
                if (gameName.startsWith("ltr") || gameName.startsWith("letter") || gameName.startsWith("开字母")) {

                    if (await getBanGroup.get(e, 'ltrgame')) {
                        send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
                        return false
                    }

                    return await guessLetter.start(e, gameList)
                }
                return false
            }
        }
    }


    /**
     * 翻开字母
     * @param {botEvent} e 
     * @returns 
     */
    async reveal(e) {
        if (!e.isGroup || !e.group_id) {
            send.send_with_At(e, '请在群聊中使用这个功能嗷！')
            return false
        }
        switch (gameList[e.group_id]?.gameType) {
            case "guessLetter": {
                return await guessLetter.reveal(e, gameList)
            }
            default: {
                return false
            }
        }
    }


    /**
     * 猜测
     * @param {botEvent} e 
     * @returns 
     */
    async guess(e) {
        /**过滤特殊消息 */
        if (!e.msg) {
            return false;
        }
        if (!e.group_id) {
            return false
        }
        switch (gameList[e.group_id]?.gameType) {
            case "guessTips": {
                logger.info(`[phi-games][guess][tips] ${e.msg}`)
                return await guessTips.guess(e, gameList)
            }
            case "guessLetter": {
                logger.info(`[phi-games][guess][letter] ${e.msg}`)
                return await guessLetter.guess(e, gameList)
            }
            case "guessIll": {
                logger.info(`[phi-games][guess][ill] ${e.msg}`)
                return await guessIll.guess(e, gameList)
            }
            case "frib19": {
                logger.info(`[phi-games][guess][frib] ${e.msg}`)
                return await frib19.guess(e, gameList)
            }
            default: {
                return false
            }
        }
    }


    /**
     * 获取提示
     * @param {botEvent} e 
     * @returns 
     */
    async getTip(e) {
        if (!e.group_id) {
            return false
        }
        switch (gameList[e.group_id]?.gameType) {
            case "guessTips": {
                return await guessTips.getTip(e, gameList)
            }
            case "guessLetter": {
                return await guessLetter.getTip(e, gameList)
            }
            default: {
                return false
            }
        }
    }


    /**
     * 结束游戏
     * @param {botEvent} e 
     * @returns 
     */
    async ans(e) {
        if (!e.group_id) {
            return false
        }
        switch (gameList[e.group_id]?.gameType) {
            case "guessTips": {
                return await guessTips.ans(e, gameList)
            }
            case "guessLetter": {
                return await guessLetter.ans(e, gameList)
            }
            case "guessIll": {
                return await guessIll.ans(e, gameList)
            }
            case "frib19": {
                return await frib19.ans(e, gameList)
            }
            default: {
                send.reply(e, `当前没有进行中的游戏嗷！`)
                return false
            }
        }
    }
}
