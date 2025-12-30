
/**
 * 难度映射
 * @type {allLevelKind[]}
 */
export const allLevel = ['EZ', 'HD', 'IN', 'AT', 'LEGACY']

/**
 * 难度映射
 * @type {levelKind[]}
 */
export const Level = ['EZ', 'HD', 'IN', 'AT']

export const LevelNum = {
    EZ: 0,
    HD: 1,
    IN: 2,
    AT: 3,
    LEGACY: 4,
}

/**redis路径前缀 */
export const redisPath = "phiPlugin"

/**最大难度 */
export const MAX_DIFFICULTY = 17.6
    
export const APII18NCN = {
    userNotFound: `未找到对应 用户`
}

// export const APIBASEURL = "https://phib19.top:8080"
export const APIBASEURL = "http://localhost:8081"