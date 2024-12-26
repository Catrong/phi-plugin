import path from 'path'

/**Yunzai-Bot 根目录 */
const _path = process.cwd()
// const _path = process.cwd().replace(/\\/g, '/')

/**插件名 */
const pluginName = path.basename(path.join(import.meta.url, '../../'))
/**插件根目录 */
const pluginRoot = path.join(_path, 'plugins', pluginName)
/**插件资源目录 */
const pluginResources = path.join(pluginRoot, 'resources')


/**曲绘资源、曲目信息路径 */
const infoPath = path.join(pluginResources, 'info')

/**额外曲目名称信息（开字母用） */
const DlcInfoPath = path.join(pluginResources, 'info', 'DLC')

/**上个版本曲目信息 */
const OldInfoPath = path.join(pluginResources, 'info', 'oldInfo')

/**数据路径 */
const dataPath = path.join(pluginRoot, 'data')

// const userPath = `E:/bot/233/Miao-Yunzai/plugins/phi-plugin/data/`

/**用户娱乐数据路径 */
const pluginDataPath = path.join(dataPath, 'pluginData')

/**用户存档数据路径 */
const savePath = path.join(dataPath, 'saveData')

/**用户设置路径 */
const configPath = path.join(pluginRoot, 'config', 'config')

/**默认设置路径 */
const defaultPath = path.join(pluginRoot, 'config', 'default_config')

/**默认图片路径 */
const imgPath = path.join(pluginResources, 'html', 'otherimg')

/**用户图片路径 */
const ortherIllPath = path.join(pluginResources, 'otherill')

/**原画资源 */
const originalIllPath = path.join(pluginResources, 'original_ill')

/**音频资源 */
const guessMicPath = path.join(pluginResources, 'splited_music')

/**备份路径 */
const backupPath = path.join(pluginRoot, 'backup')


export {
    _path,
    pluginName,
    pluginRoot,
    pluginResources,
    infoPath,
    DlcInfoPath,
    OldInfoPath,
    dataPath,
    pluginDataPath,
    savePath,
    configPath,
    defaultPath,
    imgPath,
    ortherIllPath,
    originalIllPath,
    guessMicPath,
    backupPath,
}