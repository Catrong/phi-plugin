import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import axios from 'axios'
import { dataPath } from '../filesystem/path.js'
import { APIBASEURL } from '../game/constNum.js'
import botApiAuth from './botApiAuth.js'
import logger from '../../components/Logger.js'

const unzip = promisify(gunzip)
const maxAge = 48 * 3600_000
const cacheFile = path.join(dataPath, 'avg-snapshot.bin')
/** @type {readonly ['all','b30']} */
const dimensions = ['all', 'b30']
/** @typedef {Record<string, Record<string, Record<string,[number,number]>>>} Groups */
/** @typedef {{format:1, version:string, generatedAt:string, files:Record<'all'|'b30',{bytes:number,sha256:string}>}} Manifest */
/** @type {{manifest:Manifest, data:Record<'all'|'b30',Groups>} | undefined} */
let current
let running = false
let retryAt = 0
let failures = 0
/** @type {Promise<void> | undefined} */
let restored

/** @param {Manifest} manifest */
function validate(manifest) {
    if (manifest?.format !== 1 || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(manifest.version)
        || !Number.isFinite(Date.parse(manifest.generatedAt)) || Date.parse(manifest.generatedAt) > Date.now() + 60_000) throw Error('快照清单无效')
    for (const kind of dimensions) {
        const file = manifest.files?.[kind]
        if (!file || !Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > 64 * 1024 ** 2 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw Error('快照文件描述无效')
    }
}

/** @param {Buffer} bytes @param {Manifest['files']['all']} file @returns {Promise<Groups>} */
async function decode(bytes, file) {
    if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw Error('快照文件校验失败')
    const groups = JSON.parse((await unzip(bytes, { maxOutputLength: 256 * 1024 ** 2 })).toString('utf8'))
    /** @param {object} value */
    const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
    if (!record(groups)) throw Error('快照区间无效')
    for (const [key,songs] of Object.entries(/** @type {Groups} */ (groups))) {
        if (!/^\d+,\d+$/.test(key) || !record(songs)) throw Error('快照区间无效')
        for (const ranks of Object.values(songs)) {
            if (!record(ranks)) throw Error('快照曲目无效')
            for (const [rank,pair] of Object.entries(ranks)) {
                if (!['EZ','HD','IN','AT'].includes(rank) || !Array.isArray(pair) || pair.length !== 2 || !Number.isFinite(pair[0]) || !Number.isSafeInteger(pair[1]) || pair[1] <= 0) throw Error('快照统计值无效')
            }
        }
    }
    return groups
}

/** @param {Buffer} bytes */
export async function readSnapshotBundle(bytes) {
    const split = bytes.indexOf(10)
    if (split < 0 || split > 2048) throw Error('本地快照文件头无效')
    /** @type {Manifest} */
    const manifest = JSON.parse(bytes.subarray(0, split).toString())
    validate(manifest)
    if (Date.now() - Date.parse(manifest.generatedAt) >= maxAge) return
    const middle = split + 1 + manifest.files.all.bytes
    const all = await decode(bytes.subarray(split + 1, middle), manifest.files.all)
    const b30 = await decode(bytes.subarray(middle), manifest.files.b30)
    return { manifest, data: { all, b30 } }
}

async function restore() {
    try {
        current = await readSnapshotBundle(await fs.readFile(cacheFile))
    } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) logger.warn('[phi-plugin] 无法加载本地均值快照', error)
    }
}

export async function localAvgSnapshot() {
    await (restored ??= restore())
    return current && Date.now() - Date.parse(current.manifest.generatedAt) < maxAge ? current.data : undefined
}

/** @param {Manifest} manifest */
export async function refreshAvgSnapshot(manifest) {
    await localAvgSnapshot()
    if (running || Date.now() < retryAt) return
    running = true
    try {
        validate(manifest)
        if (current?.manifest.version === manifest.version || Date.now() - Date.parse(manifest.generatedAt) >= maxAge) return
        const delay = createHash('sha256').update(botApiAuth.getClientId()).digest().readUInt32BE() % 60_000
        await new Promise(resolve => setTimeout(resolve, delay).unref())
        /** @param {'all'|'b30'} kind */
        async function download(kind) {
            const route = '/bot/avg-snapshots/' + manifest.version + '/' + kind
            const file = manifest.files[kind]
            const response = await axios.get(APIBASEURL + route, { headers: botApiAuth.sign('GET', route, ''), responseType:'arraybuffer', maxRedirects:0, maxContentLength:file.bytes, signal:AbortSignal.timeout(120_000) })
            const bytes = Buffer.from(response.data)
            return {bytes, groups:await decode(bytes,file)}
        }
        const all = await download('all')
        const b30 = await download('b30')
        await fs.mkdir(dataPath, {recursive:true})
        const temp = cacheFile + '.' + randomUUID()
        try {
            await fs.writeFile(temp, Buffer.concat([Buffer.from(JSON.stringify(manifest)+'\n'), all.bytes,b30.bytes]))
            await fs.rename(temp,cacheFile)
        } finally {
            await fs.rm(temp,{force:true})
        }
        current = {manifest, data:{all:all.groups,b30:b30.groups}}
        failures = 0
    } catch (error) {
        retryAt = Date.now() + Math.min(3600_000, 60_000 * 2 ** Math.min(failures++,6))
        logger.warn('[phi-plugin] 均值快照更新失败', error instanceof Error ? error.message : String(error))
    } finally {
        running = false
    }
}

/** @param {Groups | undefined} groups @param {{minRks:number,maxRks:number}} range */
export function lookupAvgRange(groups, range) {
    return groups?.[Math.floor(range.minRks / 0.005) + ',' + Math.floor(range.maxRks / 0.005)]
}
