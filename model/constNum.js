
/**难度映射 */
const Level = ['EZ', 'HD', 'IN', 'AT', 'LEGACY']

const LevelNum = {
    EZ: 0,
    HD: 1,
    IN: 2,
    AT: 3,
    LEGACY: 4,
}

/**redis路径前缀 */
const redisPath = "phiPlugin"

/**最大难度 */
const MAX_DIFFICULTY = 17.6

export {
    Level, LevelNum, redisPath, MAX_DIFFICULTY
}