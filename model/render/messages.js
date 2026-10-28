/**
 * 用户可见发送文案集中表。
 *
 * 组织方式：按「来源文件 › 处理函数」分组。同一处理函数的普通消息（text）与
 * Markdown 消息（markdown：标题 + 快捷操作）放在同一组，便于一起维护。
 *
 * - 静态文案直接写字符串；带变量的文案写成函数。
 * - Markdown 组统一返回 `{ title, buttons }`，由统一出口按图片 → 文本 → Markdown
 *   顺序组装成一条消息。
 * - grks 消息叶子提供完整消息，words 仅提供拼接语料。
 * - 需要指令头时直接读取 `Config.getUserCfg('config', 'cmdhead')`，不再由调用方传入。
 */

import Config from '../../components/Config.js'
import segment from '../../components/segment.js'
import { butCmd } from './message.js';
import { isUsableImage } from '../game/grks/renderResult.js'
import { Level } from '../game/constNum.js'

/** @import {botEvent} from '../../components/baseClass.js' */
/** @import {MessageParts} from './message.js' */
/** @import {grksKnownData, grksGuessEntry} from '../../apps/grks/grks.js' */
/** @import {grksSoloView} from '../../apps/grks/soloRender.js' */
/** @import {gameScoreRankingPage} from '../game/gameScore/index.js' */
/** @import {gameScoreRow, gameScoreRankKind} from '../game/gameScore/ranking.js' */

/** 用户设置页：每个设置区域单独展示该区域的全部选项 */
const userSettingSections = () => [
    {
        title: '主题风格',
        buttons: [
            butCmd('myset theme 0', '[0]默认'),
            butCmd('myset theme 1', '[1]寒冬'),
            butCmd('myset theme 2', '[2]使一颗心免于哀伤'),
            butCmd('myset theme 3', '[3]大师赛2'),
        ],
    },
    {
        title: 'B30统计数据展示',
        buttons: [
            butCmd('myset avgkind 0', '[0]全部统计'),
            butCmd('myset avgkind 1', '[1]仅B30'),
            butCmd('myset avgkind 2', '[2]仅Top'),
            butCmd('myset avgkind 3', '[3]隐藏'),
        ],
    },
    {
        title: 'B30均值条配色',
        buttons: [
            butCmd('myset avgcolor 0', '[0]红'),
            butCmd('myset avgcolor 1', '[1]金'),
            butCmd('myset avgcolor 2', '[2]蓝'),
            butCmd('myset avgcolor 3', '[3]绿'),
        ],
    },
    {
        title: 'API功能开关',
        buttons: [
            butCmd('myset api 0', '[0]启用'),
            butCmd('myset api 1', '[1]禁用'),
        ],
    },
    {
        title: 'B30统计分析',
        buttons: [
            butCmd('myset B30分析 0', '[0]显示'),
            butCmd('myset B30分析 1', '[1]隐藏'),
        ],
    },
];

/**
 * 通用快捷操作菜单。指令头在生成时统一读取配置，文案与按钮标签集中在这里。
 */
export const menus = {
    /** 帮助页 */
    help: () => [
        [butCmd('bind qrcode', '扫码绑定')],
        [butCmd('pgr', 'B30成绩')],
        [
            butCmd('ranklist', '排行榜'),
            butCmd('info', '个人信息'),
            butCmd('market', '主题市场'),
            butCmd('myset', '用户设置'),
            butCmd('apiset', 'API设置'),
        ],
    ],
    /** 用户设置页：分组数据 */
    userSettingSections,
    /** 用户设置页 */
    userSetting: () => [
        [
            butCmd('myset theme 0', '主题风格'),
            butCmd('myset avgkind 0', 'B30统计数据展示'),
            butCmd('myset avgcolor 0', 'B30均值条配色'),
            butCmd('myset api 0', 'API功能开关'),
            butCmd('myset B30分析 0', 'B30统计分析'),
            butCmd('market', '主题市场')
        ],
    ],
    /** API 用户设置页 */
    apiSetting: () => [
        [
            butCmd('apiset 数据收集 开', '数据收集'),
            butCmd('apiset 排行榜 开', '排行榜'),
            butCmd('apiset 数据聚合 开', '数据聚合'),
            butCmd('apiset 玩家id 开', '玩家ID'),
            butCmd('apiset 用户id 开', '数据聚合'),
        ]
    ],
    /** API 帮助页 */
    apiHelp: () => [
        [
            butCmd('tkls', 'Token列表'),
            butCmd('apiset', 'API设置'),
            butCmd('clearApiData', '清空数据', 3),
        ]
    ],
    /** Bot 全局设置页 */
    config: () => [
        [
            butCmd('set', '设置'),
        ]
    ],
    /** b30页通用入口 */
    b19: () => [
        [butCmd('pgr', 'B30成绩')],
        [
            butCmd('p30', 'P30成绩'),
            butCmd('x30', 'X30成绩'),
            butCmd('x30', 'X30成绩')
        ],

    ],
    /** 绑定页通用入口 */
    bind: () => [
        [
            butCmd('bind qrcode', '扫码绑定'),
            butCmd('bind 改为你的sessionToken', '普通绑定'),
            butCmd('bind 改为你的查分API', 'API绑定'),
            butCmd('tk help', '绑定帮助'),
        ]
    ],
    /** 更新存档结果页 */
    update: () => [
        [
            butCmd('pgr', 'B30成绩'),
            butCmd('p30', 'P30成绩'),
            butCmd('info', '个人信息'),
        ]
    ],
    /** 成绩筛选页 */
    userList: () => [
        [
            butCmd('list', 'list'),
            butCmd('help', '帮助'),
        ]
    ],
    /** 存档历史页 */
    history: () => [
        [
            butCmd('2025history', '推分总结'),
            butCmd('hisb30', 'B30历史'),
            butCmd('pgr', 'B30成绩')
        ]
    ],
    /** B19 衍生分析页 */
    b19Analysis: () => [
        [
            butCmd('pgr', 'B30成绩'),
            butCmd('p30', 'P30成绩'),
            butCmd('help', '帮助'),
        ]
    ],
    /** 单曲成绩页 */
    singleScore: () => [
        [
            butCmd('list', '成绩筛选'),
            butCmd('pgr', 'B30成绩'),
            butCmd('info', '个人信息'),
            butCmd('help', '帮助'),
        ]
    ],
    /** 推分建议页 */
    suggest: () => [
        [
            butCmd('list', '成绩筛选'),
            butCmd('pgr', 'B30成绩'),
            butCmd('help', '帮助'),
        ]
    ],
    /** 章节成绩页 */
    chapter: () => [
        [
            butCmd('chap ALL', '全部章节'),
            butCmd('chap help', '章节帮助'),
            butCmd('help', '帮助'),
        ]
    ],
    /** 定数成就页 */
    achievement: () => [
        [
            butCmd('achievement ', '其他定数'),
            butCmd('pgr', 'B30成绩'),
            butCmd('list', '成绩筛选'),
            butCmd('chap ALL', '章节成绩'),
            butCmd('help', '帮助'),
        ]
    ],
    /** 绑定/更新页 */
    session: () => [
        [
            butCmd('update', '更新存档'),
            butCmd('unbind', '解绑'),
            butCmd('myset', '用户设置'),
        ]
    ],
    /** 排行榜页 */
    rank: () => [
        [
            butCmd('ranklist', '排行榜'),
            butCmd('pgr', 'B30成绩'),
            butCmd('info', '个人信息'),
            butCmd('help', '帮助'),
        ]
    ],
    grksHome: () => [
        [
            butCmd('grks', '猜RKS单机'),
            butCmd('grks match', '猜RKS匹配'),
        ],
        [
            butCmd('grks lb', '单机积分榜'),
            butCmd('grks lb match', '匹配积分榜'),
            butCmd('grks lb accuracy', '准确率榜'),
        ],
        [
            butCmd('ltr', '开字母'),
            butCmd('guess', '猜曲绘'),
        ],
        [
            butCmd('tipgame', '提示猜歌'),
            butCmd('friberg', '弗一把'),
        ]
    ],
    grksSolo: () => [[butCmd('grks 0', '猜测'), butCmd('grks ans', '放弃并公布答案')]],
    grksQueue: () => [[butCmd('grks cancel', '取消匹配'), butCmd('grks lb match', '匹配积分榜')]],
    /** @param {gameScoreRankingPage} page @returns {buttonCommandObject[][]} */
    grksRanking(page) {
        const command = `grks lb ${page.gameId} ${page.mode} ${page.kind}`
        const navigation = []
        if (page.page > 1) navigation.push(butCmd(`${command} ${page.page - 1}`, '上一页'))
        if (page.page < page.pages) navigation.push(butCmd(`${command} ${page.page + 1}`, '下一页'))
        return [...(navigation.length ? [navigation] : []), ...menus.grksHome()]
    },
    /** @param {grksMatchMenuOptions} state @returns {buttonCommandObject[][]} */
    grksMatch(state) {
        if (state.settled) return menus.grksHome()
        const exit = butCmd('grks cancel', '退出匹配（判负）')
        if (state.stage === 'answer') {
            return [state.guessed ? [exit] : [butCmd('grks 0', '猜测'), exit]]
        }
        if (state.hinted) return [[exit]]
        /** @type {buttonCommandObject[][]} */
        const rows = []
        const p = state.knownRecords.findIndex((known, index) => index < 3 && !known)
        const b = state.knownRecords.findIndex((known, index) => index >= 3 && !known)
        if (p != -1 || b != -1) {
            const slot = [];
            if (p >= 0) slot.push(butCmd(`grks hint P${p + 1}`, '提示P位'))
            if (b >= 0) slot.push(butCmd(`grks hint B${b - 2}`, '提示B位'))
            rows.push(slot)
        }
        if (!state.knownSheetType) rows.push([
            butCmd('grks hint 3 histogram', '提示直方图'), butCmd('grks hint 3 range', '提示RKS区间'),
        ])
        if (!state.knownInfo) rows.push([butCmd('grks hint 4', '提示统计与课题分')])
        rows.push([exit])
        return rows
    },

};



/**
 * @typedef {object} messagesObject 单个消息对象
 * @property {any} [image] - 图片消息
 * @property {string} [text] - 普通文本消息
 * @property {string} [markdown] - Markdown 消息
 * @property {{command:string,label:string,style?:buttonStyle}[][]} [button] - 快捷操作按钮
 *
 * @typedef {Record<string, messagesObject | ((...arg: any) => messagesObject)>} messagesDetail 单个功能点的消息集合
 *
 * @typedef {Record<string, messagesDetail | messagesObject | ((...arg: any) => messagesObject)>} messagesClass 单个文件的消息集合
 */

/**
 * @typedef {Record<string, Record<string, string | ((...arg: any) => string)>>} wordsClass 凭借词集合
 */


/**
 * @description apps/b19.js
 * @satisfies {messagesClass}
 */
export const b19Messages = {
    banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
    generating: { text: '正在生成图片，请稍等一下哦！\n//·/w\\·\\\\' },
    b19: {
        otherSaveFailed: (/** @type {string} */ id, /** @type {unknown} */ err) => ({ text: `获取用户 ${id} 的存档失败！请确认该用户公开了存档且ID正确喵！\n错误信息：${err}` }),
        /**
         * @param {any} image 
         * @param {idString[]} err 
         * @param {object} changed
         * @param {number} changed.comRKS
         * @param {number} changed.saveRKS
         * @param {string} changed.changedKind 'lower'|'higher'|''
         */
        finalMessage: (image, err, changed) => {
            const text = [];
            if (err?.length) {
                if (err.length > 5) {
                    text.push(`以下曲目无信息，可能导致b19显示错误\n${err.slice(0, 5).join('\n')}\n...等${err.length}条`);
                } else {
                    text.push(`以下曲目无信息，可能导致b19显示错误\n${err.join('\n')}`);
                }
            }
            if (changed.changedKind) {
                const { comRKS, saveRKS, changedKind } = changed;
                switch (changedKind) {
                    case 'lower':
                        text.push(`请注意，当前版本可能更改了定数\n计算rks: ${comRKS}\n存档rks: ${saveRKS}`);
                        break;
                    case 'higher':
                        text.push(`请注意，您的版本可能更改了定数或计算规则\n计算rks: ${comRKS}\n存档rks: ${saveRKS}`);
                        break;
                }
            }
            return {
                image,
                text: text.join('\n'),
                button: menus.b19()
            }
        },
    },
    p30: {
        finalMessage: (image, comRKS, saveRKS) => ({
            image,
            text: `计算rks: ${comRKS}\n存档rks: ${saveRKS}`,
            button: menus.b19()
        }),
    },
    lmtAcc: {
        invalidAcc: (/** @type {string} */ input) => {
            const head = Config.getUserCfg('config', 'cmdhead');
            return ({
                text: (`我听不懂 ${input} 是多少喵！请指定一个0-100的数字喵！\n格式：/${head} lmtAcc <0-100>`),
                button: [[butCmd('lmtAcc 95.50', '示例：95.50%')]]
            });
        },
    },
    overLevelB30: {
        noOverLevel: (/** @type {boolean} */ withFlick) => ({
            text: withFlick
                ? '没有找到越级的成绩喵！(计入Flick时所有成绩的acc均不低于越级线)'
                : '没有找到越级的成绩喵！(不计Flick时所有成绩的acc均不低于越级线)'
        }),
        /**
         * @param {any} image 
         * @param {string} avg 
         * @param {number} saveRks 
         */
        finalMessage: (image, avg, saveRks) => ({ image, text: `越级成绩均rks: ${avg}\n存档rks: ${saveRks}`, button: menus.b19() }),
    },
    bestn: {
        notNumber: (/** @type {string} */ input) => ({ text: `${input}不是个数字吧！` }),
        tooLong: { text: '消息过长，自动转为私聊发送喵～' },
        noPhiSong: { text: '你还没有满分的曲目哦！收掉一首歌可以让你的RKS大幅度增加的！' },
        finalMessage: (/** @type {{text?: string}} */ parts) => ({ ...parts, button: menus.b19() }),
    },
    singlescore: {
        specifySong: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`请指定曲名哦！\n格式：/${head} score <曲名>`) }); },
        songNotFound: (/** @type {string} */ song) => ({ text: `未找到 ${song} 的有关信息哦！` }),
    },
    suggest: {
        tooMany: (/** @type {number} */ count, /** @type {number} */ max) =>
            ({ text: `谱面数量过多(${count})大于设置的最大值(${max})，只显示前${max}条！` }),
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.suggest() }),
    },
    chap: {
        notFound: (/** @type {string} */ msg) => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`未找到${msg}章节QAQ！可以使用 /${head} chap help 来查询支持的名称嗷！`) }); },
        helpMessage: (/** @type {unknown} */ image) => ({ image }),
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.chapter() }),
    },
    achievement: {
        specifyDifficulty: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`请输入定数嗷！\n/格式：/${head} table <定数>`) }); },
        difficultyTooHigh: (/** @type {number} */ max) => ({ text: `定数已经超过最高的定数${max}了QAQ！` }),
        versionNotFound: (/** @type {string} */ version) => ({ text: `未找到版本 ${version} 的相关信息QAQ！` }),
        unknownError: { text: '发生未知错误QAQ！请回报管理员！' },
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.achievement() }),
    },
    getScore: {
        infoNotFound: (/** @type {string} */ id) => ({ text: `未找到${id}的相关信息QAQ！` }),
        noRecord: (/** @type {string} */ song) => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`我不知道你关于[${song}]的成绩哦！可以试试更新成绩哦！\n格式：/${head} update`) }); },
        suggestUnavailable: ({ text: '无法推分' }),
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.singleScore() }),
    },
}

