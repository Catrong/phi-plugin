import common from '../../../lib/common/common.js'
import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js';
import get from '../model/getdata.js'
import { segment } from "oicq";

await get.init()

const ChallengeModeName = ['白', '绿', '蓝', '红', '金', '彩']

const Level = ['EZ', 'HD', 'IN', 'AT', null] //存档的难度映射

export class phib19 extends plugin {
    constructor() {
        super({
            name: 'phi-b19',
            dsc: 'phiros b19查询',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(b19|rks)$`,
                    fnc: 'b19'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)best(\\s*)[1-9]?[1-9]?$`,
                    fnc: 'bestn'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(score|单曲成绩).*$`,
                    fnc: 'singlescore'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(suggest|推分(建议)?)$`,
                    fnc: 'suggest'
                }
                // {
                //     reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(com|计算).*$`,
                //     fnc: 'suggest'
                // }

            ]
        })

    }

    async b19(e) {
        var save = await get.getsave(e.user_id)
        if (!save.session) {
            e.reply([segment.at(e.user_id), `你还没有绑定sessionToken哦！\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`], true)
            return true
        }

        if (!Config.getDefOrConfig('config', 'isGuild'))
            e.reply("正在生成图片，请稍等一下哦！\n//·/w\\·\\\\", false, { recallMsg: 5 })

        var Record = save.gameRecord
        var phi = {}
        var b19_list = []

        phi.rks = 0


        /**取出信息 */
        var rkslist = []
        for (var song in Record) {
            for (var level in song) {
                if (level == 4) break
                var tem = Record[song][level]
                if (!tem) continue
                if (tem.acc >= 100) {
                    if (tem.rks > phi.rks) {
                        phi = tem
                    }
                }
                rkslist.push(tem)
            }
        }

        if (phi.rks) {
            phi.rks = phi.rks.toFixed(2)
            phi.acc = phi.acc.toFixed(2)
            phi.illustration = get.getill(phi.song)
        }


        /**考虑屁股肉四舍五入原则 */
        var minuprks = Number(save.saveInfo.summary.rankingScore.toFixed(2)) - save.saveInfo.summary.rankingScore + 0.005

        rkslist = rkslist.sort(cmp())
        var illlist = []
        for (var i = 0; i < 21 && i < rkslist.length; ++i) {
            rkslist[i].num = i + 1
            rkslist[i].suggest = get.comsuggest(Number((i < 18) ? rkslist[i].rks : rkslist[18].rks) + minuprks * 20, rkslist[i].difficulty, 2)
            rkslist[i].rks = Number(rkslist[i].rks).toFixed(2)
            rkslist[i].acc = Number(rkslist[i].acc).toFixed(2)
            rkslist[i].illustration = get.getill(rkslist[i].song)
            b19_list.push(rkslist[i])
            illlist.push(get.getill(rkslist[i].song))
        }

        phi.suggest = "无法推分"

        var data = {
            phi,
            b19_list,
            data: undefined,
            PlayerId: save.saveInfo.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: save.saveInfo.updatedAt,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            background: illlist[Number((Math.random() * (illlist.length - 1)).toFixed(0))]
        }
        if (save.gameProgress) {
            var money = save.gameProgress.money
            data.data = `${money[4] ? `${money[4]}PiB ` : ''}${money[3] ? `${money[3]}TiB ` : ''}${money[2] ? `${money[2]}GiB ` : ''}${money[1] ? `${money[1]}MiB ` : ''}${money[0] ? `${money[0]}KiB ` : ''}`
        }
        if (Config.getDefOrConfig('config', 'isGuild')) {
            /**频道模式'@'取消换行 */
            await e.reply([segment.at(e.user_id), await get.getb19(e, data)])
        } else {

            await e.reply([segment.at(e.user_id), `\n`, await get.getb19(e, data)])
        }



    }

    /**获取bestn文字版 */
    async bestn(e) {


        var save = await get.getsave(e.user_id)
        if (!save.session) {
            e.reply(`你还没有绑定sessionToken哦！发送 /${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>进行绑定哦！`, true)
            return true
        }

        var num = e.msg.replace(/[#/](.*)(best)(\s*)/g, '')

        if (Number(num) % 1 != 0) {
            await e.reply(`${num}不是个数字吧！`, true)
            return true
        }

        num = Number(num)

        if (!num)
            num = 19 //未指定默认b19

        var Record = save.gameRecord
        var phi = {}

        phi.rks = 0

        /**取出信息 */
        var rkslist = []
        for (var song in Record) {
            for (var level in song) {
                if (level == 4) break
                var tem = Record[song][level]
                if (!tem) continue
                if (tem.acc >= 100) {
                    if (tem.rks > phi.rks) {
                        phi = tem
                    }
                }
                rkslist.push(tem)
            }
        }

        phi.suggest = "无法推分"

        /**考虑屁股肉四舍五入原则 */
        var minuprks = Number(save.saveInfo.summary.rankingScore.toFixed(2)) - save.saveInfo.summary.rankingScore + 0.005

        rkslist = rkslist.sort(cmp())

        if (Config.getDefOrConfig('config', 'isGuild')) {
            /**频道模式 */

            var Remsg = []
            var tmsg = ''
            tmsg += `PlayerId: ${save.saveInfo.PlayerId} Rks: ${Number(save.saveInfo.summary.rankingScore).toFixed(4)} ChallengeMode: ${ChallengeModeName[(save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100]}${save.saveInfo.summary.challengeModeRank % 100} Date: ${save.saveInfo.updatedAt}`
            if (phi.song) {
                tmsg += `\nPhi:${phi.song} <${phi.rank}> Lv ${phi.difficulty} ${phi.score} ${phi.pingji} ${phi.acc.toFixed(4)}% 等效${phi.rks.toFixed(4)} 推分: ${phi.suggest}`
            } else {
                tmsg += "\n你还没有满分的曲目哦！收掉一首歌可以让你的RKS大幅度增加的！"
            }
            /**防止消息过长发送失败每条消息20行 */
            var tot = 1
            for (var i = 0; i < num && i < rkslist.length; ++i) {
                if (tot <= 19) {
                    tmsg += `\n#Best${i + 1}: ${rkslist[i].song} <${rkslist[i].rank}> ${rkslist[i].difficulty} ${rkslist[i].score} ${rkslist[i].pingji} ${rkslist[i].acc.toFixed(4)}% 等效${rkslist[i].rks.toFixed(4)} 推分: ${get.comsuggest(Number((i < 18) ? rkslist[i].rks : rkslist[18].rks) + minuprks * 20, rkslist[i].difficulty, 4)}`
                } else {
                    Remsg.push(tmsg)
                    tmsg = `#Best${i + 1}: ${rkslist[i].song} <${rkslist[i].rank}> ${rkslist[i].difficulty} ${rkslist[i].score} ${rkslist[i].pingji} ${rkslist[i].acc.toFixed(4)}% 等效${rkslist[i].rks.toFixed(4)} 推分: ${get.comsuggest(Number((i < 18) ? rkslist[i].rks : rkslist[18].rks) + minuprks * 20, rkslist[i].difficulty, 4)}`
                    tot = 0
                }
                ++tot
            }

            Remsg.push(tmsg)

            if (e.isGroup) {
                /**频道模式群聊发送缩略版 */
                e.reply(Remsg[0], true)
            } else {
                e.reply(common.makeForwardMsg(e, Remsg))
            }

        } else {

            var Remsg = []
            Remsg.push(`PlayerId: ${save.saveInfo.PlayerId}\nRks: ${Number(save.saveInfo.summary.rankingScore).toFixed(4)}\nChallengeMode: ${ChallengeModeName[(save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100]}${save.saveInfo.summary.challengeModeRank % 100}\nDate: ${save.saveInfo.updatedAt}`)


            if (Config.getDefOrConfig('config', 'WordB19Img')) {

                if (phi.song) {
                    Remsg.push([`Phi:\n`,
                        segment.image(get.getill(phi.song, false)),
                        `\n${phi.song}\n` +
                        `${phi.rank} ${phi.difficulty}\n` +
                        `${phi.score} ${phi.pingji}\n` +
                        `${phi.acc.toFixed(2)}% ${phi.rks.toFixed(2)}\n` +
                        `推分: ${phi.suggest}`])
                } else {
                    Remsg.push("你还没有满分的曲目哦！收掉一首歌可以让你的RKS大幅度增加的！")
                }
                for (var i = 0; i < num && i < rkslist.length; ++i) {
                    Remsg.push([`#Best ${i + 1}: ${rkslist[i].song}\n`,
                    segment.image(get.getill(rkslist[i].song, false)),
                    `\n` +
                    `${rkslist[i].rank} ${rkslist[i].difficulty}\n` +
                    `${rkslist[i].score} ${rkslist[i].pingji}\n` +
                    `${Number(rkslist[i].acc).toFixed(4)}% ${Number(rkslist[i].rks).toFixed(4)}\n` +
                    `推分: ${get.comsuggest(Number((i < 18) ? rkslist[i].rks : rkslist[18].rks) + minuprks * 20, rkslist[i].difficulty, 4)}`])
                }
            } else {
                /**无图模式 */
                if (phi.song) {
                    Remsg.push([`Phi: ${phi.song}\n` +
                        `${phi.rank} ${phi.difficulty}\n` +
                        `${phi.score} ${phi.pingji}\n` +
                        `${phi.acc.toFixed(2)}% ${phi.rks.toFixed(2)}\n` +
                        `推分: ${phi.suggest}`])
                } else {
                    Remsg.push("你还没有满分的曲目哦！收掉一首歌可以让你的RKS大幅度增加的！")
                }
                for (var i = 0; i < num && i < rkslist.length; ++i) {
                    Remsg.push([`#Best ${i + 1}: ${rkslist[i].song}\n` +
                        `${rkslist[i].rank} ${rkslist[i].difficulty}\n` +
                        `${rkslist[i].score} ${rkslist[i].pingji}\n` +
                        `${Number(rkslist[i].acc).toFixed(4)}% ${Number(rkslist[i].rks).toFixed(4)}\n` +
                        `推分: ${get.comsuggest(Number((i < 18) ? rkslist[i].rks : rkslist[18].rks) + minuprks * 20, rkslist[i].difficulty, 4)}`])
                }
            }
            await e.reply(await common.makeForwardMsg(e, Remsg))
        }



    }


    async singlescore(e) {
        var save = await get.getsave(e.user_id)
        if (!save.session) {
            e.reply(`你还没有绑定sessionToken哦！发送 /${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken> 进行绑定哦！`, true)
            return true
        }
        var song = e.msg.replace(/[#/](.*)(score|单曲成绩)(\s*)/g, '')



        if (!(get.fuzzysongsnick(song)[0])) {
            e.reply(`未找到 ${song} 的有关信息哦！`)
            return true
        }
        song = get.fuzzysongsnick(song)
        song = song[0]

        var Record = save.gameRecord

        var ans

        /**取出信息 */
        var rkslist = []
        for (var i in Record) {
            for (var level in i) {
                if (level == 4) break
                var tem = Record[i][level]
                if (!tem) continue
                rkslist.push(tem)
            }
        }

        rkslist = rkslist.sort(cmp())
        /**b19最低rks */
        var minrks = rkslist[Math.min(18, rkslist.length)]
        /**考虑屁股肉四舍五入原则 */
        var minuprks = Number(save.saveInfo.summary.rankingScore.toFixed(2)) - save.saveInfo.summary.rankingScore + 0.005

        for (var i in Record) {
            var now = await get.idgetsong(i, false)
            if (now == song) {
                ans = Record[i]
                break
            }
        }

        if (!ans) {
            await e.reply(`我不知道你这首歌的成绩哦！可以试试⌈/${Config.getDefOrConfig('config', 'cmdhead')} update⌋哦！`)
            return false
        }

        var data = {
            PlayerId: save.saveInfo.PlayerId,
            avatar: get.idgetavatar(save.saveInfo.summary.avatar),
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(2),
            Date: save.saveInfo.updatedAt,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100
        }


        data.illustration = get.getill(song)
        var songsinfo = get.ori_info[song]
        for (var i in ans) {
            if (ans[i]) {
                ans[i].acc = ans[i].acc.toFixed(2)
                ans[i].rks = ans[i].rks.toFixed(2)
                data[Level[i]] = {
                    ...ans[i],
                    suggest: get.comsuggest(Math.max(Number(minrks.rks), Number(ans[i].rks)) + minuprks * 20, Number(ans[i].difficulty), 4)
                }
            } else {
                data[Level[i]] = {
                    pingji: 'NEW',
                    difficulty: songsinfo['chart'][Level[i]]['difficulty']
                }
            }
        }

        if (Config.getDefOrConfig('config', 'isGuild')) {
            /**频道模式'@'取消换行 */
            await e.reply([segment.at(e.user_id), await get.getsingle(e, data)])
        } else {
            await e.reply([segment.at(e.user_id), `\n`, await get.getsingle(e, data)])
        }
        return true

    }

    /**推分建议，建议的是RKS+0.01的所需值 */
    async suggest(e) {


        var save = await get.getsave(e.user_id)
        if (!save.session) {
            e.reply([segment.at(e.user_id), `你还没有绑定sessionToken哦！发送 /${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken> 进行绑定哦！`])
            return true
        }

        var Record = save.gameRecord

        /**取出信息 */
        var rkslist = []
        for (var song in Record) {
            for (var level in song) {
                if (level == 4) break
                var tem = Record[song][level]
                if (!tem) continue
                rkslist.push(tem)
            }
        }

        rkslist = rkslist.sort(cmp())
        /**b19最低rks */
        var minrks = rkslist[Math.min(18, rkslist.length)]
        /**考虑屁股肉四舍五入原则 */
        var minuprks = Number(save.saveInfo.summary.rankingScore.toFixed(2)) - save.saveInfo.summary.rankingScore + 0.005

        /**计算 */
        var suggestlist = []
        for (var i in rkslist) {
            var tem = rkslist[i]
            var suggest = get.comsuggest(Number((i < 18) ? tem.rks : minrks.rks) + minuprks * 20, Number(tem.difficulty), 4)
            if (!suggest.includes("无")) {
                tem.acc = tem.acc
                tem.rks = tem.rks
                tem.suggest = suggest
                suggestlist.push(tem)
            }
        }


        suggestlist = suggestlist.sort(cmpsugg())

        if (Config.getDefOrConfig('config', 'isGuild')) {
            /**频道模式 */
            var Remsg = []
            var tmsg = ''

            /**防止消息过长发送失败每条消息20行 */
            var tot = 1
            tmsg += `PlayerId: ${save.saveInfo.PlayerId} Rks: ${Number(save.saveInfo.summary.rankingScore).toFixed(4)} ChallengeMode: ${ChallengeModeName[(save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100]}${save.saveInfo.summary.challengeModeRank % 100} Date: ${save.saveInfo.updatedAt}`
            for (var i = 0; i < suggestlist.length; ++i) {
                if (tot <= 19) {
                    tmsg += `\n#${i + 1}: ${suggestlist[i].song} <${suggestlist[i].rank}> ${suggestlist[i].difficulty} ${suggestlist[i].acc.toFixed(4)}% 推分: ${suggestlist[i].suggest}`
                } else {
                    Remsg.push(tmsg)
                    tmsg = `#${i + 1}: ${suggestlist[i].song} <${suggestlist[i].rank}> ${suggestlist[i].difficulty} ${suggestlist[i].acc.toFixed(4)}% 推分: ${suggestlist[i].suggest}`
                    tot = 0
                }
                ++tot
            }
            Remsg.push(tmsg)

            if (e.isGroup) {
                /**频道模式群聊发送缩略版 */
                e.reply(Remsg[0], true)
            } else {
                await e.reply(common.makeForwardMsg(e, Remsg))
            }

        } else {
            var Remsg = []

            /**判断是否发图 */
            if (Config.getDefOrConfig('config', 'WordSuggImg')) {
                for (var i = 0; i < suggestlist.length; ++i) {
                    Remsg.push([`# ${i + 1}: ${suggestlist[i].song}\n`,
                    segment.image(get.getill(suggestlist[i].song, false)),
                    `\n` +
                    `${suggestlist[i].rank} ${suggestlist[i].difficulty}\n` +
                    `${suggestlist[i].score} ${suggestlist[i].pingji}\n` +
                    `${suggestlist[i].acc.toFixed(4)}% ${suggestlist[i].rks.toFixed(4)}\n` +
                    `推分: ${suggestlist[i].suggest}`])
                }
            } else {
                for (var i = 0; i < suggestlist.length; ++i) {
                    Remsg.push([`# ${i + 1}: ${suggestlist[i].song}\n` +
                        `${suggestlist[i].rank} ${suggestlist[i].difficulty}\n` +
                        `${suggestlist[i].score} ${suggestlist[i].pingji}\n` +
                        `${suggestlist[i].acc.toFixed(4)}% ${suggestlist[i].rks.toFixed(4)}\n` +
                        `推分: ${suggestlist[i].suggest}`])
                }
            }

            await e.reply(common.makeForwardMsg(e, Remsg))
        }
    }

}

function cmp() {
    return function (a, b) {
        return b.rks - a.rks
    }
}

function cmpsugg() {
    return function (a, b) {
        return (Number(a.suggest.replace("%", '')) - a.rks) - (Number(b.suggest.replace("%", '')) - b.rks)
    }
}

