import assert from 'node:assert/strict'
import test from 'node:test'
import Config from '../components/Config.js'
import send from '../model/render/send.js'
import platform from '../components/platform/index.js'
import getQRcode from '../lib/getQRcode.js'
import { b19Messages, menus, sessionMessages } from '../model/render/messages.js'
import {
    DEFAULT_MESSAGE_ORDER,
    buildQuickCommandKeyboard,
    buildQuickCommandMarkdown,
    buildQuickCommandSectionsMarkdown,
    composeMessage,
    getShortcutMode,
    mdCmd,
    sendMessage,
} from '../model/render/message.js'

test('Markdown 快捷指令保留完整命令且仅填入输入框，标签不做转义', () => {
    const command = '/phi 搜索 空格 &reply=true#片段 "引号" [方括号](圆括号)!*\n下一行'
    const markdown = mdCmd(command, '执行 [指令](名称) | <标签>\n下一行')
    assert.ok(markdown.startsWith('[执行 [指令](名称) | <标签>\n下一行]('))
    const match = markdown.match(/\]\((mqqapi:\/\/aio\/inlinecmd\?[^\s()]+)\)$/)
    assert.ok(match)
    const link = new URL(match[1])
    assert.equal(link.searchParams.get('command'), command)
    assert.equal(link.searchParams.get('enter'), 'false')
    assert.equal(link.searchParams.get('reply'), 'false')
    assert.equal([...link.searchParams].length, 3)
    assert.equal(link.hash, '')
})

test('用户设置页快捷指令：每段带标题，已选项的序号换成 ✅', () => {
    const originalGetUserCfg = Config.getUserCfg
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'cmdhead' ? 'p' : undefined)
    try {
        const markdown = buildQuickCommandSectionsMarkdown(menus.userSettingSections({
            theme: 'snow',
            b30AvgKind: 'top',
            b30AvgColor: 'gold',
            allowApiUsage: false,
            showB30Analysis: true,
        }))
        const lines = markdown.split('\n')
        assert.deepEqual(
            lines.filter(line => line && !line.startsWith('[')),
            ['主题风格', 'B30统计数据展示', 'B30均值条配色', 'API功能开关', 'B30统计分析'],
        )
        const themeLine = lines.find(line => line.includes('[✅寒冬]'))
        assert.ok(themeLine)
        assert.ok(themeLine.includes('[[0]默认]'))
        assert.ok(!themeLine.includes('[[1]寒冬]'))
        assert.ok(themeLine.includes('command=%2Fp%20myset%20theme%201'))
        assert.equal((markdown.match(/✅/g) || []).length, 5)

        const unselected = buildQuickCommandSectionsMarkdown(menus.userSettingSections({ theme: 'milthm' }))
        assert.ok(!unselected.includes('✅'))
        assert.ok(unselected.startsWith('主题风格\n'))
    } finally {
        Config.getUserCfg = originalGetUserCfg
    }
})

test('单曲成绩页的快捷按钮与 /song 图鉴一致：AT/IN 一行、HD/EZ 一行', () => {
    const originalGetUserCfg = Config.getUserCfg
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'cmdhead' ? 'p' : undefined)
    try {
        /** @type {any} */
        const chart = { id: 'Credits.Frums.0', ranks: ['EZ', 'HD', 'IN', 'AT'] }
        const parts = b19Messages.getScore.finalMessage({ image: 'score-image' }, chart)
        assert.equal(parts.image, 'score-image')
        assert.deepEqual(
            (parts.button || []).map(row => row.map(item => [item.label, item.command])),
            [
                [['AT', '/p chart Credits.Frums.0 AT'], ['IN', '/p chart Credits.Frums.0 IN']],
                [['HD', '/p chart Credits.Frums.0 HD'], ['EZ', '/p chart Credits.Frums.0 EZ']],
            ],
        )
    } finally {
        Config.getUserCfg = originalGetUserCfg
    }
})

test('composeMessage 默认按图片、文本、Markdown、按钮顺序组装', () => {
    const image = { type: 'image', data: 'image' }
    const text = '普通消息'
    const markdown = { type: 'markdown', text: 'Markdown 消息' }
    assert.deepEqual(DEFAULT_MESSAGE_ORDER, ['image', 'text', 'markdown', 'button'])
    assert.deepEqual(composeMessage({ image, text, markdown }), [image, '\n' + text, { ...markdown, text: '\n' + markdown.text }])
    assert.deepEqual(composeMessage({ markdown, text, image }), [image, '\n' + text, { ...markdown, text: '\n' + markdown.text }])
})