/**
 * @description apps/help.js
 * @satisfies {messagesClass}
 */
export const helpMessages = {
    help: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.help() }),
    },
    tkhelp: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        tokenHelp: () => {
            const head = Config.getUserCfg('config', 'cmdhead');
            return ({
                text: (`sessionToken有关帮助：\n【推荐】：扫码登录TapTap获取token\n指令：/${head} bind qrcode\n【基础方法】详见《Phigros非官方查分指引》：https://kdocs.cn/l/cvMDjWPTNaz4\n绑定sessionToken指令：\n/${head} bind <sessionToken>`),
                button: menus.bind()
            });
        },
    },
    apihelp: {
        notConnected: { text: '这里没有连接查分平台哦！' },
        capabilityDisabled: { text: 'Bot 主人已关闭在线查分功能。' },
        userDisabled: { text: '你已在本地用户设置中禁用 API 功能，可在 /myset 中重新开启。' },
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.apiHelp() }),
    },
}

/**
 * @description apps/user.js
 * @satisfies {messagesClass}
 */
export const userMessages = {
    data: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        dataAmount: (/** @type {string} */ text) => ({ text: `您的data数为：${text}` }),
        needUpdate: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`请先更新数据哦！\n/${head} update`) }); },
    },
    info: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        backgroundNotFound: (/** @type {string} */ background) => ({ text: `ERROR: 未找到[${background}]的有关信息！` }),
        noHistory: { text: '没有找到可用的历史记录，请先更新存档。' },
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.b19() }),
    },
    lvscore: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        backgroundNotFound: (/** @type {string} */ background) => ({ text: `ERROR: 未找到[${background}]背景的有关信息！` }),
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.b19() }),
    },
    list: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        tooMany: (/** @type {number} */ count, /** @type {number} */ max) =>
            ({ text: `谱面数量过多(${count})大于设置的最大值(${max})，请缩小搜索范围QAQ！` }),
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.userList() }),
    },
    analyze2025SaveHistory: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.history() }),
    },
    hisb30: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.history() }),
    },
}

/**
 * @description apps/session.js
 * @satisfies {messagesClass}
 */
export const sessionMessages = {
    bind: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        // apiBindSuccess: (/** @type {string} */ apiUserId) => `绑定成功！您的查分ID为：${apiUserId}，请妥善保管嗷！`,
        apiSaveUnavailable: { text: '绑定已成功，但暂时无法读取 API 存档，请稍后执行更新。' },
        /**
         * @param {string} apiUserId
         */
        apiUserNotFound: (apiUserId) => {
            const head = Config.getUserCfg('config', 'cmdhead');
            return {
                text: `没有找到${apiUserId}对应的用户，请确认对应用户开启了 apiUserId 绑定权限哦！\n帮助：/${head} tk help\n获取二维码：/${head} bind qrcode\n普通绑定：/${head} bind <sessionToken>`,
                button: menus.bind()
            };
        },
        apiUnavailable: { text: '这里没有连接查分平台哦！请使用sessionToken进行绑定！' },
        missingToken: () => {
            const head = Config.getUserCfg('config', 'cmdhead');
            return {
                text: (`喂喂喂！你还没输入sessionToken呐，如果不知道自己的sessionToken可以尝试扫码绑定嗷！\n帮助：/${head} tk help\n获取二维码：/${head} bind qrcode\n普通绑定：/${head} bind <sessionToken>`),
                button: menus.bind()
            };
        },
        /**
         * @param {Buffer} image
         * @param {number} time
         */
        qrcodeImageHint: (image, time) => ({ image: segment.image(image), text: `请识别二维码并按照提示进行登录嗷！请勿错扫他人二维码。请注意，登录TapTap可能造成账号及财产损失，请在信任Bot来源的情况下扫码登录。\n二维码剩余时间:${time}` }),
        /**
         * 
         * @param {number} time 
         * @param {string} qrcode 
         */
        qrcodeLinkHint: (time, qrcode) =>
            ({ text: `请点击链接进行登录嗷！请勿使用他人的链接。请注意，登录TapTap可能造成账号及财产损失，请在信任Bot来源的情况下扫码登录。\n链接剩余时间:${time}\n${qrcode}` }),
        qrcodeImageOnly: { text: '请识别二维码并按照提示进行登录嗷！请勿错扫他人二维码。请注意，登录TapTap可能造成账号及财产损失，请在信任Bot来源的情况下扫码登录。' },
        /** 
         * @param {string} url 
         */
        qrcodeLinkOnly: (url) =>
            ({ text: `请点击链接进行登录嗷！请勿使用他人的链接。请注意，登录TapTap可能造成账号及财产损失，请在信任Bot来源的情况下扫码登录。\n${url}` }),
        qrcodeScanned: { text: '二维码已扫描，请确认登录' },
        timeout: { text: '操作超时，请重试QAQ！' },
        /**

         * @param {unknown} err

         */
        tokenFailed: (err) =>
            ({ text: `获取sessionToken失败QAQ！请确认您的Phigros已登录TapTap账号并同步！\n错误信息：${err}` }),
        binding: { text: '正在绑定，请稍等一下哦！\n >_<' },
        // /**
        //  * @param {boolean} apiBindingSucceeded
        //  */
        // localBindSuccess: (apiBindingSucceeded) => {
        //     const head = Config.getUserCfg('config', 'cmdhead');
        //     return {
        //         text: (`${apiBindingSucceeded ? '' : 'API绑定不可用，已按当前 Bot 本地状态完成绑定。\n'}请注意保护好自己的sessionToken呐！如果需要获取已绑定的sessionToken可以私聊发送 /${head} sessionToken 哦！`),
        //     };
        // },
        /**

         * @param {unknown} error

         */
        updateFailed: (error) =>
            ({ text: `更新失败，请检查你的sessionToken是否正确！\n错误信息：${error}` }),
        /**
         * @param {any} image
         * @param {string} playerId
         * @param {object} [option]
         * @param {string} [option.apiUserId]
         * @param {boolean} [option.apiFailed] - API绑定失败的错误信息
         */
        bindSuccess: (image, playerId, option) => {
            const msgs = ['绑定成功！'];
            msgs.push(`PlayerId: ${playerId}`);
            option?.apiUserId && msgs.push(`API查分Id: ${option.apiUserId}`);
            option?.apiFailed && msgs.push(`API绑定不可用，已按当前 Bot 本地状态完成绑定。`);
            return {
                image,
                text: msgs.join('\n'),
                button: menus.session(),
            };
        },
    },
    update: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        updating: { text: '正在更新，请稍等一下哦！>_<' },
        noSave: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`没有找到你的存档，请先绑定sessionToken哦！如果不知道自己的sessionToken可以尝试扫码绑定嗷！\n帮助：/${head} tk help\n获取二维码：/${head} bind qrcode\n普通绑定：/${head} bind <sessionToken>`) }); },
        tokenFailed: (/** @type {unknown} */ error) =>
            ({ text: `更新失败，请检查你的sessionToken是否正确QAQ！\n错误信息：${error}` }),
        failed: (/** @type {unknown} */ error) => ({ text: `更新失败QAQ！\n错误信息：${error}` }),
        /**
         * @param {any} image
         * @param {string} playerId
         */
        updateSuccess: (image, playerId) => ({
            image,
            text: `PlayerId: ${playerId}`,
            button: menus.update()
        }),
    },
    unbind: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        noCredentials: { text: '没有找到你的存档信息嗷！' },
        timeout: { text: '超时已取消，请注意 @Bot 进行回复哦！' },
        confirm: { text: '解绑只会清除当前 Bot 本地保存的绑定、存档和历史，不会修改 API 数据。真的要这么做吗？（确认/取消）' },
        success: { text: '当前 Bot 本地解绑成功' },
        noSave: { text: '没有找到你的存档哦！' },
        cancelled: { text: '取消成功！' },
        failed: (/** @type {any} */ error) => ({ text: error }),
    },
    clean: {
        timeout: { text: '超时已取消，请注意 @Bot 进行回复哦！' },
        confirm: { text: '请注意，本操作将会删除Phi-Plugin关于您的所有信息QAQ！（确认/取消）' },
        success: { text: '清除数据成功' },
        cancelled: { text: '取消成功！' },
        failed: (/** @type {any} */ error) => ({ text: error }),
    },
    getSstk: {
        privateOnly: { text: '请私聊使用嗷' },
        notBound: { text: '未绑定存档，请先绑定存档嗷！' },
        tokenInfo: (/** @type {{playerId:string,sessionToken:string,objectId:string,userId:string,apiId:string}} */ data) =>
            ({ text: `PlayerId: ${data.playerId}\nsessionToken: ${data.sessionToken}\nObjectId: ${data.objectId}\nQQId: ${data.userId}\nAPIId: ${data.apiId || '未绑定'}` }),
    },
}

/**
 * @description apps/setting.js
 * @satisfies {messagesClass}
 */
export const settingMessages = {
    set: {
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.config() }),
    },
    showUserSetting: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        usage: () => {
            const head = Config.getUserCfg('config', 'cmdhead');
            return ({
                text: [
                    '用法示例：',
                    `/${head} 用户设置`,
                    `/${head} 用户设置 主题 star`,
                    `/${head} 用户设置 主题 3`,
                    `/${head} 用户设置 均值范围 b30`,
                    `/${head} 用户设置 配色 gold`,
                    `/${head} 用户设置 API开关 关闭`,
                    `/${head} 用户设置 B30分析 关闭`,
                ].join('\n'),
                button: menus.userSetting()
            });
        },
        missingArgs: (/** @type {string} */ usage) => ({ text: `参数不足，请提供“设置项 + 目标值”。\n${usage}` }),
        unknownSetting: (/** @type {string} */ key, /** @type {string} */ usage) =>
            ({ text: `未知设置项：${key}\n支持：主题 / 均值范围 / 配色 / API开关 / B30分析\n${usage}` }),
        themeBanned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        themeApiDisabled: { text: '该主题尚未下载，自动下载依赖联合查分 API，请联系 Bot 主人启用。' },
        preparingTheme: (/** @type {string} */ value) => ({ text: `正在校验并准备主题 ${value}，请稍候。` }),
        invalidValue: (/** @type {string} */ value, /** @type {string} */ title, /** @type {string} */ optionalValues) =>
            ({ text: `无效值：${value}\n${title} 可选：${optionalValues}` }),
        saveFailed: { text: '主题或用户设置已准备完成，但保存失败，请稍后重试。' },
        success: (/** @type {string} */ title, /** @type {string} */ option) => ({ text: `设置成功：${title} -> ${option}` }),
        themeError: (/** @type {string} */ message) => ({ text: message }),
    },
}

/**
 * @description apps/market.js
 * @satisfies {messagesClass}
 */
export const marketMessages = {
    themeError: (/** @type {string} */ message) => ({ text: message }),
    catalog: {
        unavailable: { text: '主题市场目录暂时不可用，请稍后重试。' },
    },
    marketPage: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        openFirst: () => {
            const head = Config.getUserCfg('config', 'cmdhead');
            return ({
                text: (`请先使用 /${head} market 打开主题市场。`),
                button: [[butCmd('market', '打开主题市场')]]
            });
        },
        firstPage: ({ text: '已经是主题市场第一页了。' }),
        lastPage: ({ text: '已经是主题市场最后一页了。' }),
    },
    market: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        detailUsage: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`用法：/${head} market detail <主题slug>`) }); },
        detailNotFound: { text: '未找到该主题，或主题市场暂时不可用。' },
        usage: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`用法：/${head} market [list [关键词] [页码] | detail <主题slug> | <主题slug>]`) }); },
        invalidSlug: { text: '主题 slug 格式无效。' },
        offline: { text: '当前为本地离线模式，该主题尚未下载，暂时无法使用。' },
        preparingLocal: (/** @type {string} */ id) => { return ({ text: `正在启用本地主题 ${id}，请稍候。` }); },
        preparing: (/** @type {string} */ id) => { return ({ text: `正在校验并启用主题 ${id}，首次使用时会自动下载，请稍候。` }); },
        saveFailed: { text: '主题已准备完成，但你的主题设置保存失败，请稍后重试。' },
        /**
         * @param {object} result 
         * @param {boolean} result.cached
         * @param {boolean} result.local
         * @param {boolean} result.offline
         * @param {string} result.version
         * @param {string} result.theme
         * @param {string} result.detail
         * @returns 
         */
        enabled: (result) => {
            const actionText = result.local ? '已使用本地主题' : result.cached ? '已使用本地安全缓存' : '已自动下载并完成安全校验'
            return { text: `主题已启用：${result.theme}${result.version ?? ''}（${actionText}）` }
        }
    },
}

