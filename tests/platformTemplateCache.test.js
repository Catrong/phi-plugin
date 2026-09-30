import assert from 'node:assert/strict'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { withReliableTemplateCache, YunzaiRenderer } from '../components/platform/yunzai.js'
import { KoishiRenderer } from '../components/platform/koishi.js'

/** @param {new (data?: any) => any} Renderer @param {string} label */
async function assertAtomicTemplateRefresh(Renderer, label) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), `phi-${label}-template-`))
    const liveDir = path.join(root, 'live')
    const replacementDir = path.join(root, 'replacement')
    const oldDir = path.join(root, 'old')
    const tplFile = path.join(liveDir, 'page.art')
    const renderName = `phi-template-cache-${label}-${process.pid}`
    const outputDir = path.resolve('temp', 'html', renderName)
    const renderer = new Renderer({ id: label })

    try {
        await fs.mkdir(liveDir)
        await fs.mkdir(replacementDir)
        await fs.writeFile(tplFile, 'old template: {{value}}')
        await fs.writeFile(path.join(replacementDir, 'page.art'), 'new template: {{value}}')

        const first = renderer.dealTpl(renderName, { tplFile, saveId: 'first', value: 'one' })
        assert.equal(typeof first, 'string')
        assert.match(await fs.readFile(String(first), 'utf8'), /old template: one/)

        await fs.rename(liveDir, oldDir)
        await fs.rename(replacementDir, liveDir)

        const second = renderer.dealTpl(renderName, { tplFile, saveId: 'second', value: 'two' })
        assert.equal(typeof second, 'string')
        assert.match(await fs.readFile(String(second), 'utf8'), /new template: two/)
    } finally {
        await renderer.watcher[tplFile]?.close()
        await fs.rm(root, { recursive: true, force: true })
        await fs.rm(outputDir, { recursive: true, force: true })
    }
}

test('Yunzai renderer refreshes templates after atomic directory replacement', async () => {
    await assertAtomicTemplateRefresh(YunzaiRenderer, 'yunzai')
})

test('Koishi renderer refreshes templates after atomic directory replacement', async () => {
    await assertAtomicTemplateRefresh(KoishiRenderer, 'koishi')
})

test('Yunzai host wrapper retries when a directory swap races the host template read', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'phi-yunzai-host-race-'))
    const liveDir = path.join(root, 'live')
    const replacementDir = path.join(root, 'replacement')
    const oldDir = path.join(root, 'old')
    const tplFile = path.join(liveDir, 'page.art')

    class RacingHostRenderer {
        constructor() {
            /** @type {Record<string, string>} */
            this.html = {}
            this.watcher = {}
            this.swapped = false
        }

        /** @param {string} _name @param {{tplFile:string}} data */
        dealTpl(_name, data) {
            if (!this.html[data.tplFile]) {
                this.html[data.tplFile] = fsSync.readFileSync(data.tplFile, 'utf8')
                if (!this.swapped) {
                    fsSync.renameSync(liveDir, oldDir)
                    fsSync.renameSync(replacementDir, liveDir)
                    this.swapped = true
                }
            }
            return this.html[data.tplFile]
        }
    }

    try {
        await fs.mkdir(liveDir)
        await fs.mkdir(replacementDir)
        await fs.writeFile(tplFile, 'old host template')
        await fs.writeFile(path.join(replacementDir, 'page.art'), 'new host template')
        const ReliableRenderer = withReliableTemplateCache(RacingHostRenderer)
        const renderer = new ReliableRenderer()
        assert.equal(renderer.dealTpl('race', { tplFile }), 'new host template')
    } finally {
        await fs.rm(root, { recursive: true, force: true })
    }
})
