import autoSeekApi from '../api/autoSeekApi.js'
import getNotes from './getNotes.js'
import Config from '../../components/Config.js'

/** @typedef {'customTheme' | 'scoreStatistics' | 'onlineScore'} ApiCapability */

const capabilityConfigKeys = {
    customTheme: 'enableCustomThemeApi',
    scoreStatistics: 'enableScoreStatisticsApi',
    onlineScore: 'enableOnlineScoreApi',
}

/** @param {ApiCapability} capability */
export function isApiCapabilityConfigured(capability) {
    return Boolean(
        Config.getUserCfg('config', 'openPhiPluginApi')
        && Config.getUserCfg('config', /** @type {configName} */ (capabilityConfigKeys[capability])) !== false
    )
}

/** @param {ApiCapability} capability */
export function isApiCapabilityEnabled(capability) {
    return autoSeekApi.openPhiPluginApi && isApiCapabilityConfigured(capability)
}

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
 * @param {import('../../components/baseClass.js').botEvent} e
 */
export async function getApiAccessState(e, capability = /** @type {ApiCapability} */ ('onlineScore')) {
    const globalEnabled = !!autoSeekApi.openPhiPluginApi;
    const capabilityEnabled = Config.getUserCfg('config', /** @type {configName} */ (capabilityConfigKeys[capability])) !== false
    const userEnabled = capability === 'onlineScore' ? await isUserApiEnabled(e?.user_id) : true
    return {
        globalEnabled,
        capability,
        capabilityEnabled,
        userEnabled,
        enabled: globalEnabled && capabilityEnabled && userEnabled
    }
}

/**
 * @param {import('../../components/baseClass.js').botEvent} e
 */
export async function canUseApi(e, capability = /** @type {ApiCapability} */ ('onlineScore')) {
    return (await getApiAccessState(e, capability)).enabled
}