export const chartWords = {
    settag: {
        timeout: '操作超时已取消，请重新使用 /settag。',
    }
}

/**
 * @description apps/chart.js
 * @satisfies {messagesClass}
 */
export const chartMessages = {
    chart: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
    },
    tag: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        apiDisabled: (/** @type {boolean} */ globalEnabled) => ({
            text: globalEnabled
                ? 'Bot 主人已关闭查分数据统计功能。'
                : '这里没有连接查分平台哦！'
        }),
    },
    settag: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        apiDisabled: (/** @type {{globalEnabled:boolean,capabilityEnabled:boolean}} */ apiAccess) =>
        ({
            text: !apiAccess.globalEnabled
                ? '这里没有连接查分平台哦！'
                : !apiAccess.capabilityEnabled
                    ? 'Bot 主人已关闭在线查分功能。'
                    : '你已在本地用户设置中禁用 API 功能，可在 /myset 中重新开启。'
        }),
        permissionDenied: { text: '权限不足，请尝试扫码登录或使用sessionToken进行绑定哦~' },
        categoryMenu: (/** @type {{name:string,description?:string|null}[]} */ tagTree) => ({
            text: [
                '请选择标签分类：',
                ...tagTree.map((category, index) => `-${index + 1}. ${category.name}${category.description ? `：${category.description}` : ''}`),
                '示例：/settag <曲名> <难度> 读谱',
            ].join('\n')
        }),
        childMenu: (/** @type {{name:string,description?:string|null,children?:{name:string,description?:string|null}[]}} */ category) => ({
            text: [
                `请选择「${category.name}」下的细分标签：`,
                ...(category.children || []).map((tag, index) => `-${index + 1}. ${tag.name}${tag.description ? `：${tag.description}` : ''}`),
                `示例：/settag <曲名> <难度> ${category.name} 1`,
            ].join('\n')
        }),
    },
    getChartImg: {
        finalMessage: (image, id, rank, song, charter) => {
            const head = Config.getUserCfg('config', 'cmdhead')
            return {
                image,
                text: `${song} - ${rank}\n谱师：${charter}`,
                button: [[
                    { command: `/${head} chart ${id} ${rank}`, label: '其他难度' },
                    { command: `/${head} tag ${id} ${rank}`, label: '查看标签' },
                    { command: `/${head} help`, label: '帮助' },
                ]],
            }
        },
    },
    getChartTags: {
        /**
         * 
         * @param {object} info
         * @param {string} info.song
         * @param {string} info.composer
         * @param {string} info.id
         * @param {string} info.rank
         * @param {number} info.difficulty
         * @param {string} info.charter
         * @param {{name: string, value: number, children?: {name: string, voteCount: number}[]}[]} words
         * @param {{tags?: string[]}[]} usersVote
         * @returns 
         */
        finalMessage: (info, words, usersVote) => {
            const head = Config.getUserCfg('config', 'cmdhead')
            const lines = [
                info.song,
                `by ${info.composer}`,
                `${info.rank} - ${info.difficulty}`,
                `谱师：${info.charter}`,
                '标签：',
            ]
            words.forEach((category, index) => {
                lines.push(`-${index + 1}. ${category.name}：${category.value}`)
                    ; (category.children || []).forEach((tag, childIndex) => {
                        const voted = usersVote?.[0]?.tags?.includes(tag.name) ?? false
                        lines.push(`  ${index + 1}.${childIndex + 1} ${tag.name}：${tag.voteCount} ${voted ? '(✓)' : ''}`)
                    })
            })
            return {
                text: lines.join('\n'),
                button: [[
                    { command: `/${head} chart ${info.id} ${info.rank}`, label: '查看谱面' },
                    { command: `/${head} settag ${info.id} ${info.rank}`, label: '提交标签' },
                    { command: `/${head} help`, label: '帮助' },
                ]],
            }
        },
    },
}

/**
 * @description apps/RankList.js
 * @satisfies {messagesClass}
 */
export const rankListMessages = {
    rankList: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        finalMessage: (image, total) => ({ image, text: `总数据量：${total}\n`, button: menus.rank() }),
    },
    rankfind: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        specifyRks: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`请输入要查询的 rks！\n格式： /${head} rankfind <rks>`) }); },
        rankAbove: (/** @type {number} */ rank, /** @type {number} */ total, /** @type {number} */ rks) =>
            ({ text: `当前服务器记录中一共有 ${rank}/${total} 位玩家的 rks 大于 ${rks}！` }),
        rankAboveOrEqual: (/** @type {number} */ total, /** @type {number} */ rank, /** @type {number} */ rks) =>
            ({ text: `当前服务器记录中一共有 ${total - rank + 1}/${total} 位玩家的 rks 大于等于 ${rks}！` }),
    },
}

/**
 * @description apps/money.js
 * @satisfies {messagesClass}
 */
export const moneyMessages = {
    sign: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        image: (/** @type {unknown} */ image) => ({ image }),
        success: (image, /** @type {string} */ tips, /** @type {number} */ getnum, /** @type {number} */ money) =>
            ({ image, text: `${tips}\n恭喜您获得了${getnum}个Note！当前 Note：${money}` }),
        alreadySigned: (image, /** @type {string} */ time, /** @type {number} */ money) =>
            ({ image, text: `你在今天${time}的时候已经签过到了哦！\n你现在的Note数量: ${money}` }),
    },
    retask: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        notEnoughNotes: (/** @type {number} */ money) =>
            ({ text: `刷新任务需要 20 Notes，咱没有那么多Note哇QAQ！\n你当前的 Note 数目为：${money}` }),
        allPerfect: { text: '哇塞，您已经把所有曲目全部满分了呢！没有办法为您布置任务了呢！敬请期待其他玩法哦！' },
    },
    tasks: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        image: (/** @type {unknown} */ image) => ({ image }),
    },
    send: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        formatTarget: (/** @type {string} */ tmp) => ({ text: `格式错误！请指定目标${tmp}` }),
        invalidAmount: (/** @type {string} */ tmp) => ({ text: `非法数量！转账数量只能是正整数${tmp}` }),
        targetNotFound: { text: '这个QQ号……好像没有见过呢……' },
        selfTarget: { text: '转账成……欸？这个目标……在拿我寻开心嘛！' },
        failedDeduct: { text: '转账失败！扣除 20 Notes！' },
        no20Notes: { text: 'a，你怎么连20 Note都没有哇' },
        forgive: { text: 'www，算了，我今天心情好，不和你计较了，哼！' },
        notEnough: (/** @type {number} */ money) => ({ text: `你当前的Note数量不够哦！\n当前Note: ${money}` }),
        success: (/** @type {number} */ senderOld, /** @type {number} */ num, /** @type {number} */ senderNow, /** @type {string} */ targetName, /** @type {number} */ targetOld, /** @type {number} */ received, /** @type {number} */ targetNow) =>
            ({ text: `转账成功！\n你当前的Note: ${senderOld} - ${num} = ${senderNow}\n${targetName}的Note: ${targetOld} + ${received} = ${targetNow}` }),
    },
    theme: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        specifyTheme: (/** @type {number} */ max) => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`请输入主题数字嗷！\n格式/${head} theme 0-${max}`) }); },
        preparing: (/** @type {string} */ id) => ({ text: `正在校验并准备主题 ${id}，请稍候。` }),
        saveFailed: { text: '主题已准备完成，但你的主题设置保存失败，请稍后重试。' },
        success: (/** @type {string} */ src) => ({ text: `设置成功！\n你当前的主题是：${src}` }),
    },
    jrrp: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        image: (/** @type {unknown} */ image) => ({ image }),
    },
    createJrrp: {
        unknownError: { text: '发生未知错误QAQ，请联系管理员处理！' },
    },
}

/**
 * @description apps/phisong.js
 * @satisfies {messagesClass}
 */
export const phisongMessages = {
    notice: {
        image: (/** @type {unknown} */ image) => ({ image }),
    },
    song: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        image: (/** @type {unknown} */ image) => ({ image }),
        specifySong: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`请指定曲名哦！\n格式：/${head} song <曲名>`) }); },
        notFound: (/** @type {string} */ msg) => ({ text: `未找到${msg}的相关曲目信息QAQ\n如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！` }),
    },
    search: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        image: (/** @type {unknown} */ image) => ({ image }),
        title: { text: '曲目检索' },
        empty: { text: '未找到符合条件的曲目QAQ' },
        summary: (/** @type {{ key: string, label: string }[]} */ filters) => {
            if (!filters.length) return { text: '当前筛选：无（全部曲目）' }
            /** @type {Record<string, string>} */
            const labels = { bpm: 'BPM', difficulty: '定级', combo: '物量' }
            return { text: `当前筛选：${filters.map(filter => `${labels[filter.key] || filter.key} ${filter.label}`).join('  ')}` }
        },
        truncated: (/** @type {number} */ total, /** @type {number} */ shown) =>
            ({ text: `共找到 ${total} 首曲目，仅展示前 ${shown} 首，请增加 bpm / 定级 / 物量条件缩小范围。` }),
        footer: (/** @type {number} */ total) => ({ text: `共 ${total} 首曲目` }),
    },
    setnick: {
        adminOnly: { text: '只有管理员可以设置别名哦！' },
        songNotFound: (/** @type {string} */ input) => ({ text: `输入有误哦！没有找到“${input}”这首曲子呢！` }),
        aliasExists: (/** @type {string} */ id, /** @type {string} */ alias) => ({ text: `${id} 已经有 ${alias} 这个别名了哦！` }),
        done: { text: '设置完成！' },
        formatError: { text: '输入有误哦！请按照\n原名（或已有别名） ---> 别名\n的格式发送哦！' },
    },
    ill: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        image: (/** @type {unknown} */ image) => ({ image }),
        specifySong: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`请指定曲名哦！\n格式：/${head} ill <曲名>`) }); },
        notFound: (/** @type {string} */ msg) => ({ text: `未找到${msg}的相关曲目信息QAQ` }),
    },
    randmic: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        image: (/** @type {unknown} */ image) => ({ image }),
        plusRangeUnsupported: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`含有 '+' 的难度不支持指定范围哦！\n/${head} rand <定数>+ <难度(可多选)>`) }); },
        invalidBelow: (/** @type {string} */ rank) => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`${rank} 不是一个定级哦\n#/${head} rand <定数>- <难度(可多选)>`) }); },
        invalidRange: (/** @type {string} */ from, /** @type {string} */ to) => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`${from} - ${to} 不是一个定级范围哦\n/${head} rand <定数1> - <定数2> <难度(可多选)>`) }); },
        invalidValue: (/** @type {string} */ rank) => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`${rank} 不是一个定级哦\n#/${head} rand <定数> <难度(可多选)>`) }); },
        notFound: (/** @type {number} */ bottom, /** @type {number} */ top, /** @type {string} */ levels) =>
            ({ text: `未找到 ${bottom} - ${top} 的 ${levels}谱面QAQ!` }),
    },
    alias: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        /**
         * @param {any} image
         * @param {string} id 
         * @param {string|undefined} song 
         * @param {string[]} nicks 
         * @returns 
         */
        info: (image, id, song, nicks) =>
            ({ image, text: `\nname: ${song}\nid: ${id}\n${nicks.join('\n')}` }),
        notFound: (/** @type {string} */ msg) =>
            ({ text: `未找到${msg}的相关曲目信息QAQ！如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！` }),
    },
    comrks: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        result: (/** @type {number} */ difficulty, /** @type {number} */ acc, /** @type {number} */ rks) =>
            ({ text: `dif: ${difficulty} acc: ${acc}\n计算结果：${rks}` }),
        formatError: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`格式错误QAQ！\n格式：${head} com <定数> <acc>`) }); },
    },
    tips: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        text: (/** @type {string} */ tip) => ({ text: tip }),
    },
    randClg: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        image: (/** @type {unknown} */ image) => ({ image }),
        notFound: { text: '未找到符合条件的谱面QAQ！' },
    },
    newSong: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        /**
         * @param {any} image 
         * @param {string | undefined} version 
         * @param {string | undefined} updateInfo 
         * @param {string} fileVersion 
         * @returns 
         */
        content: (image, version, updateInfo, fileVersion) => {
            const text = [];
            if (version) text.push(`最新版本：${version}`);
            if (updateInfo) text.push(`更新信息：\n${updateInfo}`);
            if (fileVersion) text.push(`信息文件版本：${fileVersion}`);
            return {
                image,
                text: text.join('\n')
            }
        },
    },
    table: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        image: (/** @type {unknown} */ image) => ({ image }),
        specifyDifficulty: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`请输入定数嗷！\n/格式：${head} table <定数>`) }); },
        difficultyTooHigh: (/** @type {number} */ max) => ({ text: `定数已经超过最高的定数${max}了QAQ！` }),
        versionNotFound: (/** @type {string} */ version) => ({ text: `未找到版本 ${version} 的相关信息QAQ！` }),
        unknownError: { text: '发生未知错误QAQ！请回报管理员！' },
    },
    difHis: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        image: (/** @type {unknown} */ image) => ({ image }),
        notFound: (/** @type {string} */ song) => ({ text: `未找到 ${song} 的相关历史定数信息QAQ！` }),
    },
    comment: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        needToken: { text: '请先绑定sessionToken哦！' },
        specifySong: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`请指定曲名哦！\n格式：\n/${head} cmt <曲名> <难度?>(换行)\n<内容>`) }); },
        notFound: (/** @type {string} */ nickname) =>
            ({ text: `未找到${nickname}的相关曲目信息QAQ\n如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！` }),
        unknownError: { text: '发生未知错误QAQ！请回报管理员' },
        invalidRank: (/** @type {string} */ rank) => ({ text: `${rank} 不是一个难度QAQ！` }),
        noDifficulty: (/** @type {string} */ id, /** @type {string} */ rank) => ({ text: `${id} 没有 ${rank} 这个难度QAQ！` }),
        empty: { text: '不可发送空白内容w(ﾟДﾟ)w！' },
        tooLong: { text: '太长了吧！你想干嘛w(ﾟДﾟ)w！' },
        onlineSuccess: { text: '在线评论成功！φ(゜▽゜*)♪' },
        success: { text: '评论成功！φ(゜▽゜*)♪' },
        failed: { text: '遇到未知错误QAQ！' },
    },
    recallComment: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        needToken: { text: '请先绑定sessionToken哦！' },
        specifyId: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`请输入评论ID嗷！\n格式：/${head} recmt <评论ID>`) }); },
        onlineDeleted: { text: '删除在线评论成功！φ(゜▽゜*)♪' },
        notFound: (/** @type {string} */ id) => ({ text: `没有找到ID为${id}的评论QAQ！` }),
        noPermission: { text: '您没有权限操作这条评论捏(。﹏。)' },
        deleted: { text: '删除成功！' },
        deleteFailed: { text: '删除失败QAQ！' },
    },
    myComment: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        empty: { text: '您还没有评论哦！' },
        content: (/** @type {{id:unknown,songId:unknown,rank:unknown,comment:unknown,time:unknown}[]} */ comments, /** @type {(...args:any[])=>string} */ formatDate) => {
            let msg = `您的评论列表：\nID | 曲目 | 难度 | 内容 | 时间\n`
            for (const comment of comments) {
                msg += `${comment.id} | ${comment.songId} | ${comment.rank} | ${comment.comment} | ${formatDate(comment.time)}\n`
            }
            return ({ text: msg })
        },
    },
}


