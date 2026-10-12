import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import Config from '../components/Config.js'
import segment from '../components/segment.js'
import send from '../model/render/send.js'
import {
    buildQuickCommandKeyboard,
    sendConfirmationPrompt,
    sendQuickCommands,
    sendQuickCommandSections,
    sendWithQuickCommands,
    userSettingQuickCommandSections,
} from '../model/game/markdown.js'
import { detectImageDimensions, readImageDimensions } from '../model/game/quickCommandImageHost.js'

const commands = [
    { command: '/phi b27', label: 'B27成绩' },
    { command: '/phi help', label: '帮助' },
]

test('quick command keyboard sends command directly', () => {
    const keyboard = buildQuickCommandKeyboard(commands)
    const button = keyboard?.content?.rows?.[0]?.buttons?.[0]
    assert.equal(button?.action?.type, 1)
    assert.equal(button?.action?.data, '/phi b27')
    assert.equal(button?.render_data?.visited_label, 'B27成绩')
})

test('quick command message no longer embeds cmd-input Markdown', async () => {
    const originals = { getUserCfg: Config.getUserCfg, reply: send.reply }
    /** @type {any[]} */ const calls = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown')
    send.reply = async (_event, message, quote, data) => {
        calls.push({ message, quote, data })
        return {}
    }
    try {
        await sendQuickCommands(/** @type {any} */({ bot: { adapter: 'qqbot' } }), commands)
        assert.equal(calls.length, 1)
        const carrier = Array.isArray(calls[0].message)
            ? calls[0].message.find(item => item?.type === 'markdown')
            : calls[0].message
        assert.equal(carrier?.type, 'markdown')
        assert.equal(carrier?.text ?? carrier?.data, ' ')
        assert.match(JSON.stringify(calls[0].message), /"callback":"\/phi b27"/)
        assert.doesNotMatch(JSON.stringify(calls[0].message), /qqbot-cmd-input/)
    } finally {
        Config.getUserCfg = originals.getUserCfg
        send.reply = originals.reply
    }
})

test('confirmation prompts use callback buttons on QQBot', async () => {
    const originals = { getUserCfg: Config.getUserCfg, sendWithAt: send.send_with_At }
    /** @type {any[]} */ const calls = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown')
    send.send_with_At = async (_event, message) => { calls.push(message); return {} }
    try {
        await sendConfirmationPrompt(/** @type {any} */({ bot: { adapter: 'qqbot' } }), '真的要继续吗？')
        assert.equal(calls.length, 1)
        const payload = JSON.stringify(calls[0])
        assert.match(payload, /"callback":"确认"/)
        assert.match(payload, /"callback":"取消"/)
    } finally {
        Config.getUserCfg = originals.getUserCfg
        send.send_with_At = originals.sendWithAt
    }
})

test('user-setting sections keep one button row per category', async () => {
    const originals = { getUserCfg: Config.getUserCfg, reply: send.reply }
    /** @type {any[]} */ const calls = []
    const sections = [
        { title: '主题', commands: [0, 1, 2, 3].map(value => ({ command: `/phi myset theme ${value}`, label: `主题·${value}` })) },
        { title: '统计', commands: [0, 1, 2, 3].map(value => ({ command: `/phi myset avgkind ${value}`, label: `统计·${value}` })) },
        { title: '配色', commands: [0, 1, 2, 3].map(value => ({ command: `/phi myset avgcolor ${value}`, label: `配色·${value}` })) },
        { title: 'API', commands: [0, 1].map(value => ({ command: `/phi myset api ${value}`, label: `API·${value}` })) },
        { title: '分析', commands: [0, 1].map(value => ({ command: `/phi myset B30分析 ${value}`, label: `分析·${value}` })) },
    ]
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => key === 'LetterMarkdown')
    send.reply = async (_event, message) => { calls.push(message); return {} }
    try {
        await sendQuickCommandSections(/** @type {any} */({ bot: { adapter: 'qqbot' } }), sections, '用户设置快捷操作')
        const button = calls[0].find(item => item?.type === 'button')
        assert.deepEqual(button?.data?.map(row => row.length), [4, 4, 4, 2, 2])
        assert.equal(button?.data?.[4]?.[1]?.callback, '/phi myset B30分析 1')
    } finally {
        Config.getUserCfg = originals.getUserCfg
        send.reply = originals.reply
    }
})

test('user-setting labels fit compact button cells', () => {
    const sections = userSettingQuickCommandSections('phi')
    const labels = sections.flatMap(section => section.commands.map(item => item.label))
    assert.deepEqual(sections[0].commands.map(item => item.label), ['主题0', '主题1', '主题2', '主题3'])
    assert.ok(labels.every(label => [...label].length <= 4))
})

