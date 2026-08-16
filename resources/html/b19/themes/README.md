# 自定义主题包

每个主题放在本目录下的独立文件夹中，并通过 `info.yaml` 声明资源。`css` 推荐使用页面映射：

```yaml
font: "font.ttf"
background: "background.png"
color:
  AT: "#555555"
  IN: "#7b5ea7"
  HD: "#5b9bd5"
  EZ: "#7ecb8a"
css:
  b19: "b19.css"
  sign: "sign.css"
  setting/userSetting: "user-setting.css"
```

短键（如 `setting`）作用于该目录下的所有模板；完整键（如 `setting/userSetting`）优先级更高，只作用于指定模板。可用键取自渲染路径，目前常用短键包括 `b19`、`sign`、`update`、`clg`、`arcgrosB19`、`suggest`、`table`、`list`、`historyB30`、`setting`、`difficultyHistory` 和 `help`。

页面始终先加载插件自带 CSS，再加载映射到该页面的主题 CSS。只有页面命中有效 CSS 文件时才会启用主题字体；未命中时保留插件默认 CSS 和字体，但仍会继承主题包声明的背景与难度颜色。

旧版 `css: "b19.css"` 仍受支持，并保持原有语义：仅作用于 `b19/b19`，且替换而不是叠加插件自带的 B19 CSS。
