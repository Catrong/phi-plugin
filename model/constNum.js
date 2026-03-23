
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

export const APIBASEURL = "https://phib19.top:8080"
// export const APIBASEURL = "http://localhost:8081"

/**
 * 用户个性化设置项标题与解释
 */
export const USER_SETTING_META = {
    theme: {
        title: '主题风格',
        description: '字段：theme，控制图片页面的整体视觉风格，仅影响你的个人渲染结果。'
    },
    b30AvgKind: {
        title: 'B30统计数据展示',
        description: '字段：avgkind，控制 B30 均值条展示的数据，可按全部平均数、仅 B30平均数 或 百分比绝对位置。'
    },
    b30AvgColor: {
        title: 'B30均值条配色',
        description: '字段：avgcolor，控制 B30 均值条的主色，用于快速区分你的展示偏好。'
    }
}

/**
 * 用户个性化设置可选项标题与解释
 */
export const USER_SETTING_OPTIONS = {
    theme: {
        default: {
            title: '默认',
            description: '使用插件基础主题，使用随机曲绘作为背景。'
        },
        snow: {
            title: '寒冬',
            description: '在默认的基础上加入飘落雪花元素。'
        },
        star: {
            title: '使一颗心免于哀伤',
            description: '飞萤之火自无梦的长夜亮起，绽放在终竟的明天。'
        },
        dss2: {
            title: '大师赛2',
            description: 'Phigros 大师赛第二赛季主题配色'
        }
    },
    b30AvgKind: {
        all: {
            title: '全部统计',
            description: '展示在相近rks的玩家中全部成绩的平均值统计，信息最完整。将使用全部四种颜色区分不同的相对位置关系。'
        },
        b30: {
            title: '仅 B30',
            description: '展示在相近rks的玩家中只按 B30 成绩平均值统计，关注B30健康度。将使用前两个或后两个颜色，下个选项选择任意一个颜色时将同时使用与其对应的颜色'
        },
        top: {
            title: '仅 Top',
            description: '展示玩家成绩在相近rks的玩家中所有成绩和仅考虑B30成绩中的排名百分比，展示格式：[Top： 全体 / B30]。将全部使用下个选项选择的颜色进行展示'
        },
        none: {
            title: '隐藏',
            description: '不展示B30均值相关信息，界面更简洁。'
        }
    },
    b30AvgColor: {
        red: {
            title: '红',
            description: '高对比暖色，视觉冲击更强。'
        },
        gold: {
            title: '金',
            description: '偏亮金色，强调成就感和层级感。'
        },
        blue: {
            title: '蓝',
            description: '冷色调方案，信息阅读更平稳。'
        },
        green: {
            title: '绿',
            description: '中性偏亮配色，整体观感更清新。'
        }
    }
}