/**
 * @description apps/aliasProposal.js
 * @satisfies {wordsClass}
 */
export const aliasProposalWords = {
    status: {
        submitted: '等待初审',
        rejected_private: '私密拒绝',
        public_review_requested: '已申请公审',
        public_voting: '公开投票',
        vote_passed: '投票通过待终审',
        approved: '正式通过',
        public_review_denied: '公审申请被拒',
        rejected_final: '最终拒绝',
    },
    failure: {
        needToken: '请先绑定 sessionToken。',
        serviceUnavailable: '别名服务暂时不可用，请稍后重试。',
    },
    list: {
        empty: '暂无相关别名提案。',
        item: (/** @type {number} */ index, /** @type {{alias:string,songId:string,status:string,votesUp?:number,votesDown?:number,publicReviewReason?:string|null,id:string}} */ item, /** @type {boolean} */ includeVote, /** @type {Record<string,string>} */ statuses) => {
            const vote = includeVote ? `｜+${item.votesUp || 0}/-${item.votesDown || 0}` : ''
            const reason = includeVote && item.publicReviewReason ? `\n理由：${item.publicReviewReason}` : ''
            return `${index + 1}. ${item.alias} -> ${item.songId}\n${statuses[item.status] || item.status}${vote}${reason}\nID: ${item.id}`
        },
    },

}

/**
 * @description apps/aliasProposal.js
 * @satisfies {messagesClass}
 */
export const aliasProposalMessages = {
    propose: {
        privateOnly: { text: '别名提案仅允许在私聊中提交。' },
        format: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`格式：/${head} alias submit 曲目 | 别名 | 私密备注（可选）`) }); },
        lengthLimit: { text: '别名最多 64 字，备注最多 500 字。' },
        ambiguous: (/** @type {string} */ candidates) => ({ text: `曲目不唯一，请使用更精确的名称：\n${candidates}` }),
        songNotFound: ({ text: '未找到对应曲目。' }),
        submitted: (/** @type {{alias:string,songId:string,id:string}} */ proposal) =>
            ({ text: `提案已提交。\n${proposal.alias} -> ${proposal.songId}\nID: ${proposal.id}` }),
    },
    appeal: {
        privateOnly: { text: '公审申请仅允许在私聊中提交。' },
        format: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`格式：/${head} alias appeal 提案ID | 10-500字理由`) }); },
        reasonLength: { text: '公审理由必须为 10-500 字。' },
        submitted: (/** @type {{id:string}} */ proposal) => ({ text: `公审申请已提交。\nID: ${proposal.id}` }),
    },
    vote: {
        format: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`格式：/${head} alias vote 提案ID 赞成|反对`) }); },
        recorded: (/** @type {1|-1} */ value) => ({ text: `投票已记录：${value === 1 ? '赞成' : '反对'}。` }),
    },
    unvote: {
        format: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`格式：/${head} alias unvote 提案ID`) }); },
        withdrawn: { text: '投票已撤回。' },
    },
    list: {
        content: (/** @type {any[]} */ items, /** @type {boolean} */ includeVote = false) => ({
            text: items.length
                ? items.slice(0, 15)
                    .map((item, index) => aliasProposalWords.list.item(index, item, includeVote, aliasProposalWords.status))
                    .join('\n\n')
                : aliasProposalWords.list.empty,
        }),
    },
    failure: (/** @type {string} */ message) => ({ text: message }),
}

const apiSettingWords = {
    apiset: {
        usage: () => {
            const head = Config.getUserCfg('config', 'cmdhead');
            return {
                text: [
                    '用法：',
                    `/${head} apiset`,
                    `/${head} apiset 数据收集 开`,
                    `/${head} apiset allowLeaderboard false`,
                    '可设置项：allowDataCollection / allowLeaderboard / allowDataAggregation / allowPlayerIdSearch / allowUserIdSearch',
                    '可选值：true/false、on/off、开/关、允许/禁止',
                ].join('\n')
            }
        },
    }
}

/**
 * @description apps/apiSetting.js
 * @satisfies {messagesClass}
 */
export const apiSettingMessages = {
    access: {
        notConnected: { text: '这里没有连接查分平台哦！' },
        capabilityDisabled: { text: 'Bot 主人已关闭在线查分功能。' },
        userDisabled: { text: '你已在本地用户设置中禁用 API 功能，可在 /myset 中重新开启。' },
    },
    setApiToken: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        noLocalTk: { text: '本地没有您的tk记录嗷！请先尝试使用tk绑定呐！' },
        specifyToken: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`请输入apiToken！\n格式：\n设置密码：/${head} setApiToken <新Token> `) }); },
        invalidToken: { text: 'API Token 包含非法字符，请检查后重试！\n格式：\n/setApiToken <新Token>' },
        success: (/** @type {string} */ token) => ({ text: `API Token 已设置为: \n${token}` }),
    },
    tokenList: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        noLocalTk: { text: '本地没有您的tk记录嗷！请先尝试使用tk绑定呐！' },
        list: (/** @type {any[]} */ platformData, /** @type {{platform:unknown,platform_id:unknown}} */ currentPlatform) => {
            let resMsg = `已绑定${platformData.length}个平台账号\n`
            platformData.forEach((item, index) => {
                if (currentPlatform.platform == item.platform_name && currentPlatform.platform_id == item.platform_id) {
                    resMsg += `${index + 1}.（当前）\n`
                } else {
                    resMsg += `${index + 1}.\n`
                }
                resMsg += `平台: ${item.platform_name}\n`
                resMsg += `平台ID: ${item.platform_id}\n`
                resMsg += `创建时间: ${item.create_at}\n`
                resMsg += `更新时间: ${item.update_at}\n`
                if (item.binding_type === 'bot') {
                    resMsg += `认证状态: ${item.authentication_label || (item.authentication >= 2 ? '已认证' : '未认证')}\n`
                    if (item.bot_display_name) resMsg += `Bot: ${item.bot_display_name}\n`
                } else if (item.binding_type === 'legacy') {
                    resMsg += `认证状态: 旧绑定\n`
                    resMsg += `提示: ${item.migration_notice || '请及时使用新版插件更新绑定状态。'}\n`
                } else {
                    resMsg += `权限: ${item.authentication}\n`
                }
            })
            return ({ text: resMsg })
        },
    },
    auth: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        invalidToken: { text: 'API Token 包含非法字符，请检查后重试！' },
        noApiId: { text: '本地没有您的apiId记录嗷！请尝试重新绑定呐！' },
        success: (/** @type {string} */ token) => ({ text: `验证成功！\n您的用户Token为：\n${token}\n请妥善保管您的Token哦~` }),
    },
    clearApiData: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        needSstk: { text: '注销 phi-api 账号需要 Phigros SSTK 权限，请先使用 SSTK 绑定。' },
        timeout: { text: '超时已取消，请注意 @Bot 进行回复哦！' },
        confirm: { text: '注销 phi-api 账号将永久清除云端账号及全部数据，且无法恢复！真的要这么做吗？（确认/取消）' },
    },
    confirmClearApiData: {
        cancelled: { text: '已取消' },
        needSstk: { text: '注销 phi-api 账号需要 Phigros SSTK 权限，请先使用 SSTK 绑定。' },
        cleared: { text: 'phi-api 账号已注销，云端数据已清除' },
    },
    updateUserToken: {
        noPermission: { text: '无权限' },
        extracting: { text: '开始提取user_token，请稍等...' },
        batchUpload: (/** @type {number} */ seconds) => ({ text: `数据量过大，开始分批上传，预计${seconds}秒...` }),
        success: { text: '上传用户Token成功' },
    },
    updateComment: {
        noPermission: { text: '无权限' },
        uploading: { text: '开始上传评论数据，请稍等...' },
    },
    apiset: {
        noLocalTk: { text: '本地没有您的tk记录嗷！请先尝试使用tk绑定呐！' },
        missingArgs: () => ({ text: `参数不足，请提供“设置项 + 目标值”。\n${apiSettingWords.apiset.usage()}` }),
        unknownSetting: (/** @type {string} */ key) => ({ text: `未知设置项：${key}\n${apiSettingWords.apiset.usage()}` }),
        invalidValue: (/** @type {string} */ value) => ({ text: `无效值：${value}\n${apiSettingWords.apiset.usage()}` }),
        success: (/** @type {string} */ title, /** @type {boolean} */ enabled) => ({ text: `设置成功：${title} -> ${enabled ? '开启' : '关闭'}` }),
        finalMessage: (/** @type {{image?: unknown}} */ parts) => ({ ...parts, button: menus.apiSetting() }),
    },
}

/**
 * @description apps/manage.js
 * @satisfies {messagesClass}
 */
export const manageMessages = {
    restartpu: {
        success: { text: '成功' },
        failed: (/** @type {any} */ error) => ({ text: error }),
    },
    backup: {
        starting: { text: '开始备份，请稍等...' },
        failed: (/** @type {any} */ error) => ({ text: error }),
    },
    restore: {
        chooseList: (/** @type {string} */ list) => ({ text: `请选择需要恢复的备份文件：\n${list}` }),
        timeout: { text: '超时已取消，请注意 @Bot 进行回复哦！' },
        failed: (/** @type {any} */ error) => ({ text: error }),
    },
    doRestore: {
        success: (/** @type {string} */ index, /** @type {string} */ name) => ({ text: `[${index}] ${name} 恢复成功` }),
        notFound: (/** @type {string} */ index) => ({ text: `第[${index}]项不存在QAQ！` }),
    },
    get: {
        invalidIndex: { text: '请输入正确的序号哦！' },
        rankList: (/** @type {string[]} */ tokens) => ({ text: tokens.join('\n') }),
    },
    del: {
        invalidToken: { text: '请输入正确的sessionToken哦！' },
        success: { text: '成功' },
    },
    allow: {
        invalidToken: { text: '请输入正确的sessionToken哦！' },
        success: { text: '成功' },
    },
    ban: {
        groupOnly: { text: '请在群聊中使用呐！' },
        bannedList: (/** @type {string} */ groupId, /** @type {string} */ list) => ({ text: `当前: ${groupId}\n已禁用:\n${list}` }),
    },
    unban: {
        groupOnly: { text: '请在群聊中使用呐！' },
        bannedList: (/** @type {string} */ groupId, /** @type {string} */ list) => ({ text: `当前: ${groupId}\n已禁用:\n${list}` }),
    },
}

/**
 * @description apps/botClient.js
 * @satisfies {wordsClass}
 */
export const botClientWords = {
    resetApiBot: {
        success: (/** @type {string} */ clientId, /** @type {string} */ claimUrl) =>
            `API Bot身份已重置。\nclientId: ${clientId}\n认领链接: ${claimUrl || '请重新获取'}`
    },
    claimLink: {
        success: (/** @type {string} */ url) => `Bot认领链接（15分钟有效）：\n${url}`,
    },
}

/**
 * @description apps/botClient.js
 * @satisfies {messagesClass}
 */
export const botClientMessages = {
    resetApiBot: {
        groupOnly: { text: 'API Bot身份已重置，clientId与认领链接仅在控制台输出。' },
        failed: (/** @type {string} */ error) => ({ text: `重置失败：${error}` }),
        details: (/** @type {string} */ message) => ({ text: message }),
    },
    claimLink: {
        groupOnly: { text: '认领链接仅在私聊或控制台输出。' },
        failed: (/** @type {string} */ error) => ({ text: `获取失败：${error}` }),
        details: (/** @type {string} */ message) => ({ text: message }),
    },
}

