import assert from 'node:assert/strict'
import test from 'node:test'
import Config from '../components/Config.js'
import { aliasProposal } from '../apps/aliasProposal.js'
import { phiupdate } from '../apps/update.js'

test('recreated apps read the current head including empty and regex heads', () => {
    const original = Config.getUserCfg
    let head = 'phi'
    const stub = test.mock.method(Config, 'getUserCfg', (/** @type {any} */ name, /** @type {any} */ key) => {
        if (name === 'config' && key === 'cmdhead') return head
        return Reflect.apply(original, Config, [name, key])
    })
    try {
        for (const value of ['phi', 'custom', '', '(?:pg|pgr)']) {
            head = value
            const concrete = value === '(?:pg|pgr)' ? 'pg' : value
            const proposal = new aliasProposal()
            const update = new phiupdate()
            assert.ok(proposal.rule)
            assert.ok(update.rule)
            assert.ok(new RegExp(proposal.rule[0].reg).test(`/${concrete} alias submit song | alias`))
            assert.ok(new RegExp(update.rule[0].reg).test(`/${concrete} gx`))
            assert.ok(new RegExp(update.rule[1].reg).test(`/${concrete} down ill`))
            if (head !== 'phi') assert.equal(new RegExp(proposal.rule[0].reg).test('/phi alias submit song | alias'), false)
        }
    } finally { stub.mock.restore() }
})
