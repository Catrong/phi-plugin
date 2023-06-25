import plugin from '../../../lib/plugins/plugin.js'
import get from '../model/getdata.js'

await get.init()

export class phib19 extends plugin {
    constructor() {
        super({
            name: 'phi-b19',
            dsc: 'phiros b19查询',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: '^[#/]phi (b19|rks)$',
                    fnc: 'b19'
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

        e.reply("正在生成图片，大约需要1分钟，请稍等一下哦！\n//·/w\\·\\\\")
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
                tem.acc = Number(tem.acc).toFixed(2)
                tem.rks = Number(tem.rks).toFixed(2)
                rkslist.push(tem)
            }
        }

        rkslist = rkslist.sort(cmp())
        var illlist = []
        for (var i = 0; i < 21 && i < rkslist.length; ++i) {
            rkslist[i].num = i + 1
            rkslist[i].suggest = get.comsuggest(Number(rkslist[i].rks) + 0.2, rkslist[i].difficulty)
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
            background: illlist[Number((Math.random() * illlist.length).toFixed(0)) - 1]
        }


        await e.reply(await get.getb19(e, data))



    }

}

function cmp() {
    return function (a, b) {
        return b.rks - a.rks
    }
}