export const theoryTableWords = {
    theoryTable: {
        simulatedInfo: (/** @type {string} */ algorithm, /** @type {string} */ label, /** @type {boolean} */ isNewAlgo) => ([
            '模拟分表：理论模拟，非真实存档',
            `理论rks = ${algorithm}（${label}${isNewAlgo ? '' : '旧版'}算法）`,
        ]),
    }
}

/**
 * @description apps/theoryTable.js
 * @satisfies {messagesClass}
 */
export const theoryTableMessages = {
    theoryTable: {
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
        image: (/** @type {unknown} */ image) => ({ image }),
        versionNotFound: (/** @type {string} */ version) => ({ text: `未找到版本 ${version} 的相关信息QAQ！` }),
        unknownError: { text: '发生未知错误QAQ！请回报管理员！' },
        chartTableUnavailable: (/** @type {string} */ label) => ({ text: `未能获取版本 ${label} 的定数表QAQ！` }),
        generating: { text: '正在生成图片，请稍等一下哦！\n//·/w\·\\' },
        playerName: (/** @type {string} */ label) => ({ text: `v${label}理论分表` }),

    },
}

/**
 * @description apps/update.js
 * @satisfies {wordsClass}
 */
export const updateWords = {
    time: {
        failed: '获取时间失败',
    },
    update: {
        failed: (/** @type {unknown} */ err) => `phi-plugin更新失败QAQ!${err}`,
        illFailed: (/** @type {unknown} */ err) => `曲绘文件更新失败QAQ!${err}`,
        upToDate: (/** @type {string} */ time) => `phi-plugin已经是最新版本\n最后更新时间：${time}`,
        current: (/** @type {string} */ time) => `phi-plugin\n最后更新时间：${time}`,
    },
    ill: {
        upToDate: (/** @type {string} */ time) => `曲绘文件已经是最新版本\n最后更新时间：${time}`,
        current: (/** @type {string} */ time) => `phi-plugin-ill\n最后更新时间：${time}`,
    },
    gitErr: {
        timeout: (/** @type {string} */ remote) => `更新失败QAQ！\n连接超时：${remote}`,
        connectFailed: (/** @type {string} */ remote) => `更新失败QAQ！\n连接失败：${remote}`,
        conflict: (/** @type {string} */ errMsg) => `更新失败QAQ！存在冲突：\n${errMsg}\n请解决冲突后再更新，或者执行#phi强制更新，放弃本地修改`,
        conflictWithOutput: (/** @type {string} */ errMsg, /** @type {string} */ stdout) => [
            '更新失败QAQ！存在冲突\n',
            errMsg,
            stdout,
            '\n请解决冲突后再更新，或者执行#phi强制更新，放弃本地修改',
        ].join('\n'),
    },
    log: {
        header: (/** @type {number} */ count) => `phi-plugin更新日志，共${count}条`,
        illHeader: (/** @type {number} */ count) => `phi-plugin-ill更新日志，共${count}条`,
        moreInfo: '更多详细信息，请前往github查看\nhttps://github.com/Catrong/phi-plugin',
    },
}

/**
 * @description apps/update.js
 * @satisfies {messagesClass}
 */
export const updateMessages = {
    update: {
        noPermission: { text: '无权限' },
        updating: { text: '已有命令更新中..请勿重复操作' },
        failed: (/** @type {unknown} */ err) => ({ text: updateWords.update.failed(err) }),
        illFailed: (/** @type {unknown} */ err) => ({ text: updateWords.update.illFailed(err) }),
        restarting: { text: '更新完毕，正在重启云崽以应用更新' },
        updatedNoRestart: { text: '更新完毕，本次更新不需要进行重启' },
        forceStarting: { text: '开始执行强制更新操作，请稍等' },
        starting: { text: '开始执行更新操作，请稍等' },
        upToDate: (/** @type {string} */ time) => ({ text: updateWords.update.upToDate(time) }),
        current: (/** @type {string} */ time) => ({ text: updateWords.update.current(time) }),
    },
    ill_update: {
        noPermission: { text: '无权限' },
        updating: { text: '已有命令更新中..请勿重复操作' },
        finished: { text: '更新完毕' },
    },
    ill: {
        startingClone: { text: '开始下载曲绘文件' },
        startingUpdate: { text: '开始更新曲绘文件，请稍等' },
        upToDate: (/** @type {string} */ time) => ({ text: updateWords.ill.upToDate(time) }),
        current: (/** @type {string} */ time) => ({ text: updateWords.ill.current(time) }),
        log: (/** @type {any} */ message) => ({ text: message }),
    },
    log: {
        forward: (/** @type {any} */ message) => ({ text: message }),
        text: (/** @type {string[]} */ lines) => ({ text: lines.join('\n') }),
    },
    gitErr: {
        header: { text: '更新失败QAQ！' },
        timeout: (/** @type {string} */ remote) => ({ text: updateWords.gitErr.timeout(remote) }),
        connectFailed: (/** @type {string} */ remote) => ({ text: updateWords.gitErr.connectFailed(remote) }),
        conflict: (/** @type {string} */ errMsg) => ({ text: updateWords.gitErr.conflict(errMsg) }),
        conflictWithOutput: (/** @type {string} */ errMsg, /** @type {string} */ stdout) => ({
            text: updateWords.gitErr.conflictWithOutput(errMsg, stdout)
        }),
        output: (/** @type {string} */ errMsg, /** @type {string} */ stdout) => ({ text: [errMsg, stdout].join('\n') }),
    },
    checkGit: {
        gitMissing: { text: '请先安装git' },
    },
}

/**
 * @description apps/guessGame.js
 * @satisfies {messagesClass}
 */
export const guessGameMessages = {
    start: {
        groupOnly: { text: '请在群聊中使用这个功能嗷！' },
        otherGameRunning: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`当前存在其他未结束的游戏嗷！如果想要开启新游戏请 /${head} ans 结束进行的游戏嗷！`) }); },
        banned: { text: '这里被管理员禁止使用这个功能了呐QAQ！' },
    },
    ans: {
        noneRunning: { text: '当前没有进行中的游戏嗷！' },
    },
    reveal: {
        groupOnly: { text: '请在群聊中使用这个功能嗷！' },
    },
}

/**
 * @description apps/guessGame/guessTips.js
 * @satisfies {messagesClass}
 */
export const guessTipsMessages = {
    start: {
        alreadyStarted: { text: '请不要重复发起哦！' },
        noIllustration: { text: '当前曲库暂无有曲绘的曲目哦！更改曲库后需要重启哦！' },
        unknownError: { text: '获取曲目信息发生未知错误QAQ！' },
        intro: (/** @type {number} */ cd, /** @type {number} */ tipNum, /** @type {number} */ ansTime) => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`下面开始进行提示猜歌哦！可以直接发送曲名进行回答哦！每过${cd}秒后可以请求下一条提示，共有${tipNum + 1}条提示嗷！所有提示发送完毕${ansTime}秒后会自动结束游戏嗷！发送 /${head} ans 也可以提前结束游戏呐！`) }); },
        tipList: (/** @type {string[]} */ tips, /** @type {number} */ tipNum) =>
            ({ text: tips.slice(0, tipNum).map((tip, index) => `${index + 1}.${tip}`).join('\n') }),
    },
    getTip: {
        cooldown: (/** @type {number} */ seconds) => ({ text: `提示的冷却时间还有${seconds}秒哦！` }),
        noMoreTips: { text: '已经没有提示了呐，再仔细想想吧！' },
        revealIntro: (/** @type {number} */ ansTime) =>
            ({ text: `接下来是曲绘提示哦！如果在${ansTime}秒内没有回答正确的话，将会自动公布答案哦！` }),
        progress: (/** @type {unknown} */ image, /** @type {string[]} */ tips, /** @type {number} */ tipNum) => ({
            image,
            text: tips.slice(0, tipNum).map((tip, index) => `${index + 1}.${tip}`).join('\n')
        }),
    },
    guess: {
        correct: (/** @type {unknown} */ image) => ({ image, text: '恭喜你，答对啦喵！ヾ(≧▽≦*)o' }),
        wrongRaw: (/** @type {string} */ input) => ({ text: `不是 ${input} 哦喵！≧ ﹏ ≦` }),
        wrongSong: (/** @type {string|undefined} */ song) => ({ text: `不是 ${song} 哦喵！≧ ﹏ ≦` }),
    },
    ans: {
        answer: (/** @type {unknown} */ image, /** @type {string|undefined} */ song) => ({ image, text: `好吧，下面开始公布答案。正确答案是：${song}` }),
    },
    common: {
        noCorrect: (/** @type {unknown} */ image, /** @type {string|undefined} */ song) => ({ image, text: `呜……很遗憾，没有人答对喵！正确答案是：${song}` }),
    },
}

/**
 * @description apps/guessGame/guessIll.js
 * @satisfies {wordsClass}
 */
export const guessIllWords = {
    tip: {
        areaIncrease: '[区域扩增!]',
        blurDown: '[清晰度上升!]',
        added: '[追加提示!]',
        globalView: '[全局视野!]',
        interferenceReduced: (/** @type {string} */ name) => `[${name}干扰减弱!]`,
        interferenceHeader: '\n当前干扰类型：',
        blur: '模糊 ',
        saturate: '饱和 ',
        invert: '反相 ',
        hueRotate: '色相 ',
        lineMode: '线稿 ',
        noInterference: '\n当前没有任何干扰了哦！',
        chapter: (/** @type {string} */ value) => `\n该曲目隶属于 ${value}`,
        bpm: (/** @type {string|number} */ value) => `\n该曲目的 BPM 值为 ${value}`,
        composer: (/** @type {string} */ value) => `\n该曲目的作者为 ${value}`,
        length: (/** @type {string} */ value) => `\n该曲目的时长为 ${value}`,
        illustrator: (/** @type {string} */ value) => `\n该曲目曲绘的作者为 ${value}`,
    },
}

/**
 * @description apps/guessGame/guessIll.js
 * @satisfies {messagesClass}
 */
export const guessIllMessages = {
    start: {
        alreadyStarted: { text: '请不要重复发起哦！' },
        noIllustration: { text: '当前曲库暂无有曲绘的曲目哦！更改曲库后需要重启哦！' },
        drawFailed: { text: '[phi guess]抽取曲目失败，请检查曲库设置' },
        intro: (/** @type {number} */ cd, /** @type {string|number} */ level, /** @type {string} */ interferences) => {
            const head = Config.getUserCfg('config', 'cmdhead'); return ({
                text: ([
                    `下面开始进行猜曲绘哦！回答可以直接发送哦！每过${cd}秒后将会给出进一步提示。`,
                    `发送 /${head} ans 结束游戏`,
                    `本局难度：${level}，当前干扰类型：${interferences || '无干扰'}`,
                ].join('\n'))
            });
        },
        recallHint: (/** @type {number} */ cd) => ({ text: `每过${cd}秒后将会给出进一步提示。` }),
    },
    guess: {
        correct: (/** @type {unknown} */ image) => ({ image, text: '恭喜你，答对啦喵！ヾ(≧▽≦*)o' }),
        wrongRaw: (/** @type {string} */ input) => ({ text: `不是 ${input} 哦喵！≧ ﹏ ≦` }),
        wrongSong: (/** @type {string|undefined} */ song) => ({ text: `不是 ${song} 哦喵！≧ ﹏ ≦` }),
    },
    tip: {
        image: (/** @type {unknown} */ image) => ({ image }),
        update: (/** @type {unknown} */ image, /** @type {string} */ text) => ({ image, text }),
    },
    timeout: {
        nobodyCorrect: (/** @type {unknown} */ image) => ({ image, text: '呜，怎么还没有人答对啊QAQ！只能说答案了喵……' }),
    },
    ans: {
        reveal: (/** @type {unknown} */ image) => ({ image, text: '好吧，下面开始公布答案。' }),
        image: (/** @type {unknown} */ image) => ({ image }),
    },
    mix: {
        running: { text: '当前有正在进行的游戏，请等待游戏结束再执行该指令' },
        shuffled: { text: '洗牌成功了www' },
    },
}

/**
 * @description apps/guessGame/guessLetter.js
 * @satisfies {wordsClass}
 */
export const guessLetterWords = {
    puzzle: {
        puzzleHeader: '开字母进行中：',
        allGuessedHeader: '所有曲目均已被猜出，答案如下：',
        range: (/** @type {string[]} */ list) => `曲库范围：${list.join('、')}\n`,
        songLine: (/** @type {number} */ index, /** @type {string} */ song) => `${index + 1}. ${song}`,
        guessedMark: ' ✅',
        winner: (/** @type {string} */ card) => ` @${card}`,
        clickTip: '\n*点击蓝色字体可以快速填写指令哦~',
        open: '开个字母',
        tip: '看看提示',
        answer: '公布答案',
        restart: '再来一局',
        guess: '猜个曲绘',
        tipGame: '提示猜歌',
    },
    guess: {
        openedList: (/** @type {string} */ letters) => `\n所有翻开的字母[ ${letters}]\n`,
    },
}

/**
 * @description apps/guessGame/guessLetter.js
 * @satisfies {messagesClass}
 */
