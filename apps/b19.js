import common from '../../../lib/common/common.js'
import plugin from '../../../lib/plugins/plugin.js'
import get from '../model/getdata.js'

await get.init()

const ChallengeModeName = ['白', '绿', '蓝', '红', '金', '彩']

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
                    reg: '^[#/]phi(\\s*)(best)(\\s*)[1-9]?[1-9]?$',
                    fnc: 'bestn'
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


        await e.reply(await get.getb19(e, data), true)



    }

    /**获取bestn文字版 */
    async bestn(e) {
        var save = await get.getsave(e.user_id)
        if (!save.session) {
            e.reply("你还没有绑定sessionToken哦！发送#phi bind xxxx进行绑定哦！", true)
            return true
        }

        var num = e.msg.replace(/[#/]phi(\\s*)(best)(\\s*)/g, '')

        if (Number(num) % 1) {
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
                tem.acc = Number(tem.acc).toFixed(2)
                tem.rks = Number(tem.rks).toFixed(2)
                rkslist.push(tem)
            }
        }

        phi.suggest = "已经到顶啦"

        Remsg.push(`PlayerId: ${save.saveInfo.PlayerId}\n
                    Rks: ${Number(save.saveInfo.summary.rankingScore).toFixed(4)}\n
                    ChallengeMode: ${ChallengeModeName[(save.saveInfo.summary.challengeModeRank - (save.saveInfo.summary.challengeModeRank % 100)) / 100]}${save.saveInfo.summary.challengeModeRank % 100}\n
                    Date: ${save.saveInfo.updatedAt}`)

        if (phi.song) {
            Remsg.push(`Phi:\n`+segment.image(get.getill(phi.song,false))+`\n${phi.song}\n${phi.rank} ${phi.difficulty}\n${phi.score} ${phi.pingji}\n${phi.acc} ${phi.rks}\nRks+0.01所需acc: ${phi.suggest}`)
        } else {
            Remsg.push("你还没有满分的曲目哦！收掉一首歌可以让你的RKS大幅度增加的！")
        }

        rkslist = rkslist.sort(cmp())

        for (var i = 0; i < num && i < rkslist.length; ++i) {
            Remsg.push(`#Best ${i + 1}:\n`+segment.image(get.getill(rkslist[i].song.song,false))+`\n${rkslist[i].song}\n${rkslist[i].rank} ${rkslist[i].difficulty}\n${rkslist[i].score} ${rkslist[i].pingji}\n${rkslist[i].acc} ${rkslist[i].rks}\nRks+0.01所需acc: ${get.comsuggest(Number(rkslist[i].rks) + 0.2, rkslist[i].difficulty)}`)
        }

        await e.reply(await common.makeForwardMsg(e,Remsg,`${e.user_id} 的best${num}结果`,false))


    }

}

function cmp() {
    return function (a, b) {
        return b.rks - a.rks
    }
}

