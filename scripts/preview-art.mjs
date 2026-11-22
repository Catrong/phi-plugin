/**
 * 把 .art 模板离线渲染成可直接打开的预览 HTML。
 *
 * 用法（在 phi-plugin 目录下）：
 *   node scripts/preview-art.mjs                # 默认渲染 chap/chapHelp
 *   node scripts/preview-art.mjs chapHelp       # 同上
 *   node scripts/preview-art.mjs chap/chapHelp  # 指定 resources/html 下的相对路径
 *
 * 产物写在模板同目录，文件名 `{模板名}-render.html`，全部使用相对路径，
 * 双击即可在浏览器里预览（不需要启动 Yunzai / 渲染器）。
 *
 * 与线上渲染的差异：这里只填充静态数据，不经过主题、不缩放、不截图。
 * 新增模板支持时，在 DATA_BUILDERS 里加一个构造器即可。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import template from 'art-template'
import YAML from 'yaml'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const pluginRoot = path.resolve(scriptDir, '..')
const resRoot = path.join(pluginRoot, 'resources')
const htmlRoot = path.join(resRoot, 'html')

/**
 * 从模板所在目录回退到 resources/ 的相对前缀（带结尾斜杠）。
 * 生成的 HTML 里所有资源引用都由它拼接，保证不出现绝对路径。
 * @param {string} fromDir
 */
function relPrefix(fromDir) {
    return path.relative(fromDir, resRoot).replace(/\\/g, '/') + '/'
}

/**
 * 章节数据：规则与 getInfo.getChapterList() 保持一致 ——
 * name 取 chaplist.yaml 的第一个别名（正式名），alias 取该章最短别名，
 * aliases 为全部别名，displayAliases 去掉正式名后按长度升序取最短三个。
 * @param {string} rel 相对 resources/ 的前缀
 */
function buildChapters(rel) {
    const chapList = YAML.parse(fs.readFileSync(path.join(resRoot, 'info/chaplist.yaml'), 'utf8'))
    return Object.entries(chapList).map(([code, aliases]) => {
        const list = (Array.isArray(aliases) ? aliases : []).filter(a => typeof a === 'string' && a.length > 0)
        const name = list[0] || code
        const alias = list.reduce((best, cur) => (cur.length < best.length ? cur : best), name)
        const allAliases = list.length ? list : [name]
        /* 按长度升序取最短三个，正式名已在卡上 */
        const displayAliases = allAliases
            .filter(item => item !== name)
            .sort((a, b) => a.length - b.length)
            .slice(0, 3)
        return {
            code,
            name,
            alias,
            aliases: allAliases,
            displayAliases: displayAliases.length ? displayAliases : [name],
            /* 本地曲绘按章节代码命名：Single.png、MainStory9.png、vividstasis.png */
            ill: rel + 'original_ill/chap/' + code + '.png',
        }
    })
}

/** 模板名 → 数据构造器。数据里已包含各自需要的相对路径。 */
const DATA_BUILDERS = {
    chapHelp: rel => ({ chapters: buildChapters(rel) }),
}

const arg = process.argv[2] || 'chapHelp'
const relTpl = arg.includes('/') ? arg.replace(/\.art$/, '') : 'chap/' + arg
const artPath = path.join(htmlRoot, relTpl + '.art')
const tplName = path.basename(relTpl)

if (!fs.existsSync(artPath)) {
    console.error('找不到模板: ' + path.relative(pluginRoot, artPath))
    process.exit(1)
}
const buildData = DATA_BUILDERS[tplName]
if (!buildData) {
    console.error('暂不支持的模板: ' + tplName)
    console.error('已支持: ' + Object.keys(DATA_BUILDERS).join(', '))
    console.error('如需新增，在 scripts/preview-art.mjs 的 DATA_BUILDERS 里加一个构造器。')
    process.exit(1)
}

const outDir = path.dirname(artPath)
const outPath = path.join(outDir, tplName + '-render.html')
const rel = relPrefix(outDir)
const pluginVersion = 'v' + JSON.parse(fs.readFileSync(path.join(pluginRoot, 'package.json'), 'utf8')).version
/* 游戏内版本与 Version.js 一样从 README 的 Phigros-x.y.z 标记读取 */
const readmePath = path.join(pluginRoot, 'README.md')
const phigrosVersion = fs.existsSync(readmePath)
    ? /Phigros-([0-9.]+)/.exec(fs.readFileSync(readmePath, 'utf8'))?.[1] ?? ''
    : ''

const data = {
    defaultLayout: path.join(htmlRoot, 'common/layout/default.art'),
    filename: artPath,
    /* 静态预览：不启用无 JS 渲染分支，脚本照常执行 */
    renderNoJs: false,
    /* 从模板目录回退到 resources/，模板里再拼 html/... 与 original_ill/... */
    _res_path: rel,
    _imgPath: rel + 'html/otherimg/',
    themeInfo: null,
    element: 'hydro',
    displayMode: 'default',
    bodyClass: '',
    sys: { scale: '' },
    background: '',
    _plugin: 'Phi-Plugin',
    Version: { ver: pluginVersion, phigros: phigrosVersion },
    Math,
    fCompute: {},
    ...buildData(rel),
}

const html = template.render(fs.readFileSync(artPath, 'utf8'), data)
fs.writeFileSync(outPath, html)

/* 资源引用的绝对路径会让静态页离开插件目录就打不开，这里兜底检查（跳过 SVG 命名空间常量） */
const absoluteRefs = (html.match(/file:\/\/[^"'\s]*|https?:\/\/[^"'\s]*/g) || [])
    .filter(url => !url.includes('www.w3.org'))

console.log('模板  ' + path.relative(pluginRoot, artPath))
console.log('输出  ' + path.relative(pluginRoot, outPath) + '  (' + (html.length / 1024).toFixed(1) + ' KB)')
console.log('前缀  ' + rel)
if ('chapters' in data) console.log('章节  ' + data.chapters.length)
console.log('绝对路径引用  ' + (absoluteRefs.length ? absoluteRefs.join(', ') : '无'))
