import Config from '../components/Config.js'
import getNotes from './getNotes.js'
import send from './send.js'

/**
 * @param {string | number | undefined} userId
 * @returns {Promise<boolean>}
 */
export async function isUserApiEnabled(userId) {
    if (!userId) return true
    const uid = String(userId)
    const pluginData = await getNotes.getNotesData(uid)
    if (typeof pluginData.allowApiUsage !== 'boolean') {
        pluginData.allowApiUsage = true
        getNotes.putNotesData(uid, pluginData)
    }
    return pluginData.allowApiUsage !== false
}

/**
 * @param {import('../components/baseClass.js').botEvent} e
 */
export async function getApiAccessState(e) {
    const globalEnabled = !!Config.getUserCfg('config', 'openPhiPluginApi')
    const userEnabled = await isUserApiEnabled(e?.user_id)
    return {
        globalEnabled,
        userEnabled,
        enabled: globalEnabled && userEnabled
    }
}

/**
 * @param {import('../components/baseClass.js').botEvent} e
 */
export async function canUseApi(e) {
    return (await getApiAccessState(e)).enabled
}