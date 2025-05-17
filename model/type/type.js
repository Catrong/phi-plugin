/**
 * @typedef {string & { readonly brand: unique symbol }} idString 曲目id
 * @typedef {string & { readonly brand: unique symbol }} songString 曲目名称
 * @typedef {'EZ' | 'HD' | 'IN' | 'AT'} levelKind 有效难度分级
 * @typedef {'EZ' | 'HD' | 'IN' | 'AT' | 'LEGACY'} allLevelKind 全部难度分级
 * @typedef {'tap' | 'drag' | 'hold' | 'flick'} noteKind note分类
 */

/**
 * @typedef {Object} ori_record
 * @property {number} score
 * @property {number} acc
 * @property {number} fc
 */

/**
 * @typedef {'help'
 * | 'tkhelp'
 * | 'bind'
 * | 'unbind'
 * | 'b19'
 * | 'p30'
 * | 'arcgrosB19'
 * | 'update'
 * | 'info'
 * | 'list'
 * | 'singlescore'
 * | 'lvscore'
 * | 'chap'
 * | 'suggest'
 * | 'bestn'
 * | 'data'
 * | 'song'
 * | 'ill'
 * | 'chart'
 * | 'addtag'
 * | 'retag'
 * | 'search'
 * | 'alias'
 * | 'randmic'
 * | 'randClg'
 * | 'table'
 * | 'comment'
 * | 'recallComment'
 * | 'comrks'
 * | 'rankList'
 * | 'godList'
 * | 'tips'
 * | 'lmtAcc'
 * | 'newSong'
 * | 'tipgame'
 * | 'guessgame'
 * | 'ltrgame'
 * | 'sign'
 * | 'send'
 * | 'tasks'
 * | 'retask'
 * | 'jrrp'
 * | 'theme'
 * | 'dan'
 * | 'danupdate'} allFnc 全部指令
 */

/**
 * 渲染设置
 * @typedef {'onLinePhiIllUrl'} onLinePhiIllUrl 在线曲绘来源
 * @typedef {'renderScale'} renderScale 渲染精度
 * @typedef {'randerQuality'} randerQuality 渲染质量
 * @typedef {'timeout'} timeout 渲染超时时间
 * @typedef {'waitingTimeout'} waitingTimeout 等待超时时间
 * @typedef {'renderNum'} renderNum 并行渲染数量
 * @typedef {'B19MaxNum'} B19MaxNum B19最大限制
 * @typedef {'HistoryDayNum'} HistoryDayNum 历史成绩单日数量
 * @typedef {'HistoryScoreDate'} HistoryScoreDate 历史成绩展示天数
 * @typedef {'HistoryScoreNum'} HistoryScoreNum 历史成绩展示数量
 * @typedef {'listScoreMaxNum'} listScoreMaxNum /list 最大数量
 * 系统设置
 * @typedef {'watchInfoPath'} watchInfoPath 监听信息文件
 * @typedef {'allowComment'} allowComment 曲目评论
 * @typedef {'allowChartTag'} allowChartTag 曲目标签
 * @typedef {'autoPullPhiIll'} autoPullPhiIll 自动更新曲绘
 * @typedef {'isGuild'} isGuild 频道模式
 * @typedef {'TapTapLoginQRcode'} TapTapLoginQRcode 绑定二维码
 * @typedef {'WordB19Img'} WordB19Img 文字版B19曲绘图片
 * @typedef {'WordSuggImg'} WordSuggImg Suggest曲绘图片
 * @typedef {'cmdhead'} cmdhead 命令头
 * @typedef {'phigrousUpdateUrl'} phigrousUpdateUrl Phigrous更新日志API
 * @typedef {'otherinfo'} otherinfo 曲库
 * 猜曲绘设置
 * @typedef {'GuessTipCd'} GuessTipCd 提示间隔
 * @typedef {'GuessTipRecall'} GuessTipRecall 猜曲绘撤回
 * 开字母设置
 * @typedef {'LetterNum'} LetterNum 字母条数
 * @typedef {'LetterIllustration'} LetterIllustration 发送曲绘
 * @typedef {'LetterRevealCd'} LetterRevealCd 字母提示间隔
 * @typedef {'LetterGuessCd'} LetterGuessCd 字母开启间隔
 * @typedef {'LetterTipCd'} LetterTipCd 字母提示间隔
 * @typedef {'LetterTimeLength'} LetterTimeLength 猜字母最长时长
 * 提示猜歌设置
 * @typedef {'GuessTipsTipCD'} GuessTipsTipCD 提示冷却
 * @typedef {'GuessTipsTipNum'} GuessTipsTipNum 提示条数
 * @typedef {'GuessTipsTimeout'} GuessTipsTimeout 游戏时长
 * @typedef {'GuessTipsAnsTime'} GuessTipsAnsTime 额外时间
 * 其他设置
 * @typedef {'VikaToken'} VikaToken VikaToken
 * 
 * @typedef {onLinePhiIllUrl
 * |renderScale
 * |randerQuality
 * |timeout
 * |waitingTimeout
 * |renderNum
 * |B19MaxNum
 * |HistoryDayNum
 * |HistoryScoreDate
 * |HistoryScoreNum
 * |listScoreMaxNum
 * |watchInfoPath
 * |allowComment
 * |allowChartTag
 * |autoPullPhiIll
 * |isGuild
 * |TapTapLoginQRcode
 * |WordB19Img
 * |WordSuggImg
 * |cmdhead
 * |phigrousUpdateUrl
 * |otherinfo
 * |GuessTipCd
 * |GuessTipRecall
 * |LetterNum
 * |LetterIllustration
 * |LetterRevealCd
 * |LetterGuessCd
 * |LetterTipCd
 * |LetterTimeLength
 * |GuessTipsTipCD
 * |GuessTipsTipNum
 * |GuessTipsTimeout
 * |GuessTipsAnsTime
 * |VikaToken
* } configName 全部设置
*/


