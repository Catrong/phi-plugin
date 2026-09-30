// 函数名与聊天指令不一致时，在此声明公开名称及业务入口文本。
/** @type {Record<string, Record<string, string | { name: string, text: string, bare?: boolean }>>} */
const names = {
    b19: { b19: 'b30', arcgrosB19: 'ab30', lmtAcc: 'lmtacc', bestn: 'best', singlescore: 'score' },
    help: { tkhelp: { name: 'tkhelp', text: 'tk help' }, apihelp: { name: 'apihelp', text: 'api help' } },
    session: { getSstk: { name: 'sessiontoken', text: 'sessionToken' } },
    update: { update: 'gx', ill_update: 'downill' },
    money: { tasks: 'task' },
    manage: { restartpu: 'repu' },
    user: { lvscore: 'lvscore', analyze2025SaveHistory: '2025history' },
    setting: { showUserSetting: 'myset' },
    phisong: { randClg: 'randclg', randmic: 'rand', comrks: 'com', newSong: 'newlog', difHis: 'difhis', recallComment: 'recmt', myComment: 'mycmt', newNotice: 'newnotice' },
    RankList: { rankList: 'ranklist' },
    market: { marketPage: 'nx' },
    apiSetting: { tokenList: 'tkls' },
    botClient: { claimLink: { name: 'botclaimlink', text: 'botClaimLink' } },
    guessGame: { start: 'guess', getTip: 'tip', reveal: { name: 'open', text: 'open', bare: true } },
    aliasProposal: Object.fromEntries(Object.entries({ propose: 'submit', mine: 'mine', publicList: 'public', appeal: 'appeal', vote: 'vote', unvote: 'unvote' })
        .map(([fnc, action]) => [fnc, { name: `alias-${action}`, text: `alias ${action}` }])),
}

/** 9 个常用入口 + 16 个业务分类，满足 Discord 顶层最多 25 项。 */
const commonCommands = [
    'help', 'b30', 'bind', 'update', 'score', 'suggest', 'info', 'song', 'sign',
]

/** @type {Record<string, [string, string]>} */
const commandCategories = {
    b19: ['scores', '成绩查询与分析'], session: ['account', '存档与账号'],
    phisong: ['songs', '曲目查询与曲绘'], help: ['guides', 'Token 与 API 帮助'],
    apiSetting: ['api', 'API 设置'], aliasProposal: ['proposals', '曲目别名提案与投票'],
    botClient: ['bot', 'Bot 身份与认领'], chart: ['charts', '谱面与标签'],
    guessGame: ['games', '猜曲游戏'], manage: ['admin', '插件管理'],
    market: ['market', '主题市场'], money: ['daily', '签到与任务'],
    RankList: ['ranking', '排行榜'], setting: ['settings', '设置'],
    update: ['maintenance', '插件与曲绘更新'], user: ['user', '个人数据与历史'],
}

/** @param {string} key @param {string} fnc */
function commandSpec(key, fnc) {
    const spec = names[key]?.[fnc] ?? fnc
    return typeof spec === 'string'
        ? { name: spec.toLowerCase().replace(/_/g, '-'), text: spec, bare: false }
        : { ...spec, bare: spec.bare ?? false }
}

// 可选功能清单；测试将其与 apps 的真实规则核对，避免菜单遗漏。
const commandFunctions = {
    "aliasProposal": [
        "propose",
        "mine",
        "publicList",
        "appeal",
        "vote",
        "unvote"
    ],
    "apiSetting": [
        "setApiToken",
        "tokenList",
        "auth",
        "clearApiData",
        "updateHistory",
        "updateUserToken",
        "updateComment",
        "apiset"
    ],
    "b19": [
        "b19",
        "p30",
        "arcgrosB19",
        "lmtAcc",
        "bestn",
        "singlescore",
        "suggest",
        "chap",
        "achievement"
    ],
    "botClient": [
        "resetApiBot",
        "claimLink"
    ],
    "chart": [
        "chart",
        "tag",
        "settag"
    ],
    "guessGame": [
        "start",
        "reveal",
        "getTip",
        "ans"
    ],
    "help": [
        "help",
        "tkhelp",
        "apihelp"
    ],
    "manage": [
        "restartpu",
        "backup",
        "restore",
        "get",
        "del",
        "allow",
        "ban",
        "unban"
    ],
    "market": [
        "market",
        "marketPage"
    ],
    "money": [
        "sign",
        "tasks",
        "retask",
        "send",
        "theme",
        "jrrp"
    ],
    "phisong": [
        "song",
        "search",
        "setnick",
        "ill",
        "randClg",
        "randmic",
        "alias",
        "comrks",
        "tips",
        "newSong",
        "live",
        "table",
        "difHis",
        "comment",
        "recallComment",
        "myComment",
        "addtag",
        "newNotice"
    ],
    "RankList": [
        "rankList",
        "rankfind"
    ],
    "session": [
        "bind",
        "update",
        "unbind",
        "clean",
        "getSstk"
    ],
    "setting": [
        "showUserSetting",
        "set"
    ],
    "update": [
        "update",
        "ill_update"
    ],
    "user": [
        "data",
        "info",
        "lvscore",
        "list",
        "analyze2025SaveHistory",
        "hisb30"
    ]
}

const shortcutCommands = Object.entries(commandFunctions).flatMap(([key, functions]) => functions.map(fnc => ({
    id: key + '.' + fnc, key, ...commandSpec(key, fnc),
})))
const defaultShortcutCommands = shortcutCommands.filter(item => commonCommands.includes(item.name)).map(item => item.id)
const defaultShortcutCategories = Object.keys(commandCategories)
module.exports = { commandSpec, commonCommands, commandCategories, shortcutCommands, defaultShortcutCommands, defaultShortcutCategories }
