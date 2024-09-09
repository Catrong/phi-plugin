<div align="center">

<img src="https://github.com/Catrong/phi-plugin/assets/117198625/731e11cb-71d3-4575-8c0d-b9cedcd442d4" width="80%">

[![phi-plugin](https://img.shields.io/badge/GitHub仓库-phi--plugin-9cf?style=for-the-badge&logo=github)](https://github.com/Catrong/phi-plugin)
[![phi-plugin](https://img.shields.io/badge/Gitee仓库-phi--plugin-9cf?style=for-the-badge&logo=gitee)](https://gitee.com/catrong/phi-plugin)
![version](https://img.shields.io/badge/%E7%89%88%E6%9C%AC-0.9.7-9cf?style=for-the-badge)
[![YunzaiBot](https://img.shields.io/badge/Yunzai-v3.0-9cf?style=for-the-badge&logo=dependabot)](https://gitee.com/yoimiya-kokomi/Yunzai-Bot)
[![MiaoYunzai](https://img.shields.io/badge/Miao--Yunzai-v3.0-9cf?style=for-the-badge&logo=dependabot)](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
[![TrssYunzai](https://img.shields.io/badge/TRSS--Yunzai-v3.0-9cf?style=for-the-badge&logo=dependabot)](https://gitee.com/TimeRainStarSky/Yunzai)
[![Guild](https://img.shields.io/badge/频道-Hutao114Pgr939-9cf?style=for-the-badge&logo=GroupMe)](https://pd.qq.com/s/e3z86q6bw)
[![Bilibili](https://img.shields.io/badge/Bilibili-就是不会告诉你-ff69b4?style=for-the-badge&logo=bilibili)](https://space.bilibili.com/403342249)
[![Stars](https://img.shields.io/github/stars/Catrong/phi-plugin?style=for-the-badge&color=yellow&label=Star)](../../stargazers)

### 中文 | [English](./README_en.md)

</div>
  
<br>

------

### 特别鸣谢
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

------

### 安装：
在Yunzai目录下运行

> 使用Github

```
git clone --depth=1 https://github.com/Catrong/phi-plugin.git ./plugins/phi-plugin/ #安装插件本体
cd ./plugins/phi-plugin/ #进入插件目录
pnpm install -P #安装插件所需依赖
```

> 使用Gitee

```
git clone --depth=1 https://gitee.com/catrong/phi-plugin.git ./plugins/phi-plugin/ #安装插件本体
cd ./plugins/phi-plugin/ #进入插件目录
pnpm install -P #安装插件所需依赖
```

------

### 功能

以下#均可用/代替，命令头可自定义

#### **以下为用户功能**

| **功能名称** | **功能说明** 
| :- | :- 
| `#phi帮助` | 获取帮助 
| `#phi (bind\|绑定)xxx` | 绑定sessionToken 
| `#phi (unbind\|解绑)` | 删除sessionToken和存档记录 
| `#phi clean` | 删除所有记录 
| `#phi (update\|更新存档)` | 更新存档 
| `#phi (rks\|pgr\|b19)` | 查询rks，会提供得出的b21结果 
| `杠批比三零` | 同上
| `#phi info(1\|2)?` | 查询个人统计信息 
| `#phi (lvsco(re)\|scolv) <定数范围> <难度>` | 获取区间成绩 
| `#phi chap <章节名称\|help>` | 获取章节成绩
| `#phi list <定数范围> <EZ\|HD\|IN\|AT> <NEW\|C\|B\|A\|S\|V\|FC\|PHI>` | 获取区间每首曲目的成绩 
| `#phi best1(+)` | 查询文字版b19（或更多），最高b99 
| `#phi (score\|单曲成绩)xxx` | 获取单曲成绩及这首歌的推分建议 
| `#phi (suggest\|推分)` | 获取可以让RKS+0.01的曲目及其所需ACC 
| `#phi (ranklist\|排行榜)` | 获取 RKS 排行榜
| `#phi data` | 获取用户data数量 
| `#phi (guess\|猜曲绘)` | 猜曲绘，回答无特殊命令，直接回复，如果不是曲名就不会说话，如果是不正确的曲名会回复。#ans 结束 
| `#phi (ltr\|开字母)` | 根据字母猜曲名，#出/#open... 开指定的字母，#第n个/#nX.xxx 进行回答，#ans 获取答案 
| `#phi (tipgame\|提示猜曲)` | 根据提示猜曲名，#tip获得下一条提示，#ans 获取答案，回答直接回复
| `#phi (song\|曲) xxx` | 查询phigros中某一曲目的图鉴，支持设定别名 
| `#phi tips` | 随机tips 
| `#phi jrrp` | 今日人品 
| `#phi nick xxx` | 查询某一曲目的别名 
| `#phi (rand\|随机) <条件>` | 根据条件随机曲目，条件支持难度、定数，难度可以多选，定数以-作为分隔 
| `#phi (曲绘\|ill\|Ill) xxx` | 查询phigros中某一曲目的曲绘 
| `#phi (search\|查询\|检索) <条件 值>` | 检索曲库中的曲目，支持BPM 定数 物量，条件 bpm dif cmb，值可以为区间，以 - 间隔 
| `#phi (theme\|主题) [0-2]` | 切换绘图主题，仅对 b19 update 生效 
| `sign/签到` | 签到获取Notes 
| `task/我的任务` | 查看自己的任务 
| `retask/刷新任务` | 刷新任务，需要花费20Notes 
| `#phi (send\|送\|转) <目标> <数量>` | 送给目标Note，支持@或QQ号 

#### **以下为管理功能**

| 功能名称 | 功能说明
| :- | :-
| `#phi backup (back)?` | 备份存档文件，+ back 发送该备份文件，自动保存在 /phi-plugin/backup/ 目录下
| `#phi restore` | 从备份中还原，不会丢失已有数据，需要将文件放在 /phi-plugin/backup/ 目录下
| `#phi(设置别名\|setnick) xxx ---> xxx` | 设置某一歌曲的别名，格式为 原名(或已有别名) ---> 别名（会自动过滤--->两边的空格） 
| `#phi(删除别名\|delnick) xxx` | 删除某一歌曲的别名 
| `#phi(强制\|qz)?(更新\|gx)` | 更新本插件 
| `#phi repu` | 重启puppeteer 
| `#下载曲绘\|down ill` | 下载曲绘到本地 
| `#phi get <名次>` | 获取排行榜上某一名次的sessionToken
| `#phi del <sessionToken>` | 禁用某一sessionToken
| `#phi allow <sessionToken>` | 恢复某一sessionToken
| `#phi ban <功能>` | 禁用某一类功能，详见下表

##### 功能参数说明

| 参数 | 功能 | 影响指令
| :- | :- | :-
| all | 全部功能 | -.-
| help | 帮助功能 | /help /tkhelp
| bind | 绑定功能 | /bind /unbind
| b19 | 图片查分功能 | /pgr /update /info /list /pb30 /score /lvsco /chap
| wb19 | 文字查分功能 | /suggest /data /best
| song | 图鉴功能 | /song /ill /search /alias /rand
| ranklist | 排行榜功能，不会禁用用户排名 | /ranklist /godlist
| fnc | 小功能 | /com /tips
| tipgame | tip猜歌 | /tipgame
| guessgame | 猜歌 | /guess
| ltrgame | 猜字母 | /letter /ltr
| sign | 娱乐功能 | /sign /send /task /retask /jrrp
| setting | 系统设置 | /theme
| dan | 段位认证相关 | /dan /danupdate

------

<details><summary>支持我的创作</summary>
<br>

[<img src="https://github.com/user-attachments/assets/8c181f08-a2b6-4e67-8b61-bd2e4027a6a4" width="400" />](https://afdian.com/a/Feijiang_)

感谢您的支持，您的支持就是我创作的最大动力！鸣谢名单可能更新不及时，欢迎来QQ催我！</details>

#### Todo

- [ ] 优化界面设计

- [ ] 加入收集品、头像等的图鉴
 
- [ ] 点phi的歌

- [ ] 优化扫码获取sessionToken

- [ ] 指令修改设置

- [ ] …

------

### 友情链接

[Yunzai-Bot 相关内容索引](https://github.com/yhArcadia/Yunzai-Bot-plugins-index)

[Miao-Yunzai](https://github.com/yoimiya-kokomi/Miao-Yunzai/tree/master)

[TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai)

------

### 预览

|Best19效果图<br><img src="https://github.com/user-attachments/assets/d7fab54d-293d-4a74-84cd-3e521ad3e242"><br>效果图来自[@Steve喵~](https://github.com/S-t-e-v-e-e) | 单曲成绩效果图<br><img src="https://github.com/user-attachments/assets/2201c185-1352-4b69-8649-c00d9756e1c5" width="60%"><br>效果图来自[@Steve喵~](https://github.com/S-t-e-v-e-e)<br><br>单曲成绩效果图（Legacy）<br><img src="https://github.com/Catrong/phi-plugin/assets/117198625/093e3d30-7f9e-48cb-9e12-bb9f0bb3b40c" width="60%"><br>效果图来自[@Steve喵~](https://github.com/S-t-e-v-e-e)<br><br>单曲图鉴效果图<br><img src="https://github.com/Catrong/phi-plugin/assets/117198625/c6eb9694-8f72-4d3f-85d9-5120375b047b" width="60%"> |
|:-------------------:|:------------------------:|
| 范围成绩效果图<br><img src="https://github.com/Catrong/phi-plugin/assets/117198625/411dff8e-ec93-4ebe-80ff-510105fd3f65"><br>效果图来自[@东城Eastown](https://space.bilibili.com/171389567) <br><br>个人信息效果图<br><img src="https://github.com/user-attachments/assets/ed20abfa-5bb1-4215-8b2b-8c5171126432"><br>效果图来自[@Steve喵~](https://github.com/S-t-e-v-e-e)| 个人信息效果图（Legacy）<br> <img src="https://github.com/Catrong/phi-plugin/assets/117198625/9e536f1a-4cbe-41da-b2da-94d1bcd70488" width="60%"><br>效果图来自[@东城Eastown](https://space.bilibili.com/171389567)|



------

### 免责声明

1. 功能仅限内部交流与小范围使用，请勿将`Yunzai-Bot`及`phi-Plugin`用于任何以盈利为目的的场景.
2. 图片与其他素材均来自于网络，仅供交流学习使用，如有侵权请联系，会立即删除.
3. 云存档由[7aGiven/PhigrosLibrary](https://github.com/7aGiven/PhigrosLibrary/tree/v3.1.0) 改写而来

------

###### ***写的不好，轻喷……***



