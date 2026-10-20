/**
 * 通用游戏积分榜注册表。
 *
 * 任何新增的小游戏只需要在自身模块里调用 `registerGame()` 声明游戏与榜单模式，
 * 之后即可复用 `store.js` / `ranking.js` 的持久化与排名能力，无需改动积分榜命令。
 *
 * @typedef {'normal' | 'match'} gameScoreMode 榜单模式：单机 / 匹配
 *
 * @typedef {object} gameScoreModeMeta 榜单模式元信息
 * @property {string} label 模式显示名
 * @property {boolean} winRate 是否提供胜率榜
 * @property {boolean} trackResult 是否记录胜负
 *
 * @typedef {object} gameScoreGame 游戏定义
 * @property {string} id 游戏标识，同时作为存储键
 * @property {string} name 游戏显示名
 * @property {Record<string, gameScoreModeMeta>} modes 模式表
 */

/** @type {Map<string, gameScoreGame>} */
const games = new Map()

/** 匹配模式默认元信息，避免每个游戏重复声明。 */
export const defaultModes = {
    normal: { label: '单机', winRate: false, trackResult: false },
    match: { label: '匹配', winRate: true, trackResult: true },
}

/**
 * 注册游戏；重复注册会覆盖旧定义，便于测试与热更新。
 * @param {{id: string, name: string, modes?: Record<string, gameScoreModeMeta>}} definition
 * @returns {gameScoreGame}
 */
export function registerGame(definition) {
    const id = String(definition?.id || '').trim()
    if (!id) throw new Error('registerGame 需要非空 id')
    const modes = definition.modes && Object.keys(definition.modes).length
        ? definition.modes
        : defaultModes
    /** @type {gameScoreGame} */
    const game = {
        id,
        name: definition.name || id,
        modes: { ...modes },
    }
    games.set(id, game)
    return game
}

/**
 * 取游戏定义。
 * @param {string} id
 * @returns {gameScoreGame | null}
 */
export function getGame(id) {
    return games.get(String(id || '')) || null
}

/**
 * 列出全部已注册游戏。
 * @returns {gameScoreGame[]}
 */
export function listGames() {
    return [...games.values()]
}

/**
 * 解析游戏与模式：未指定游戏时取第一个；模式非法时回退该游戏第一个模式。
 * @param {string | undefined} gameId
 * @param {string | undefined} mode
 * @returns {{game: gameScoreGame, mode: string, modeMeta: gameScoreModeMeta} | null}
 */
export function resolveGameMode(gameId, mode) {
    const game = gameId ? getGame(gameId) : listGames()[0]
    if (!game) return null
    const modes = Object.keys(game.modes)
    const selected = mode && game.modes[mode]
        ? mode
        : modes[0]
    const modeMeta = game.modes[selected]
    if (!modeMeta) return null
    return { game, mode: selected, modeMeta }
}

/** 清空注册表，仅供测试。 */
export function clearGames() {
    games.clear()
}
