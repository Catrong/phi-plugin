import { getPlatformAdapter, setPlatformAdapter } from './state.js'

// Koishi 在加载业务模块前注入适配器；没有注入时保持 Yunzai 默认行为。
if (!getPlatformAdapter()) {
    const { default: yunzaiAdapter } = await import('./yunzai.js')
    setPlatformAdapter(yunzaiAdapter)
}

export * from './state.js'
export { default } from './state.js'