export const guessLetterMessages = {
    start: {
        alreadyStarted: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`喂喂喂，已经有群友发起出字母猜歌啦，不要再重复发起了，赶快输入'/第X个XXXX'来猜曲名或者'/出X'来揭开字母吧！结束请发 /${head} ans 嗷！`) }); },
        tooFewSongs: { text: '曲库中曲目的数量小于开字母的条数哦！更改曲库后需要重启哦！' },
        drawFailed: { text: '抽取曲目失败，请检查曲库设置' },
        intro: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`开字母开启成功！回复'/nX. XXXX'命令猜歌，例如：/n1. Reimei;发送'/open X'来揭开字母(不区分大小写，不需要指令头)，如'/open A';发送'/${head} ans'结束并查看答案哦！`) }); },
    },
    puzzle: {
        image: (/** @type {unknown} */ image) => ({ image }),
        plain: (/** @type {string} */ text) => ({ text }),
        markdown: (/** @type {string} */ markdown) => ({ markdown }),
    },
    timeout: {
        nobodyCorrect: { text: '呜，怎么还没有人答对啊QAQ！只能说答案了喵……' },
    },
    reveal: {
        notRunning: () => {
            const head = Config.getUserCfg('config', 'cmdhead');
            return ({ text: (`现在还没有进行的开字母捏，赶快输入'/${head} ltr'开始新的一局吧！`) });
        },
        cooldown: (/** @type {number} */ seconds) => ({ text: `翻字符的全局冷却时间还有${seconds}s呐，先耐心等下哇QAQ` }),
        letterOpened: (/** @type {string} */ letter) => ({ text: `字符[ ${letter} ]已经被打开过了ww,不用需要再重复开啦！` }),
    },
    guess: {
        cooldown: (/** @type {number} */ seconds) => ({ text: `猜测的冷却时间还有${seconds}s呐，先耐心等下哇QAQ` }),
        invalidIndex: (/** @type {number} */ num) => ({ text: `没有第${num}个啦！看清楚再回答啊喂！￣へ￣` }),
        songNotFound: (/** @type {string} */ content) => ({ text: `没有找到[${content}]的曲目信息呐QAQ` }),
        alreadyGuessed: (/** @type {string} */ name) => ({ text: `曲目[${name}]已经猜过了，要不咱们换一个吧uwu` }),
        correct: (/** @type {number} */ index, /** @type {string|undefined} */ name) =>
            ({ text: `恭喜你ww，答对啦喵，第${index}首答案是[${name}]!ヾ(≧▽≦*)o ` }),
        wrongRaw: (/** @type {number} */ index, /** @type {string} */ content) => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`第${index}首不是[${content}]www，要不再想想捏？如果实在不会可以悄悄发个[/${head} tip]哦≧ ﹏ ≦`) }); },
        wrongSong: (/** @type {number} */ index, /** @type {string} */ name) => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`第${index}首不是[${name}]www，要不再想想捏？如果实在不会可以悄悄发个[/${head} tip]哦≧ ﹏ ≦`) }); },
    },
    ans: {
        notRunning: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`现在还没有进行的开字母捏，赶快输入'/${head} letter'开始新的一局吧！`) }); },
        reveal: { text: '好吧好吧，既然你执着要放弃，那就公布答案好啦。' },
    },
    getTip: {
        notRunning: () => {
            const head = Config.getUserCfg('config', 'cmdhead');
            return ({ text: (`现在还没有进行的开字母捏，赶快输入'/${head} letter'开始新的一局吧！`) });
        },
        cooldown: (/** @type {number} */ seconds) => ({ text: `使用提示的全局冷却时间还有${seconds}s呐，还请先耐心等下哇QAQ` }),
        noCandidates: { text: '当前没有可以继续翻开的字符，请结束本局后重新开始。' },
    },
    mix: {
        running: { text: '当前有正在进行的游戏，请等待游戏结束再执行该指令' },
        shuffled: { text: '洗牌成功了www' },
    },
}

/**
 * @description apps/guessGame/frib19.js
 * @satisfies {wordsClass}
 */
const frib19Words = {
    guess: {
        answerLine: (/** @type {string|undefined} */ song) => {
            const head = Config.getUserCfg('config', 'cmdhead');
            return `正确答案是：${song}！发送 /${head} fib 可以再来一局喵！\nTip: 可以指定难度与定级范围哦~ 例如 /${head} fib AT 15+`
        },
    },
}

/**
 * @description apps/guessGame/frib19.js
 * @satisfies {messagesClass}
 */
export const frib19Messages = {
    start: {
        alreadyStarted: () => { const head = Config.getUserCfg('config', 'cmdhead'); return ({ text: (`当前群还有未结束的弗一把哦！发送 /${head} ans 可以提前结束呐！`) }); },
        noSongs: (/** @type {string} */ levelText) => ({ text: `当前曲库没有符合「${levelText}」条件的曲目哦！换个难度或定数下限试试吧！` }),
        unknownError: { text: '获取曲目信息发生未知错误QAQ！' },
        intro: (/** @type {{levelText:string,initial:number,max:number,timeout:number,selfCd:number,groupCd:number}} */ data) => {
            const head = Config.getUserCfg('config', 'cmdhead')
            return ({
                text: [
                    `下面开始进行弗一把哦！本局按「${data.levelText}」谱面对比，定数与物量均以该难度为准嗷！`,
                    `直接发送曲名进行猜测，参与的人越多本局可猜次数越多（初始 ${data.initial} 次，最多 ${data.max} 次）；猜中或次数用尽后公布答案，连续 ${data.timeout} 秒没有有效猜测会自动结束呐！`,
                    `发送 /${head} ans 获取答案，回答冷却：个人 ${data.selfCd}s、群聊 ${data.groupCd}s。`,
                ].join('\n')
            })
        },
    },
    guess: {
        finalMessage: (/** @type {unknown} */ image, /** @type {string|undefined} */ song) => ({
            image,
            text: [
                '恭喜你，猜中啦喵！ヾ(≧▽≦*)o',
                frib19Words.guess.answerLine(song),
            ].join('\n'),
        }),
        image: (/** @type {unknown} */ image) => ({ image }),
        alreadyGuessed: (/** @type {string} */ name) => ({ text: `曲目[${name}]已经猜过啦，换一首试试吧uwu` }),
        cooldown: (/** @type {'self'|'group'|string} */ kind, /** @type {number} */ seconds) =>
            ({ text: `${kind === 'self' ? '你的' : '群里的'}回答冷却还有 ${seconds}s 呐，先耐心等下哇QAQ` }),
        answerLine: (/** @type {string|undefined} */ song) => ({ text: frib19Words.guess.answerLine(song) }),
        exhausted: (/** @type {unknown} */ image, /** @type {string|undefined} */ song) => ({ image, text: `很遗憾，猜测次数用完了喵！正确答案是：${song}` }),
    },
    ans: {
        reveal: (/** @type {unknown} */ image, /** @type {string|undefined} */ song) => ({ image, text: `好吧，下面开始公布答案。正确答案是：${song}` }),
    },
    timeout: {
        message: (/** @type {unknown} */ image, /** @type {number} */ seconds, /** @type {string|undefined} */ song) =>
            ({ image, text: `呜……${seconds}秒内没有新的有效猜测，这一局就到这里啦！正确答案是：${song}` }),
    },
}

/**
 * @description apps/grks.js
 */
export const grksMessages = {
    rankList: {
        unavailable: (/** @type {string} */ text) => ({ text, button: menus.grksHome() }),
        /** @param {botEvent} e @param {gameScoreRankingPage} page @returns {Promise<grksFinalMessage>} */
        async result(e, page) {
            const { averageHints, winRate } = await import('../game/gameScore/ranking.js')
            const { ANONYMOUS_PLAYER_PROFILE, resolveRankingProfiles } = await import('../game/gameScore/profile.js')
            page = await resolveRankingProfiles(page)
            /** @type {grksRankingView} */
            const view = {
                title: page.title,
                pageText: grksRankingWords.page(page),
                metricTitle: gameScoreMessages.kind[page.kind],
                rows: page.items.map((row, index) => ({
                    rank: (page.page - 1) * page.pageSize + index + 1,
                    name: row.profile?.name || ANONYMOUS_PLAYER_PROFILE.name,
                    avatar: row.profile?.avatar || ANONYMOUS_PLAYER_PROFILE.avatar,
                    me: row.userId === page.meId,
                    metric: grksRankingWords.metric(row, page.kind, averageHints(row), winRate(row)),
                    detail: grksRankingWords.detail(row, page.kind),
                })),
                emptyText: page.kind === 'accuracy' ? gameScoreMessages.empty.accuracy(page.minPlays)
                    : page.kind === 'winRate' ? gameScoreMessages.empty.winRate(page.minPlays) : gameScoreMessages.empty.score,
                footer: grksRankingWords.me(page),
            }
            const button = menus.grksRanking(page)
            const { default: logger } = await import('../../components/Logger.js')
            /** @type {unknown} */
            let image = null
            try {
                const { default: picmodle } = await import('./picmodle.js')
                image = await picmodle.grksRanking(e, view)
            } catch (error) {
                logger.warn('[phi-plugin][grks] 积分榜渲染失败，改为文字', error)
            }
            if (isUsableImage(image)) return { image, text: [page.title, view.pageText].join('\n'), button }
            if (typeof image === 'string') logger.warn(`[phi-plugin][grks] 积分榜渲染失败：${image}`)
            return { text: page.text, button }
        },
    },
    start: {
        matching: (/** @type {string} */ prefix) => ({ text: `你正在排队或参与匹配房间，先发送 ${prefix} cancel 退出再开单机吧！`, button: menus.grksQueue() }),
    },
    hint: {
        /** @param {string} prefix @param {grksMatchMenuOptions | 'queue'} [state] */
        format: (prefix, state) =>
            ({ text: `格式：${prefix} hint B7（等价于 hint 1 B7）／${prefix} hint 3 [histogram|range]／${prefix} hint 4`, button: grksMatchButtons(state) }),
    },
    guess: {
        /** @param {string} prefix @param {grksMatchMenuOptions | 'queue'} [state] */
        format: (prefix, state) => ({ text: `格式：${prefix} 15.25`, button: state ? grksMatchButtons(state) : menus.grksSolo() }),
    },
}

/**
 * @typedef {object} grksRankingRow
 * @property {number} rank 全榜名次
 * @property {string} name Phigros 玩家名称
 * @property {string} avatar 本地游戏头像文件名
 * @property {boolean} me 是否为查询者
 * @property {string} metric 主要排名数值
 * @property {string} detail 对局统计
 *
 * @typedef {object} grksRankingView
 * @property {string} title 榜单标题
 * @property {string} pageText 页码与人数
 * @property {string} metricTitle 排名指标
 * @property {grksRankingRow[]} rows 本页玩家
 * @property {string} emptyText 空榜提示
 * @property {string} footer 查询者排名
 */

export const grksRankingWords = {
    page: (/** @type {gameScoreRankingPage} */ page) => `第 ${page.page} / ${page.pages} 页 · 共 ${page.total} 位玩家`,
    /** @param {gameScoreRow} row @param {gameScoreRankKind} kind @param {number | null} average @param {number} rate @returns {string} */
    metric(row, kind, average, rate) {
        if (kind === 'accuracy') return `${average === null ? '--' : average.toFixed(2)} 条提示`
        if (kind === 'winRate') return `${(rate * 100).toFixed(1)}%`
        return `${row.score.toFixed(2)} 分`
    },
    /** @param {gameScoreRow} row @param {gameScoreRankKind} kind @returns {string} */
    detail(row, kind) {
        if (kind === 'winRate') return `${row.wins} 胜 · ${row.losses} 负 · ${row.draws} 平 · 积分 ${row.score.toFixed(2)}`
        if (kind === 'accuracy') return `${row.hintPlays} 局统计 · 积分 ${row.score.toFixed(2)}`
        return `${row.plays} 局 · 单局最高 ${row.best.toFixed(2)} 分`
    },
    me: (/** @type {gameScoreRankingPage} */ page) => page.meRank !== null
        ? `我的排名：#${page.meRank} · ${page.me?.profile?.name || '匿名用户'}` : '我的排名：未上榜',
}

/**
 * @typedef {object} grksFinalMessage
 * @property {string} text 完整消息文本
 * @property {buttonCommandObject[][]} button 当前可用指令
 * @property {MessageParts['image']} [image] 可用的渲染图片
 *
 * @typedef {object} grksViewMessageOptions
 * @property {grksKnownData} data 已公开的题目数据
 * @property {boolean} orderKnown 是否公开成绩位置
 * @property {number} hintCount 已使用提示条数
 * @property {string} prefix 命令前缀
 * @property {number | null} [answerRks] 结算答案
 * @property {boolean} [revealAll] 是否已结算
 * @property {'ans' | 'cancel'} [exitCommand] 退出指令
 * @property {grksGuessEntry[]} [history] 当前视角的猜测记录
 * @property {string} [playerId] 标题玩家标识
 *
 * @typedef {object} grksMatchQueueMessageOptions
 * @property {number} timeout 匹配池等待上限秒数
 *
 * @typedef {object} grksMatchMenuOptions
 * @property {'hint' | 'answer'} stage 当前阶段
 * @property {boolean} settled 是否结算
 * @property {boolean} hinted 本轮是否已选择提示
 * @property {boolean} guessed 本轮是否已回答
 * @property {boolean[]} knownRecords 已公开的自身成绩位置
 * @property {boolean} knownInfo 是否已公开自身统计与课题分
 * @property {'' | 'histogram' | 'range'} knownSheetType 已公开的自身统计图
 *
 * @typedef {object} grksMatchViewOptions
 * @property {string} id 房间编号
 * @property {'red' | 'blue'} team 当前玩家阵营
 * @property {string} opponent 对手名称
 * @property {number} turn 当前回合
 * @property {number} maxTurns 回合上限
 * @property {'hint' | 'answer'} stage 当前阶段
 * @property {boolean} settled 是否已结算
 * @property {string} notice 阶段通知
 * @property {boolean} hinted 本方是否选择提示
 * @property {boolean} guessed 本方是否回答
 * @property {boolean} opponentHinted 对方是否选择提示
 * @property {boolean} opponentGuessed 对方是否回答
 * @property {boolean} error 是否发生处理错误
 * @property {string[]} result 结算结果
 * @property {string} prefix 命令前缀
 * @property {number} seconds 阶段时限
 * @property {number} tolerance 答案容差
 *
 * @typedef {object} grksHintSummaryOptions
 * @property {'record' | 'info' | 'sheet'} type 提示类型
 * @property {number[]} indices 本次公开的成绩索引
 * @property {boolean} orderKnown 是否公开成绩位置
 * @property {'' | 'histogram' | 'range'} sheetKind 已公开的统计图
 * @property {boolean} orderRevealed 是否在本次公开成绩顺序
 *
 * @typedef {object} grksCorrectMessageOptions
 * @property {string} rks 正确答案
 * @property {string} guess 本次回答
 * @property {number} tolerance 容差
 * @property {string} points 本局积分
 * @property {number} hints 提示次数
 */

