
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
        description: '使用/myset theme <序号>修改，控制图片页面的整体视觉风格，仅影响你的个人渲染结果。'
    },
    b30AvgKind: {
        title: 'B30统计数据展示',
        description: '使用/myset avgkind <序号>修改，控制 B30 均值条展示的数据，可按全部平均数、仅 B30平均数 或 百分比绝对位置。'
    },
    b30AvgColor: {
        title: 'B30均值条配色',
        description: '使用/myset avgcolor <序号>修改，控制 B30 均值条的主色，用于快速区分你的展示偏好。'
    },
    allowApiUsage: {
        title: 'API功能开关',
        description: '使用/myset api <序号>修改，关闭后将不再使用在线查分平台相关功能。'
    }
}

/**
 * 用户个性化设置可选项标题与解释
 */
export const USER_SETTING_OPTIONS = {
    theme: {
        default: {
            title: '[0]默认',
            description: '使用插件基础主题，使用随机曲绘作为背景。'
        },
        snow: {
            title: '[1]寒冬',
            description: '在默认的基础上加入飘落雪花元素。'
        },
        star: {
            title: '[2]使一颗心免于哀伤',
            description: '飞萤之火自无梦的长夜亮起，绽放在终竟的明天。'
        },
        dss2: {
            title: '[3]大师赛2',
            description: 'Phigros 大师赛第二赛季主题配色'
        }
    },
    b30AvgKind: {
        all: {
            title: '[0]全部统计',
            description: '展示在相近rks的玩家中全部成绩的平均值统计，信息最完整。将使用全部四种颜色区分不同的相对位置关系。'
        },
        b30: {
            title: '[1]仅 B30',
            description: '展示在相近rks的玩家中只按 B30 成绩平均值统计，关注B30健康度。将使用前两个或后两个颜色，下个选项选择任意一个颜色时将同时使用与其对应的颜色'
        },
        top: {
            title: '[2]仅 Top',
            description: '展示玩家成绩在相近rks的玩家中所有成绩和仅考虑B30成绩中的排名百分比，展示格式：[Top： 全体 / B30]。将全部使用下个选项选择的颜色进行展示'
        },
        none: {
            title: '[3]隐藏',
            description: '不展示B30均值相关信息，界面更简洁。'
        }
    },
    b30AvgColor: {
        red: {
            title: '[0]红',
            description: '高对比暖色，视觉冲击更强。'
        },
        gold: {
            title: '[1]金',
            description: '偏亮金色，强调成就感和层级感。'
        },
        blue: {
            title: '[2]蓝',
            description: '冷色调方案，信息阅读更平稳。'
        },
        green: {
            title: '[3]绿',
            description: '中性偏亮配色，整体观感更清新。'
        }
    },
    allowApiUsage: {
        true: {
            title: '[0]启用',
            description: '允许插件使用在线查分平台相关能力。'
        },
        false: {
            title: '[1]禁用',
            description: '禁用在线查分平台能力，仅使用本地数据。'
        }
    }
}

export const USER_API_SETTING_META = {
    allowDataCollection: {
        title: '数据收集同意',
        description: '控制是否同意插件收集你的游戏数据（如成绩、游玩时间等）用于统计分析和功能优化，帮助我们改进插件性能和用户体验。关闭后将同步禁用下方所有选项。'
    },
    allowLeaderboard: {
        title: '排行榜展示',
        description: '同意将你的成绩展示在在线排行榜中，供其他玩家查看和比较。'
    },
    allowDataAggregation: {
        title: '数据聚合',
        description: '同意将你的成绩数据匿名化后用于整体统计分析，分析结果将用于推分建议以及谱面分析、定位等功能。'
    },
    allowPlayerIdSearch: {
        title: '玩家ID搜索',
        description: '同意其他玩家通过你游戏中的的玩家ID搜索到你的成绩信息，便于社交互动和成绩比较。'
    },
    allowUserIdSearch: {
        title: '用户ID搜索',
        description: '控制是否同意使用用户ID进行绑定，其他玩家可以通过用户id获取到你的成绩信息'
    }
}

export const USER_API_SETTING_OPTIONS = {
    allowDataCollection: {
        true: {
            title: '[1]同意',
            description: ''
        },
        false: {
            title: '[0]拒绝',
            description: '插件将仅使用本地数据，不会上传任何信息。'
        }
    },
    allowLeaderboard: {
        true: {
            title: '[1]同意',
            description: ''
        },
        false: {
            title: '[0]拒绝',
            description: '你的成绩将不会在排行榜中展示。'
        }
    },
    allowDataAggregation: {
        true: {
            title: '[1]同意',
            description: ''
        },
        false: {
            title: '[0]拒绝',
            description: '拒绝将你的成绩数据用于统计分析，插件将不会使用你的数据进行任何形式的分析或报告。'
        }
    },
    allowPlayerIdSearch: {
        true: {
            title: '[1]同意',
            description: ''
        },
        false: {
            title: '[0]拒绝',
            description: '其他人将无法通过你的游戏ID搜索到你的成绩信息。'
        }
    },
    allowUserIdSearch: {
        true: {
            title: '[1]同意',
            description: ''
        },
        false: {    
            title: '[0]拒绝',
            description: '禁止使用用户ID获取存档，将禁用用户ID绑定功能。'
        }
    }
}