test('detects image dimensions for markdown image sizing', () => {
    const png = Buffer.alloc(24)
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png)
    png.writeUInt32BE(640, 16)
    png.writeUInt32BE(360, 20)
    assert.deepEqual(detectImageDimensions(png), { width: 640, height: 360 })
})

test('reads image dimensions from a local file source', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-image-size-'))
    const file = path.join(tempDir, 'image.png')
    const png = Buffer.alloc(24)
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png)
    png.writeUInt32BE(320, 16)
    png.writeUInt32BE(180, 20)
    await fs.writeFile(file, png)
    try {
        assert.deepEqual(await readImageDimensions(file), { width: 320, height: 180 })
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true })
    }
})

test('merge mode uses configured image host and sends one message', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-quick-command-'))
    const script = path.join(tempDir, 'host.mjs')
    await fs.writeFile(script, 'export default async function upload(data, options) { return { url: `https://img.example/${options.filename}`, width: 640, height: 360 } }\n')
    const originals = { getUserCfg: Config.getUserCfg, sendWithAt: send.send_with_At, reply: send.reply }
    /** @type {any[]} */ const sent = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => ({
        LetterMarkdown: true,
        QuickCommandMergeImage: true,
        QuickCommandImageHostScript: script,
        QuickCommandImageHostTimeout: 1000,
    }[key]))
    send.send_with_At = async (_event, message, quote, data) => {
        sent.push({ message, quote, data })
        return {}
    }
    send.reply = async () => { throw new Error('separate send should not be used') }
    try {
        await sendWithQuickCommands(
            /** @type {any} */({ bot: { adapter: 'qqbot' } }),
            segment.image(Buffer.from('png bytes')),
            commands,
            '快捷操作',
        )
        assert.equal(sent.length, 1)
        assert.match(JSON.stringify(sent[0].message), /https:\/\/img\.example\//)
        assert.match(JSON.stringify(sent[0].message), /"callback":"\/phi b27"/)
    } finally {
        Config.getUserCfg = originals.getUserCfg
        send.send_with_At = originals.sendWithAt
        send.reply = originals.reply
        await fs.rm(tempDir, { recursive: true, force: true })
    }
})

test('merge mode converts image even when there are no buttons', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-quick-command-image-'))
    const script = path.join(tempDir, 'host.mjs')
    await fs.writeFile(script, 'export default async function upload(data, options) { return { url: `https://img.example/${options.filename}`, width: 640, height: 360 } }\n')
    const originals = { getUserCfg: Config.getUserCfg, sendWithAt: send.send_with_At }
    /** @type {any[]} */ const sent = []
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => ({
        LetterMarkdown: true,
        QuickCommandMergeImage: true,
        QuickCommandImageHostScript: script,
        QuickCommandImageHostTimeout: 1000,
    }[key]))
    send.send_with_At = async (_event, message) => { sent.push(message); return {} }
    try {
        await sendWithQuickCommands(
            /** @type {any} */({ bot: { adapter: 'qqbot' } }),
            segment.image(Buffer.from('local image')),
            [],
            '绑定二维码',
        )
        assert.equal(sent.length, 1)
        assert.match(JSON.stringify(sent[0]), new RegExp('https://img\\.example/'))
        assert.doesNotMatch(JSON.stringify(sent[0]), /"type":"image"/)
    } finally {
        Config.getUserCfg = originals.getUserCfg
        send.send_with_At = originals.sendWithAt
        await fs.rm(tempDir, { recursive: true, force: true })
    }
})

test('merge mode falls back to image then keyboard when upload is unavailable', async () => {
    const originals = { getUserCfg: Config.getUserCfg, sendWithAt: send.send_with_At, reply: send.reply }
    let imageCalls = 0
    let buttonCalls = 0
    Config.getUserCfg = /** @type {any} */ ((_name = '', key = '') => ({
        LetterMarkdown: true,
        QuickCommandMergeImage: true,
        QuickCommandImageHostScript: '',
    }[key]))
    send.send_with_At = async () => { imageCalls++; return {} }
    send.reply = async () => { buttonCalls++; return {} }
    try {
        await sendWithQuickCommands(/** @type {any} */({ bot: { adapter: 'qqbot' } }), segment.image(Buffer.from('local image')), commands)
        assert.equal(imageCalls, 1)
        assert.equal(buttonCalls, 1)
    } finally {
        Config.getUserCfg = originals.getUserCfg
        send.send_with_At = originals.sendWithAt
        send.reply = originals.reply
    }
})
