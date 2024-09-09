<div align="center">

# <img src="https://github.com/Catrong/phi-plugin/assets/117198625/3d952c50-80b5-4031-9104-666027fbddcb" width="80%">

[![phi-plugin](https://img.shields.io/badge/GitHub_repository-phi--plugin-9cf?style=for-the-badge&logo=github)](https://github.com/Catrong/phi-plugin)
[![phi-plugin](https://img.shields.io/badge/GitHub_repository-phi--plugin-9cf?style=for-the-badge&logo=gitee)](https://gitee.com/catrong/phi-plugin)
![version](https://img.shields.io/badge/version-0.9.6-9cf?style=for-the-badge)
[![YunzaiBot](https://img.shields.io/badge/Yunzai-v3.0.0-9cf?style=for-the-badge&logo=dependabot)](https://github.com/yoimiya-kokomi/Yunzai-Bot)
[![MiaoYunzai](https://img.shields.io/badge/Miao--Yunzai-v3.0.0-9cf?style=for-the-badge&logo=dependabot)](https://github.com/yoimiya-kokomi/Miao-Yunzai)
[![TrssYunzai](https://img.shields.io/badge/TRSS--Yunzai-v3.0.0-9cf?style=for-the-badge&logo=dependabot)](https://github.com/TimeRainStarSky/Yunzai)
[![QQGuild](https://img.shields.io/badge/QQGuild-Hutao114Pgr939-9cf?style=for-the-badge&logo=GroupMe)](https://pd.qq.com/s/e3z86q6bw)
[![Bilibili](https://img.shields.io/badge/Bilibili-就是不会告诉你-ff69b4?style=for-the-badge&logo=bilibili)](https://space.bilibili.com/403342249)
[![Stars](https://img.shields.io/github/stars/Catrong/phi-plugin?style=for-the-badge&color=yellow&label=Stars)](../../stargazers)

### English | [中文](https://github.com/Catrong/phi-plugin/)


  </div>
  
<br>

---

### Special Acknowledgements:

<table style="border-radius: 20px">
  <tbody style="border-radius: 20px">
    <tr>
        <td align="center" valign="top" width="10%"><a href="https://github.com/Walkersifolia"><img src="https://avatars.githubusercontent.com/u/129571444?v=4?s=100" style="border-radius: 50%" width="50px;" alt="圈圈"/><br /><sub><b>@Walkersifolia</b></sub></a><br /><a href="https://github.com/Catrong/phi-plugin/graphs/contributors/commits?author=Walkersifolia" title="Code">🌸</a></td>
        <td align="center" valign="top" width="10%"><a href="https://github.com/KeluIsAfkeru"><img src="https://avatars.githubusercontent.com/u/107661829?v=4?s=100" style="border-radius: 50%" width="50px;" alt="屑克鲁"/><br /><sub><b>@KeluIsAfkeru</b></sub></a><br /><a href="https://github.com/Catrong/phi-plugin/graphs/contributors/commits?author=KeluIsAfkeru" title="Code">🌸</a></td>
        <td align="center" valign="top" width="10%"><a href="https://github.com/S-t-e-v-e-e"><img src="https://avatars.githubusercontent.com/u/117198625?v=4?s=100" style="border-radius: 50%" width="50px;" alt="史蒂夫"/><br /><sub><b>@Steve~ɘvɘɈƧ</b></sub></a><br /><a href="https://github.com/Catrong/phi-plugin/graphs/contributors/commits?author=S-t-e-v-e-e" title="Code">🌸</a></td>
        <td align="center" valign="top" width="10%"><a href="https://github.com/7aGiven"><img src="https://avatars.githubusercontent.com/u/77519196?v=4?s=100" style="border-radius: 50%" width="50px;" alt="文酱"/><br /><sub><b>@7aGiven</b></sub></a><br /><a href="https://github.com/Catrong/phi-plugin/graphs/contributors/commits?author=7aGiven" title="Code">🌸</a></td>
        <td align="center" valign="top" width="10%"><a href="https://github.com/MYS-KISO"><img src="https://avatars.githubusercontent.com/u/101465504?v=4?s=100" style="border-radius: 50%" width="50px;" alt="MoistCrystal"/><br /><sub><b>@MoistCrystal</b></sub></a><br /><a href="https://github.com/Catrong/phi-plugin/graphs/contributors/commits?author=MYS-KISO" title="Code">🌸</a></td>
        <td align="center" valign="top" width="10%"><a href="https://github.com/yt6983138"><img src="https://avatars.githubusercontent.com/u/83499886?v=4?s=100" style="border-radius: 50%" width="50px;" alt="yt6983138"/><br /><sub><b>@static_void</b></sub></a><br /><a href="https://github.com/yt6983138" title="Code">🌸</a></td>
        <td align="center" valign="top" width="10%"><a href="https://github.com/wms26"><img src="https://avatars.githubusercontent.com/u/50258919?v=4?s=100" style="border-radius: 50%" width="50px;" alt="wms26"/><br /><sub><b>@千柒</b></sub></a><br /><a href="https://github.com/wms26" title="Code">🌸</a></td>
    </tr>
  </tbody>
</table>

---

### Install:

Run in Yunzai directory  
> Install by using GitHub
```
git clone --depth=1 https://github.com/Catrong/phi-plugin.git ./plugins/phi-plugin/ # Install plugin ontology
cd ./plugins/phi-plugin/ # Go to the plugins directory
pnpm install -P # Install the plugin dependencies
```
> Install by using Gitee
```
git clone --depth=1 https://gitee.com/catrong/phi-plugin.git ./plugins/phi-plugin/ # Install plugin ontology
cd ./plugins/phi-plugin/ # Go to the plugins directory
pnpm install -P # Install the plugin dependencies
```
---

### List of features:
> The following # can be replaced with /, and the command header can be customized
#### **User features below**
| **Function name** | **Function Description** 
| :- | :- 
| `#phi帮助` | Get help 
| `#phi (bind\|绑定)xxx` | Bind sessionToken 
| `#phi (unbind\|解绑)` | Delete sessionToken and save records on the bot) 
| `#phi clean` | Delete all of the personal data
| `#phi (update\|更新存档)` | Update save on the bot 
| `#phi (rks\|pgr\|b19)` | Querying the rks (Get the resulting b21 results)
| `#phi info(1\|2)?` | Get personal information 
| `#phi (lvsco(re)\|scolv) <DIF range>` | Get comprehensive scores for different difficulty ranges
| `#phi chap <章节名称\|help>` | Obtain the scores of all songs in any one chapter 
| `#phi list <range of dif> <EZ\|HD\|IN\|AT> <NEW\|C\|B\|A\|S\|V\|FC\|PHI>` | Get scores of all thesongs which in different difficulty ranges
| `#phi best1(+)` | Get b19 in text version (or more), up to b99 
| `#phi (score\|单曲成绩)xxx` | Get track scores,acc and acc suggestions 
| `#phi (suggest\|推分)` | Get suggestions and the acc which can make your RKS +0.01 
| `#phi (ranklist\|排行榜)` | Get RKS leaderboard
| `#phi data` | Get the quantity of data
| `#phi (guess\|猜曲绘)` | Guess the song, answer without special orders,just reply directly. bot will not reply if it your answer is not the song title, if it is not the correct song title,it will reply. '#illans' to stop guessing and get answer.
| `#phi mic` | Listen to music clips and guess the song, guess by '/gu'<song>; For example '/gu Distorted Fate', if more fragments are needed to send '/phi mictip', '/micans' to stop guessing and get answer.
| `#phi (曲绘洗牌\|illmix)` | Shuffle the order of the track list in the guess plot and normalize the weights 
| `#phi (letter\|出你字母\|猜曲名)` | Guess the title of the song according to the letters, '#出...' Opens the specified letter, guess by'#第n个...' , '#letterans' to stop guessing and get answer.
| `#phi (字母洗牌\|lettermix)` | The order of the track list in the title will be shuffled according to the letter guess and the weights will be normalized 
| `#phi (song\|曲) xxx` | Get Phigros song info, also supports aliasing 
| `#phi tips` | Random tips 
| `#phi jrrp` | Find out the lucky dog 
| `#phi (rand\|随机) <condition>` | According to the conditional random tracks, the condition supports difficulty, fixed number, difficulty can be multi-select, in - interval 
| `#phi (曲绘\|ill\|Ill) xxx` | Query the illustration of a song in Phigros 
| `#phi (search\|查询\|检索) <condition, value>` | Retrieve tracks in the library, support BPM constant quantity, condition bpm dif cmb, the value can be interval, with - interval 
| `#phi (theme\|主题) [0-2]` | Toggles the drawing theme, only for b19 And update
| `sign/签到` | sign for Notes and task 
| `task/我的任务` | Review your tasks 
| `retask/刷新任务` | Refreshing the task by costing 20 Notes 
| `#phi (send\|送\|转) <target> <quantity>` | Send to the target Note, support @ or QQ number 
#### **Admin functions below**
| **Function name** | **Function Description** 
| :- | :- 
| `#phi(设置别名\|setnick) xxx ---> xxx` | Set an alias for a song in the format Original name (or already an alias) ---> alias (spaces on both sides of the ---> are automatically filtered) 
| `#phi(删除别名\|delnick) xxx` | Delete an alias for a song 
| `#phi(强制)?更新` | Update this plugin | `#download illustration|down ill` | Download illustrations to local storage 
| `#phi get <rank>` | Get the sessionToken of a user at a specific rank on the leaderboard
| `#phi del <sessionToken>` | Disable a specific sessionToken
| `#phi allow <sessionToken>` | Restore a specific sessionToken
| `#phi ban <function>` | Disable a certain type of function, see the table below

#### Function Parameter Description

| Parameter | Function | Affected Commands
| :- | :- | :-
| all | all | all
| help | Help feature | /help /tkhelp
| bind | Binding feature | /bind /unbind
| b19 | Image score lookup feature | /pgr /update /info /list /pb30 /score /lvsco /chap
| wb19 | Text score lookup feature | /suggest /data /best
| song | Song guide feature | /song /ill /search /alias /rand
| ranklist | Leaderboard feature (does not disable user rankings) | /ranklist /godlist
| fnc | Small features | /com /tips
| tipgame | Tip guessing game | /tipgame
| guessgame | Guessing game | /guess
| ltrgame | Letter guessing game | /letter /ltr
| sign | Entertainment features | /sign /send /task /retask /jrrp
| setting | System settings | /theme
| dan | Rank certification related | /dan /danupdate

---

#### Todo

- [ ] Optimized the interface design

- [ ] Added collectibles, avatars, etc
 
- [ ] Dotted phi's song


---

## Links

[Yunzai-Bot plugins index](https://github.com/yhArcadia/Yunzai-Bot-plugins-index)

[Miao-Yunzai](https://github.com/yoimiya-kokomi/Miao-Yunzai/tree/master)

[TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai)

---

#### Best19 rendering
<img src="https://github.com/user-attachments/assets/d7fab54d-293d-4a74-84cd-3e521ad3e242" width="50%">

Renderings from[@Steve~](https://github.com/S-t-e-v-e-e)  

#### Single song score info rendering
<img src="https://github.com/user-attachments/assets/2201c185-1352-4b69-8649-c00d9756e1c5" width="50%">

Renderings from[@Steve~](https://github.com/S-t-e-v-e-e)

#### Single song score info rendering(Legacy)
<img src="https://github.com/Catrong/phi-plugin/assets/117198625/093e3d30-7f9e-48cb-9e12-bb9f0bb3b40c" width="50%"> 

Renderings from[@Steve~](https://github.com/S-t-e-v-e-e)

#### Range Score Info rendering
<img src="https://github.com/Catrong/phi-plugin/assets/117198625/411dff8e-ec93-4ebe-80ff-510105fd3f65" width="50%">

Renderings from[@Eastown](https://space.bilibili.com/171389567)

#### Single song information rendering
<img src="https://github.com/Catrong/phi-plugin/assets/117198625/c6eb9694-8f72-4d3f-85d9-5120375b047b" width="50%">

#### User information rendering(Legacy)
<img src="https://github.com/Catrong/phi-plugin/assets/117198625/9e536f1a-4cbe-41da-b2da-94d1bcd70488" width="50%">

Renderings from[@Eastown](https://space.bilibili.com/171389567)

#### User information rendering
<img src="https://github.com/user-attachments/assets/ed20abfa-5bb1-4215-8b2b-8c5171126432" width="50%">

Renderings from[@Steve~](https://github.com/S-t-e-v-e-e)

---

## Disclaimer

1. Plugins are only for internal communication and small-scale use. Do not use 'Yunzai-Bot' and 'phi-Plugin' for any profit-oriented scenarios.
2. The pictures and other materials are from the network, only for the exchange of learning use, if any infringement, please contact, will be immediately deleted.
3. Cloud archive adapted from [7aGiven/PhigrosLibrary](https://github.com/7aGiven/PhigrosLibrary/).

---

###### ***Bad writing,don't overdo it...***


