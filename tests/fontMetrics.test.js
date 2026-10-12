import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createTextMeasurer, measureText, measureLineHeight } from '../model/render/fontMetrics.js'

/** @param {number} format */
function fixtureFont(format) {
    const head = Buffer.alloc(54), hhea = Buffer.alloc(36), maxp = Buffer.alloc(6), hmtx = Buffer.alloc(12)
    head.writeUInt16BE(1000, 18)
    hhea.writeInt16BE(800, 4); hhea.writeInt16BE(-200, 6); hhea.writeInt16BE(100, 8)
    hhea.writeUInt16BE(3, 34); maxp.writeUInt16BE(4, 4)
    ;[500, 300, 700].forEach((advance, index) => hmtx.writeUInt16BE(advance, index * 4))
    /** @type {Buffer} */
    let mapping
    if (format === 4) {
        // A 用 delta，B/C 用 glyph array（C 缺字），方块用 delta，末段为必需 sentinel。
        mapping = Buffer.alloc(52)
        mapping.writeUInt16BE(4, 0); mapping.writeUInt16BE(mapping.length, 2); mapping.writeUInt16BE(8, 6)
        const starts = [65, 66, 0x25a0, 0xffff], ends = [65, 67, 0x25a0, 0xffff]
        const deltas = [-64, 1, 3 - 0x25a0, 1]
        for (let i = 0; i < 4; i++) {
            mapping.writeUInt16BE(ends[i], 14 + i * 2)
            mapping.writeUInt16BE(starts[i], 24 + i * 2)
            mapping.writeInt16BE(deltas[i], 32 + i * 2)
        }
        mapping.writeUInt16BE(6, 42) // idRangeOffset 的位置 42，到 glyph array 48 的距离。
        mapping.writeUInt16BE(1, 48) // delta + 1 后为 glyph 2。
        mapping.writeUInt16BE(0, 50) // glyph 0 必须保持缺字，不能再应用 delta。
    } else {
        mapping = Buffer.alloc(16 + 3 * 12)
        mapping.writeUInt16BE(12, 0); mapping.writeUInt32BE(mapping.length, 4); mapping.writeUInt32BE(3, 12)
        const groups = [[65, 66, 1], [0x25a0, 0x25a0, 3], [0x1f600, 0x1f600, 2]]
        groups.forEach((group, index) => group.forEach((value, field) => mapping.writeUInt32BE(value, 16 + index * 12 + field * 4)))
    }
    const cmap = Buffer.alloc(12 + mapping.length)
    cmap.writeUInt16BE(1, 2); cmap.writeUInt16BE(3, 4); cmap.writeUInt16BE(format === 12 ? 10 : 1, 6)
    cmap.writeUInt32BE(12, 8); mapping.copy(cmap, 12)
    const tables = { head, hhea, maxp, hmtx, cmap }, header = Buffer.alloc(12 + Object.keys(tables).length * 16)
    header.writeUInt32BE(0x00010000, 0); header.writeUInt16BE(Object.keys(tables).length, 4)
    let offset = header.length
    Object.entries(tables).forEach(([name, data], index) => {
        const position = 12 + index * 16
        header.write(name, position, 4); header.writeUInt32BE(offset, position + 8); header.writeUInt32BE(data.length, position + 12)
        offset += data.length
    })
    return Buffer.concat([header, ...Object.values(tables)])
}

test('自带字体用真实 advance 测量常用文字，合成粗体宽度一致', () => {
    assert.equal(measureText(null), 0)
    assert.ok(measureText('WWW') > measureText('iii') * 2)
    assert.ok(measureText('版本日期') > 3.8 && measureText('版本日期') < 4.2)
    assert.ok(measureText('インフェルノシティ') > 0)
    assert.ok(measureText('Orbital Velocity: ■■■ km/s') > 0)
    assert.equal(measureText('Exoplanetary Mirage', { fontWeight: 'bold' }), measureText('Exoplanetary Mirage'))
    assert.equal(measureText('A\tB\nC'), measureText('A B C'))
    assert.equal(measureLineHeight('Exoplanetary Mirage'), 1.5)
    assert.ok(Math.abs(measureLineHeight('مرحبا بالعالم') - 2.112) < 0.000001)
})

test('cmap format 4 支持 delta、glyph array、缺字与 hmtx 最后 advance 复用', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phi-font-metrics-'))
    try {
        const file = path.join(directory, 'test.ttf')
        fs.writeFileSync(file, fixtureFont(4))
        const metrics = createTextMeasurer([file])
        assert.equal(metrics.measureText('A'), 0.3)
        assert.equal(metrics.measureText('B'), 0.7)
        assert.equal(metrics.measureText('■'), 0.7)
        assert.equal(metrics.measureText('C'), 0.6, '缺字应进入安全估算路径')
        assert.equal(metrics.measureLineHeight('AB'), 1.1)
        fs.unlinkSync(file)
        assert.equal(metrics.measureText('ABA'), 1.3, '首次加载后不再持有文件句柄或重复读取字体')
    } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

test('cmap format 12 覆盖非 BMP 符号，缺失或损坏字体继续回退', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phi-font-metrics-'))
    try {
        const file = path.join(directory, 'test.ttf'), broken = path.join(directory, 'broken.ttf')
        fs.writeFileSync(file, fixtureFont(12)); fs.writeFileSync(broken, Buffer.alloc(16))
        const metrics = createTextMeasurer([path.join(directory, 'missing.ttf'), broken, file])
        assert.equal(metrics.measureText('😀'), 0.7)
        assert.equal(metrics.measureText('AB■'), 1.7)
        assert.ok(Number.isFinite(metrics.measureText('未知\u0301\u200d')))
        const fallback = createTextMeasurer([broken])
        assert.equal(fallback.measureText('中'), 1)
        assert.equal(fallback.measureText('\u0301\u200d'), 0)
        assert.equal(fallback.measureLineHeight(), 1.2)
    } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
