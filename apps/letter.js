/**Phigros出字母猜曲名游戏
 * 会随机抽选6首歌曲
 * 每首曲目的名字只显示一部分，剩下的部分隐藏
 * 通过给出的字母猜出响应的歌曲
 * 玩家可以翻开所有曲目响应的字母获得更多线索
*/
import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'

await get.init()
var songsname = []
for (let i in get.info) {
    songsname.push(i)
}
songsname=songsname.filter((song) => {
    // 判断是否为纯中文或纯英文，其他符号的曲名不太好打
    return /^[\u4e00-\u9fa5]+$|^[\w\s-+]+$/.test(song);
});

var gamelist = {}//存储标准答案曲名
var blurlist = {}//存储模糊后的曲名
var alphalist = {}//存储翻开的字母

export class philetter extends plugin{
    constructor() {
        super({
            name: 'phi-lettergame',
            dsc: 'phi-plugin出你字母',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(letter|出你字母)$`,
                    fnc: 'start'
                },
                {
                    reg: `^[#/]出[a-zA-Z]$`,
                    fnc: 'reveal'
                },
                {
                    reg: `^[#/]第[1-6]个.*$`,
                    fnc: 'guess'
                },
                {
                    reg: `^[#/](字母答案)$`,
                    fnc: 'ans'
                }

            ]
        })

    }
        /**发起出字母猜歌 */
    async start(e){
        if (gamelist[e.group_id]) {
            e.reply("喂喂喂，已经有群友发起出字母猜歌啦，不要再重复发起了，赶快输入'#第X个XXXX'来猜曲名或者'#出X'来揭开字母吧！", true)
            return true
        }

        //随机抽取6首歌
        for (var i = 1; i <= 6; i++) {
            var num = randbt(songsname.length - 2)
            var songName = songsname[num]
            var songs_info = get.info[songName]
            gamelist[e.group_id] = gamelist[e.group_id] || {}
            gamelist[e.group_id][i] = songs_info.song

            blurlist[e.group_id] = blurlist[e.group_id] || {}
            //加密歌名
            blurlist[e.group_id][i] = encrypt_song_name(songs_info.song)
        }
        e.reply(`出你字母开启成功！回复'#第X个XXXX'命令猜歌，例如：#第1个Reimei;发送'#出X'来揭开字母(不区分大小写)，如'#出A';发送'#字母答案'结束并查看答案`)
        
        //延时1s
        await timeout(1 * 1000)

        var output='出你字母进行中：\n'
        for(var i in blurlist[e.group_id]){
            var blur_name=blurlist[e.group_id][i]
            output+='【'+ i + '】'+ blur_name+'\n'
        }
        await e.reply(output,true)

        return true
    }

    async reveal(e){
        if (!gamelist[e.group_id]) {
            e.reply("当前还没有进行的出你字母游戏捏，赶快输入'#letter'或'#出字母'开始新的一局吧！", true)
            return true
        }

        var msg=e.msg
        var regex = /^[#/]出([a-zA-Z])$/
        var letter=''
        var reverse_letter=''
        var output=''
        var matchResult = msg.match(regex)
        if(matchResult){
            //匹配成功
            letter=matchResult[1]
            reverse_letter=reverseletter(letter)
            var included=false
            for(var i in gamelist[e.group_id]){
                var songname=gamelist[e.group_id][i]
                if(!songname.includes(letter) && !songname.includes(reverse_letter)){
                    if(!(blurlist[e.group_id][i])){
                        output+='【'+ i + '】'+ songname+'\n'
                    }else{
                        output+='【'+ i + '】'+ blurlist[e.group_id][i]+'\n'
                    }
                    continue
                }
                included=true

                if(!(blurlist[e.group_id][i])){
                    output+='【'+ i + '】'+ songname+'\n'
                    continue
                }

                var blurname=blurlist[e.group_id][i]
                var newBlurname=''
                for(var ii=0;ii<songname.length;ii++){
                    if(songname[ii]==letter){
                        newBlurname+=letter
                    }else if(songname[ii]==reverse_letter){
                        newBlurname+=reverse_letter
                    }else{
                        newBlurname+=blurname[ii]
                    }
                }
                blurlist[e.group_id][i] = newBlurname
                output+='【'+ i + '】'+ newBlurname+'\n'
            }

            if(included){
                //包含该字母
                alphalist[e.group_id] = alphalist[e.group_id] || {}
                alphalist[e.group_id][letter]=''

                //已翻开的
                var opened='当前所有翻开字母['
                for(var a in alphalist[e.group_id]){
                    opened+=a+' '
                }
                opened+=']\n'

                e.reply("已翻开字母["+letter+']\n'+ opened + output, true)
            }
            else{
                e.reply("这几首曲目中不包含字母["+letter+']\n'+output, true)
            }
        }else{
            e.reply("匹配失败，请检查你的格式是否正确！", true)
            return true
        }
        return true
    }


    async guess(e){
        //必须已经开始了一局
        if (gamelist[e.group_id]) {
            var msg=e.msg
            var regex = /^[#/]第([1-6])个(.*)$/
            var result = msg.match(regex);
            var num=''
            var content=''
            var output=''
            if(result){
                num=result[1]
                content=result[2]
                var songs = get.songsnick(content)//匹配到的歌曲
                var standard_song=gamelist[e.group_id][num]
                //已翻开的
                var opened='已翻开字母['
                for(var a in alphalist[e.group_id]){
                    opened+=a+' '
                }
                opened+=']\n'

                if (songs[0]) {
                    for (var i in songs) {
                        if (standard_song == songs[i]) {
                            //已经猜完的曲目不能再猜
                            if(!blurlist[e.group_id][num]){
                                e.reply('曲目['+standard_song+']已经猜过了，要不咱们换一个吧uwu')
                                return true
                            }

                            delete (blurlist[e.group_id][num])
                            e.reply('恭喜你ww，答对啦喵！ヾ(≧▽≦*)o', true)
                            e.reply(await get.getsongsinfo(e, standard_song))//发送曲绘
                            var isEmpty = Object.getOwnPropertyNames(blurlist[e.group_id]).length === 0//是否全部猜完
                            if(!isEmpty){
                                output='出你字母进行中：\n'+ opened
                                for(var m in gamelist[e.group_id]){
                                    var blur_name=blurlist[e.group_id][m]
                                    if(blurlist[e.group_id][m]){
                                        output+='【'+ m + '】'+ blur_name+'\n'
                                    }else{
                                        output+='【'+ m + '】'+ gamelist[e.group_id][m]+'\n'
                                    }
                                }
                                e.reply(output)
                                return true
                            }else{
                                output='出你字母已结束，答案如下：\n'
                                for(var m in gamelist[e.group_id]){
                                    var correct_name=gamelist[e.group_id][m]
                                    output+='【'+ m + '】'+ correct_name +'\n'
                                }
                                output+=opened
                                delete(alphalist[e.group_id])
                                delete (gamelist[e.group_id])
                                delete (blurlist[e.group_id])
                                e.reply(output)
                                return true
                            }

                        }
                    }             
                    e.reply('第'+num+'首不是'+content+'www，要不再想想捏？≧ ﹏ ≦', true)
                    return true
                }
                e.reply('第'+num+'首不是'+content+'www，要不再想想捏？≧ ﹏ ≦', true)

            }else{
                e.reply('格式匹配错误，请检查格式')
                return true
            }

            
        }else{
            e.reply("现在还没有进行的出你字母捏，赶快输入'#phi letter'或'#phi 出你字母'开始新的一局吧！", true)
        }


        return true
    }

    async ans(e) {
        if (gamelist[e.group_id]) {
            var t = gamelist[e.group_id]
            delete(alphalist[e.group_id])
            delete (gamelist[e.group_id])
            delete(blurlist[e.group_id])
            await e.reply('好吧好吧，既然你执着要放弃，那就公布答案好啦。', true)
            var output='出你字母已结束，答案如下：\n'
            for(var m in t){
                var correct_name=t[m]
                output+='【'+ m + '】'+ correct_name +'\n'
            }
            await e.reply(output)
            return true
        }
        return false
    }


}

/**
 * RandBetween
 * @param {number} top 随机值上界
 */
function randbt(top, bottom = 0) {
    return Number((Math.random() * (top - bottom)).toFixed(0)) + bottom
}

function timeout(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms, 'done');
    });
}

