// Compatibility entry point for integrations that still import model/themeManager.js.
// @ts-ignore The file is also exposed through a compatibility symlink at model/themeManager.js.
import manager from '../theme/manager.js'

/** Keep the legacy import strongly typed even when TypeScript resolves the symlink. */
/** @type {{getThemeList: () => {id: string, src: string}[], [key: string]: any}} */
const typedManager = manager

export default typedManager
