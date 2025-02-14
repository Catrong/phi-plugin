import plugin from '../../../lib/plugins/plugin.js';
import Config from '../components/Config.js';
import send from '../model/send.js';
import guessTips from './guessGame/guessTips.js';
import guessLetter from './guessGame/guessLetter.js';
import guessIll from './guessGame/guessIll.js';
import getBanGroup from '../model/getBanGroup.js';

let games = "(提示猜曲|tipgame|ltr|letter|开字母|guess|猜曲绘)"
let gameList = {}

export class phiGames extends plugin {
    constructor() {
        super({
            name: 'phi-games',
            dsc: 'phi-plugin 猜曲游戏',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)${games}$`,
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

    async start(e) {
        let msg = e.msg.match(new RegExp(games))[0]
        if(!e.group_id) {
            send.send_with_At(e, '请在群聊中使用这个功能嗷！')
            return false
        }
        if (gameList[e.group_id]) {
            send.send_with_At(e, `当前存在其他未结束的游戏嗷！如果想要开启新游戏请 /${Config.getUserCfg('config', 'cmdhead')} ans 结束进行的游戏嗷！`)
            return false
        }
        switch (msg) {
            case "tipgame":
            case "提示猜曲": {

                if (await getBanGroup.get(e.group_id, 'tipgame')) {
                    send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
                    return false
                }

                return await guessTips.start(e, gameList)
            }
            case "letter":
            case "ltr":
            case "开字母": {

                if (await getBanGroup.get(e.group_id, 'ltrgame')) {
                    send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
                    return false
                }

                return await guessLetter.start(e, gameList)
            }
            case "guess":
            case "猜曲绘": {

                if (await getBanGroup.get(e.group_id, 'guessgame')) {
                    send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
                    return false
                }

                return await guessIll.start(e, gameList)
            }
            default: {
                return false
            }
        }
    }

    async reveal(e) {
        switch (gameList[e.group_id]?.gameType) {
            case "guessLetter": {
                return await guessLetter.reveal(e, gameList)
            }
            default: {
                return false
            }
        }
    }

    async guess(e) {
        switch (gameList[e.group_id]?.gameType) {
            case "guessTips": {
                return await guessTips.guess(e, gameList)
            }
            case "guessLetter": {
                return await guessLetter.guess(e, gameList)
            }
            case "guessIll": {
                return await guessIll.guess(e, gameList)
            }
            default: {
                return false
            }
        }
    }

    async getTip(e) {
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

    async ans(e) {
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
            default: {
                e.reply(`当前没有进行中的游戏嗷！`)
                return false
            }
        }
    }
}
