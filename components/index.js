import Version from './Version.js'
import Data from './Data.js'
import Config from './Config.js'
import YamlReader from './YamlReader.js'
import { pluginRoot } from '../model/path.js'
import platform from './platform/index.js'
const Path = platform.rootPath
const Display_Plugin_Name = 'Phi-Plugin'
const Plugin_Name = 'phi-plugin'
const Plugin_Path = pluginRoot
export { Config, Data, Version, Path, Plugin_Name, Plugin_Path, Display_Plugin_Name, YamlReader }