/**
 * @typedef {object} ori_record
 * @property {number} score
 * @property {number} acc
 * @property {number} fc
 */

/**
 * @typedef {object} gameFile
 * @property {string} __type
 * @property {string} bucket
 * @property {string} createdAt
 * @property {string} key
 * @property {object} metaData
 * @property {string} mime_type
 * @property {string} name
 * @property {string} objectId
 * @property {string} provider
 * @property {string} updatedAt
 * @property {string} url
 * 
 * @typedef {object} modifiedAt
 * @property {string} __type
 * @property {string} iso
 * 
 * @typedef {object} summary
 * @property {string} updatedAt
 * @property {number} saveVersion
 * @property {number} challengeModeRank
 * @property {number} rankingScore
 * @property {number} gameVersion
 * @property {string} avatar
 * @property {number[]} cleared
 * @property {number[]} fullCombo
 * @property {number[]} phi
 * 
 * @typedef {object} saveInfo
 * @property {string} createdAt
 * @property {gameFile} gameFile
 * @property {modifiedAt} modifiedAt
 * @property {string} name
 * @property {string} objectId
 * @property {summary} summary
 * @property {{ '*': object }} ACL
 * @property {{ 'taptap': object }} authData
 * @property {string} avatar
 * @property {boolean} emailVerified
 * @property {boolean} mobilePhoneVerified
 * @property {string} nickname
 * @property {phigrosToken} sessionToken
 * @property {string} shortId
 * @property {string} username
 * @property {string} updatedAt
 * @property {{'__type': "Pointer", 'className': "_User", 'objectId': string}} user
 * @property {string} PlayerId
 * 
 * @typedef {object} gameProgress
 * @property {boolean} isFirstRun
 * @property {boolean} legacyChapterFinished
 * @property {boolean} alreadyShowCollectionTip
 * @property {boolean} alreadyShowAutoUnlockINTip
 * @property {string} completed
 * @property {number} songUpdateInfo
 * @property {number} challengeModeRank
 * @property {number[]} money
 * @property {number} unlockFlagOfSpasmodic
 * @property {number} unlockFlagOfIgallta
 * @property {number} unlockFlagOfRrharil
 * @property {number} flagOfSongRecordKey
 * @property {number} randomVersionUnlocked
 * @property {boolean} chapter8UnlockBegin
 * @property {boolean} chapter8UnlockSecondPhase
 * @property {boolean} chapter8Passed
 * @property {number} chapter8SongUnlocked
 * 
 * @typedef {object} gameuser
 * @property {string} name
 * @property {string} version
 * @property {boolean} showPlayerId
 * @property {string} selfIntro
 * @property {string} avatar
 * @property {string} background
 * @property {string} CLGMOD
 * 
 * @typedef {{[id:idString]: ori_record[]}} gameRecord
 * 
 * @typedef {object} oriSave
 * @property {phigrosToken} session
 * @property {saveInfo} saveInfo
 * @property {string} saveUrl
 * @property {number} Recordver
 * @property {gameProgress} gameProgress
 * @property {gameuser} gameuser
 * @property {gameRecord} gameRecord
 */