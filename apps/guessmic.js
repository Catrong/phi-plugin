import get from '../model/getdata.js';
import send from '../model/send.js';
import Config from '../components/Config.js';
import { segment } from 'oicq';

const gamelist = {}

export class phiGuessMic extends plugin {
    constructor() {
        super({
            name: 'phi-guessMic',
            dsc: 'phigros猜曲目片段',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)mic$`,
                    fnc: 'start'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)mic提示$`,
                    fnc: 'tip'
                },
                {
                    reg: `^[#/]${Config.getDefOrConfig('config', 'isGuild') ? '?' : ''}(\\s*)mic.*$`,
                    fnc: 'guess'
                }
            ]
        })

    }

    async start(e) {

        if(e.isGuild) {
            e.reply('暂时无法在频道中使用哦QAQ！')
        }

        const { group_id } = e
        if (gamelist[group_id]) {
            send.send_with_At(e, "请不要重复发起哦！")
            return true
        }

        gamelist[group_id] = {}
        gamelist[group_id].songId = get.idssong[get.songlist[randint(0, get.songlist.length - 1)]].replace('.0', '')
        gamelist[group_id].unsend = []
        gamelist[group_id].tip = new Date()
        gamelist[group_id].tot = (await get.getData('splicetot.json', get.infoPath))[gamelist[group_id].songId]

        for (let i = 1; i <= gamelist[group_id].tot; i++) {
            gamelist[group_id].unsend.push(i)
        }
        console.info(gamelist)

        e.reply(`游戏开始！发送 /mic提示 获取更多提示，发送/micans 查看答案哦！`)

        var rand = randint(0, gamelist[group_id].unsend.length - 1)

        var url = `https://qxsky.top:833/data/other_data/web/splited_music/${gamelist[group_id].songId}/${gamelist[group_id].unsend[rand]}.wav`
        // try {
        //     let msg = await uploadRecord(url, 0, false)
        //     e.reply(msg)
        // } catch {
        //     e.reply('歌曲文件太大啦，发不出来，诶嘿')

        // }

        // await SendMusicShare(e, { source: 'netease', name: `发送 /mic 猜歌哦！/micans可以结束哦！`, artist: `Phi-Plugin 猜歌`, pic: get.getimg('Phigros_Icon_3.0.0.png'), link: url })

        // e.reply(segment.share(url, `发送 /mic 猜歌哦！/micans可以结束哦！`, get.getimg('Phigros_Icon_3.0.0.png')))

        e.reply(segment.record(`https://qxsky.top:833/data/other_data/web/splited_music/${gamelist[group_id].songId}/${gamelist[group_id].unsend[rand]}.wav`))

        gamelist[group_id].unsend.splice(rand, 1)

    }

    async tip(e) {
        const { group_id } = e
        if (!gamelist[group_id]) {
            return false
        }
        if (gamelist[group_id].unsend.length == 0) {
            e.reply(`提示已经发完了呐QAQ！如果还是猜不出来也可以发送 /micans 查看答案哦！`)
            return true
        }
        var now = new Date()
        if (now - gamelist[group_id].tip <= Config.getDefOrConfig('config', 'MicTipCd') * 1000) {
            send.send_with_At(e, `距离提示的冷却时间还有${(Config.getDefOrConfig('config', 'MicTipCd') * 1000 - now + gamelist[group_id].tip).toFixed(1)}s呐！先仔细想一想吧！`)
            return true
        }
        gamelist[group_id].tip = now
        var rand = randint(0, gamelist[group_id].unsend.length - 1)

        e.reply(segment.record(`https://qxsky.top:833/data/other_data/web/splited_music/${gamelist[group_id].songId}/${gamelist[group_id].unsend[rand]}.wav`))

        gamelist[group_id].unsend.splice(rand, 1)

    }

    async guess(e) {
        const { group_id, msg } = e
        if (!gamelist[group_id]) {
            return false
        }
        const ans = msg.replace(/^.*?mic\s*/g, '')
        if (!ans) {
            return false
        }
        const result = get.fuzzysongsnick(ans, 0.95)
        const real = get.idgetsong(gamelist[group_id].songId + '.0')

        console.info(result)
        console.info(real)

        for (var i = 0; i < result.length; ++i) {
            if (result[i] == real) {
                send.send_with_At(e, `恭喜你，答对啦喵！ヾ(≧▽≦*)o\n答案是${real}！`)
                delete gamelist[group_id]
                return true
            }
        }

        if (result[1]) {
            send.send_with_At(e, `不是 ${ans} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
        } else {
            send.send_with_At(e, `不是 ${result[0]} 哦喵！≧ ﹏ ≦`, true, { recallMsg: 5 })
        }
    }

}


//定义生成指定区间整数随机数的函数
function randint(min, max) {
    const range = max - min + 1
    const randomOffset = Math.floor(Math.random() * range)
    return (randomOffset + min) % range + min
}


async function SendMusicShare(e, data, to_uin = null) {
    if (!Bot.sendOidb) return false

    let appid, appname, appsign, style = 4;
    switch (data.source) {
        case 'netease':
            appid = 100495085, appname = "com.netease.cloudmusic", appsign = "da6b069da1e2982db3e386233f68d76d";
            break;
        case 'kuwo':
            appid = 100243533, appname = "cn.kuwo.player", appsign = "bf9ff4ffb4c558a34ee3fd52c223ebf5";
            break;
        case 'kugou':
            appid = 205141, appname = "com.kugou.android", appsign = "fe4a24d80fcf253a00676a808f62c2c6";
            break;
        case 'migu':
            appid = 1101053067, appname = "cmccwm.mobilemusic", appsign = "6cdc72a439cef99a3418d2a78aa28c73";
            break;
        case 'qq':
        default:
            appid = 100497308, appname = "com.tencent.qqmusic", appsign = "cbd27cd7c861227d013a25b2d10f0799";
            break;
    }

    var title = data.name, singer = data.artist, prompt = '[分享]', jumpUrl, preview, musicUrl;

    let types = [];
    if (data.url == null) { types.push('url') };
    if (data.pic == null) { types.push('pic') };
    if (data.link == null) { types.push('link') };
    if (types.length > 0 && typeof (data.api) == 'function') {
        let { url, pic, link } = await data.api(data.data, types);
        if (url) { data.url = url; }
        if (pic) { data.pic = pic; }
        if (link) { data.link = link; }
    }

    typeof (data.url) == 'function' ? musicUrl = await data.url(data.data) : musicUrl = data.url;
    typeof (data.pic) == 'function' ? preview = await data.pic(data.data) : preview = data.pic;
    typeof (data.link) == 'function' ? jumpUrl = await data.link(data.data) : jumpUrl = data.link;

    if (typeof (musicUrl) != 'string' || musicUrl == '') {
        style = 0;
        musicUrl = '';
    }

    prompt = '[分享]' + title + '-' + singer;

    let recv_uin = 0;
    let send_type = 0;
    let recv_guild_id = 0;
    let ShareMusic_Guild_id = false;

    if (e.isGroup && to_uin == null) {//群聊
        recv_uin = e.group.gid;
        send_type = 1;
    } else if (e.guild_id) {//频道
        recv_uin = Number(e.channel_id);
        recv_guild_id = BigInt(e.guild_id);
        send_type = 3;
    } else if (to_uin == null) {//私聊
        recv_uin = e.friend.uid;
        send_type = 0;
    } else {//指定号码私聊
        recv_uin = to_uin;
        send_type = 0;
    }

    let body = {
        1: appid,
        2: 1,
        3: style,
        5: {
            1: 1,
            2: "0.0.0",
            3: appname,
            4: appsign,
        },
        10: send_type,
        11: recv_uin,
        12: {
            10: title,
            11: singer,
            12: prompt,
            13: jumpUrl,
            14: preview,
            16: musicUrl,
        },
        19: recv_guild_id
    };


    let payload = await Bot.sendOidb("OidbSvc.0xb77_9", core.pb.encode(body));

    let result = core.pb.decode(payload);

    if (result[3] != 0) {
        e.reply('歌曲分享失败：' + result[3], true);
    }
}
