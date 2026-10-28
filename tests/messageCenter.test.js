import assert from 'node:assert/strict'
import test from 'node:test'
import Config from '../components/Config.js'
import send from '../model/render/send.js'
import platform from '../components/platform/index.js'
import getQRcode from '../lib/getQRcode.js'
import { sessionMessages } from '../model/render/messages.js'
import {
    DEFAULT_MESSAGE_ORDER,
    buildQuickCommandKeyboard,
    buildQuickCommandMarkdown,
    composeMessage,
    mdCmd,
    sendMessage,
} from '../model/render/message.js'

test('Markdown 快捷指令保留完整命令且仅填入输入框', () => {
    const command = '/phi 搜索 空格 &reply=true#片段 "引号" [方括号](圆括号)!*\n下一行'
    const markdown = mdCmd(command, '执行 [指令](名称) | <标签>\n下一行')
    assert.ok(markdown.startsWith('[执行 \\[指令\\](名称) \\| &lt;标签&gt; 下一行]('))
    const match = markdown.match(/\]\((mqqapi:\/\/aio\/inlinecmd\?[^\s()]+)\)$/)
    assert.ok(match)
    const link = new URL(match[1])
    assert.equal(link.searchParams.get('command'), command)
    assert.equal(link.searchParams.get('enter'), 'false')
    assert.equal(link.searchParams.get('reply'), 'false')
    assert.equal([...link.searchParams].length, 3)
    assert.equal(link.hash, '')
})

test('composeMessage 默认按图片、文本、Markdown、按钮顺序组装', () => {
    const image = { type: 'image', data: 'image' }
    const text = '普通消息'
    const markdown = { type: 'markdown', text: 'Markdown 消息' }
    assert.deepEqual(DEFAULT_MESSAGE_ORDER, ['image', 'text', 'markdown', 'button'])
    assert.deepEqual(composeMessage({ image, text, markdown }), [image, text, markdown])
    assert.deepEqual(composeMessage({ markdown, text, image }), [image, text, markdown])
})

test('composeMessage 支持自定义组装顺序与空元素过滤', () => {
    assert.deepEqual(
        composeMessage({ image: 'image', text: 'text', markdown: 'md' }, ['markdown', 'text', 'image']),
        ['md', 'text', 'image'],
    )
    assert.deepEqual(composeMessage({ image: false, text: '', markdown: null }), [])
})

test('sendMessage 把同一处的普通消息和 Markdown 合并成一条发送', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown')
    send.reply = async (_event, message) => { replies.push(message); return {} }
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
        assert.equal(replies[0][1]?.text ?? replies[0][1]?.content, 'Markdown 消息')
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
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
    assert.deepEqual(payload, [message.image, message.text])
    assert.match(message.text, /二维码剩余时间:120/)
    assert.equal(quote, false)
    assert.deepEqual(data, { recallMsg: 60 })
})

test('sendMessage 默认只在 QQ 官方机器人发送 Markdown，可显式关闭该限制', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown')
    send.reply = async (_event, message) => { replies.push(message); return {} }
    try {
        await sendMessage({ platform: 'yunzai' }, { markdown: 'unused' })
        assert.equal(replies.length, 0)
        await sendMessage(
            { platform: 'yunzai' },
            { markdown: '市场快捷操作' },
            { requireOfficialBot: false },
        )
        assert.equal(replies.length, 1)
        assert.equal(replies[0]?.text ?? replies[0]?.content, '市场快捷操作')
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
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
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => {
        if (key === 'LetterMarkdown') return true
        if (key === 'MergeImageWithText') return false
        return undefined
    })
    send.reply = async (_event, message) => { replies.push(message); return {} }
    try {
        await sendMessage(
            { bot: { adapter: 'qqbot' } },
            { image: 'image', text: '普通消息', markdown: 'Markdown 消息' },
        )
        assert.equal(replies.length, 2)
        assert.equal(replies[0], 'image')
        assert.ok(Array.isArray(replies[1]))
        assert.equal(replies[1][0], '普通消息')
        assert.equal(replies[1][1]?.text ?? replies[1][1]?.content, 'Markdown 消息')
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
    }
})

test('开启图文合并后图片、文本和 Markdown 合并为一条', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => {
        if (key === 'LetterMarkdown') return true
        if (key === 'MergeImageWithText') return true
        return undefined
    })
    send.reply = async (_event, message) => { replies.push(message); return {} }
    try {
        await sendMessage(
            { bot: { adapter: 'qqbot' } },
            { image: 'image', text: '普通消息', markdown: 'Markdown 消息' },
        )
        assert.equal(replies.length, 1)
        assert.ok(Array.isArray(replies[0]))
        assert.equal(replies[0][0], 'image')
        assert.equal(replies[0][1], '普通消息')
        assert.equal(replies[0][2]?.text ?? replies[0][2]?.content, 'Markdown 消息')
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
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
        assert.deepEqual(replies[0], ['image', '普通消息'])
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
    }
})

test('快捷操作模式为 markdown 时把 button 列表渲染为 Markdown 表格', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown' ? 'markdown' : undefined)
    send.reply = async (_event, message, _quote, data) => { replies.push({ message, data }); return {} }
    try {
        await sendMessage({ bot: { adapter: 'qqbot' }, user_id: 'test-user' }, {
            button: [[{ button: { command: '/p b30', label: 'B30' } }]],
        })
        assert.equal(replies.length, 1)
        const markdown = replies[0].message
        assert.equal(markdown?.type, 'markdown')
        assert.ok((markdown?.text ?? markdown?.content).includes('[B30](mqqapi://aio/inlinecmd?command=%2Fp%20b30&enter=false&reply=false)'))
        const action = replies[0].data?.keyboard?.content?.rows?.[0]?.buttons?.[0]?.action
        assert.equal(action?.type, 2)
        assert.equal(action?.data, '/p b30')
        assert.equal(action?.enter, false)
    } finally {
        Config.getUserCfg = originalGetUserCfg
        send.reply = originalReply
    }
})

test('快捷操作模式为 button 时发送按钮行而不是 Markdown 表格', async () => {
    const originalGetUserCfg = Config.getUserCfg
    const originalReply = send.reply
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown' ? 'button' : undefined)
    send.reply = async (_event, message, _quote, data) => { replies.push({ message, data }); return {} }
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
    const originalHasButtonSegment = platform.hasButtonSegment
    /** @type {any[]} */ const replies = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown' ? 'button' : undefined)
    platform.hasButtonSegment = () => false
    send.reply = async (_event, message, _quote, data) => { replies.push({ message, data }); return {} }
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
    }
})

test('二维按钮按输入行换行，且不会与下一行接续', () => {
    const button = (/** @type {string} */ label) => ({ button: { command: `/${label}`, label } })
    const markdown = buildQuickCommandMarkdown([
        [button('R1'), button('R2'), button('R3'), button('R4')],
        [button('R5')],
    ])
    const rows = markdown.split('\n')
    assert.match(rows[2], /R4/)
    assert.doesNotMatch(rows[2], /R5/)
    assert.match(rows[3], /R5/)
})

test('按钮构建保留 style 字段', () => {
    const keyboard = buildQuickCommandKeyboard([[{ command: '/p b30', label: 'B30', style: 3 }]])
    assert.equal(keyboard?.content?.rows?.[0]?.buttons?.[0]?.render_data?.style, 3)
})
