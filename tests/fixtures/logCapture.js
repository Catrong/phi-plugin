import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Logger } = /** @type {any} */ (require('koishi'))

/** @type {string[]} */
const logs = []

// 只收集警告与错误，避免测试输出被重复打印；每个测试文件由 node --test 单独进程执行。
Logger.targets.push({
    name: 'phi-test-capture',
    record: (/** @type {any} */ record) => {
        if (record.type === 'warn' || record.type === 'error') logs.push(String(record.content))
    },
})

/** 清空并返回本进程捕获到的警告与错误文本。 @returns {string[]} */
export function captureWarnings() {
    logs.length = 0
    return logs
}
