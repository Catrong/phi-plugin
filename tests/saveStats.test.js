import assert from 'node:assert/strict'
import test from 'node:test'
import Save from '../model/save/Save.js'
import getInfo from '../model/game/getInfo.js'

test('getStats does not count Legacy placeholders as AT unlocks', async () => {
    const originalInfo = getInfo.ori_info
    getInfo.ori_info = /** @type {any} */ ({
        'regular-song.0': { chart: { AT: { difficulty: 15 } } },
        'legacy-song.0': { chart: { LY: { difficulty: 15 } } },
    })

    try {
        const stats = await Save.prototype.getStats.call({
            gameRecord: {
                'regular-song.0': [undefined, undefined, undefined, null],
                'legacy-song.0': [undefined, undefined, undefined, null, { score: 1000000 }],
            },
        })

        assert.equal(stats[3].tot, 1)
        assert.equal(stats[3].unlock, 1)
    } finally {
        getInfo.ori_info = originalInfo
    }
})
