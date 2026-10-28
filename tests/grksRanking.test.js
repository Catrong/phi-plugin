import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import template from 'art-template'
import Config from '../components/Config.js'
import { phiGrks, parseRankArgs } from '../apps/grks.js'
import { grksSoloClass } from '../apps/grks/solo.js'
import { addScore, getPlayer, getStoreFile, queryRanking, reloadStore, setStoreFile } from '../model/game/gameScore/index.js'
import { ANONYMOUS_PLAYER_PROFILE, parsePlayerProfile, playerProfileFromSave, playerProfileForUser, resolveRankingProfiles } from '../model/game/gameScore/profile.js'
import credentials from '../model/user/userCredentialStore.js'
import savesRepository from '../model/save/getSave.js'
import getInfo from '../model/game/getInfo.js'
import picmodle from '../model/render/picmodle.js'
import send from '../model/render/send.js'
import { grksMessages, menus } from '../model/render/messages.js'

test.before(async () => await getInfo.loadAvatar())

/** @import {botEvent} from '../components/baseClass.js' */
/** @import {gameScoreRecord} from '../model/game/gameScore/store.js' */
/** @import {grksRankingView} from '../model/render/messages.js' */

/** @returns {botEvent} */
function event() {
    return {
        user_id: 'player-0', msg: '/phi grks lb match accuracy 2', isGroup: false, isPrivate: true,
        sender: { user_name: '用户名', nickname: '昵称', card: '群名片' },
        friend: { getAvatarUrl: () => 'https://example.com/avatar.png' },
    }
}

/** @param {import('node:test').TestContext} t */
function fixture(t) {
    const original = getStoreFile()
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phi-grks-ranking-'))
    const file = path.join(dir, 'scores.json')
    setStoreFile(file)
    t.after(() => {
        setStoreFile(original)
        assert.equal(path.dirname(dir), path.resolve(os.tmpdir()))
        fs.rmSync(dir, { recursive: true, force: true })
    })
    const originalConfig = Config.getUserCfg.bind(Config)
    t.mock.method(Config, 'getUserCfg', (/** @type {'config'} */ name, /** @type {configName} */ key) => {
        if (key === 'cmdhead') return 'phi'
        return originalConfig(name, key)
    })
    /** @type {Map<string, NonNullable<Parameters<typeof playerProfileFromSave>[0]>>} */
    const saves = new Map()
    t.mock.method(credentials, 'getSessionToken', async (/** @type {string | number} */ userId) => saves.has(String(userId)) ? String(userId) : null)
    t.mock.method(savesRepository, 'getSaveBySessionToken', async (/** @type {string | null | undefined} */ token) => saves.get(String(token)))
    return { file, saves }
}

/** @param {string} file */
function seedRanking(file) {
    /** @type {Record<string, gameScoreRecord>} */
    const rows = {}
    for (let index = 0; index < 21; index++) {
        rows[`player-${index}`] = {
            score: 100 - index, plays: 10, best: 10, wins: 10, losses: 0, draws: 0,
            hintSum: (index + 1) * 10, hintPlays: 10, updatedAt: 1,
            profile: { source: 'phigros', name: `旧游戏名 ${index}`, avatar: 'Glaciaxion' },
        }
    }
    fs.writeFileSync(file, JSON.stringify({ version: 1, games: { grks: { normal: rows, match: rows } } }))
    reloadStore()
}

test('Phigros 身份仅取游戏存档，旧聊天资料和远程头像不再展示', async () => {
    const profile = await playerProfileFromSave({ saveInfo: { PlayerId: '游戏名称', summary: { avatar: 'Glaciaxion' } } })
    assert.deepEqual(profile, { source: 'phigros', name: '游戏名称', avatar: 'Glaciaxion' })
    assert.deepEqual(await playerProfileFromSave(undefined), ANONYMOUS_PLAYER_PROFILE)
    assert.equal(parsePlayerProfile({ name: '旧聊天用户名', avatar: 'https://example.com/avatar.png' }), undefined)
    assert.deepEqual(parsePlayerProfile({ source: 'phigros', name: '  玩家\n名称 ', avatar: 'https://example.com/avatar.png' }), {
        source: 'phigros', name: '玩家 名称', avatar: 'Introduction',
    })
    assert.equal(parsePlayerProfile({ source: 'phigros', name: 123 }), undefined)
    assert.equal(parsePlayerProfile({ source: 'phigros', name: '  ' }), undefined)
    assert.equal(parsePlayerProfile({ source: 'phigros', name: '玩家', avatar: '../secret' })?.avatar, 'Introduction')
})

