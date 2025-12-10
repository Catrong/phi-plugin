<div align="center">
  <h1>
    <picture>
      <source srcset="https://github.com/user-attachments/assets/b9dd395d-b983-4532-a6b1-12abfaba5cea" type="image/avif" width="80%" />
      <img src="https://github.com/Catrong/phi-plugin/assets/117198625/3d952c50-80b5-4031-9104-666027fbddcb" width="80%">
    </picture>
  
### [中文](./README.md) | English
  </h1>

[![Guild](https://img.shields.io/badge/QQGuild-Hutao114Pgr939-9cf?style=flat-square&logo=GroupMe)](https://pd.qq.com/s/e3z86q6bw)
[![Guild](https://img.shields.io/badge/Discord-RkBwFBaRqa-9cf?style=flat-square&logo=Discord)](https://discord.gg/invite/RkBwFBaRqa)
[![Bilibili](https://img.shields.io/badge/Bilibili-就是不会告诉你-A4CAFA?style=flat-square&logo=bilibili&logoColor=white&labelColor=ff69b4)](https://space.bilibili.com/403342249)
[![Stars](https://img.shields.io/github/stars/Catrong/phi-plugin?style=flat-square&color=yellow&label=Star)](../../stargazers)

![version](https://img.shields.io/badge/Plugin_Version-0.9.9.4-9cf?style=flat-square)
![version](https://img.shields.io/badge/Phigros-3.18.0-9cf?style=flat-square)  
[![YunzaiBot](https://img.shields.io/badge/Yunzai-v3.0-9cf?style=flat-square&logo=dependabot)](/yoimiya-kokomi/Yunzai-Bot)
[![MiaoYunzai](https://img.shields.io/badge/Miao--Yunzai-v3.0-9cf?style=flat-square&logo=dependabot)](/yoimiya-kokomi/Miao-Yunzai)
[![TrssYunzai](https://img.shields.io/badge/TRSS--Yunzai-v3.0-9cf?style=flat-square&logo=dependabot)](/TimeRainStarSky/Yunzai)
</div>

### Introduction

`phi-plugin` is a plugin for querying Phigros information, including b30, score, userinfo, and more Phigros-related features. Suggestions and issues can be submitted via [Issues](./issues). [Pull request](./pulls) are welcome.

Use `/phihelp` after installation to view detailed commands.

---

### Installation

Run the following commands in your Yunzai directory:

> Using GitHub

```bash
# Install plugin core
git clone --depth=1 https://github.com/Catrong/phi-plugin.git ./plugins/phi-plugin/
# Enter plugin directory
cd ./plugins/phi-plugin/
# Install dependencies
pnpm install -P
```

> Using Gitee

```bash
# Install plugin core
git clone --depth=1 https://gitee.com/catrong/phi-plugin.git ./plugins/phi-plugin/
# Enter plugin directory
cd ./plugins/phi-plugin/
# Install dependencies
pnpm install -P 
```

> [!WARNING]
> Please use the master's permission to execute this command to download the song illustrations. Otherwise, the relevant song illustrations will not be displayed properly! (It can be standard input or other platforms.)
> 
>```
> /phi downill
>```

---

#### Todo

* [ ] Optimize UI design
* [ ] Add collection/avatar gallery
* [ ] Song selection via phi
* [ ] Optimize sessionToken QR scanning
* [ ] Modify settings via commands
* [ ] ...

---

### Features

Note: `#` can be replaced with `/`. Command headers are customizable.

#### **User Features**

| **Command** | **Description** |
| :- | :- |
| `#phi help` | Show help |
| `#phi (bind\|bind)xxx` | Bind sessionToken |
| `#phi (unbind\|unbind)` | Remove sessionToken & records |
| `#phi clean` | Delete all records |
| `#phi (update\|update)` | Update save data |
| `#phi (rks\|pgr\|b30)` | Query Rks (provides b30 results) |
| `#phi x30` | Query 1Good b30 |
| `#phi fc30` | Query Full Combo b30 |
| `杠批比三零` | Same as above,but looks like Arcaea Online |
| `#phi info(1\|2)?` | View personal stats |
| `#phi lmtacc [0-100]` | Calculate Rks with minimum ACC limit |
| `#phi (lvsco(re)\|scolv) <rating range> <difficulty>` | Get scores in range |
| `#phi chap <chapter name\|help>` | Get chapter scores |
| `#phi list <-dif difficultyRange> <-acc accRange> <EZ\|HD\|IN\|AT> <NEW\|C\|B\|A\|S\|V\|FC\|PHI>` | List scores per song in range |
| `#phi best1(+)` | Text-based b30 (up to b99) |
| `#phi score xxx  [-dif (EZ\|HD\|IN\|AT)] [-or (acc\|score\|fc\|time)] [-unrank]` | Get single score & improvement tips (parameters for score ranking, API required) |
| `#phi (suggest\|suggest)` | Get songs that can increase Rks by +0.01 |
| `#phi (ranklist\|ranking)` | Rks leaderboard |
| `#phi data` | Check user data count |
| `#phi (guess\|guess)` | Guess song from illustration (reply directly) |
| `#phi (ltr\|letter)` | Guess song via letters (use #open/#ans) |
| `#phi (tipgame\|hint)` | Guess song via hints (use #tip/#ans) |
| `#phi (song\|song) xxx` | Query song info (supports aliases) |
| `#phi chart <song> <difficulty>` | View chart details |
| `#phi (addtag\|subtag\|retag) <song> <difficulty> <tag>` | Vote on tags (default IN) |
| `#phi (comment\|cmt) <song> <difficulty?>(newline)<text>` | Comment on songs |
| `#phi mycmt` | View own cloud comments |
| `#phi recmt <ID>` | Delete comment (owner/admin) |
| `#phi (table\|ratings) <rating>` | Phigros rating table (by Rhythematics) |
| `#phi new` | Check new songs |
| `#phi tips` | Random tips |
| `#phi jrrp` | Daily luck |
| `#phi alias xxx` | Query song aliases |
| `#phi (rand\|random) [rating] [difficulty]` | Random song by criteria |
| `#phi randclg [total] [difficulty] ([rating range])` | Random challenge (e.g., /rand 40 (IN 13-15)) |
| `#phi (ill\|ill) xxx` | View song illustration |
| `#phi (search\|search) <criteria>` | Search songs by BPM/rating/notes |
| `#phi (theme\|theme) [0-2]` | Switch themes (affects b30/update/randclg/sign/task) |
| `sign/sign` | Daily check-in |
| `task/mytasks` | View tasks |
| `retask/refresh` | Refresh tasks (20 Notes) |
| `#phi (send\|give) <target> <amount>` | Send Notes |

#### **Admin Features**

| **Command** | **Description** |
| :- | :- |
| `#phi backup (back)?` | Backup saves (+back to send) |
| `#phi restore` | Restore from backup |
| `#phi(setnick) xxx ---> xxx` | Set song alias |
| `#phi(delnick) xxx` | Remove alias |
| `#phi(force)?(update)` | Update plugin |
| `#phi repu` | Restart puppeteer |
| `#download ill` | Download illustration |
| `#phi get <rank>` | Get sessionToken by rank |
| `#phi del <token>` | Ban sessionToken |
| `#phi allow <token>` | Unban sessionToken |
| `#phi (set\|set)<feature><value>` | Modify settings |
| `#phi ban <feature>` | Disable features |

<details open>  
<summary>Ban Parameters</summary>

#### `#phi ban` Parameters

| Parameter | Feature | Affected Commands |
| :- | :- | :- |
| all | All features | All |
| help | Help | /help /tkhelp |
| bind | Binding | /bind /unbind |
| b19 | Image queries | /pgr /update /info /list /pb30 /p30 /lmtacc /score /lvsco /chap /suggest |
| wb19 | Text queries | /data /best |
| song | Song info | /song /chart /ill /search /alias /rand /randclg /table /cmt /recmt /addtag /subtag /retag |
| ranklist | Leaderboards | /ranklist /godlist |
| fnc | Utilities | /com /tips /new |
| tipgame | Hint game | /tipgame |
| guessgame | Guess game | /guess |
| ltrgame | Letter game | /letter /ltr |
| sign | Social | /sign /send /task /retask /jrrp |
| setting | Settings | /theme |
| dan | Dan authentication | /dan /danupdate |
</details>

---

### Support Development

[<img src="https://github.com/user-attachments/assets/8c181f08-a2b6-4e67-8b61-bd2e4027a6a4" width="400" />](https://afdian.com/a/Feijiang_)  

Your support is my greatest motivation!

#### Sponsors

Special thanks to these sponsors (list may not be fully updated):

<table>
    <tr>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><a href="https://github.com/qilinX88"><img src="https://avatars.githubusercontent.com/u/92022485?v=4?s=100" style="border-radius: 50%" width="50px;" alt="Loser_X"/><br /><sub><b>@Loser_X</b></sub></a><br />🌸 20 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><a href="https://github.com/S-t-e-v-e-e"><img src="https://avatars.githubusercontent.com/u/117198625?v=4?s=100" style="border-radius: 50%" width="50px;" alt="史蒂夫"/><br /><sub><b>@Steve~ɘvɘɈƧ</b></sub><br />🌸 40 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><img src="https://pic1.afdiancdn.com/user/a743be34fb4e11ef81be52540025c377/avatar/a284c446cefded67dbbf0c14b9eda2a0_w1080_h1080_s115.jpeg?imageView2/1/w/240/h/240" style="border-radius: 50%" width="50px;" alt="溯洌RIPPLE"/><br /><sub><b>溯洌RIPPLE</b></sub><br/>🌸 35 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><img src="https://pic1.afdiancdn.com/default/avatar/avatar-purple.png?imageView2/1/" style="border-radius: 50%" width="50px;" alt="祈"/><br /><sub><b>祈</b></sub><br/>🌸 15 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><img src="https://pic1.afdiancdn.com/user/7f56847012a911f0853552540025c377/avatar/752eaae4cf8018a82719ea8f42569eae_w2000_h2000_s2699.png?imageView2/1/w/240/h/240" style="border-radius: 50%" width="50px;" alt="茗亿"/><br /><sub><b>茗亿</b></sub><br/>🌸 30 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><img src="https://pic1.afdiancdn.com/user/fbcb2b98204611eea8f152540025c377/avatar/d4e7f58683064153bfbedb99ad95c6d8_w855_h875_s117.jpeg?imageView2/1/w/240/h/240" style="border-radius: 50%" width="50px;" alt="..."/><br /><sub><b>...</b></sub><br/>🌸 50 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><img src="https://pic1.afdiancdn.com/user/4041ac584eb111f0b57952540025c377/avatar/04de899ed964c6cfe315d27ea56a1fea_w1080_h1080_s69.jpeg?imageView2/1/w/240/h/240" style="border-radius: 50%" width="50px;" alt="夏夏肃炎"/><br /><sub><b>夏夏肃炎</b></sub><br/>🌸 5 🌸</td>
    </tr>
</table>

---

### Previews

| **Best30**<br><picture><source srcset="https://github.com/user-attachments/assets/22670da2-cd67-4da3-9589-e139f3db6d82" type="image/avif" width="80%" /><img src="https://github.com/user-attachments/assets/7faf1dba-2cd5-44d5-bc9d-d880fd2f2201" width="80%" /></picture><br>By [@Steve~ɘvɘɈƧ](https://github.com/S-t-e-v-e-e) | **Single Score**<br><picture><source srcset="https://github.com/user-attachments/assets/8a5adadb-3cdf-4371-b1d3-cc869f89a545" type="image/avif" width="40%" /><img src="https://github.com/user-attachments/assets/4594ef39-dacf-4079-9612-5090626f572b" width="40%"></picture><br>Legacy Version<br><picture><source srcset="https://github.com/user-attachments/assets/83296c38-2181-479f-ad26-dfb2e09bccf8" type="image/avif" width="40%" /><img src="https://github.com/Catrong/phi-plugin/assets/117198625/093e3d30-7f9e-48cb-9e12-bb9f0bb3b40c" width="40%"></picture><br>**Song Info**<br><picture><source srcset="https://github.com/user-attachments/assets/e332c88d-ecd0-49e7-aa6b-310645f14a5a" type="image/avif" width="40%" /><img src="https://github.com/Catrong/phi-plugin/assets/117198625/c6eb9694-8f72-4d3f-85d9-5120375b047b" width="40%"></picture> |
|:-------------------:|:------------------------:|
| **Range Scores**<br><picture><source srcset="https://github.com/user-attachments/assets/b1a4ff41-d26b-4ccc-942d-087797ff02b3" type="image/avif" /><img src="https://github.com/Catrong/phi-plugin/assets/117198625/411dff8e-ec93-4ebe-80ff-510105fd3f65"></picture><br>By [@东城Eastown](https://space.bilibili.com/171389567) <br>**User Stats**<br><picture><source srcset="https://github.com/user-attachments/assets/1361b1e9-510f-4140-a87d-a74b2ee70337" type="image/avif" /><img src="https://github.com/user-attachments/assets/ed20abfa-5bb1-4215-8b2b-8c5171126432"></picture> | **Legacy Stats**<br><picture><source srcset="https://github.com/user-attachments/assets/c876119b-d98f-4751-85ba-675e6f2ba55f" type="image/avif" width="60%" /><img src="https://github.com/Catrong/phi-plugin/assets/117198625/9e536f1a-4cbe-41da-b2da-94d1bcd70488" width="60%"></picture> |

---

### Contributors

<a href="https://github.com/Catrong/phi-plugin/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Catrong/phi-plugin" />
</a>

![Alt](https://repobeats.axiom.co/api/embed/3ba1307fae8ac160167cbb2556334fe324ce3065.svg "Repobeats analytics image")

### Star History

<a href="https://www.star-history.com/#Catrong/phi-plugin&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Catrong/phi-plugin&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Catrong/phi-plugin&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Catrong/phi-plugin&type=Date" />
 </picture>
</a>

---

### Disclaimer

1. This plugin is intended for non-commercial use only.
2. All images/assets are from the internet and will be removed upon request.
3. Cloud save system adapted from [7aGiven/PhigrosLibrary](https://github.com/7aGiven/PhigrosLibrary)

### Related Projects

<table>
    <tr>
        <td align="center"><a href="https://github.com/yhArcadia/Yunzai-Bot-plugins-index"><b>Yunzai-Bot Plugin Index</b></a></td>
        <td align="center"><a href="https://github.com/yoimiya-kokomi/Yunzai-Bot"><b>Yunzai-Bot</b></a></td>
        <td align="center"><a href="https://github.com/yoimiya-kokomi/Miao-Yunzai"><b>Miao-Yunzai</b></a></td>
        <td align="center"><a href="https://github.com/TimeRainStarSky/Yunzai"><b>TRSS-Yunzai</b></a></td>
    </tr>
</table>
