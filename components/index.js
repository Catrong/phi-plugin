import Version from './Version.js'
import Data from './Data.js'
import Config from './Config.js'
import YamlReader from './YamlReader.js'
import { pluginRoot } from '../model/filesystem/path.js'
import platform from './platform/index.js'
import logger from './Logger.js'
import segment from './segment.js'
const Path = platform.rootPath
const Display_Plugin_Name = 'Phi-Plugin'
const Plugin_Name = 'phi-plugin'
const Plugin_Path = pluginRoot
export { Config, Data, Version, Path, Plugin_Name, Plugin_Path, Display_Plugin_Name, YamlReader, logger, segment }
