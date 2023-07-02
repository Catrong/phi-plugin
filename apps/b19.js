import common from '../../../lib/common/common.js'
import plugin from '../../../lib/plugins/plugin.js'
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
                    reg: '^[#/]phi(\\s*)(b19|rks)$',
                    fnc: 'b19'
                },
                {
                    reg: '^[#/]phi(\\s*)best(\\s*)[1-9]?[1-9]?$',
                    fnc: 'bestn'
                },
                {
                    reg: '^[#/]phi(\\s*)(score|单曲成绩).*$',
                    fnc: 'singlescore'
                },
                {
                    reg: '^[#/]phi(\\s*)(suggest|推分(建议)?)$',
                    fnc: 'suggest'
                }

            ]
        })

    }

    async b19(e) {
        var save = await get.getsave(e.user_id)
        if (!save.session) {
            e.reply("你还没有绑定sessionToken哦！发送#phi bind xxxx进行绑定哦！", true)
            return true
        }

        e.reply("正在生成图片，请稍等一下哦！\n//·/w\\·\\\\")
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

        phi.rks = phi.rks.toFixed(2)
        phi.acc = phi.acc.toFixed(2)


        /**考虑屁股肉四舍五入原则 */
        var minuprks = Number(save.saveInfo.summary.rankingScore.toFixed(2)) - save.saveInfo.summary.rankingScore + 0.05

        rkslist = rkslist.sort(cmp())
        var illlist = []
        for (var i = 0; i < 21 && i < rkslist.length; ++i) {
            rkslist[i].num = i + 1
            rkslist[i].suggest = get.comsuggest(Number(rkslist[i].rks) + minuprks * 20, rkslist[i].difficulty)
            rkslist[i].rks = Number(rkslist[i].rks).toFixed(2)
            rkslist[i].acc = Number(rkslist[i].acc).toFixed(2)
            b19_list.push(rkslist[i])
            illlist.push(rkslist[i].illustration)
        }

        phi.suggest = "已经到顶啦"

        var data = {
            phi,
            b19_list,
            PlayerId: save.saveInfo.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(4),
            Date: save.saveInfo.updatedAt,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
            background: illlist[Number((Math.random() * (illlist.length - 1)).toFixed(0))]
        }


        await e.reply([segment.at(e.user_id), `\n`, await get.getb19(e, data)])



    }

    /**获取bestn文字版 */
    async bestn(e) {
        var save = await get.getsave(e.user_id)
        if (!save.session) {
            e.reply("你还没有绑定sessionToken哦！发送#phi bind xxxx进行绑定哦！", true)
            return true
        }

        var num = e.msg.replace(/[#/]phi(\s*)(best)(\s*)/g, '')

        if (Number(num) % 1 != 0) {
            await e.reply(`${num}不是个数字吧！`, true)
            return true
        }

        num = Number(num)

        if (!num)
            num = 19 //未指定默认b19

        var Record = save.gameRecord
        var phi = {}
        var Remsg = []

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

        phi.suggest = "已经到顶啦"

        Remsg.push(`PlayerId: ${save.saveInfo.PlayerId}\nRks: ${Number(save.saveInfo.summary.rankingScore).toFixed(4)}\nChallengeMode: ${ChallengeModeName[(save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100]}${save.saveInfo.summary.challengeModeRank % 100}\nDate: ${save.saveInfo.updatedAt}`)

        /**考虑屁股肉四舍五入原则 */
        var minuprks = Number(save.saveInfo.summary.rankingScore.toFixed(2)) - save.saveInfo.summary.rankingScore + 0.05

        if (phi.song) {
            Remsg.push([`Phi:\n`,
                segment.image(get.getill(phi.song, false)),
                `\n${phi.song}\n` +
                `${phi.rank} ${phi.difficulty}\n` +
                `${phi.score} ${phi.pingji}\n` +
                `${phi.acc.toFixed(2)} ${phi.rks.toFixed(2)}\n` +
                `Rks+0.01所需acc: ${phi.suggest}`])
        } else {
            Remsg.push("你还没有满分的曲目哦！收掉一首歌可以让你的RKS大幅度增加的！")
        }

        rkslist = rkslist.sort(cmp())

        for (var i = 0; i < num && i < rkslist.length; ++i) {

            Remsg.push([`#Best ${i + 1}:\n`,
            segment.image(get.getill(rkslist[i].song, false)),
            `\n${rkslist[i].song}\n` +
            `${rkslist[i].rank} ${rkslist[i].difficulty}\n` +
            `${rkslist[i].score} ${rkslist[i].pingji}\n` +
            `${Number(rkslist[i].acc).toFixed(2)} ${Number(rkslist[i].rks).toFixed(2)}\n` +
            `Rks+0.01所需acc: ${get.comsuggest(Number((i < 18) ? rkslist[i].rks : rkslist[18].rks) + minuprks * 20, rkslist[i].difficulty)}`])
        }

        await e.reply(await common.makeForwardMsg(e, Remsg))


    }


    async singlescore(e) {
        var save = await get.getsave(e.user_id)
        if (!save.session) {
            e.reply("你还没有绑定sessionToken哦！发送#phi bind xxxx进行绑定哦！", true)
            return true
        }
        var song = e.msg.replace(/[#/]phi(\s*)(score|单曲成绩)(\s*)/g, '')


        if (! await get.songsnick(song)) {
            e.reply(`未找到 ${song} 的有关信息哦！`)
            return true
        }

        song = await get.songsnick(song)

        var Record = save.gameRecord

        var ans

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
        var minuprks = Number(save.saveInfo.summary.rankingScore.toFixed(2)) - save.saveInfo.summary.rankingScore + 0.05

        for (var i in Record) {
            if (await get.idgetsong(i, false) == song) {
                ans = Record[i]
                break
            }
        }

        if (!ans) {
            await e.reply("我不知道你这首歌的成绩哦！可以试试⌈#phi update⌋哦！")
            return false
        }

        var data = {
            PlayerId: save.saveInfo.PlayerId,
            Rks: Number(save.saveInfo.summary.rankingScore).toFixed(2),
            Date: save.saveInfo.updatedAt,
            ChallengeMode: (save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100,
            ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100
        }


        data.illustration = get.info[song].illustration_big

        for (var i in ans) {
            if (ans[i]) {
                ans[i].acc = ans[i].acc.toFixed(2)
                ans[i].rks = ans[i].rks.toFixed(2)
                data[Level[i]] = {
                    ...ans[i],
                    suggest: get.comsuggest(Number(minrks.rks) + minuprks * 20, Number(ans[i].difficulty))
                }
            } else {
                data[Level[i]] = { pingji: 'NEW' }
            }
        }

        await e.reply(await get.getsingle(e, data))
        return true

    }

    /**推分建议，建议的是RKS+0.01的所需值 */
    async suggest(e) {

        var save = await get.getsave(e.user_id)
        if (!save.session) {
            e.reply("你还没有绑定sessionToken哦！发送#phi bind xxxx进行绑定哦！", true)
            return true
        }

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
        minrks = rkslist[Math.min(18, rkslist.length)]
        /**考虑屁股肉四舍五入原则 */
        minuprks = Number(save.saveInfo.summary.rankingScore.toFixed(2)) - save.saveInfo.summary.rankingScore + 0.05

        /**计算 */
        var suggestlist = []
        for (var song in Record) {
            for (var level in song) {
                if (level == 4) break
                var tem = Record[song][level]
                if (!tem) continue
                if (typeof get.comsuggest(Number(minrks.rks) + minuprks * 20, Number(tem.difficulty)) == 'number') {
                    tem.acc = Number(tem.acc).toFixed(2)
                    tem.rks = Number(tem.rks).toFixed(2)
                    suggestlist.push(tem)
                }
            }
        }

        
        suggestlist = suggestlist.sort(cmpsugg())

        var Remsg = []
        for (var i = 0; i < suggestlist.length; ++i) {

            Remsg.push([`#Best ${i + 1}:\n`,
            segment.image(get.getill(suggestlist[i].song, false)),
            `\n${suggestlist[i].song}\n` +
            `${suggestlist[i].rank} ${suggestlist[i].difficulty}\n` +
            `${suggestlist[i].score} ${suggestlist[i].pingji}\n` +
            `${suggestlist[i].acc} ${suggestlist[i].rks}\n` +
            `Rks+0.01所需acc: ${get.comsuggest(Number((i < 18) ? suggestlist[i].rks : suggestlist[18].rks) + minuprks * 20, suggestlist[i].difficulty)}`])
        }

        await e.reply(await common.makeForwardMsg(e, Remsg))
    }

}

function cmp() {
    return function (a, b) {
        return b.rks - a.rks
    }
}

function cmpsugg() {
    return function (a, b) {
        return b.rks - a.rks
    }
}

