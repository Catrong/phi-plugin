import path from 'path'

/**Yunzai-Bot 根目录 */
export const _path = process.cwd()
// export const _path = process.cwd().replace(/\\/g, '/')

/**插件名 */
export const pluginName = path.basename(path.join(import.meta.url, '../../'))
/**插件根目录 */
export const pluginRoot = path.join(_path, 'plugins', pluginName)
/**插件临时文件目录 */
export const tempPath = path.join(pluginRoot, 'temp')
/**插件资源目录 */
export const pluginResources = path.join(pluginRoot, 'resources')


/**曲绘资源、曲目信息路径 */
export const infoPath = path.join(pluginResources, 'info')

/**额外曲目名称信息（开字母用） */
export const DlcInfoPath = path.join(pluginResources, 'info', 'DLC')

/**上个版本曲目信息 */
export const oldInfoPath = path.join(pluginResources, 'info', 'oldInfo')

/**数据路径 */
export const dataPath = path.join(pluginRoot, 'data')

// export const userPath = `E:/bot/233/Miao-Yunzai/plugins/phi-plugin/data/`

/**用户娱乐数据路径 */
export const pluginDataPath = path.join(dataPath, 'pluginData')

/**用户存档数据路径 */
export const savePath = path.join(dataPath, 'saveData')

/**API用户存档数据路径 */
export const apiSavePath = path.join(dataPath, 'apiSaveData')

/**其他插件数据路径 */
export const otherDataPath = path.join(dataPath, 'otherData')

/**用户设置路径 */
export const configPath = path.join(pluginRoot, 'config', 'config')

/**默认设置路径 */
export const defaultPath = path.join(pluginRoot, 'config', 'default_config')

/**默认图片路径 */
export const imgPath = path.join(pluginResources, 'html', 'otherimg')

/**用户图片路径 */
export const ortherIllPath = path.join(pluginResources, 'otherill')

/**原画资源 */
export const originalIllPath = path.join(pluginResources, 'original_ill')

/**音频资源 */
export const guessMicPath = path.join(pluginResources, 'splited_music')

/**备份路径 */
export const backupPath = path.join(pluginRoot, 'backup')