test('composeMessage 支持自定义组装顺序与空元素过滤', () => {
    assert.deepEqual(
        composeMessage({ image: 'image', text: 'text', markdown: 'md' }, ['markdown', 'text', 'image']),
        ['md', '\ntext\n', 'image'],
    )
    assert.deepEqual(composeMessage({ image: false, text: '', markdown: null }), [])
})

test('sendMessage 把同一处的普通消息和 Markdown 合并成一条发送', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    const originalWithAt = send.send_with_At
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown')
    send.reply = send.send_with_At = async (_event, message) => { replies.push(message); return {} }
    try {
        const event = { bot: { adapter: 'qqbot' }, user_id: 'test-user' }
        await sendMessage(event, {
            text: '普通消息',
            markdown: 'Markdown 消息',
        })
        assert.equal(replies.length, 1)
        assert.ok(Array.isArray(replies[0]))
        assert.equal(replies[0][0], '普通消息')
        assert.equal(replies[0][1]?.type, 'markdown')
        assert.match(String(replies[0][1]?.text ?? replies[0][1]?.content), /^\n+Markdown 消息$/)
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
        send.send_with_At = originalWithAt
    }
})

test('Markdown 与按钮消息不引用，改为开头 @ 用户', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalWithAt = send.send_with_At
    /** @type {{quote: boolean | undefined, message: any}[]} */ const sent = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown' ? 'markdown' : undefined)
    send.send_with_At = async (_event, message, quote) => { sent.push({ quote, message }); return {} }
    try {
        await sendMessage(
            { bot: { adapter: 'qqbot' }, user_id: 'test-user', isGroup: true },
            { markdown: 'Markdown 消息' },
            { quote: true },
        )
        assert.equal(sent.length, 1)
        assert.equal(sent[0].quote, false)
        assert.equal(String(sent[0].message?.text ?? sent[0].message?.content), 'Markdown 消息')
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.send_with_At = originalWithAt
    }
})

test('频道私聊自动关闭 Markdown 与按钮，纯文本消息照常发送', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    const originalWithAt = send.send_with_At
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown' ? 'button' : undefined)
    send.reply = send.send_with_At = async (_event, message) => { replies.push(message); return {} }
    try {
        const guildDirect = { bot: { adapter: 'qqbot' }, user_id: 'qg_abc', isGroup: false }
        assert.equal(getShortcutMode(guildDirect), 'off')
        await sendMessage(guildDirect, { markdown: 'Markdown 消息' })
        assert.equal(replies.length, 0)

        await sendMessage(guildDirect, { text: '普通消息' })
        assert.deepEqual(replies, ['普通消息'])

        const group = { bot: { adapter: 'qqbot' }, user_id: 'qg_abc', group_id: 'qg_1-2', isGroup: true }
        assert.equal(getShortcutMode(group), 'button')
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
        send.send_with_At = originalWithAt
    }
})

test('sendMessage 只有一个元素时保持单条消息形态', async () => {
    const originalReply = send.reply
    /** @type {any[]} */ const replies = []
    send.reply = async (_event, message) => { replies.push(message); return {} }
    try {
        await sendMessage({ platform: 'yunzai' }, { text: '只有文本' })
        assert.deepEqual(replies, ['只有文本'])
    } finally {
        send.reply = originalReply
    }
})

test('扫码绑定以图片元素发送 PNG 二维码，并保留提示和撤回时间', async t => {
    const png = await getQRcode.getQRcode('https://example.com/qrcode-regression')
    assert.ok(Buffer.isBuffer(png))
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    const reply = t.mock.method(send, 'send_with_At', async () => true)
    const message = sessionMessages.bind.qrcodeImageHint(png, 120)
    assert.equal(Buffer.isBuffer(message.image), false)
    assert.equal(message.image.type, 'image')
    assert.deepEqual(message.image, platform.segment.image(png))
    await sendMessage({ user_id: 'qrcode-test' }, message, { at: true, recallMsg: 60 })
    assert.equal(reply.mock.callCount(), 1)
    const [, payload, quote, data] = reply.mock.calls[0].arguments
    assert.deepEqual(payload, [message.image, '\n' + message.text])
    assert.match(message.text, /二维码剩余时间:120/)
    assert.equal(quote, false)
    assert.deepEqual(data, { recallMsg: 60 })
})

