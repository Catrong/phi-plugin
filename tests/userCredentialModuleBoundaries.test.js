import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 读取模块源码，依赖边界测试只检查导入方向，不执行插件初始化。
 * @param {string} relativePath 相对插件根目录的文件路径
 */
function source(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('user credential modules keep a one-way dependency structure', () => {
    const credentials = source('model/user/userCredentials.js')
    const localSave = source('model/save/getSave.js')
    const apiSaveCache = source('model/save/getSaveFromApi.js')
    const credentialStore = source('model/user/userCredentialStore.js')
    const fileRepository = source('model/filesystem/getFile.js')
    const request = source('model/api/makeRequest.js')

    assert.doesNotMatch(credentials, /(?:from\s+|import\()['"]\.\.\/render\/send\.js/)
    assert.doesNotMatch(credentials, /getUpdateSave/)
    assert.doesNotMatch(request, /(?:from\s+|import\()['"]\.\.\/render\/send\.js/)

    assert.doesNotMatch(localSave, /(?:from\s+|import\()['"](?:\.\.\/user\/userCredentials|\.\/getSaveFromApi|\.\.\/api\/makeRequest)\.js/)
    assert.doesNotMatch(apiSaveCache, /(?:from\s+|import\()['"](?:\.\.\/user\/(?:userCredentials|userCredentialStore)|\.\.\/api\/makeRequest)\.js/)
    assert.doesNotMatch(credentialStore, /(?:from\s+|import\()['"](?:\.\/userCredentials|\.\.\/save\/(?:getSave|getSaveFromApi)|\.\.\/api\/makeRequest)\.js/)
    assert.doesNotMatch(fileRepository, /(?:from\s+|import\()['"]\.\.\/save\/getSave\.js/)
})

test('model root only contains its directory guide', () => {
    const rootFiles = fs.readdirSync(path.join(root, 'model'), { withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => entry.name)

    assert.deepEqual(rootFiles, ['README.md'])
})