export const grksViewWords = {
    anonymous: '？？？',
    waitingHint: '等待提示',
    unanswered: '—',
    guessResult: {
        pending: '待回答', correct: '正确', wrong: '错误',
        timeout: '超时放弃', abandoned: '已放弃', empty: '未开始',
    },
    slotName: (/** @type {number} */ index) => index < 3 ? `P${index + 1}` : `B${index - 2}`,
    date: (/** @type {number | undefined} */ timestamp) => {
        const date = typeof timestamp === 'number' && Number.isFinite(timestamp) ? new Date(timestamp) : new Date()
        const pad = (/** @type {number} */ value) => String(value).padStart(2, '0')
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    },
    answerRks: (/** @type {number | null | undefined} */ value) =>
        typeof value === 'number' && Number.isFinite(value) ? value.toFixed(4) : '----',
    recordRks: (/** @type {number | null} */ value) => value === null ? '???' : value.toFixed(2),
    tickRks: (/** @type {number} */ value) => value.toFixed(2),
    /** @param {number | null | undefined} value @returns {string} */
    answer(value) {
        return value === null || value === undefined ? grksViewWords.unanswered : String(value)
    },
    /** @param {grksSoloView} view @param {grksViewMessageOptions} options @returns {string[]} */
    details(view, options) {
        const { data } = options
        const orderKnown = options.revealAll === true || options.orderKnown
        /** @type {string[]} */
        const lines = []
        if (data.records.length) {
            lines.push(orderKnown ? '已公开的成绩：' : '已公开的成绩（按单曲 rks 降序）：')
            data.records.forEach((record, index) => {
                if (!record) return
                const position = orderKnown ? grksViewWords.slotName(index) : ''
                const song = record.song || String(record.id)
                lines.push(`${position}${record.rank} ${record.difficulty.toFixed(1)} ${song} · ${record.score} · ${record.acc.toFixed(2)}%`)
            })
        } else {
            lines.push('暂无公开的成绩')
        }
        if (data.info) {
            lines.push('存档统计：')
            data.info.stats.forEach((row, index) => {
                lines.push(`${Level[index] || `难度${index + 1}`}：通关 ${row[0]} · FC ${row[1]} · φ ${row[2]}`)
            })
            lines.push(`课题分：${data.info.challenge}`)
        }
        if (view.sheet.kind === 'histogram') {
            const textBarWidth = 20
            lines.push('单曲等效 RKS 相对分布（不含数值刻度）：')
            for (const bar of view.sheet.bars) {
                const width = Math.max(1, Math.round(bar.height / 100 * textBarWidth))
                lines.push(`${bar.label} ${'|'.repeat(width)}`)
            }
        } else if (view.sheet.kind === 'range') {
            lines.push(`单曲等效 RKS 区间：${view.sheet.min.toFixed(2)} ~ ${view.sheet.max.toFixed(2)}`)
        }
        if (typeof options.answerRks === 'number' && Number.isFinite(options.answerRks)) {
            lines.push(`正确答案：${options.answerRks.toFixed(4)}`)
        }
        for (const entry of view.history) {
            if (entry.result === 'empty') continue
            lines.push(`第 ${entry.turn} 次 · 提示：${entry.hint} · 回答：${entry.answer} · ${entry.resultText}`)
        }
        lines.push(`已使用提示 ${options.hintCount} 条`)
        lines.push(`猜测：${options.prefix} <数值>　放弃：${options.prefix} ${options.exitCommand || 'ans'}`)
        return lines
    },
}

/** @param {grksMatchMenuOptions | 'queue'} [state] @returns {buttonCommandObject[][]} */
function grksMatchButtons(state) {
    return state === 'queue' ? menus.grksQueue() : state ? menus.grksMatch(state) : menus.grksHome()
}

/** @param {botEvent} e @param {grksViewMessageOptions} options @param {string} footnote @returns {Promise<Pick<grksFinalMessage, 'text' | 'image'>>} */
async function renderGrksView(e, options, footnote) {
    const { grksSoloRender } = await import('../../apps/grks/soloRender.js')
    const view = grksSoloRender.buildView({
        data: options.data, orderKnown: options.orderKnown, footnote,
        answerRks: options.answerRks, revealAll: options.revealAll, history: options.history,
    })
    if (options.playerId) view.header.playerId = options.playerId
    const { default: logger } = await import('../../components/Logger.js')
    /** @type {unknown} */
    let image = null
    try {
        const { default: picmodle } = await import('./picmodle.js')
        image = await picmodle.grks(e, view)
    } catch (error) {
        logger.warn('[phi-plugin][grks] 提示图渲染失败，改为文字')
        logger.warn(error)
    }
    if (isUsableImage(image)) return { image, text: footnote }
    if (typeof image === 'string') logger.warn(`[phi-plugin][grks] 提示图渲染失败，改为文字兜底：${image}`)
    return { text: [footnote, grksViewWords.details(view, options).join('\n')].filter(Boolean).join('\n\n') }
}

/**
 * @description apps/grks/match.js
 */
export const grksMatchMessages = {
    join: {
        incomplete: (/** @type {number} */ min) => ({ text: `匹配需要完整 P3 和 B27，且至少有 ${min} 条有效成绩，请更新存档后重试。`, button: menus.grksHome() }),
        /** @param {string} prefix @param {grksMatchMenuOptions | 'queue'} [state] */
        alreadyInMatch: (prefix, state) => ({ text: `你已在对局中，发送 ${prefix} cancel 可退出`, button: grksMatchButtons(state) }),
        noSession: () => ({ text: '无法识别当前会话，请稍后重试', button: menus.grksHome() }),
        soloGame: (/** @type {string} */ prefix) => ({ text: `当前会话还有进行中的单机对局，先发送 ${prefix} ans 结束再匹配吧！`, button: menus.grksSolo() }),
        /** @param {number} count @param {grksMatchQueueMessageOptions} rules @param {string} prefix */
        joined: (count, rules, prefix) =>
            ({ text: `正在匹配（当前排队 ${count} 人）\n优先选择匹配场次差最小的跨会话对手，再比较答题正确率差；正确率为答对次数 ÷ 已结算回答轮次，回答超时计错。无样本时不计算正确率差，同条件按等待先后配对。无差值门槛，入池等待 ${rules.timeout}s 后自动退出。\n匹配成功后通知双方进入提示回合；发送 ${prefix} cancel 可取消。`, button: menus.grksQueue() }),
        timedOut: (/** @type {number} */ seconds) => ({ text: `本次匹配等待已满 ${seconds}s，已自动退出匹配池，可重新开始单机或匹配。`, button: menus.grksHome() }),
    },
    hint: {
        wrongStage: (/** @type {grksMatchMenuOptions | 'queue'} */ state) => ({ text: '当前是回答回合，不能再选择提示。', button: grksMatchButtons(state) }),
        invalidHint: (/** @type {grksMatchMenuOptions | 'queue'} */ state) => ({ text: '提示参数不合法或已公开。可选 P1-P3、B1-B27；统计和课题信息各只能提示一次。', button: grksMatchButtons(state) }),
        noMatch: (/** @type {string} */ prefix) => ({ text: `当前没有匹配对局，发送 ${prefix} match 加入匹配池`, button: menus.grksHome() }),
        alreadyHinted: (/** @type {grksMatchMenuOptions | 'queue'} */ state) => ({ text: '本轮提示已锁定，等待双方选择完毕后统一公布。', button: grksMatchButtons(state) }),
    },
    guess: {
        wrongStage: (/** @type {grksMatchMenuOptions | 'queue'} */ state) => ({ text: '当前是提示回合，双方选择完毕并公布提示后才能作答。', button: grksMatchButtons(state) }),
        staleTurn: (/** @type {grksMatchMenuOptions | 'queue'} */ state) => ({ text: '提交时该回合或阶段已结束，请根据最新状态重新操作。', button: grksMatchButtons(state) }),
        ended: () => ({ text: '对局已结束', button: menus.grksHome() }),
        /** @param {string} prefix @param {grksMatchMenuOptions | 'queue'} state */
        invalidValue: (prefix, state) => ({ text: `请输入 0~99 的数值，例如：${prefix} 15.25`, button: grksMatchButtons(state) }),
        alreadyGuessed: (/** @type {grksMatchMenuOptions | 'queue'} */ state) => ({ text: '本回合已经提交过猜测了，等待本回合结算', button: grksMatchButtons(state) }),
    },
    cancel: {
        leftQueue: () => ({ text: '已退出匹配池', button: menus.grksHome() }),
    },
    /** @param {botEvent} e @param {grksViewMessageOptions} options @param {grksMatchViewOptions} data @param {grksMatchMenuOptions} state @returns {Promise<grksFinalMessage>} */
    async view(e, options, data, state) {
        const text = [
            grksMatchWords.room(data.id, data.team, data.opponent, data.turn, data.maxTurns),
            grksMatchWords.stage(data.stage, data.settled),
            data.settled ? '' : data.notice,
            grksMatchWords.progress(data.hinted, data.guessed, data.opponentHinted, data.opponentGuessed),
            data.error ? grksMatchWords.failed : data.result.join('\n'),
            grksMatchWords.commands(data.prefix, data.seconds, data.tolerance, data.maxTurns),
        ].filter(Boolean).join('\n')
        return { ...await renderGrksView(e, options, text), button: menus.grksMatch(state) }
    },
}

export const grksMatchWords = {
    started: '匹配成功，双方进入提示回合，请各选择一次提示。',
    hintsPublished: '双方提示已统一公布，进入回答回合，请各提交一次猜测。',
    nextRound: (/** @type {number} */ turn) => `第 ${turn} 轮双方均未猜中，进入下一轮提示回合。`,
    failed: '房间处理失败，已停止对局；积分可能未完整保存，请联系管理员查看日志。',
    answerTimeout: '回答阶段超时，未回答者视为放弃；双方均未回答则判平',
    correct: '本回合猜测已结算',
    hintLimit: '已完成 10 次提示及回答，双方均未猜中，判为平局',
    quit: (/** @type {string} */ name) => `${name} 主动退出，判负`,
    settlement: (/** @type {string} */ reason) => `猜 RKS 匹配结束：${reason}`,
    room: (/** @type {string} */ id, /** @type {'red'|'blue'} */ team, /** @type {string} */ opponent, /** @type {number} */ turn, /** @type {number} */ maxTurns) =>
        `房间 ${id} · 第 ${turn}/${maxTurns} 轮\n你是${team === 'red' ? '红方' : '蓝方'}，对手：${opponent}`,
    stage: (/** @type {'hint'|'answer'} */ stage, /** @type {boolean} */ settled) => settled ? '当前阶段：已结算'
        : stage === 'hint' ? '提示回合：双方各选择一次提示，选择完毕后统一公布。'
            : '回答回合：提示已公布，双方各作答一次，作答完毕后统一校验。',
    opponent: (/** @type {'red'|'blue'} */ team) => `${team === 'red' ? '红方视角 · 蓝方' : '蓝方视角 · 红方'} B30`,
    progress: (/** @type {boolean} */ hinted, /** @type {boolean} */ guessed, /** @type {boolean} */ opponentHinted, /** @type {boolean} */ opponentGuessed) =>
        `本方：${hinted ? '已选提示' : '未选提示'} / ${guessed ? '已提交猜测' : '未提交猜测'}\n对方：${opponentHinted ? '已选提示' : '未选提示'} / ${opponentGuessed ? '已提交猜测' : '未提交猜测'}`,
    commands: (/** @type {string} */ prefix, /** @type {number} */ seconds, /** @type {number} */ tolerance, /** @type {number} */ maxTurns) =>
        `每阶段 ${seconds}s，容差 ±${tolerance}。提示：${prefix} hint B7 / hint 3 range / hint 4\n猜测：${prefix} 15.25；退出判负：${prefix} cancel\n最多 ${maxTurns} 次提示，最后一次回答后仍无人猜中则平局。回答超时即放弃；阶段结束时向双方最新会话各发送一次消息。`,
    result: (/** @type {'red'|'blue'} */ team, /** @type {string} */ name, /** @type {'win'|'loss'|'draw'} */ result, /** @type {string} */ points, /** @type {string} */ answer) =>
        `${team === 'red' ? '红方' : '蓝方'} ${name}：${result === 'win' ? '胜' : result === 'loss' ? '负' : '平'}，${points} 分，自己的答案 ${answer}`,
}

/**
 * @description apps/grks/solo.js
 */
