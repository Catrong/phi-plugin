# TRSS 帮助图裁切排查（2026-10-12）

本次在 `D:\Bot\TRSS-Yunzai` 实际加载宿主渲染器、调用 phi-plugin 的帮助处理函数和 Shotium 原生引擎。测试回复收集到本地，没有向聊天账号发送消息。

## 结论

**已用真实宿主引擎复现并修复单参数宿主接口下的左上角裁切。** 最初测试目录使用 `shot(method, options)` / `shotContainer(method, options)`，当事人环境使用 `shot(options)` / `shotContainer(options)`，此前测试未覆盖这种接口差异。

插件劫持 `shotContainer` 时原本固定转发 `target.shot(method, { ...options, selector })`。单参数宿主传入的 options 被当作 method，选择器进入第二个参数并被宿主忽略；引擎因而截取默认的 `800×600` 视口。`model/render/shotium.js` 现在按本次实参类型转发：字符串首参保留双参数接口，对象首参把选择器合入第一个参数。不依赖函数的 `length`，也不修改宿主配置。

在同一套本地 Shotium 0.12.1 原生引擎上，还原当事人描述的单参数调用契约，并分别运行修改前和修改后适配器：修改前精确输出 `800×600`，记录到 selector 缺失、调用参数数为 2；修改后输出完整的 `1500×4625`，selector 已传入且调用参数数为 1。三种主题连续 18 次通过，clip 分页输出 `1500×1500` 三张及 `1500×125` 一张，总高度等于整图。该验证使用接口夹具，未取得当事人的完整宿主代码或 `@shotkit/shotium` 二进制；本地输出高度与当事人的 `5398` 不同，来自帮助内容和文字适配差异。

单参数验证证据位于 `D:\Bot\TRSS-Yunzai\temp\phi-shotium-signatures-1791800450202`，包含 `before.jpg`、`after.jpg`、逐次参数记录和 `results.json`；日志为 `D:\Bot\TRSS-Yunzai\temp\phi-shotium-signatures.log`。

此前另已确认并修复一个 TRSS 模板接口兼容问题：TRSS 的 `Renderer` 构造函数把 `dealTpl` 绑定到宿主静态方法，该实例属性遮住插件子类的同名方法。插件因此绕过静态文字适配，模板缓存和监听器也转到宿主静态对象，插件关闭无法回收它们。它与上述 selector 丢失问题独立。

`components/platform/yunzai.js` 现在识别这种静态接口，使用插件自己的模板实例，恢复 pvis、原子替换缓存校验和监听器回收；Shotium 仍调用同一个宿主实例。

## 环境与结果

- 宿主：TRSS-Yunzai 3.1.3，`config/config/renderer.yaml` 为 `name: shotium`。
- 插件：复制本工作区，`renderer: auto`，实际解析为宿主 Shotium。
- 引擎：宿主安装的 Shotium 0.12.1，进程内模式，默认视口 `800×600`。
- 最初双参数宿主测试：222 次连续/并发渲染，含三种主题、50%～200% 缩放、跨过第 100 张的内存回收点，均未裁图；另有初始单张验证。
- 模板兼容修复后的双参数正式脚本：12 次真实帮助处理函数调用、126 次三路并发/缩放渲染、1 次分页，共 139 次引擎调用；资源加载失败数为 0，全部断言通过。
- selector 接口兼容修复后，再次运行同一双参数正式脚本的 139 次引擎调用，全部通过；证据位于 `D:\Bot\TRSS-Yunzai\temp\phi-help-smoke-1791800470689`，日志为 `D:\Bot\TRSS-Yunzai\temp\phi-help-dual-signature.log`。
- 三种主题：默认、星空、寒冬。普通用户帮助图在 100% 缩放下为 `1200×3700`，分页为 `1200×1234`、`1200×1234`、`1200×1232`。
- 其他缩放输出：50% 为 `600×1850`，75% 为 `900×2775`，125% 为 `1500×4625`，150% 为 `1800×5550`，200% 为 `2400×7400`。
- 文字适配产生实际内联字号，模板缓存和监听器归插件实例所有，本次临时 HTML 在返回后清理。
- selector 兼容修复后的定向回归：27 项渲染器/适配测试、23 项 pvis/静态布局测试，合计 50 项通过。此前模板兼容修复另有 20 项 Puppeteer 生命周期测试通过；`git diff --check` 通过。
- 全量类型检查未通过，存在缺失 Koishi 依赖及已有类型错误；在测试副本比较修改前后诊断，归一化行号后的 67 条错误完全一致，未新增错误。

正式运行证据位于 `D:\Bot\TRSS-Yunzai\temp\phi-help-smoke-1791799810183\results.json`，同目录保留代表性 HTML 和 JPEG；运行日志为 `D:\Bot\TRSS-Yunzai\temp\phi-help-smoke.log`。

## 复跑

在 TRSS 根目录、已安装本插件且宿主启用 Shotium 的环境执行：

```powershell
node plugins/phi-plugin/scripts/test-trss-help.mjs
```

单参数调用契约的真实引擎回归：

```powershell
node plugins/phi-plugin/tests/fixtures/shotiumHostSignaturesSmoke.mjs
```

该夹具将单参数宿主的截图请求转交本地已加载的同一个宿主引擎，并验证选择器、输出尺寸和 clip 分页。若需要对比旧适配器，可设置 `PHI_SHOTIUM_BASELINE` 为保留的修改前适配器模块路径。

脚本临时绑定跟随宿主、三路并发的测试参数，不保存插件设置；结果写入新的 `temp/phi-help-smoke-<时间戳>` 目录。它检查实际图片尺寸、资源失败数、静态文字适配、分页总高度、模板资源归属和临时 HTML 清理。

本次没有经过真实聊天平台的消息传输，也未启动完整 Bot 登录。测试目录未安装独立曲绘包，帮助命令的随机曲绘回退到内置背景；远端曲绘、其他宿主 Shotium 版本/配置和消息平台对图片的处理仍未验证。若真实环境再次出现，可先保留原始返回图片及当次 HTML、引擎版本和配置，区分渲染器输出裁切与消息平台展示裁切。
