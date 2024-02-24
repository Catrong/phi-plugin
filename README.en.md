<div align="center">

# <img src="https://github.com/Catrong/phi-plugin/assets/117198625/3d952c50-80b5-4031-9104-666027fbddcb" width="80%">

[![phi-plugin](https://img.shields.io/badge/GitHub_repository-phi--plugin-9cf?style=for-the-badge&logo=github)](https://github.com/Catrong/phi-plugin)
[![phi-plugin](https://img.shields.io/badge/GitHub_repository-phi--plugin-9cf?style=for-the-badge&logo=gitee)](https://gitee.com/catrong/phi-plugin)
![version](https://img.shields.io/badge/version-0.9.6-9cf?style=for-the-badge)
[![YunzaiBot](https://img.shields.io/badge/Yunzai-v3.0.0-9cf?style=for-the-badge&logo=dependabot)](https://gitee.com/yoimiya-kokomi/Yunzai-Bot)
[![MiaoYunzai](https://img.shields.io/badge/Miao--Yunzai-v3.0.0-9cf?style=for-the-badge&logo=dependabot)](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
[![TrssYunzai](https://img.shields.io/badge/TRSS--Yunzai-v3.0.0-9cf?style=for-the-badge&logo=dependabot)](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
[![Guild](https://img.shields.io/badge/QQGuild-Hutao114Pgr939-9cf?style=for-the-badge&logo=GroupMe)](https://pd.qq.com/s/e3z86q6bw)
[![Bilibili](https://img.shields.io/badge/Bilibili-就是不会告诉你-ff69b4?style=for-the-badge&logo=bilibili)](https://space.bilibili.com/403342249)
[![Stars](https://img.shields.io/github/stars/Catrong/phi-plugin?style=for-the-badge&color=yellow&label=Stars)](../../stargazers)

[![phi-plugin](https://img.shields.io/badge/语言-中文-FF0000?style=for-the-badge)](https://github.com/Catrong/phi-plugin/blob/main/README.md)
[![phi-plugin](https://img.shields.io/badge/Language-English-blue?style=for-the-badge)](https://github.com/Catrong/phi-plugin/blob/main/README.en.md)

  </div>
  
<br>

#### **The author is about to take the college entrance examination and will stop updating for the time being :(**

---

### Special Acknowledgements:

<table style="border-radius: 20px">
  <tbody style="border-radius: 20px">
    <tr>
        <td align="center" valign="top" width="10%"><a href="https://github.com/Walkersifolia"><img src="https://avatars.githubusercontent.com/u/129571444?v=4?s=100" style="border-radius: 50%" width="50px;" alt="圈圈"/><br /><sub><b>@Walkersifolia</b></sub></a><br /><a href="https://github.com/Catrong/phi-plugin/graphs/contributors/commits?author=Walkersifolia" title="Code">🌸</a></td>
        <td align="center" valign="top" width="10%"><a href="https://github.com/KeluIsAfkeru"><img src="https://avatars.githubusercontent.com/u/107661829?v=4?s=100" style="border-radius: 50%" width="50px;" alt="屑克鲁"/><br /><sub><b>@KeluIsAfkeru</b></sub></a><br /><a href="https://github.com/Catrong/phi-plugin/graphs/contributors/commits?author=KeluIsAfkeru" title="Code">🌸</a></td>
        <td align="center" valign="top" width="10%"><a href="https://github.com/S-t-e-v-e-e"><img src="https://avatars.githubusercontent.com/u/117198625?v=4?s=100" style="border-radius: 50%" width="50px;" alt="史蒂夫"/><br /><sub><b>@Steve~ɘvɘɈƧ</b></sub></a><br /><a href="https://github.com/Catrong/phi-plugin/graphs/contributors/commits?author=S-t-e-v-e-e" title="Code">🌸</a></td>
        <td align="center" valign="top" width="10%"><a href="https://github.com/7aGiven"><img src="https://avatars.githubusercontent.com/u/77519196?v=4?s=100" style="border-radius: 50%" width="50px;" alt="文酱"/><br /><sub><b>@7aGiven</b></sub></a><br /><a href="https://github.com/Catrong/phi-plugin/graphs/contributors/commits?author=7aGiven" title="Code">🌸</a></td>
        <td align="center" valign="top" width="10%"><a href="https://github.com/MYS-KISO"><img src="http://q2.qlogo.cn/headimg_dl?dst_uin=178269080&spec=100" style="border-radius: 50%" width="50px;" alt="Moist_Crystal"/><br /><sub><b>@Moist_Crystal</b></sub></a><br /><a href="https://github.com/Catrong/phi-plugin/graphs/contributors/commits?author=MYS-KISO" title="Code">🌸</a></td>
    </tr>
  </tbody>
</table>

---

### Install:

Run in Yunzai directory  
> Install using GitHub
```
git clone --depth=1 https://github.com/Catrong/phi-plugin.git ./plugins/phi-plugin/ # Install plugin ontology
cd ./plugins/phi-plugin/ # Go to the plugins directory
pnpm install -P # Install the plugin dependencies
```
> Install using Gitee
```
git clone --depth=1 https://gitee.com/catrong/phi-plugin.git ./plugins/phi-plugin/ # Install plugin ontology
cd ./plugins/phi-plugin/ # Go to the plugins directory
pnpm install -P # Install the plugin dependencies
```

---

### List of features:
> The following # can be used instead of /, and the command header can be customized
#### **User features below**
| **Function name** | **Function Description** 
| :- | :- 
| `#phi帮助` | Get help 
| `#phi (bind\|绑定)xxx` | Bind sessionToken 
| `#phi (unbind\|解绑)` | Delete sessionToken and save records on the bot) 
| `#phi clean` | Delete all of the persenal date 
| `#phi (update\|更新存档)` | Update save on the bot 
| `#phi (rks\|pgr\|b19)` | Querying the rks will provide the resulting b21 results 
| `#phi info(1\|2)?` | Inquiries for personal information 
| `#phi (lvsco(re)\|scolv) <DIF range>` | Get interval scores 
| `#phi list <DIF range> <EZ|HD|IN|AT> <NEW|C|B|A|S|V|FC|PHI>` | 获取区间每首曲目的成绩
| `#phi best1(+)` | Query text version b19 (or more), up to b99 
| `#phi (score\|单曲成绩)xxx` | Get track scores and score suggestions 
| `#phi (suggest\|推分)` | Get the track information that can make RKS+0.01 and its required ACC 
| `#phi data` | Gets the number of user data 
| `#phi (guess\|猜曲绘)` | Guess the song, answer without special orders, reply directly, if it is not the song title will not speak, if it is not the correct song title will reply. '#illans' End of guessing 
| `#phi mic` | Listen to music clips and guess the song, answer that you need to send '/gu'<song>; For example '/gu Distorted Fate', if more fragments are needed to send '/phi mictip', answer '/micans' 
| `#phi (曲绘洗牌\|illmix)` | Shuffle the order of the track list in the guess plot and normalize the weights 
| `#phi (letter\|出你字母\|猜曲名)` | Guess the title of the song according to the letters, '#出...' Opens the specified letter, '#第n个...' Answer, '#letterans' to get the answer 
| `#phi (字母洗牌\|lettermix)` | The order of the track list in the title will be shuffled according to the letter guess and the weights will be normalized 
| `#phi (song\|曲) xxx` | Query Phigros song info, also supports aliasing 
| `#phi (rand\|随机) <condition>` | According to the conditional random tracks, the condition supports difficulty, fixed number, difficulty can be multi-select, in - interval 
| `#phi (曲绘\|ill\|Ill) xxx` | Query the artwork of a track in Phigros 
| `#phi (search\|查询\|检索) <condition, value>` | Retrieve tracks in the library, support BPM constant quantity, condition bpm dif cmb, the value can be interval, with - interval 
| `#phi (theme\|主题) [0-2]` | Toggles the drawing theme, only for b19, update
| `sign/签到` | Check in to get Notes and task 
| `task/我的任务` | Review your tasks 
| `retask/刷新任务` | Refreshing the task costs 20Notes 
| `#phi (send\|送\|转) <target> <quantity>` | Send to the target Note, support @ or QQ number 
#### **Admin functions below**
| **Function name** | **Function Description** 
| :- | :- 
| `#phi(设置别名\|setnick) xxx ---> xxx` | Set an alias for a song in the format Original name (or already an alias) ---> alias (spaces on both sides of the ---> are automatically filtered) 
| `#phi(删除别名\|delnick) xxx` | Delete an alias for a song 
| `#phi(强制)?更新` | Update this plugin 

---

#### Todo

- [ ] Write a help menu
- [ ] Complete cloud save
- [ ] Add a booklet for collectibles, avatars, etc
- [ ] Listen to phigros's songs
- [ ] Guild mode disables private chat to generate b19 graphs and entertainment functions  
…

---

#### Best19 rendering
<img src="https://github.com/Catrong/phi-plugin/assets/117198625/e55e7fec-c0cc-447e-8529-71dfa13b370b" width="60%">

Renderings from[@Steve~](https://github.com/S-t-e-v-e-e)  

#### Single song score info rendering
<img src="https://github.com/Catrong/phi-plugin/assets/117198625/8f4606da-dbc4-476f-b7c9-8a32dda72758" width="100%">  

Renderings from[@Steve~](https://github.com/S-t-e-v-e-e)

#### Single song score info rendering(Legacy)
<img src="https://github.com/Catrong/phi-plugin/assets/117198625/093e3d30-7f9e-48cb-9e12-bb9f0bb3b40c" width="100%">  

Renderings from[@Steve~](https://github.com/S-t-e-v-e-e)

#### Range Score Info rendering
<img src="https://github.com/Catrong/phi-plugin/assets/117198625/411dff8e-ec93-4ebe-80ff-510105fd3f65" width="100%">  

Renderings from@Eastown

#### Single song information rendering
<img src="https://github.com/Catrong/phi-plugin/assets/117198625/c6eb9694-8f72-4d3f-85d9-5120375b047b" width="100%">

#### User information renderings(Legacy)
<img src="https://github.com/Catrong/phi-plugin/assets/117198625/9e536f1a-4cbe-41da-b2da-94d1bcd70488" width="60%">  

Renderings from@Eastown

#### User information renderings
<img src="https://github.com/Catrong/phi-plugin/assets/117198625/c576dd76-4011-4e5f-9f58-b1f2e5015d56" width="100%">  

Renderings from[@Steve~](https://github.com/S-t-e-v-e-e)

---

## Disclaimer

1. Plugins are only for internal communication and small-scale use. Do not use 'Yunzai-Bot' and 'phi-Plugin' for any profit-oriented scenarios.
2. The pictures and other materials are from the network, only for the exchange of learning use, if any infringement, please contact, will be immediately deleted.
3. Cloud archive adapted from [7aGiven/PhigrosLibrary](https://github.com/7aGiven/PhigrosLibrary/).

---

###### ***Bad writing,don't overdo it...***