export const grksSoloWords = {
    opened: (/** @type {{cd: number, prefix: string, limit: number}} */ data) => [
        '猜 RKS 开始！房间内所有人都可以猜，猜错时系统会自动给出下一条提示。',
        `全房间共 ${data.limit} 次猜测机会，最后一次猜错立即判负。`,
        `猜测：${data.prefix} <数值>　放弃：${data.prefix} ans`,
        `回答冷却 ${data.cd}s（按玩家独立计算），提示冷却 ${data.cd}s（按房间计算）`,
    ].join('\n'),
    wrong: (/** @type {{hintGiven: boolean, hintWait: number, hintCount: number, cd: number, prefix: string}} */ data) => [
        '不是这个值',
        data.hintGiven ? `系统已给出第 ${data.hintCount} 条提示`
            : data.hintWait > 0 ? `提示冷却中，剩余 ${data.hintWait}s，本次未给出新提示` : '本局提示已全部公开',
        `回答冷却 ${data.cd}s 后可再次回答：${data.prefix} <数值>`,
    ].join('\n'),
    correct: (/** @type {grksCorrectMessageOptions} */ data) =>
        `猜对了！答案 ${data.rks}，你猜 ${data.guess}（容差 ±${data.tolerance}）\n本局得分：${data.points} 分（提示 ${data.hints} 条）`,
    answer: (/** @type {string} */ reason, /** @type {grksViewMessageOptions} */ options) =>
        `${reason}\n正确答案：${grksViewWords.answerRks(options.answerRks)}\n本局提示 ${options.hintCount} 条`,
    timeout: (/** @type {number} */ seconds) => `超过 ${seconds}s 没有新的回答，本局结束`,
    abandoned: '本局已放弃',
    failed: (/** @type {number} */ limit) => `${limit} 次猜测均未猜中，本局判负`,
}

/**
 * @description components/baseClass.js
 * @satisfies {messagesClass}
 */
export const baseClassMessages = {
    choseMutiNick: {
        notFound: { text: '未找到相关曲目信息QAQ！如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！' },
        inputNumber: { text: '请输入正确的序号哦！' },
        numberNotFound: (/** @type {number} */ num) => ({ text: `未找到${num}所对应的曲目哦！` }),
        list: (/** @type {string} */ nicks) => ({ text: nicks }),
    },
    getMicInfoFromMsg: {
        missingSong: { text: '请在命令后添加曲目名称或别名哦~' },
        notFound: (/** @type {string} */ msg) => ({ text: `未找到${msg}的相关曲目信息QAQ！如果想要提供别名的话请访问 /phihelp 中的别名投稿链接嗷！` }),
        infoMissing: (/** @type {string} */ id) => ({ text: `未找到${id}的曲目信息QAQ！请回报管理员！` }),
        noDifficulty: (/** @type {string} */ song, /** @type {unknown} */ rank) => ({ text: `${song} 没有 ${rank} 这个难度QAQ！` }),
    },
}

/**
 * @description model/user/getBanGroup.js
 * @satisfies {messagesClass}
 */
export const banGroupMessages = {
    bannedPrimary: { text: '当前账户被加入黑名单，详情请联系管理员(1)。' },
    bannedSecondary: { text: '当前账户被加入黑名单，详情请联系管理员(2)。' },
}

/**
 * @description model/save/getBackup.js
 * @satisfies {messagesClass}
 */
export const backupMessages = {
    tooManySaves: { text: '存档数量过多，请手动备份 /data/saveData/ 目录！' },
    startingSaves: { text: '开始备份存档，请稍等...' },
    tooManyPluginData: { text: '插件数据数量过多，请手动备份 /data/pluginData/ 目录！' },
    startingPluginData: { text: '开始备份插件数据，请稍等...' },
    startingTokens: { text: '开始备份user_token，请稍等...' },
    compressing: { text: '开始压缩备份数据，请稍等...' },
    themesAdded: (/** @type {number} */ count) => ({ text: `已加入 ${count} 个主题到备份` }),
    success: (/** @type {string} */ name) => ({ text: `${name} 成功备份到 ./backup 目录下` }),
}

/**
 * @description model/render/send.js
 * @satisfies {messagesClass}
 */
export const sendMessages = {
    needSessionToken: () => {
        const head = Config.getUserCfg('config', 'cmdhead');
        return {
            text: `请先绑定sessionToken哦！如果不知道自己的sessionToken可以尝试扫码绑定嗷！\n帮助：/${head} tk help\n获取二维码：/${head} bind qrcode\n普通绑定：/${head} bind <sessionToken>`,
            button: menus.bind()
        };
    },
    needUpdate: () => {
        const head = Config.getUserCfg('config', 'cmdhead');
        return {
            text: `请先更新数据哦！\n格式：/${head} update`,
            button: [[butCmd(`update`, '更新数据')]]
        };
    },
    forwardFailed: { text: '转发失败QAQ！请尝试在私聊触发命令！' },
}

/**
 * @description model/api/makeRequest.js
 * @satisfies {messagesClass}
 */
export const apiMessages = {
    forbidden: (/** @type {string} */ detail) => ({ text: `API访问被拒绝。${detail || '请检查你的设置是否正确启用了API访问权限。'}` }),
    serverError: (/** @type {string} */ detail) => ({ text: `API访问发生服务器错误。${detail || '请稍后再试，或联系管理员。'}` }),
    errorDetail: (/** @type {string} */ detail) => ({ text: `错误信息：${detail}` }),
}

/**
 * @description model/game/fCompute.js
 * @satisfies {messagesClass}
 */
export const fileMessages = {
    uploadError: (/** @type {unknown} */ stack) => ({ text: `文件上传错误：${stack}` }),
}


/**
 * @description apps/grks/grksClass.js
 * @satisfies {wordsClass}
 */
export const grksClassWords = {
    hint: {
        /** @param {grksHintSummaryOptions} data @returns {string} */
        summary(data) {
            let text
            if (data.type === 'record') {
                text = data.orderKnown
                    ? `公开 ${data.indices.map(grksViewWords.slotName).join(' / ')}`
                    : `公开随机成绩 ${data.indices.length} 条`
            } else if (data.type === 'info') {
                text = '存档统计与课题分'
            } else {
                text = data.sheetKind === 'histogram' ? '等效 RKS 直方图' : '等效 RKS 上下界'
            }
            return data.orderRevealed ? `${text}；公开成绩顺序` : text
        },
        append: (/** @type {string} */ previous, /** @type {string} */ hint) => `${previous}；${hint}`,
        noNew: '无新增提示',
        missingHistory: '猜测记录未创建',
    },
    hintRecord: {
        noUnKnown: '抽取未知的成绩失败',
    },
    getKnownData: {
        noAnswer: '没有已知的成绩',
    }
}


/**
 * @description apps/grks/solo.js
 */
export const grksSoloMessages = {
    start: {
        banned: () => ({ text: '这里被管理员禁止使用这个功能了呐QAQ！', button: menus.grksHome() }),
        existing: (/** @type {string} */ prefix) => ({ text: `当前会话已有进行中的猜 RKS，直接发送 ${prefix} <数值> 继续猜测吧！`, button: menus.grksSolo() }),
        noArchive: (/** @type {number} */ min) => ({ text: `暂无可出题的存档：需要本地存在有效成绩不少于 ${min} 条的绑定存档`, button: menus.grksHome() }),
        drawFailed: () => ({ text: '出题失败：存档的 B30 数据不完整，请稍后再试', button: menus.grksHome() }),
        /** @param {botEvent} e @param {grksViewMessageOptions} options @param {{cd: number, limit: number}} data @returns {Promise<grksFinalMessage>} */
        async opened(e, options, data) {
            const text = grksSoloWords.opened({ ...data, prefix: options.prefix })
            return { ...await renderGrksView(e, options, text), button: menus.grksSolo() }
        },
    },
    guess: {
        notRunning: (/** @type {string} */ prefix) => ({ text: `当前没有进行中的猜 RKS，发送 ${prefix} 开始一局吧！`, button: menus.grksHome() }),
        invalidValue: (/** @type {string} */ prefix) => ({ text: `请输入 0~99 的数值，例如：${prefix} 15.25`, button: menus.grksSolo() }),
        cooldown: (/** @type {number} */ seconds) => ({ text: `你的回答冷却中，请 ${seconds}s 后再试`, button: menus.grksSolo() }),
        /** @param {botEvent} e @param {grksViewMessageOptions} options @param {{hintGiven: boolean, hintWait: number, cd: number}} data @returns {Promise<grksFinalMessage>} */
        async wrong(e, options, data) {
            const text = grksSoloWords.wrong({ ...data, hintCount: options.hintCount, prefix: options.prefix })
            return { ...await renderGrksView(e, options, text), button: menus.grksSolo() }
        },
    },
    reveal: {
        /** @param {botEvent} e @param {grksViewMessageOptions} options @param {grksCorrectMessageOptions} data @returns {Promise<grksFinalMessage>} */
        async correct(e, options, data) {
            const text = [grksSoloWords.correct(data), grksSoloWords.answer('本局已结算', options)].join('\n')
            return { ...await renderGrksView(e, options, text), button: menus.grksHome() }
        },
        /** @param {botEvent} e @param {grksViewMessageOptions} options @param {number} seconds @returns {Promise<grksFinalMessage>} */
        async timeout(e, options, seconds) {
            const text = grksSoloWords.answer(grksSoloWords.timeout(seconds), options)
            return { ...await renderGrksView(e, options, text), button: menus.grksHome() }
        },
        /** @param {botEvent} e @param {grksViewMessageOptions} options @returns {Promise<grksFinalMessage>} */
        async abandoned(e, options) {
            const text = grksSoloWords.answer(grksSoloWords.abandoned, options)
            return { ...await renderGrksView(e, options, text), button: menus.grksHome() }
        },
        /** @param {botEvent} e @param {grksViewMessageOptions} options @param {number} limit @returns {Promise<grksFinalMessage>} */
        async failed(e, options, limit) {
            const text = grksSoloWords.answer(grksSoloWords.failed(limit), options)
            return { ...await renderGrksView(e, options, text), button: menus.grksHome() }
        },
    },
}

/** model/game/grks/hints.js */
export const grksHintWords = {
    exhausted: 'B30 成绩已全部公开，可继续猜测或放弃。',
    recordsHeader: '本次公开的成绩：',
    positionHidden: '（位置尚未公开）',
    recordLine: (/** @type {string} */ position, /** @type {string} */ rank, /** @type {string} */ difficulty, /** @type {string} */ song, /** @type {number} */ score, /** @type {string} */ acc) =>
        `${position}${rank} ${difficulty} ${song} · ${score} · ${acc}%`,
    range: (/** @type {string} */ min, /** @type {string} */ max) => `B30 单曲等效 rks 区间：${min} ~ ${max}`,
    histogramHeader: 'B30 等效 rks 分布：',
    histogramRange: (/** @type {string} */ min, /** @type {string} */ max, /** @type {string} */ average) =>
        `区间 ${min} ~ ${max}，平均 ${average}`,
    challenge: (/** @type {string} */ name, /** @type {string|number} */ level, /** @type {string|number} */ score) =>
        `课题模式：${name} ${level}（${score} 分）`,
    completionHeader: '谱面完成度：',
    statsLine: (/** @type {string} */ title, /** @type {number} */ cleared, /** @type {number} */ tot, /** @type {number} */ fc, /** @type {number} */ phi) =>
        `${title}：通关 ${cleared}/${tot} · FC ${fc} · φ ${phi}`,
    totalLine: (/** @type {number} */ cleared, /** @type {number} */ tot, /** @type {number} */ fc, /** @type {number} */ phi) =>
        `合计：通关 ${cleared}/${tot} · FC ${fc} · φ ${phi}`,
    revealed: (/** @type {number} */ count, /** @type {number} */ total) => `已公开 ${count}/${total} 个槽位`,
}

/** model/game/gameScore/index.js & ranking.js */
export const gameScoreMessages = {
    noBoard: '暂无可查询的游戏积分榜',
    kind: {
        accuracy: '准确率榜',
        winRate: '胜率榜',
        score: '积分榜',
    },
    title: (/** @type {string} */ gameName, /** @type {string} */ modeLabel, /** @type {string} */ kindLabel) =>
        `${gameName} · ${modeLabel} ${kindLabel}`,
    boardTitle: (/** @type {string} */ title, /** @type {number} */ total) => `🏆 ${title}（共 ${total} 人）`,
    page: (/** @type {number} */ page, /** @type {number} */ pages) => `第 ${page}/${pages} 页`,
    rankLine: (/** @type {number} */ rank, /** @type {string} */ description) => `#${rank} ${description}`,
    myRank: (/** @type {number} */ rank, /** @type {string} */ description) => `我的排名：#${rank} ${description}`,
    empty: {
        accuracy: (/** @type {number} */ threshold) => `暂无符合条件的玩家（至少完成 ${threshold} 局）`,
        winRate: (/** @type {number} */ threshold) => `暂无符合条件的玩家（至少 ${threshold} 场匹配对局）`,
        score: '暂无数据，快去玩一局吧！',
    },
    me: {
        accuracy: (/** @type {number} */ threshold) => `我的排名：未上榜（需要至少完成 ${threshold} 局）`,
        winRate: (/** @type {number} */ threshold) => `我的排名：未上榜（需要至少 ${threshold} 场匹配对局）`,
        score: '我的排名：暂无记录',
    },
    describe: {
        accuracy: (/** @type {string} */ name, /** @type {string} */ averageText, /** @type {number} */ plays, /** @type {string} */ score) =>
            `${name}　平均 ${averageText} 条提示　${plays} 局　积分 ${score}`,
        winRate: (/** @type {string} */ name, /** @type {string} */ rate, /** @type {number} */ wins, /** @type {number} */ losses, /** @type {number} */ draws, /** @type {number} */ total, /** @type {string} */ score) =>
            `${name}　胜率 ${rate}%　${wins}胜 ${losses}负 ${draws}平（${total} 场）　积分 ${score}`,
        score: (/** @type {string} */ name, /** @type {string} */ score, /** @type {number} */ plays, /** @type {string} */ best) =>
            `${name}　${score} 分　${plays} 局　最高 ${best}`,
    },
}