test('sendMessage 默认只在 QQ 官方机器人发送 Markdown，可显式关闭该限制', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    const originalWithAt = send.send_with_At
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown')
    send.reply = send.send_with_At = async (_event, message) => { replies.push(message); return {} }
    try {
        await sendMessage({ platform: 'yunzai' }, { markdown: 'unused' })
        assert.equal(replies.length, 0)
        await sendMessage(
            { platform: 'yunzai' },
            { markdown: '市场快捷操作' },
            { requireOfficialBot: false },
        )
        assert.equal(replies.length, 1)
        assert.equal(String(replies[0]?.text ?? replies[0]?.content), '市场快捷操作')
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
        send.send_with_At = originalWithAt
    }
})

test('sendMessage 支持通过 compose 接管组装', async () => {
    const originalReply = send.reply
    /** @type {any[]} */ const replies = []
    send.reply = async (_event, message) => { replies.push(message); return {} }
    try {
        await sendMessage({ platform: 'yunzai' }, { image: 'image', text: 'text' }, {
            compose: (/** @type {any} */ parts) => [{ merged: parts }],
        })
        assert.deepEqual(replies, [{ merged: { image: 'image', text: 'text' } }])
    } finally {
        send.reply = originalReply
    }
})

test('默认设置下图片与文本/Markdown 分开发送：先图片，后文本与 Markdown', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    const originalWithAt = send.send_with_At
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => {
        if (key === 'LetterMarkdown') return true
        if (key === 'MergeImageWithText') return false
        return undefined
    })
    send.reply = send.send_with_At = async (_event, message) => { replies.push(message); return {} }
    try {
        await sendMessage(
            { bot: { adapter: 'qqbot' } },
            { image: 'image', text: '普通消息', markdown: 'Markdown 消息' },
        )
        assert.equal(replies.length, 2)
        assert.equal(replies[0], 'image')
        assert.ok(Array.isArray(replies[1]))
        assert.equal(replies[1][0], '普通消息')
        assert.match(String(replies[1][1]?.text ?? replies[1][1]?.content), /^\n+Markdown 消息$/)
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
        send.send_with_At = originalWithAt
    }
})

test('开启图文合并后图片、文本和 Markdown 合并为一条', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    const originalWithAt = send.send_with_At
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => {
        if (key === 'LetterMarkdown') return true
        if (key === 'MergeImageWithText') return true
        return undefined
    })
    send.reply = send.send_with_At = async (_event, message) => { replies.push(message); return {} }
    try {
        await sendMessage(
            { bot: { adapter: 'qqbot' } },
            { image: 'image', text: '普通消息', markdown: 'Markdown 消息' },
        )
        assert.equal(replies.length, 1)
        assert.ok(Array.isArray(replies[0]))
        assert.equal(replies[0][0], 'image')
        assert.equal(replies[0][1], '\n普通消息')
        assert.match(String(replies[0][2]?.text ?? replies[0][2]?.content), /^\n+Markdown 消息$/)
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
        send.send_with_At = originalWithAt
    }
})

test('图文合并关闭时图片与纯文本仍合并为一条', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => {
        if (key === 'MergeImageWithText') return false
        return undefined
    })
    send.reply = async (_event, message) => { replies.push(message); return {} }
    try {
        await sendMessage({ platform: 'yunzai' }, { image: 'image', text: '普通消息' })
        assert.equal(replies.length, 1)
        assert.deepEqual(replies[0], ['image', '\n普通消息'])
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
    }
})

test('快捷操作模式为 markdown 时把 button 列表渲染为指令行而非表格', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    const originalWithAt = send.send_with_At
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown' ? 'markdown' : undefined)
    send.reply = send.send_with_At = async (_event, message, _quote, data) => { replies.push({ message, data }); return {} }
    try {
        await sendMessage({ bot: { adapter: 'qqbot' }, user_id: 'test-user' }, {
            button: [[{ button: { command: '/p b30', label: 'B30' } }, { button: { command: '/p p30', label: 'P30' } }]],
        })
        assert.equal(replies.length, 1)
        const markdown = replies[0].message
        assert.equal(markdown?.type, 'markdown')
        const content = String(markdown?.text ?? markdown?.content)
        assert.equal(content.trimEnd(), '[B30](mqqapi://aio/inlinecmd?command=%2Fp%20b30&enter=false&reply=false) | [P30](mqqapi://aio/inlinecmd?command=%2Fp%20p30&enter=false&reply=false)')
        // 附带键盘时正文尾部补一个换行，与键盘留出间距
        assert.ok(content.endsWith('\n'))
        const action = replies[0].data?.keyboard?.content?.rows?.[0]?.buttons?.[0]?.action
        assert.equal(action?.type, 2)
        assert.equal(action?.data, '/p b30')
        assert.equal(action?.enter, false)
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
        send.send_with_At = originalWithAt
    }
})

