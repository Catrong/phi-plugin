<div align="center">
  <h1>
    <picture>
      <source srcset="https://github.com/user-attachments/assets/c18cd28c-220e-445d-9001-3f7a8f25ac51" type="image/avif" width="80%" />
      <img src="https://github.com/Catrong/phi-plugin/assets/117198625/731e11cb-71d3-4575-8c0d-b9cedcd442d4" width="80%" />
    </picture>
  
### 中文 | [English](./README_en.md)
  </h1>

[![Guild](https://img.shields.io/badge/频道-Hutao114Pgr939-9cf?style=flat-square&logo=GroupMe)](https://pd.qq.com/s/e3z86q6bw)
[![Guild](https://img.shields.io/badge/频道-RkBwFBaRqa-9cf?style=flat-square&logo=Discord)](https://discord.gg/invite/RkBwFBaRqa)
[![Bilibili](https://img.shields.io/badge/Bilibili-就是不会告诉你-A4CAFA?style=flat-square&logo=bilibili&logoColor=white&labelColor=ff69b4)](https://space.bilibili.com/403342249)
[![Stars](https://img.shields.io/github/stars/Catrong/phi-plugin?style=flat-square&color=yellow&label=Star)](../../stargazers)

![version](https://img.shields.io/badge/插件版本-1.0.3-9cf?style=flat-square)
![version](https://img.shields.io/badge/Phigros-3.20.0-9cf?style=flat-square)
![version](https://img.shields.io/badge/PhigrosVer-154-9cf?style=flat-square)
[![YunzaiBot](https://img.shields.io/badge/Yunzai-v3.0-9cf?style=flat-square&logo=dependabot)](../../yoimiya-kokomi/Yunzai-Bot)
[![MiaoYunzai](https://img.shields.io/badge/Miao--Yunzai-v3.0-9cf?style=flat-square&logo=dependabot)](../../yoimiya-kokomi/Miao-Yunzai)
[![TrssYunzai](https://img.shields.io/badge/TRSS--Yunzai-v3.0-9cf?style=flat-square&logo=dependabot)](../../TimeRainStarSky/Yunzai)
</div>

### 介绍

`phi-plugin` 为查询Phigros信息的插件，包括b30、score、userinfo以及更多Phigros相关功能，有相关的建议和问题可以在[Issues](../../issues)中提出，欢迎[PR](../../pulls)。

具体功能可在安装插件后 通过 `/phihelp` 查看详细指令

---

### 安装

#### Yunzai 安装

在Yunzai目录下运行

> 使用Github

```bash
#安装插件本体
git clone --depth=1 https://github.com/Catrong/phi-plugin.git ./plugins/phi-plugin/ 
#进入插件目录
cd ./plugins/phi-plugin/ 
#安装插件所需依赖
pnpm install -P
```

> 使用Gitee

```bash
#安装插件本体
git clone --depth=1 https://gitee.com/catrong/phi-plugin.git ./plugins/phi-plugin/
#进入插件目录
cd ./plugins/phi-plugin/
#安装插件所需依赖
pnpm install -P 
```

> [!WARNING]
> 请使用主人权限执行该指令以下载曲绘，否则相关曲绘将无法正常展示！（可以是标准输入或者其他平台）
> 
>```txt
> /phi downill
>```

> [!TIP]
> 如果安装依赖时速度过慢，运行：
> 
>```txt
> pnpm config set registry https://registry.npmmirror.com
>```

#### Koishi 安装

<details>

<summary>展开</summary>

在已有的 Koishi 4 项目根目录执行（需要 Node.js，克隆或更新时需要 Git）：

```sh
node ./external/phi-plugin/scripts/install-koishi.cjs
```

首次安装时，也可以从包含此脚本的插件版本中单独取得 `scripts/install-koishi.cjs`，在 Koishi 根目录运行 `node install-koishi.cjs`。脚本会自动克隆缺失的插件本体；已有本体默认直接复用，不会自动更新。

脚本会生成独立的 `koishi-plugin-phi-plugin` 包装包、安装依赖，并在 `koishi.yml` 登记插件，让 WebUI 能识别插件并显示配置表单。**不会修改本体 `phi-plugin/package.json`**，但会修改 Koishi 宿主的 `package.json` 和锁文件。已有插件配置、凭据、禁用状态及 Puppeteer 设置会保留；旧的相对路径入口会迁移为标准插件名。

```sh
# 预览安装计划，不修改文件
node ./external/phi-plugin/scripts/install-koishi.cjs --dry-run
# 从其他目录执行时指定 Koishi 根目录
node /path/to/install-koishi.cjs --root /path/to/koishi-app
# 更新本体并重新安装（仅允许干净 Git 工作区，快进更新）
node ./external/phi-plugin/scripts/install-koishi.cjs --update
```

包管理器优先按宿主唯一的锁文件识别，也可用 `--manager npm`、`--manager yarn` 或 `--manager pnpm` 指定。Yarn 需要 2+ 且使用 `nodeLinker: node-modules`。非默认 YAML 配置可用 `--config 文件路径` 指定。

安装前会将待修改的已有宿主文件和包装文件备份至宿主 `.phi-plugin-install-backups/`。安装失败时可据此恢复；脚本不会自动回滚已安装的依赖，也不会自动重启 Koishi。安装成功后请重启 Koishi 并刷新 WebUI。

请在控制台启用一个 `database` 服务。缺少 Puppeteer 时脚本会添加其依赖和配置，但保留已有服务的禁用状态。安装过程跳过浏览器下载，请通过 Koishi Puppeteer 服务配置可用的 Chrome / Chromium 路径。

若原先使用独立版本的同名`koishi-plugin-phi-plugin`插件，请先迁移，脚本不会覆盖它。

#### Koishi 指令管理

Koishi 加载插件后还会每分钟执行“phi-Bot状态与正式别名同步”：上报 Bot 状态并处理 API 下发事项；正式别名距上次成功同步满 6 小时才重新下载。任务遵循 API 总开关和版本检查，不重叠执行，插件卸载或重载时自动清理旧定时器。启动时的首次同步仍由原有 API 初始化流程负责。

插件通过 Koishi 的 `ctx.command()` 注册功能，可在指令管理中查看、调整权限或设置别名。常用功能直接注册在命令头下，例如 `/p help`、`/p b30`、`/p score`（管理标识为 `p.help`、`p.b30`、`p.score`）；不常用功能按分类展开，例如 `/p songs alias`、`/p account unbind`。修改命令头时旧注册随重载清理；原来绑定旧指令标识的权限和别名设置需按新标识调整。游戏答题和会话确认仍作为普通消息处理。

顶层常用入口为 `help`、`b30`、`bind`、`update`、`score`、`suggest`、`info`、`song`、`sign`。其他功能放入成绩 `scores`、账号 `account`、曲目 `songs`、帮助 `guides`、API `api`、别名提案 `proposals`、Bot `bot`、谱面 `charts`、游戏 `games`、管理 `admin`、市场 `market`、日常 `daily`、排行 `ranking`、设置 `settings`、更新 `maintenance`、用户 `user` 分类。当前共 9 个常用入口和 16 个分类，所有功能均保留在 Discord 菜单中。命令头为空时省略根分组，例如 `/b30`、`/songs alias`。

Koishi 设置中的“Koishi 快捷指令”支持自定义以上默认菜单：使用一组树形勾选项：勾选分组即添加该分类菜单，展开后勾选子命令即将其添加到顶层快捷指令。父子独立勾选，不自动联动。单独勾选的功能不再在分类中重复显示，空分类自动省略；未选功能仍保留原聊天调用和权限检查，清空所有勾选可关闭快捷菜单。保存后由 Koishi 重载插件并自动同步。指令与非空分类合计最多 25 个顶层入口；默认已占满 25 项，增加单独功能时需相应减少其他入口，超限会在注册前明确报错。调整顶层/分类位置会改变管理标识，原权限与别名配置需按新标识调整。树形设置仅提供给 Koishi，不出现在 Guoba 设置中；已有两组配置会继续读取，首次编辑树形选择后使用新配置。

正则命令头仍用于匹配聊天内容。对于 `phi|pg`、`(?:phi|pg)` 这类命令头，使用首个字面量分支 `phi` 作为管理分组；无法提取字面量的复杂正则使用 `phi-plugin` 分组，不将正则符号作为指令名。

注册命名冲突时，整棵指令树按“空头 → p → phi → phigros → phi-plugin”回退；用户显式设置的非空命令头优先尝试。空头模式只要有一个顶层名称被已有指令或别名占用，就为整棵树选择下一个可用根分组。例如已有系统 `help` 时使用 `/p help`、`/p b30`，不向系统帮助添加子命令。所有候选均占用时明确报错，可设置其他命令头。聊天匹配规则不随注册回退改变；系统 `/help` 优先，Phi 帮助可通过 `#help`（宿主未占用该写法时）或 `/p help` 调用。实际名称可在日志和指令管理中查看。

注册完成、命令头变更及插件卸载后，会以 500ms 防抖同步在线机器人，提交 Koishi 当前完整斜线指令树，保留其他插件的指令；同步中的后续变更会排队刷新，成功上传过的相同内容不重复提交。Discord 返回 429 时按 `retry_after`（秒）等待并增加 250ms 余量，随后自动上传最新指令树；等待期间重载插件也不会绕过冷却期限。无法解析限流等待时间时等待 30 秒，宿主关闭时取消重试。Discord 适配器须启用斜线指令；离线机器人仍由 Koishi 在上线时同步。其他更新失败会记录日志，可在连接恢复后重新加载插件重试。

注册前校验 Discord 限制：每层名称 1–32 字符、合法小写名称、最多三级、每层最多 25 个子项、全局最多 100 个根指令。超限会明确报错，不会截断名称或丢弃部分功能。上传前还会校验完整快照，校验失败则取消本次上传。Discord 中 `/p help`、`/p b30` 可直接执行，无需重复输入完整指令；曲名等参数填入可选的 `args` 字段，例如 `/p score args:曲名`，具体格式由业务功能校验。

聊天中继续使用原有写法，命令头 `cmdhead` 可以自定义、使用正则或留空：

| cmdhead | 示例 |
| --- | --- |
| `phi` | `/phihelp`、`#phi help`、`/phi b30` |
| `pg` | `/pghelp`、`/pg b30` |
| 空字符串 | `/help`、`/b30` |
| `phi\|pg` | `/phihelp`、`/pghelp` |

Koishi 的全局前缀与 `cmdhead` 分别生效。例如 Koishi 前缀为 `!`、`cmdhead` 为空时，可发送 `!b30`；全局前缀也为空时可直接发送 `b30`。原有 `/`、`#` 写法仍兼容。保存命令头设置后由 Koishi 重载插件并重新匹配指令。

管理标识和 Koishi 别名也可直接调用，例如 `pg.b30`、`pg.score 曲名`；兼容在参数中传入完整原始指令。复杂正则命令头无法还原为字面量时，可通过 `args` 传入完整原始指令。所有调用都会经过 Koishi 的命令权限检查；原有业务权限检查仍保留。

#### Koishi 设置页更新按钮

插件启用并加载控制台扩展后，设置表单顶部提供“更新插件”和“更新曲绘库”两行按钮，点击即可执行，无需保存设置。仅控制台权限等级 4 及以上用户可以执行；页面显示更新进度和结果，并阻止重复启动。

已有仓库执行 `git pull --ff-only`，保留当前分支和远程配置；有未提交修改或无法快进时停止，不强制覆盖。曲绘库尚未下载时，按已保存的 `downIllUrl` 和 `githubProxy` 克隆。插件更新完成后请重载插件，若依赖发生变化则重新运行安装脚本。按钮不会自动重启 Koishi；接入此控制台扩展无需改动本体 `package.json`。

</details>

---

#### Todo

* [ ] 优化界面设计

* [ ] 加入收集品、头像等的图鉴

* [ ] 点phi的歌

* [ ] 优化扫码获取sessionToken

* [ ] 指令修改部分设置

* [ ] 曲目历史定数查询

* [ ] 谱面标签

* [ ] 适配TapTap国际版

* [ ] ……
---

### 功能

以下#均可用/代替，命令头可自定义

#### **以下为用户功能**

| **功能名称** | **功能说明**
| :- | :-
| `#phi帮助` | 获取帮助
| `#phi (cn\|gb)?(bind\|绑定)xxx` | 绑定sessionToken，支持国服/国际服，默认为国服
| `#phi (unbind\|解绑)` | 仅清除当前 Bot 本地保存的 sessionToken、API ID、存档和历史，不修改 API 平台绑定
| `#phi clean` | 删除所有记录
| `#phi (update\|更新存档)` | 更新存档
| `#phi (rks\|pgr\|b30)` | 查询rks，会提供得出的b30结果
| `#phi x30` | 查询1Good b30
| `#phi fc30` | 查询Full Combo b30
| `杠批比三零` | 同上
| `#phi info(1\|2)?` | 查询个人统计信息
| `#phi lmtacc [0-100]` | 计算限制最低 ACC 后的 RKS
| `#phi (lvsco(re)\|scolv) <定数范围> <难度>` | 获取区间成绩
| `#phi chap <章节名称\|help>` | 获取章节成绩
| `#phi ahv <定数>[-v 版本]` | 获取定数成绩表
| `#phi list <-dif 定数范围> <-acc ACC范围> <EZ\|HD\|IN\|AT> <NEW\|C\|B\|A\|S\|V\|FC\|PHI>` | 获取区间每首曲目的成绩
| `#phi hisb30` | 根据历史记录计算B30变化情况
| `#phi best1(+)` | 查询文字版b30（或更多），最高b99
| `#phi (score\|单曲成绩)xxx  [-dif 难度] [-or acc\|score\|fc\|time] [-unrank]` | 获取单曲成绩及这首歌的推分建议，参数为对分数排行的参数，目前仅开启API后有效
| `#phi (suggest\|推分)` | 获取可以让RKS+0.01的曲目及其所需ACC
| `#phi (ranklist\|排行榜) [名次]` | 获取 RKS 排行榜
| `#phi rankfind <rks>` | 获取有多少人大于查询 RKS
| `#phi data` | 获取用户data数量
| `#phi (guess\|猜曲绘) [-l <0-3>]` | 猜曲绘，回答无特殊命令，直接回复，如果不是曲名就不会说话，如果是不正确的曲名会回复。#ans 结束
| `#phi (ltr\|开字母)` | 根据字母猜曲名，#出/#open... 开指定的字母，#第n个/#nX.xxx 进行回答，#ans 获取答案
| `#phi (tipgame\|提示猜曲)` | 根据提示猜曲名，#tip获得下一条提示，#ans 获取答案，回答直接回复
| `#phi (弗一把\|friberg\|fib\|fri) [难度=EZ\|HD\|IN\|AT] [定数下限，如 14+]` | 弗一把猜歌，直接回复曲名猜测，每次猜测都会对比谱师（真实名录来源于 daogemm.github.io，多名谱师有一人重合即视为相近）、首次收录版本（含上线时间）、章节、是否独占、定数、BPM、物量与答案的异同，#ans 获取答案；定数与物量以指定难度的谱面为准，回答有个人与群聊冷却，参与人数越多可猜次数越多
| `#phi (song\|曲) xxx` | 查询phigros中某一曲目的图鉴，支持设定别名
| `#phi chart <曲名> [难度=IN]` | 查询phigros中某一谱面的详细信息
| `#phi tag <曲名> [难度=IN] <标签>` | 查看谱面标签，标签可选项见回复说明，难度默认为IN
| `#phi settag <曲名> [难度=IN] <标签>` | 给谱面打标签，推荐先使用/tag查询标签列表，难度默认为IN
| `#phi (comment\|cmt\|评论\|评价) <曲名> [难度=IN](换行)<内容>` | 评论曲目，难度默认为IN
| `#phi recmt <评论ID>` | 查看并确认是否删评，仅发送者和主人权限，需要二次确认
| `#phi mycmt` | 查看自己的云端评论
| `#phi (table\|定数表) <定数>` | 查询phigros定数表
| `#phi (difHis\|历史定数)` | 查询曲目历史定数
| `#phi new` | 查询更新的曲目
| `#phi tips` | 随机tips
| `#phi jrrp` | 今日人品
| `#phi alias xxx` | 查询某一曲目的别名
| `#phi (rand\|随机) [定数] [难度]` | 根据条件随机曲目，条件支持难度、定数，难度可以多选，定数以-作为分隔
| `#phi randclg [课题总值] [难度] ([曲目定数范围])` | 随机课题 eg: /rand 40 (IN 13-15)
| `#phi (曲绘\|ill\|Ill) xxx` | 查询phigros中某一曲目的曲绘
| `#phi (search\|查询\|检索) <条件 值>` | 检索曲库中的曲目，支持BPM 定数 物量，条件 bpm dif cmb，值可以为区间，以 - 间隔
| `#phi (theme\|主题) [编号]` | 切换绘图主题，页面级样式按主题包配置生效
| `#phi (myset\|个人设置)` | 查看和修改用户设置，参数为设置项名称，值支持使用序号选择，建议先查看设置项列表
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
| `#phi (set\|设置)<功能><值>` | 修改设置，建议先/phi set查看功能名称，没有空格
| `#phi ban <功能>` | 禁用某一类功能，详见 [功能参数说明](#phi-ban-%E5%8A%9F%E8%83%BD%E5%8F%82%E6%95%B0%E8%AF%B4%E6%98%8E)
| `#phi 获取Bot认领链接` | **主人命令** 获取 15 分钟内有效的 Bot 平台认领链接，建议私聊发送
| `#phi 重置API Bot身份` | **主人命令** 重新申请一套 API Bot 身份，仅用于凭据丢失、被撤销或主动更换身份

<details open>  
<summary>功能参数说明</summary>

#### `#phi ban` 功能参数说明

| 参数 | 功能 | 影响指令
| :- | :- | :-
| 全部 | 全部功能 | 所有
| help | 帮助功能 | /help /tkhelp /myset
| bind | 绑定功能 | /bind /unbind
| b19 | 图片查分功能 | /pgr /update /info /list /pb30 /p30 /lmtacc /score /lvsco /chap /suggest
| wb19 | 文字查分功能 | /data /best
| song | 图鉴功能 | /song /chart /ill /search /alias /rand /randclg /table /cmt /recmt /addtag /subtag /retag
| ranklist | 排行榜功能，不会禁用用户排名 | /ranklist /godlist
| fnc | 小功能 | /com /tips /new
| tipgame | tip猜歌 | /tipgame
| guessgame | 猜歌 | /guess
| ltrgame | 猜字母 | /letter /ltr
| fribgame | 弗一把 | /friberg /fib /fri
| sign | 娱乐功能 | /sign /send /task /retask /jrrp
| setting | 系统设置 | /theme
| dan | 段位认证相关 | /dan /danupdate
</details>

## API功能正式开启测试

可在设置项手动设置打开与关闭，开启后，将自动同步用户在Phi-Plugin系列应用（网页、云崽，暂不含koishi）使用记录与历史成绩到API端，且部分功能需要开启API后才能使用

| 功能名称 | 功能说明
| :- | :-
| `#phi (bind\|绑定) <userId>` | 开启查分API可用，绑定API账号
| `#phi setApiToken <token>` | 设置API Token
| `#phi tokenList` | 获取当前绑定的平台列表
| `#phi auth <api Token>` | 通过API Token 获取 sessionToken
| `#phi alias submit 曲目 \| 别名 \| 备注` | 私聊提交曲目别名提案 |
| `#phi alias mine` | 查询自己的别名提案 |
| `#phi alias appeal 提案ID \| 理由` | 私聊申请公开评审 |
| `#phi alias public` | 查询正在公开投票的提案 |
| `#phi alias vote 提案ID 赞成/反对` | 参与公开投票或改票 |
| `#phi alias unvote 提案ID` | 撤回公开投票 |
| `#phi clearApiData` | 永久注销 phi-api 账号并清除云端数据，需要 Phigros SSTK 权限及二次确认
| `#phi updateHistory` | 将BOT端的历史成绩更新到API端
| `#phi updateUserToken` | **主人命令** 上传当前BOT端的用户Token到API端

#### Bot 平台认领（Bot 主人）

认领用于把当前 phi-plugin 部署关联到已登录的网页账号，以便在网页控制台查看 Bot 状态、绑定统计和进行管理。Bot 在 API 注册成功后已经可以正常工作，未认领不会影响 Bot 激活或用户查分。

认领步骤：

1. 将 phi-plugin 更新到支持 Bot 平台认证的版本，并确认配置项 `openPhiPluginApi` 已开启。
2. 启动或重启一次 Bot。插件缺少 API Bot 身份时会自动向 API 注册，并将凭据写入本地配置；请勿公开或手工发送 `apiBotClientSecret`。
3. Bot 主人在**私聊**中发送 `#phi 获取Bot认领链接`（也可使用 `#phi botClaimLink`）。
4. 在 15 分钟内打开 Bot 返回的认领链接。若网页尚未登录，请先完成登录，随后继续原认领页面。
5. 核对页面显示的 Bot 名称和 `clientId`，确认认领。完成后可在网页控制台的 Bot 管理页面查看和管理该 Bot。

认领链接为一次性链接，过期或使用后需重新发送命令获取。在群聊中执行时，插件不会把链接发到群内，而会将链接输出到 Bot 控制台；建议改为私聊执行。

`#phi 重置API Bot身份`（别名 `#phi resetApiBot`）会申请全新的 `clientId` 和 secret，并替换当前 Bot 身份。该命令不是正常认领步骤，只应在本地凭据丢失、身份被 API 撤销或确定要更换 Bot 身份时使用；重置后需要重新认领。为避免敏感信息泄露，在群聊中执行时，新的身份信息和认领链接只会输出到 Bot 控制台。

#### 关于权限的详细说明：

仅通过查分ID即可绑定与获取存档，首次使用`sessionToken`绑定时会将`API Token`设置为`sessionToken`，且用户绑定时若提供`sessionToken`，bot端本地会保存。



---

### 支持我的创作

[<img src="https://github.com/user-attachments/assets/8c181f08-a2b6-4e67-8b61-bd2e4027a6a4" width="400" />](https://afdian.com/a/Feijiang_)  

感谢您的支持，您的支持就是我创作的最大动力！

#### 赞助者

感谢以下赞助者对本项目的支持，鸣谢名单可能更新不及时，欢迎来QQ催我！

<table>
    <tr>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><a href="https://github.com/qilinX88"><img src="https://avatars.githubusercontent.com/u/92022485?v=4?s=100" style="border-radius: 50%" width="50px;" alt="Loser_X"/><br /><sub><b>@Loser_X</b></sub></a><br />🌸 20 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><a href="https://github.com/S-t-e-v-e-e"><img src="https://avatars.githubusercontent.com/u/117198625?v=4?s=100" style="border-radius: 50%" width="50px;" alt="史蒂夫"/><br /><sub><b>@Steve~ɘvɘɈƧ</b></sub><br />🌸 40 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><img src="https://pic1.afdiancdn.com/user/a743be34fb4e11ef81be52540025c377/avatar/a284c446cefded67dbbf0c14b9eda2a0_w1080_h1080_s115.jpeg?imageView2/1/w/240/h/240" style="border-radius: 50%" width="50px;" alt="溯洌RIPPLE"/><br /><sub><b>溯洌RIPPLE</b></sub><br/>🌸 35 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><img src="https://pic1.afdiancdn.com/default/avatar/avatar-purple.png?imageView2/1/" style="border-radius: 50%" width="50px;" alt="祈"/><br /><sub><b>祈</b></sub><br/>🌸 15 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><img src="https://pic1.afdiancdn.com/user/7f56847012a911f0853552540025c377/avatar/752eaae4cf8018a82719ea8f42569eae_w2000_h2000_s2699.png?imageView2/1/w/240/h/240" style="border-radius: 50%" width="50px;" alt="茗亿"/><br /><sub><b>茗亿</b></sub><br/>🌸 30 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><img src="https://pic1.afdiancdn.com/user/fbcb2b98204611eea8f152540025c377/avatar/d4e7f58683064153bfbedb99ad95c6d8_w855_h875_s117.jpeg?imageView2/1/w/240/h/240" style="border-radius: 50%" width="50px;" alt="..."/><br /><sub><b>...</b></sub><br/>🌸 50 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><img src="https://pic1.afdiancdn.com/user/4041ac584eb111f0b57952540025c377/avatar/04de899ed964c6cfe315d27ea56a1fea_w1080_h1080_s69.jpeg?imageView2/1/w/240/h/240" style="border-radius: 50%" width="50px;" alt="夏夏肃炎"/><br /><sub><b>夏夏肃炎</b></sub><br/>🌸 5 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><img src="https://pic1.afdiancdn.com/user/7737c9cca1f211ed896a5254001e7c00/avatar/7a320f384ead8f4fca4630efa31c0c3b_w705_h705_s346.jpeg?imageView2/1/w/240/h/240" style="border-radius: 50%" width="50px;" alt="Bluerosion"/><br /><sub><b>Bluerosion</b></sub><br/>🌸 52.0 🌸</td>
        <td align="center" valign="top" width="35%" nowrap="nowrap"><img src="https://pic1.afdiancdn.com/user/00794630e24f11ebac7252540025c377/avatar/f67fff0ab78bcf86d81a7b12a55ba3ca_w374_h354_s148.png?imageView2/1/w/240/h/240" style="border-radius: 50%" width="50px;" alt="Bluerosion"/><br /><sub><b>铃</b></sub><br/>🌸 5 🌸</td>
    </tr>
</table>

---

### 部分功能预览

|**Best30效果图**<br><picture><source srcset="https://github.com/user-attachments/assets/22670da2-cd67-4da3-9589-e139f3db6d82" type="image/avif" width="80%" /><img src="https://github.com/user-attachments/assets/7faf1dba-2cd5-44d5-bc9d-d880fd2f2201" width="80%" /></picture><br>效果图来自[@Steve喵~](https://github.com/S-t-e-v-e-e) | **单曲成绩效果图**<br><picture><source srcset="https://github.com/user-attachments/assets/8a5adadb-3cdf-4371-b1d3-cc869f89a545" type="image/avif" width="40%" /><img src="https://github.com/user-attachments/assets/4594ef39-dacf-4079-9612-5090626f572b" width="40%"></picture><br>效果图来自[@Steve喵~](https://github.com/S-t-e-v-e-e)<br><br>**单曲成绩效果图（Legacy）**<br><picture><source srcset="https://github.com/user-attachments/assets/83296c38-2181-479f-ad26-dfb2e09bccf8" type="image/avif" width="40%" /><img src="https://github.com/Catrong/phi-plugin/assets/117198625/093e3d30-7f9e-48cb-9e12-bb9f0bb3b40c" width="40%"></picture><br>效果图来自[@Steve喵~](https://github.com/S-t-e-v-e-e)<br><br>**单曲图鉴效果图**<br><picture><source srcset="https://github.com/user-attachments/assets/e332c88d-ecd0-49e7-aa6b-310645f14a5a" type="image/avif" width="40%" /><img src="https://github.com/Catrong/phi-plugin/assets/117198625/c6eb9694-8f72-4d3f-85d9-5120375b047b" width="40%"></picture> |
|:-------------------:|:------------------------:|
|**范围成绩效果图**<br><picture><source srcset="https://github.com/user-attachments/assets/b1a4ff41-d26b-4ccc-942d-087797ff02b3" type="image/avif" /><img src="https://github.com/Catrong/phi-plugin/assets/117198625/411dff8e-ec93-4ebe-80ff-510105fd3f65"></picture><br>效果图来自[@东城Eastown](https://space.bilibili.com/171389567) <br><br>**个人信息效果图**<br><picture><source srcset="https://github.com/user-attachments/assets/1361b1e9-510f-4140-a87d-a74b2ee70337" type="image/avif" /><img src="https://github.com/user-attachments/assets/ed20abfa-5bb1-4215-8b2b-8c5171126432"></picture><br>效果图来自[@Steve喵~](https://github.com/S-t-e-v-e-e)|**个人信息效果图（Legacy）**<br><picture><source srcset="https://github.com/user-attachments/assets/c876119b-d98f-4751-85ba-675e6f2ba55f" type="image/avif" width="60%" /><img src="https://github.com/Catrong/phi-plugin/assets/117198625/9e536f1a-4cbe-41da-b2da-94d1bcd70488" width="60%"></picture><br>效果图来自[@东城Eastown](https://space.bilibili.com/171389567)|

---

### 贡献者

感谢以下贡献者对本项目做出的贡献

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

### 免责声明

1. 功能仅限内部交流与小范围使用，请勿将`Yunzai-Bot`及`phi-Plugin`用于任何以盈利为目的的场景.
2. 图片与其他素材均来自于网络，仅供交流学习使用，如有侵权请联系，会立即删除.
3. 云存档由 [7aGiven/PhigrosLibrary](https://github.com/7aGiven/PhigrosLibrary) 改写而来
4. 谱师数据来源于 [DP-Tool](https://daogemm.github.io/)

###### 写的不好，轻喷……

### 友情链接

<table>
    <tr>
        <td align="center"> <a href="https://github.com/yhArcadia/Yunzai-Bot-plugins-index"><b>Yunzai-Bot 相关内容索引</b></a></td>
        <td align="center"> <a href="https://github.com/yoimiya-kokomi/Yunzai-Bot"><b>Yunzai-Bot</b></a></td>
        <td align="center"> <a href="https://github.com/yoimiya-kokomi/Miao-Yunzai"><b>Miao-Yunzai</b></a></td>
        <td align="center"> <a href="https://github.com/TimeRainStarSky/Yunzai"><b>TRSS-Yunzai</b></a></td>
        <td align="center"> <a href="https://daogemm.github.io/"><b>DP-Tool</b></a></td>
    </tr>
</table>
