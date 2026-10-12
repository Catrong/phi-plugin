# Shotium 模板文字适配

在 `.art` 的 `{{extend defaultLayout}}` 后声明 `pvis`，正文只保留 `name="pvis"`。

```html
{{set pvis = [600, 76, 56, 22, 1.1]}}

<p name="pvis">{{song.song}}</p>
```

数组依次为可用宽度、可用高度、原字号上限、可读字号下限、行高倍率，单位为 CSS px。行高可省略。最终字号仍根据每段文字计算。

同页有不同区域时，用选择器覆盖默认参数：

```html
{{set pvis = ({
    default: [600, 76, 56, 22, 1.1],
    '.Player_Id-right': [ranklist ? 450 : 530, 78, 60, 18, 1.1],
    '.num': false
})}}
```

只有 `name="pvis"` 的元素参与处理。选择器可匹配元素自身或祖先区域；依次检查特殊项，后命中的参数完整替换前一组，不按 CSS 优先级合并。没有匹配项时使用 `default`；`false` 跳过适配。不同区域尺寸差异较大时，可用 `default: false` 并逐个声明区域，避免改变编号和难度等小字。

声明在模板渲染时求值，因此可直接使用 `ranklist` 等本页条件。配置仅属于本次请求，模板缓存保留原始源码。Yunzai、Koishi 的 Shotium 入口共用后处理；Puppeteer 继续使用页面脚本。

默认使用原来的多行 `fitBox` 算法。需要保留真实字体度量或单行估算时，可以使用第六项：

```html
{{set pvis = ({
    default: false,
    '.songname': [168, 23, 15, 11, null, { method: 'pvis', nowrap: true }]
})}}
```

`method` 支持 `box`、`pvis`、`line`，分别对应 `fitBox`、`fitPvis`、`fitLine`；`null` 行高沿用算法默认值。`pvis` 还支持 `breakWords` 和 `useFontMetrics`，主题使用自定义字体时默认回退估算。

若页面需要根据文字是否过长扩展容器，可复用顶部参数进行判断：

```html
{{set expanded = renderNoJs && staticText.fitRule(text, pvis['.desc'], { minimum: 1 }) < 12}}
```

宽高是页面提供的布局预算，后处理不会自动读取实际 CSS 布局。更改页面或主题尺寸时，应同步调整参数。正文中的实体、换行、嵌套标签及原有其他样式均保留。