test('游戏身份随积分持久化，旧记录缺失身份时展示匿名用户', async t => {
    fixture(t)
    const profile = await playerProfileFromSave({ saveInfo: { PlayerId: '游戏名称', summary: { avatar: 'Glaciaxion' } } })
    await addScore('grks', 'normal', 'player-0', 10, { hints: 2, profile })
    reloadStore()
    assert.deepEqual(getPlayer('grks', 'normal', 'player-0')?.profile, profile)
    await addScore('grks', 'normal', 'player-0', 5)
    assert.equal(getPlayer('grks', 'normal', 'player-0')?.profile?.name, '游戏名称')
    await addScore('grks', 'normal', 'player-0', 1, { profile: { source: 'phigros', name: '新游戏名', avatar: 'Introduction' } })
    reloadStore()
    assert.equal(getPlayer('grks', 'normal', 'player-0')?.profile?.name, '新游戏名')
    assert.match(queryRanking({ meId: 'player-0' }).text, /新游戏名/)
    await addScore('grks', 'normal', 'legacy', 1)
    assert.equal(getPlayer('grks', 'normal', 'legacy')?.profile, undefined)
    assert.match(queryRanking({}).text, /匿名用户/)
    assert.ok(!queryRanking({}).text.includes('legacy'))
})

test('单机未绑定玩家无需绑定仍可记分，已绑定玩家保存游戏身份', async t => {
    const { saves } = fixture(t)
    const notify = t.mock.method(send, 'getsave_result', async () => { throw new Error('不应触发绑定提示') })
    const solo = new grksSoloClass()
    await solo.recordPlay(event(), 10, 1)
    assert.deepEqual(getPlayer('grks', 'normal', 'player-0')?.profile, ANONYMOUS_PLAYER_PROFILE)
    saves.set('player-0', { saveInfo: { PlayerId: 'Phigros 玩家', summary: { avatar: 'Glaciaxion' } } })
    await solo.recordPlay(event(), 5, 2)
    assert.deepEqual(getPlayer('grks', 'normal', 'player-0')?.profile, { source: 'phigros', name: 'Phigros 玩家', avatar: 'Glaciaxion' })
    assert.equal(getPlayer('grks', 'normal', 'player-0')?.score, 15)
    assert.equal(notify.mock.callCount(), 0)
})

test('当前页只补全本页与查询者的身份，旧聊天资料被游戏存档替换，解绑后匿名', async t => {
    const { file, saves } = fixture(t)
    seedRanking(file)
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    raw.games.grks.normal['player-10'].profile = { name: '旧聊天用户名', avatar: 'https://example.com/chat.png' }
    fs.writeFileSync(file, JSON.stringify(raw))
    reloadStore()
    saves.set('player-10', { saveInfo: { PlayerId: '当前游戏名称', summary: { avatar: 'Glaciaxion' } } })
    saves.set('player-0', { saveInfo: { PlayerId: '我的游戏名称', summary: { avatar: 'Glaciaxion' } } })
    const lookup = t.mock.method(credentials, 'getSessionToken', credentials.getSessionToken)
    const page = queryRanking({ page: 2, meId: 'player-0' })
    assert.ok(page.ok)
    assert.ok(!page.text.includes('旧聊天用户名'))
    const resolved = await resolveRankingProfiles(page)
    assert.equal(resolved.items[0].profile?.name, '当前游戏名称')
    assert.equal(resolved.me?.profile?.name, '我的游戏名称')
    assert.ok(resolved.text.includes('当前游戏名称'))
    assert.ok(!resolved.text.includes('player-10'))
    assert.equal(lookup.mock.callCount(), 11)
    assert.deepEqual(new Set(lookup.mock.calls.map(call => call.arguments[0])), new Set([
        ...Array.from({ length: 10 }, (_, index) => `player-${index + 10}`), 'player-0',
    ]))
    saves.delete('player-10')
    const unbound = await resolveRankingProfiles(resolved)
    assert.deepEqual(unbound.items[0].profile, ANONYMOUS_PLAYER_PROFILE)
    assert.ok(!unbound.text.includes('当前游戏名称'))
})

