import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import art from 'art-template'
import staticText from '../model/render/staticText.js'

const resources = path.resolve(import.meta.dirname, '../resources').replace(/\\/g, '/')
const longTitle = '很长的任务曲名 Mixed English and 中文 😀'
const record = { song: "Rrhar'il", illustration: 'song.png', Rating: 'S', rank: 'IN',
    score_new: 927131, acc_new: 99.2069, rks_new: 15.7305 }

/** @param {boolean} renderNoJs @param {boolean} [helper] */
function render(renderNoJs, helper = true) {
    return art(`${resources}/html/update/update.art`, {
        defaultLayout: `${resources}/html/common/layout/default.art`, _res_path: resources + '/',
        renderNoJs, ...(helper ? { staticText } : {}), theme: 'default', themeInfo: null,
        sys: { scale: '' }, _plugin: 'Phi-Plugin', Version: { ver: 'test' },
        PlayerId: '这是一个很长的玩家名字 Very Long Player ID', Rks: 14.3822, added_rks_notes: [],
        ChallengeMode: 2, ChallengeModeRank: 40, Notes: 0, Date: '2026/10/11 15:32:46',
        rks_history: [], rks_range: [14, 15], rks_date: [], tips: '',
        task_time: '2026/10/11 15:32:46', task_data: [
            { song: longTitle, illustration: 'task.png', finished: true, reward: 500, request: { rank: 'IN', value: '99.50%' } },
            { song: 'HAZARD', illustration: 'task.png', finished: false, reward: 100, request: { rank: 'IN', value: '98.00%' } },
        ],
        box_line: [
            [{ date: '2026/10/05 05:33:31', update_num: 300, width: 135, color: '#be007d', song: [record] }],
            [{ date: '2026/10/06 05:33:31', update_num: 3, width: 290, color: '#be007d', song: [{ ...record, Rating: null, song: longTitle }] }],
        ],
    })
}

test('Shotium update 固定标题栏使用可读字号，评级、任务及无评级标题分别留出正确空间', () => {
    const html = render(true)
    assert.match(html, /title="Rrhar&#39;il" style="font-size: 13px"/)
    assert.match(html, /title="很长的任务曲名[^"\n]+" style="font-size: 10px"/)
    assert.match(html, /namebox without-rating/)
    assert.match(html, /\.record_box \.songsname p \{ font-size: 13px; line-height: 1\.1;/)
    assert.match(html, /max-height: 16px/)
    assert.match(html, /title="Player:[^"\n]+" style="font-size: 12px"/)
    assert.equal((html.match(/class="box_title compact-date"/g) || []).length, 1, '只对单首日期和计数同处一栏的组上下错开')
    assert.ok(html.includes('927131'))
    assert.ok(html.includes('Updated × 300'))
    assert.equal((html.match(/name="pvis" class="phi-fit-line"/g) || []).length, 5)
    assert.match(html, /<p name="pvis">2026\/10\/05 05:33:31<\/p>/)
    assert.match(html, /<p name="pvis">Updated × 300<\/p>/)
})

test('update 模板先热更新时有静态字号兜底，Puppeteer 继续使用原有字体脚本', () => {
    assert.match(render(true, false), /\.record_box \.songsname p \{ font-size: 13px;/)
    const puppeteer = render(false, false)
    assert.doesNotMatch(puppeteer, /max-height: 16px|compact-date|without-rating|title="Player:/)
    assert.match(puppeteer, /function adjustFontSize/)
    assert.match(puppeteer, /<p name="pvis">Rrhar&#39;il<\/p>/)
})