function rand(max){
    return Math.floor(Math.random()*(max+1))
}

function encrypt_song_name(name){
    var encryptedName=''
    var num=rand(Math.min(2,name.length-2))+1//显示多少位
    var numset=[]
    for(var i=0;i<num;i++){
        var numToShow=rand(name.length-1)
        while(name[numToShow]==' '){
            numToShow=rand(name.length-1)
        }
        numset[i]=numToShow
    }

    for(var i=0;i<name.length;i++){
        if(numset.includes(i)){
            encryptedName+=name[i]
            continue
        }else if(name[i]==' '){
            encryptedName+=' '
            continue
        }else{
            // //判断这个字符是什么格式，中文就用'*'，英文就用'#'，其他就用'@'
            // if(/^[\u4e00-\u9fa5]+$/.test(name[i])){
            //     //中文
            //     encryptedName+='*'
            // }else if(/^[a-zA-Z]+$/.test(name[i])){
            //     //English
            //     encryptedName+='#'
            // }else{
            //     //others
            //     encryptedName+='@'
            // }
            encryptedName+='*'
        }
    }
    return encryptedName
}

//字母取反
function reverseletter(alpha){
    var convertedLetter
    if (alpha === alpha.toUpperCase()) {
         // 如果是大写字母，则转换为小写字母
         convertedLetter = alpha.toLowerCase();
    }else{
        convertedLetter = alpha.toUpperCase();
    }

    return convertedLetter
}

