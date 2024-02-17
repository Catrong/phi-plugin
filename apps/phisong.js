import plugin from '../../../lib/plugins/plugin.js'
import get from '../model/getdata.js'
import common from "../../../lib/common/common.js"
import Config from '../components/Config.js'
import send from '../model/send.js'

await get.init()

const Level = ['EZ', 'HD', 'IN', 'AT'] //难度映射
let wait_to_del_list
let wait_to_del_nick


export class phisong extends plugin {
    constructor() {
        super({
            name: 'phi-图鉴',
            dsc: 'phigros图鉴',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(曲|song).*$`,
                    fnc: 'song'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(查找|检索|search).*$`,
                    fnc: 'search'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(设置别名|setnic(k?)).*$`,
                    fnc: 'setnick'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(删除别名|delnic(k?)).*$`,
                    fnc: 'delnick'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(曲绘|ill|Ill).*$`,
                    fnc: 'ill'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(随机|rand(om)?).*$`,
                    fnc: 'randmic'
                },
            ]
        })

    }


    /**歌曲图鉴 */
    async song(e) {
        let msg = e.msg.replace(/[#/](.*)(曲|song)(\s*)/, "")
        if (!msg) {
            send.send_with_At(e, `请指定曲名哦！\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} song <曲名>`)
            return true
        }
        let songs = get.fuzzysongsnick(msg)
        if (songs[0]) {
            let msgRes
            if (!songs[1]) {
                songs = songs[0]
                // get.getsongsinfo(e, songs)
                msgRes = await get.GetSongsInfoAtlas(e, songs)
                e.reply(msgRes)
            } else {
                msgRes = []
                for (let i in songs) {
                    msgRes[i] = await get.GetSongsInfoAtlas(e, songs[i])
                }
                e.reply(await common.makeForwardMsg(e, msgRes, `找到了${songs.length}首歌曲！`))
            }
        } else {
            e.reply(`未找到${msg}的相关曲目信息QAQ`, true)
        }
        return true
    }

    async search(e) {
        let msg = e.msg.replace(/[#/](.*)(查找|检索|search)(\s*)/g, "").toLowerCase()

        const patterns = {
            'bpm': {
                'regex': /bpm([\s:：,，/|~是为]*)([0-9]+(\s*-\s*[0-9]+)?)/,
                'predicate': (item, bottom, top) => bottom <= item['bpm'] && item['bpm'] <= top
            },
            'difficulty': {
                'regex': /(difficulty|dif|定数|难度|定级)([\s:：,，/|~是为]*)([0-9.]+(\s*-\s*[0-9.]+)?)/,
                'predicate': (item, bottom, top) => Object.values(item['chart']).some(level => bottom <= level['difficulty'] && level['difficulty'] <= top)
            },
            'combo': {
                'regex': /(combo|cmb|物量|连击)([\s:：,，/|~是为]*)([0-9]+(\s*-\s*[0-9]+)?)/,
                'predicate': (item, bottom, top) => Object.values(item['chart']).some(level => bottom <= level['combo'] && level['combo'] <= top)
            }
        }

        let remain = get.info()
        let result = {}
        let filters = {}

        for (let key in patterns) {
            let { regex, predicate } = patterns[key]
            let match = msg.match(regex)
            if (match) {
                match = match[0].replace(/((bpm|difficulty|dif|难度|定级|定数|combo|cmb|物量|连击)([\s:：,，/|~是为]*))(\d)/g, '$1 $4')
                match = match.replace(/((bpm|difficulty|dif|难度|定级|定数|combo|cmb|物量|连击)([\s:：,，/|~是为]*))|\s/g, '')
                let [bottom, top] = match.includes('-') ? match.split('-').sort((a, b) => a - b) : [match, match]
                bottom = Number(bottom)
                top = Number(top)
                if (key === 'difficulty' && !match.includes('.0') && top % 1 === 0) {
                    top += 0.9
                }
                filters[key] = [bottom, top]
                for (let i in remain) {
                    if (predicate(remain[i], bottom, top)) {
                        result[i] = remain[i]
                    }
                }
                remain = result
                result = {}
            }
        }

        if (Config.getDefOrConfig('config', 'isGuild')) {
            let Resmsg = []
            let tot = 0
            let count = 1
            let single = `当前筛选：${filters.bpm ? `BPM:${filters.bpm[0]}${filters.bpm[1] ? `-${filters.bpm[1]}` : ''}` : ''}${filters.difficulty ? `定级:${filters.difficulty[0]}${filters.difficulty[1] ? `-${filters.difficulty[1]}` : ''} ` : ''}${filters.combo ? ` 物量:${filters.combo[0]}${filters.combo[1] ? `-${filters.combo[1]}` : ''} ` : ''}`
            for (let i in remain) {
                let song = remain[i]
                let msg
                if (count) {
                    msg = `\n${i} BPM:${song.bpm}`
                } else {
                    msg = `${i} BPM:${song.bpm}`
                }
                for (let level in song.chart) {
                    msg += `<${level}> ${song['chart'][level]['difficulty']} ${song['chart'][level]['combo']}`
                }
                single += msg
                ++tot
                ++count
                /**每条消息10行 */
                if (count == 10) {
                    Resmsg.push(single)
                    single = ''
                    count = 0
                }
            }
            if (count) {
                Resmsg.push(single)
                count = 0
            }
            if (e.isGroup) {
                send.send_with_At(e, `找到了${tot}个结果，自动转为私聊发送喵～`, true)
                send.pick_send(e, await common.makeForwardMsg(e, Resmsg))

            } else {
                e.reply(await common.makeForwardMsg(e, Resmsg))
            }
        } else {
            let Resmsg = [`当前筛选：${filters.bpm ? `\nBPM:${filters.bpm[0]}${filters.bpm[1] ? `-${filters.bpm[1]}` : ''}` : ''}${filters.difficulty ? `\n定级:${filters.difficulty[0]}${filters.difficulty[1] ? `-${filters.difficulty[1]}` : ''} ` : ''}${filters.combo ? `\n物量:${filters.combo[0]}${filters.combo[1] ? `-${filters.combo[1]}` : ''} ` : ''}`]
            for (let i in remain) {
                let song = remain[i]
                let msg = `${i}\nBPM:${song.bpm}`
                for (let level in song.chart) {
                    msg += `\n${level} ${song['chart'][level]['difficulty']} ${song['chart'][level]['combo']}`
                }
                Resmsg.push(msg)
            }
            e.reply(await common.makeForwardMsg(e, Resmsg, `找到了${Resmsg.length - 1}首曲目喵！`))
        }

    }


    /**设置别名 */
    async setnick(e) {
        if (!(e.is_admin || e.isMaster)) {
            e.reply("只有管理员可以设置别名哦！")
            return true
        }
        let msg = e.msg.replace(/[#/](.*)(设置别名|setnic(k?))(\s*)/g, "")
        if (msg.includes("--->")) {
            msg = msg.replace(/(\s*)--->(\s*)/g, " ---> ")
            msg = msg.split(" ---> ")
        } else if (msg.includes("\n")) {
            msg = msg.split("\n")
        }
        if (msg[1]) {
            let mic = get.fuzzysongsnick(msg[0], 1)
            if (mic[0]) {
                mic = mic[0]
            } else {
                e.reply(`输入有误哦！没有找到“${msg[0]}”这首曲子呢！`)
                return true
            }
            if (mic in get.fuzzysongsnick(msg[1], 1)) {
                /**已经添加过该别名 */
                e.reply(`${mic} 已经有 ${msg[1]} 这个别名了哦！`)
                return true
            } else {
                get.setnick(`${mic}`, `${msg[1]}`)
                e.reply("设置完成！")
            }
        } else {
            e.reply(`输入有误哦！请按照\n原名（或已有别名） ---> 别名\n的格式发送哦！`)
        }
        return true
    }

    async delnick() {
        if (!(this.e.is_admin || this.e.isMaster)) {
            this.e.reply("只有管理员可以删除别名哦！")
            return true
        }
        let msg = this.e.msg.replace(/[#/](.*)(删除别名|delnic(k?))(\s*)/g, '')
        let ans = Config.getConfig('nickconfig', msg)
        ans = ans[msg]
        if (ans) {
            if (ans.length == 1) {
                Config.modifyarr('nickconfig', msg, ans[0], 'del', 'config')
                await this.reply("删除成功！")
            } else {
                wait_to_del_list = ans
                wait_to_del_nick = msg
                let Remsg = []
                Remsg.push("找到了多个别名！请发送 /序号 进行选择！")
                for (let i in ans) {
                    Remsg.push(`#${i}\n${ans[i]}`)
                }
                this.reply(common.makeForwardMsg(this.e, Remsg, "找到了多个结果！"))
                this.setContext('choosesdelnick', true, 30)

            }
        } else {
            await this.reply(`未找到 ${msg} 所对应的别名哦！`)
        }
        return true
    }

    choosesdelnick() {
        let msg = this.e.msg.match(/\/\s*[0-9]+/g, '')[0]
        msg = Number(msg.replace('/', ''))
        if (wait_to_del_list[msg]) {
            Config.modifyarr('nickconfig', wait_to_del_nick, wait_to_del_list[msg], 'del', 'config')
            this.reply("删除成功！")
        } else {
            this.reply(`未找到 ${msg} 所对应的别名哦！`)
        }
        this.finish('choosesdelnick', true)
        return true
    }

    async ill(e) {
        let msg = e.msg.replace(/[#/](.*?)(曲绘|ill|Ill)(\s*)/, "")
        if (!msg) {
            send.send_with_At(e, `请指定曲名哦！\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} ill <曲名>`)
            return true
        }
        let songs = get.fuzzysongsnick(msg)
        if (songs[0]) {
            let msgRes

            if (!songs[1]) {
                songs = songs[0]
                msgRes = await get.GetSongsIllAtlas(e, songs)
                e.reply(msgRes)
            } else {
                msgRes = []
                for (let i in songs) {
                    msgRes.push(await get.GetSongsIllAtlas(e, songs[i]))
                }
                e.reply(await common.makeForwardMsg(e, msgRes, `找到了${songs.length}首歌曲！`))
            }
        } else {
            e.reply(`未找到${msg}的相关曲目信息QAQ`, true)
            return false
        }
        return true

    }

    /**随机定级范围内曲目 */
    async randmic(e) {
        let msg = e.msg.replace(/^[#/](.*)(随机|rand)(\s*)/, "")
        let isask = [1, 1, 1, 1]

        msg = msg.toUpperCase()
        if (msg.includes('AT') || msg.includes('IN') || msg.includes('HD') || msg.includes('EZ')) {
            isask = [0, 0, 0, 0]
            if (msg.includes('EZ')) { isask[0] = 1 }
            if (msg.includes('HD')) { isask[1] = 1 }
            if (msg.includes('IN')) { isask[2] = 1 }
            if (msg.includes('AT')) { isask[3] = 1 }
        }
        msg = msg.replace(/((\s*)|AT|IN|HD|EZ)*/g, "")
        let rank = msg.split('-')
        let top
        let bottom

        /**是否指定范围 */
        if (rank[0]) {
            if (rank[0].includes('+')) {
                if (rank[1]) {
                    send.send_with_At(e, `含有 '+' 的难度不支持指定范围哦！\n/${Config.getDefOrConfig('config', 'cmdhead')} rand <定数>+ <难度(可多选)>`, true)
                    return true
                } else {
                    rank[0] = Number(rank[0].replace('+', ''))
                    bottom = rank[0]
                    top = 100
                }
            } else if (rank[0].includes('-') && !rank[1]) {
                rank[0] = Number(rank[0].replace('-', ''))
                if (rank[0] == NaN) {
                    send.send_with_At(e, `${rank[0]} 不是一个定级哦\n#/${Config.getDefOrConfig('config', 'cmdhead')} rand <定数>- <难度(可多选)>`, true)
                    return true
                } else {
                    bottom = 0
                    top = rank[0]
                }
            } else {
                rank[0] = Number(rank[0])
                if (rank[1]) {
                    rank[1] = Number(rank[1])
                    if (Number(rank[0]) == NaN || Number(rank[1]) == NaN) {
                        send.send_with_At(e, `${rank[0]} - ${rank[1]} 不是一个定级范围哦\n/${Config.getDefOrConfig('config', 'cmdhead')} rand <定数1> - <定数2> <难度(可多选)>`, true)
                        return true
                    }
                    top = Math.max(rank[0], rank[1])
                    bottom = Math.min(rank[0], rank[1])
                } else {
                    if (rank[0] == NaN) {
                        send.send_with_At(e, `${rank[0]} 不是一个定级哦\n#/${Config.getDefOrConfig('config', 'cmdhead')} rand <定数> <难度(可多选)>`, true)
                        return true
                    } else {
                        top = bottom = rank[0]
                    }
                }
            }
        } else {
            top = 100
            bottom = 0
        }

        if (top % 1 == 0 && !msg.includes(".0")) top += 0.9

        let songsname = []
        for (let i in get.ori_info) {
            for (let level in Level) {
                if (isask[level] && get.ori_info[i]['chart'][Level[level]]) {
                    let difficulty = get.ori_info[i]['chart'][Level[level]]['difficulty']
                    if (difficulty >= bottom && difficulty <= top) {
                        songsname.push({
                            ...get.ori_info[i]['chart'][Level[level]],
                            rank: Level[level],
                            illustration: get.getill(i),
                            song: get.ori_info[i]['song'],
                            illustrator: get.ori_info[i]['illustrator'],
                            composer: get.ori_info[i]['composer'],
                        })
                    }
                }
            }
        }

        if (!songsname[0]) {
            send.send_with_At(e, `未找到 ${bottom} - ${top} 的 ${isask[0] ? `${Level[0]} ` : ''}${isask[1] ? `${Level[1]} ` : ''}${isask[2] ? `${Level[2]} ` : ''}${isask[3] ? `${Level[3]} ` : ''}谱面QAQ!`)
            return true
        }

        let result = songsname[randbt(songsname.length - 1)]

        send.send_with_At(e, await get.getrand(e, result))
        return true
    }

}

/**
 * RandBetween
 * @param {number} top 随机值上界
 */
function randbt(top, bottom = 0) {
    return Math.floor((Math.random() * (top - bottom + 1))) + bottom
}
