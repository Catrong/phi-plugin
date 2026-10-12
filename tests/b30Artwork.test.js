import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import Save from '../model/save/Save.js'
import getInfo from '../model/game/getInfo.js'
import { imgPath, originalIllPath } from '../model/filesystem/path.js'

function saveFixture() {
    const save = Object.create(Save.prototype)
    save.saveInfo = { summary: { rankingScore: 15 } }
    save.gameRecord = {}
    for (let index = 0; index < 33; index++) {
        const id = `artwork-test-${index}.0`
        save.gameRecord[id] = [null, null, {
            id, rank: 'IN', difficulty: 16, rks: 16 - index / 100,
            acc: index < 3 ? 100 : 99, score: index < 3 ? 1000000 : 990000,
            fc: true, illustration: `original/${id}.png`,
        }, null]
    }
    return save
}

test('B30 的 P3 与 B27 实际生成数据均请求低清曲绘，保留存档原图', async t => {
    /** @type {{id: string, kind: string, rank: string}[]} */
    const calls = []
    t.mock.method(getInfo, 'getill', (/** @type {string} */ id, /** @type {string} */ kind, /** @type {string} */ rank) => {
        calls.push({ id, kind, rank })
        return `${kind}/${rank}/${id}.png`
    })
    const save = saveFixture()
    const originals = save.getRecord().map((/** @type {any} */ record) => ({ ...record }))
    const result = await save.getB19(/** @type {any} */ ({}), 27, { avgType: 'none' })
    const cards = [...result.phi.filter(Boolean), ...result.b19_list]
    assert.equal(cards.length, 30)
    assert.equal(calls.length, 30)
    assert.ok(calls.every(call => call.kind === 'low' && call.rank === 'IN'))
    for (const card of cards) assert.equal(card.illustration, `low/${card.rank}/${card.id}.png`)
    assert.deepEqual(save.getRecord(), originals)
})

test('条件 Best 的 P3/B27 与无 P3 列表同样使用低清，不修改排序缓存', async t => {
    /** @type {{id: string, kind: string, rank: string}[]} */
    const calls = []
    t.mock.method(getInfo, 'getill', (/** @type {string} */ id, /** @type {string} */ kind, /** @type {string} */ rank) => {
        calls.push({ id, kind, rank })
        return `${kind}/${rank}/${id}.png`
    })
    for (const withPhi of [true, false]) {
        const save = saveFixture()
        const originals = save.getRecord().map((/** @type {any} */ record) => ({ ...record }))
        calls.length = 0
        const result = await save.getBestWithLimit(withPhi ? 27 : 30, [], withPhi)
        const cards = [...(result.phi || []).filter(Boolean), ...result.b19_list]
        assert.equal(cards.length, 30)
        assert.equal(calls.length, 30)
        assert.ok(calls.every(call => call.kind === 'low'))
        for (const card of cards) assert.equal(card.illustration, `low/${card.rank}/${card.id}.png`)
        assert.deepEqual(save.getRecord(), originals)
    }
})

/** @param {import('node:test').TestContext} t @param {string} id @param {string[]} files */
function artworkFixture(t, id, files) {
    const original = getInfo.ori_info
    const info = /** @type {any} */ ({ id })
    getInfo.ori_info = { ...original, [id]: info }
    t.after(() => { getInfo.ori_info = original })
    t.mock.method(getInfo, 'all_info', () => ({ [id]: info }))
    const existing = new Set(files.map(file => path.resolve(file)))
    t.mock.method(fs, 'existsSync', (/** @type {import('node:fs').PathLike} */ file) => existing.has(path.resolve(String(file))))
}

test('低清曲绘文件存在时使用低清，缺失时回退原图；common 用途保持原图', t => {
    const id = 'artwork-fallback.0'
    const common = path.join(originalIllPath, 'ill', 'artwork-fallback.png')
    const low = path.join(originalIllPath, 'illLow', 'artwork-fallback.png')
    const blur = path.join(originalIllPath, 'illBlur', 'artwork-fallback.png')
    artworkFixture(t, id, [common, low])
    assert.equal(getInfo.getill(/** @type {any} */ (id), 'low', 'IN'), low)
    assert.equal(getInfo.getill(/** @type {any} */ (id), 'blur', 'IN'), common)
    assert.equal(getInfo.getill(/** @type {any} */ (id), 'common', 'IN'), common)
    t.mock.method(fs, 'existsSync', (/** @type {import('node:fs').PathLike} */ file) => path.resolve(String(file)) === path.resolve(common))
    assert.equal(getInfo.getill(/** @type {any} */ (id), 'low', 'IN'), common)
    assert.notEqual(getInfo.getill(/** @type {any} */ (id), 'blur', 'IN'), blur)
})

test('低清回退保留 Happyending 的难度曲绘，原图也缺失才使用默认背景', t => {
    const id = 'WhatdoyouwantmorethanaHappyending.Apo11oHALOprogramft安月名莉子大瀬良あい.0'
    const filename = id.replace(/\.0$/, '.png')
    const common = path.join(originalIllPath, 'ill', filename)
    const ranked = path.join(originalIllPath, 'ill', 'AT', filename)
    artworkFixture(t, id, [common, ranked])
    assert.equal(getInfo.getill(/** @type {any} */ (id), 'low', 'AT'), ranked)
    assert.equal(getInfo.getill(/** @type {any} */ (id), 'blur', 'AT'), ranked)
    t.mock.method(fs, 'existsSync', (/** @type {import('node:fs').PathLike} */ file) => path.resolve(String(file)) === path.resolve(common))
    assert.equal(getInfo.getill(/** @type {any} */ (id), 'low', 'AT'), path.join(imgPath, 'phigros.png'))
})

test('旧目录与 SP 曲绘没有低清文件时保持已有资源路径', t => {
    const id = 'legacy-artwork.0'
    const legacy = path.join(originalIllPath, 'legacy-artwork.png')
    artworkFixture(t, id, [legacy])
    assert.equal(getInfo.getill(/** @type {any} */ (id), 'low', 'IN'), legacy)
    const originalSp = getInfo.sp_info
    t.after(() => { getInfo.sp_info = originalSp })
    getInfo.sp_info = /** @type {any} */ ({ ...originalSp, 'special-artwork.0': { id: 'special-artwork.0' } })
    t.mock.method(getInfo, 'all_info', () => getInfo.sp_info)
    const special = path.join(originalIllPath, 'SP', 'special-artwork.png')
    t.mock.method(fs, 'existsSync', (/** @type {import('node:fs').PathLike} */ file) => path.resolve(String(file)) === path.resolve(special))
    assert.equal(getInfo.getill(/** @type {any} */ ('special-artwork.0'), 'low', 'SP'), special)
})
