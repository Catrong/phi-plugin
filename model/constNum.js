
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

export {
    Level, LevelNum, redisPath
}