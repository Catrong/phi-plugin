/** @import {gameScoreRankingPage} from './index.js' */

/**
 * @typedef {object} gameScoreProfile
 * @property {'phigros'} source 身份来源
 * @property {string} name Phigros 玩家名称
 * @property {string} avatar 本地游戏头像文件名
 */

/** @type {Readonly<gameScoreProfile>} */
export const ANONYMOUS_PLAYER_PROFILE = Object.freeze({ source: 'phigros', name: '匿名用户', avatar: 'Introduction' })

/** @param {unknown} value @returns {gameScoreProfile | undefined} */
export function parsePlayerProfile(value) {
    if (!value || typeof value !== 'object' || !('source' in value) || value.source !== 'phigros'
        || !('name' in value) || typeof value.name !== 'string') return undefined
    const name = value.name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
    if (!name) return undefined
    const avatar = 'avatar' in value && typeof value.avatar === 'string' && value.avatar
        && !/[/\\:\u0000-\u001f]/.test(value.avatar) ? value.avatar : ANONYMOUS_PLAYER_PROFILE.avatar
    return { source: 'phigros', name, avatar }
}

/** @param {{saveInfo: {PlayerId?: string, summary: {avatar?: string}}} | null | undefined} save @returns {Promise<gameScoreProfile>} */
export async function playerProfileFromSave(save) {
    if (!save) return { ...ANONYMOUS_PLAYER_PROFILE }
    const { default: getInfo } = await import('../getInfo.js')
    const profile = parsePlayerProfile({
        source: 'phigros', name: save.saveInfo.PlayerId || ANONYMOUS_PLAYER_PROFILE.name,
        avatar: getInfo.idgetavatar(save.saveInfo.summary.avatar || 'Introduction'),
    })
    if (!profile) throw new Error('Phigros 玩家名称为空')
    return profile
}

/** @param {string} userId @returns {Promise<gameScoreProfile>} */
export async function playerProfileForUser(userId) {
    const { default: credentials } = await import('../../user/userCredentialStore.js')
    const token = await credentials.getSessionToken(userId)
    if (!token) return { ...ANONYMOUS_PLAYER_PROFILE }
    const { default: saves } = await import('../../save/getSave.js')
    return await playerProfileFromSave(await saves.getSaveBySessionToken(token))
}

/** @param {gameScoreRankingPage} page @returns {Promise<gameScoreRankingPage>} */
export async function resolveRankingProfiles(page) {
    const items = await Promise.all(page.items.map(async row => ({ ...row, profile: await playerProfileForUser(row.userId) })))
    const me = page.me ? items.find(row => row.userId === page.meId)
        || { ...page.me, profile: await playerProfileForUser(page.meId) } : null
    const resolved = { ...page, items, me }
    const { formatRankingPage } = await import('./ranking.js')
    return { ...resolved, text: formatRankingPage(resolved) }
}
