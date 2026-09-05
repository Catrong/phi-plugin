import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { buildRksHistogram, getB30AnalysisRecords } from '../model/game/b30Analysis.js'
import { pluginResources } from '../model/filesystem/path.js'
import { renderDefaultB30Canvas } from '../model/render/b30CanvasRenderer.js'

const illustration = path.join(pluginResources, 'html', 'otherimg', 'phigros.png')

/** @param {number} index @param {boolean} [phi] */
function createRecord(index, phi = false) {
    const ranks = ['AT', 'IN', 'HD', 'EZ']
    return {
        id: `canvas-song-${index}`,
        song: index === 2 ? '这是一首用于验证中文字体与超长标题截断的测试歌曲' : `Canvas Test Track ${index + 1}`,
        rank: ranks[index % ranks.length],
        difficulty: 16.4 - index * 0.04,
        rks: 16.12 - index * 0.045,
        score: phi ? 1_000_000 : 998_000 - index * 713,
        acc: phi ? 100 : 99.82 - index * 0.035,
        Rating: phi ? 'phi' : index % 5 === 0 ? 'FC' : 'V',
        suggest: phi ? '已满分' : '+0.01',
        suggestType: index % 6,
        illustration,
        num: index + 1,
        ...(index === 4 ? { accAvg: 'Avg: 99.1234%', accKind: 'Higher' } : {}),
        ...(index === 7 ? { cpToOld: { type: 'Lower', dif: '0.1', rks: '0.05' } } : {}),
    }
}

export function createB30CanvasFixture() {
    const phi = Array.from({ length: 3 }, (_, index) => createRecord(index, true))
    const b19_list = Array.from({ length: 30 }, (_, index) => createRecord(index + 3))
    const histogram = buildRksHistogram(getB30AnalysisRecords({ phi, b19_list }))
    return {
        theme: 'default',
        phi,
        b19_list,
        Date: '2026-09-05 14:30:00',
        background: illustration,
        gameuser: {
            avatar: '-SURREALISM-',
            ChallengeMode: 5,
            ChallengeModeRank: 42,
            PlayerId: 'Canvas Renderer 测试玩家',
            rks: 16.1234,
            data: '12GiB 345MiB 678KiB',
        },
        stats: ['AT', 'IN', 'HD', 'EZ'].map((title, index) => ({
            title,
            cleared: 100 + index,
            fc: 80 + index,
            phi: 60 + index,
        })),
        spInfo: ['Game 4.1.0', 'Real RKS: 16.1234'],
        b30Analysis: {
            histogram,
            showTags: true,
            tagAnalysis: {
                threshold: 15.4,
                recordCount: 30,
                totalVotes: 1280,
                insufficient: false,
                radar: {
                    grids: [
                        '100,12 169,52 169,132 100,172 31,132 31,52',
                        '100,52 134,72 134,112 100,132 66,112 66,72',
                    ],
                    axes: [
                        { x: 100, y: 12 }, { x: 169, y: 52 }, { x: 169, y: 132 },
                        { x: 100, y: 172 }, { x: 31, y: 132 }, { x: 31, y: 52 },
                    ],
                    points: '100,30 154,61 146,119 100,155 44,124 50,63',
                    categories: [
                        { name: '读谱', displayRks: '16.31', labelX: 100, labelY: 4, anchor: 'middle' },
                        { name: '手速', displayRks: '16.12', labelX: 180, labelY: 48, anchor: 'start' },
                        { name: '耐力', displayRks: '15.98', labelX: 180, labelY: 136, anchor: 'start' },
                        { name: '多押', displayRks: '15.86', labelX: 100, labelY: 180, anchor: 'middle' },
                        { name: '节奏', displayRks: '16.08', labelX: 20, labelY: 136, anchor: 'end' },
                        { name: '交互', displayRks: '16.25', labelX: 20, labelY: 48, anchor: 'end' },
                    ],
                },
                strong: Array.from({ length: 5 }, (_, index) => ({ name: `擅长标签 ${index + 1}`, rks: 16.3 - index * 0.06 })),
                weak: Array.from({ length: 5 }, (_, index) => ({ name: `薄弱标签 ${index + 1}`, rks: 15.7 - index * 0.05 })),
            },
        },
    }
}

test('renders the default B30 theme as a scaled JPEG buffer', async () => {
    const imageBuffer = await renderDefaultB30Canvas(createB30CanvasFixture(), {
        scale: 0.5,
        pluginName: 'Phi-Plugin',
        version: 'test',
        quality: 82,
    })

    assert.ok(Buffer.isBuffer(imageBuffer))
    assert.deepEqual([...imageBuffer.subarray(0, 3)], [0xff, 0xd8, 0xff])
    assert.ok(imageBuffer.length > 50_000)

    const image = await loadImage(imageBuffer)
    assert.equal(image.width, 600)
    assert.ok(image.height >= 1200)
    assert.ok(image.height <= 1400)
})

test('renders without optional records or analysis data', async () => {
    const imageBuffer = await renderDefaultB30Canvas({
        theme: 'default',
        phi: [],
        b19_list: [],
        gameuser: {},
    }, { scale: 0.25, quality: 60 })

    const image = await loadImage(imageBuffer)
    assert.equal(image.width, 300)
    assert.equal(image.height, 180)
})

test('reloads illustrations from disk between renders', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-b30-canvas-'))
    const background = path.join(tempDir, 'background.png')
    t.after(() => fs.rm(tempDir, { recursive: true, force: true }))

    const source = createCanvas(64, 64)
    const sourceContext = source.getContext('2d')
    const render = () => renderDefaultB30Canvas({
        theme: 'default',
        phi: [],
        b19_list: [],
        background,
        gameuser: {},
    }, { scale: 0.25, quality: 90 })

    sourceContext.fillStyle = '#ff0000'
    sourceContext.fillRect(0, 0, source.width, source.height)
    await fs.writeFile(background, await source.encode('png'))
    const first = await render()

    sourceContext.fillStyle = '#0000ff'
    sourceContext.fillRect(0, 0, source.width, source.height)
    await fs.writeFile(background, await source.encode('png'))
    const second = await render()

    assert.notDeepEqual(first, second)
})