test('快捷操作模式为 button 时发送按钮行而不是 Markdown 表格', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    const originalWithAt = send.send_with_At
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown' ? 'button' : undefined)
    send.reply = send.send_with_At = async (_event, message, _quote, data) => { replies.push({ message, data }); return {} }
    try {
        await sendMessage({ bot: { adapter: 'qqbot' }, user_id: 'test-user' }, {
            button: [[{ button: { command: '/p b30', label: 'B30' } }]],
        })
        assert.equal(replies.length, 1)
        const payload = replies[0].message
        const button = Array.isArray(payload) ? payload.find(item => item?.type === 'button') : payload
        assert.ok(button)
        const rows = button.rows || button.content || []
        const first = Array.isArray(rows[0]) ? rows[0][0] : rows[0]
        assert.equal(first?.text, 'B30')
        assert.equal(first?.input, '/p b30')
        assert.equal(first?.send, false)
        assert.equal(replies[0].data?.keyboard, undefined)
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
        send.send_with_At = originalWithAt
    }
})

test('快捷操作模式为 off 时不发送快捷操作', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown' ? 'off' : undefined)
    send.reply = async (_event, message, _quote, data) => { replies.push({ message, data }); return {} }
    try {
        await sendMessage({ bot: { adapter: 'qqbot' }, user_id: 'test-user' }, {
            button: [[{ button: { command: '/p b30', label: 'B30' } }]],
        })
        assert.equal(replies.length, 0)
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
    }
})

test('按钮消息不可用时自动降级为 Markdown 列表', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    const originalWithAt = send.send_with_At
    const originalHasButtonSegment = platform.hasButtonSegment
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown' ? 'button' : undefined)
    platform.hasButtonSegment = () => false
    send.reply = send.send_with_At = async (_event, message, _quote, data) => { replies.push({ message, data }); return {} }
    try {
        await sendMessage({ bot: { adapter: 'qqbot' }, user_id: 'test-user' }, {
            button: [[{ button: { command: '/p b30', label: 'B30' } }]],
        })
        assert.equal(replies.length, 1)
        const markdown = replies[0].message
        assert.equal(markdown?.type, 'markdown')
        assert.ok((markdown?.text ?? markdown?.content).includes('[B30](mqqapi://aio/inlinecmd?command=%2Fp%20b30&enter=false&reply=false)'))
    } finally {
        Config.getUserCfg = originalGetUserCfg
        platform.hasButtonSegment = originalHasButtonSegment
        send.reply = originalReply
        send.send_with_At = originalWithAt
    }
})

test('md 按钮行只在数组结束后换行，不再按 3 个一行折行', () => {
    const button = (/** @type {string} */ label) => ({ button: { command: `/${label}`, label } })
    const markdown = buildQuickCommandMarkdown([
        [button('R1'), button('R2'), button('R3'), button('R4')],
        [button('R5')],
    ])
    const rows = markdown.split('\n')
    assert.equal(rows.length, 2)
    assert.match(rows[0], /R1.*\|.*R2.*\|.*R3.*\|.*R4/)
    assert.match(rows[1], /R5/)
    assert.ok(!markdown.includes('| :---: |'))
})

test('按钮构建保留 style 字段', () => {
    const keyboard = buildQuickCommandKeyboard([[{ command: '/p b30', label: 'B30', style: 3 }]])
    assert.equal(keyboard?.content?.rows?.[0]?.buttons?.[0]?.render_data?.style, 3)
})

test('混合类型边界换行且不修改原始消息', () => {
    const image = { type: 'image', file: 'image.png' }
    const markdown = { type: 'markdown', content: '菜单' }
    const button = { type: 'button' }
    assert.deepEqual(composeMessage({ image, text: '说明', markdown, button }), [image, '\n说明', { ...markdown, content: '\n菜单\n' }, button])
    assert.deepEqual(markdown, { type: 'markdown', content: '菜单' })
    assert.deepEqual(composeMessage({ markdown, button }), [{ ...markdown, content: '菜单\n' }, button])
    assert.deepEqual(composeMessage({ image, button }), [image, '\n', button])
    assert.deepEqual(composeMessage({ image: [image, image], text: ['\n说明', '补充'] }), [image, image, '\n说明', '补充'])
    assert.deepEqual(composeMessage({ text: '说明\n', markdown }), ['说明\n', markdown])
    assert.deepEqual(composeMessage({ image: [null, false], text: '说明' }), ['说明'])
})