test('补全身份沿用同一次榜单快照，期间新增积分不混入旧页名次', async t => {
    const { file } = fixture(t)
    seedRanking(file)
    const page = queryRanking({ page: 2, meId: 'player-0' })
    assert.ok(page.ok)
    const ids = page.items.map(row => row.userId)
    await addScore('grks', 'normal', 'new-leader', 1000)
    const resolved = await resolveRankingProfiles(page)
    assert.equal(resolved.total, 21)
    assert.equal(resolved.meRank, 1)
    assert.deepEqual(resolved.items.map(row => row.userId), ids)
    assert.match(resolved.text, /#11 匿名用户/)
    assert.ok(!resolved.text.includes('new-leader'))
})

test('未绑定时不读取存档，真实存档读取异常会如实报错', async t => {
    const { saves } = fixture(t)
    const error = new Error('存档读取失败')
    const read = t.mock.method(savesRepository, 'getSaveBySessionToken', async () => { throw error })
    assert.deepEqual(await playerProfileForUser('player-0'), ANONYMOUS_PLAYER_PROFILE)
    assert.equal(read.mock.callCount(), 0)
    saves.set('player-0', { saveInfo: { PlayerId: '游戏名称', summary: { avatar: 'Glaciaxion' } } })
    await assert.rejects(playerProfileForUser('player-0'), error)
})

test('21 位玩家分为 10、10、1 位，翻页保留游戏模式和类型，首尾页无越界按钮', t => {
    const { file } = fixture(t)
    seedRanking(file)
    for (const [requested, actual, count] of [[1, 1, 10], [2, 2, 10], [3, 3, 1], [999, 3, 1]]) {
        const page = queryRanking({ gameId: 'grks', mode: 'match', kind: 'accuracy', page: requested, meId: 'player-0' })
        assert.ok(page.ok)
        assert.equal(page.page, actual)
        assert.equal(page.pages, 3)
        assert.equal(page.items.length, count)
        assert.equal(page.meRank, 1)
        const navigation = menus.grksRanking(page).flat().filter(button => ['上一页', '下一页'].includes(button.label))
        assert.equal(navigation.some(button => button.label === '上一页'), actual > 1)
        assert.equal(navigation.some(button => button.label === '下一页'), actual < 3)
        for (const button of navigation) {
            const parsed = parseRankArgs(button.command)
            assert.equal(parsed.gameId, 'grks')
            assert.equal(parsed.mode, 'match')
            assert.equal(parsed.kind, 'accuracy')
            assert.equal(parsed.page, actual + (button.label === '上一页' ? -1 : 1))
        }
    }
})

test('榜单完整消息显示游戏身份、连续名次与分页按钮，图片失败后保留文字和翻页', async t => {
    const { file, saves } = fixture(t)
    saves.set('player-10', { saveInfo: { PlayerId: '<script>游戏名称</script>', summary: { avatar: 'Glaciaxion' } } })
    seedRanking(file)
    /** @type {grksRankingView[]} */
    const views = []
    let image = true
    t.mock.method(picmodle, 'grksRanking', async (/** @type {botEvent} */ _e, /** @type {grksRankingView} */ view) => {
        views.push(view)
        return image ? { type: 'image', data: 'test' } : false
    })
    const page = queryRanking({ mode: 'match', kind: 'accuracy', page: 2, meId: 'player-0' })
    assert.ok(page.ok)
    const success = await grksMessages.rankList.result(event(), page)
    assert.ok(success.image)
    assert.equal(views[0].rows.length, 10)
    assert.equal(views[0].rows[0].rank, 11)
    assert.equal(views[0].rows[9].rank, 20)
    assert.equal(views[0].rows[0].name, '<script>游戏名称</script>')
    assert.equal(views[0].rows[0].avatar, 'Glaciaxion')
    assert.equal(views[0].rows[0].metric, '11.00 条提示')
    image = false
    const fallback = await grksMessages.rankList.result(event(), page)
    assert.equal(fallback.image, undefined)
    assert.equal(fallback.text, (await resolveRankingProfiles(page)).text)
    assert.deepEqual(fallback.button, success.button)
    t.mock.method(picmodle, 'grksRanking', async () => { throw new Error('渲染异常') })
    const thrown = await grksMessages.rankList.result(event(), page)
    assert.equal(thrown.text, fallback.text)
    assert.deepEqual(thrown.button, success.button)
})

test('积分榜命令传递当前页图像并直接发送最终消息', async t => {
    const { file } = fixture(t)
    seedRanking(file)
    /** @type {grksRankingView[]} */
    const views = []
    t.mock.method(picmodle, 'grksRanking', async (/** @type {botEvent} */ _e, /** @type {grksRankingView} */ view) => {
        views.push(view)
        return { type: 'image', data: 'rank-test' }
    })
    const sender = t.mock.method(send, 'send_with_At', async () => true)
    assert.equal(await new phiGrks().rankList(event()), true)
    assert.equal(views[0].rows.length, 10)
    assert.equal(views[0].rows[0].rank, 11)
    assert.equal(sender.mock.callCount(), 1)
})

test('榜单模板使用本地游戏头像并转义名称，旧记录匿名，空榜不提供翻页', async t => {
    const { file, saves } = fixture(t)
    saves.set('player-10', { saveInfo: { PlayerId: '<script>游戏名称</script>', summary: { avatar: 'Glaciaxion' } } })
    seedRanking(file)
    const page = queryRanking({ page: 2 })
    assert.ok(page.ok)
    /** @type {grksRankingView[]} */
    const views = []
    t.mock.method(picmodle, 'grksRanking', async (/** @type {botEvent} */ _e, /** @type {grksRankingView} */ view) => {
        views.push(view)
        return false
    })
    await grksMessages.rankList.result(event(), page)
    const html = template(fileURLToPath(new URL('../resources/html/grks/ranking.art', import.meta.url)), {
        ...views[0],
        defaultLayout: fileURLToPath(new URL('../resources/html/common/layout/default.art', import.meta.url)),
        _res_path: '/resources/', _plugin: 'phi-plugin', Version: { ver: 'test' }, sys: { scale: '' },
        renderNoJs: true, themeInfo: null,
    })
    assert.equal((html.match(/<article class="ranking-row /g) || []).length, 10)
    assert.ok(html.includes('&#60;script&#62;游戏名称&#60;/script&#62;'))
    assert.ok(!html.includes('<script>游戏名称</script>'))
    assert.ok(html.includes('/resources/html/avatar/Glaciaxion.png'))
    assert.ok(!html.includes('https://example.com/'))
    const empty = queryRanking({ mode: 'match', kind: 'winRate', minPlays: 100 })
    assert.ok(empty.ok)
    const message = await grksMessages.rankList.result(event(), empty)
    assert.equal(views.at(-1)?.rows.length, 0)
    assert.match(message.text, /至少 100 场/)
    assert.ok(!message.button.flat().some(button => ['上一页', '下一页'].includes(button.label)))
    await addScore('grks', 'normal', 'old-player', 1000)
    const legacy = queryRanking({})
    assert.ok(legacy.ok)
    await grksMessages.rankList.result(event(), legacy)
    assert.equal(views.at(-1)?.rows[0].name, '匿名用户')
    assert.equal(views.at(-1)?.rows[0].avatar, 'Introduction')
})
