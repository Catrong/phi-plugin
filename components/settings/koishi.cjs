const { Schema } = require('koishi')
const { editable, defaults, readGeneratedSettings } = require('./shared.cjs')
const { shortcutCommands, commandCategories, defaultShortcutCommands, defaultShortcutCategories } = require('../platform/koishiCommandNames.cjs')

function createKoishiSchema() {
    const groups = [...new Set(editable.map(item => item.group))]
    return Schema.intersect([Schema.object({
        __updatePlugin: Schema.any().role('phi-plugin-update', { target: 'plugin' }).description('更新插件'),
        __updateArtwork: Schema.any().role('phi-plugin-update', { target: 'artwork' }).description('更新曲绘库'),
    }), Schema.object({
        koishiShortcuts: Schema.union([Schema.const(null), Schema.array(Schema.union([
            ...shortcutCommands.map(item => Schema.const(`command:${item.id}`)),
            ...Object.keys(commandCategories).map(key => Schema.const(`category:${key}`)),
        ]))]).default(null).role('phi-plugin-shortcuts', {
            tree: Object.entries(commandCategories).map(([key, [name, label]]) => ({
                id: `category:${key}`, label: `${label} (${name})`,
                children: shortcutCommands.filter(item => item.key === key).map(item => ({ id: `command:${item.id}`, label: item.name })),
            })),
            commands: defaultShortcutCommands, categories: defaultShortcutCategories,
        }).description('快捷指令'),
        koishiShortcutCommands: Schema.array(Schema.union(shortcutCommands.map(item =>
            Schema.const(item.id).description(`${item.name} · ${commandCategories[item.key][1]}`),
        ))).hidden().max(25).default(defaultShortcutCommands)
            .description('快捷指令：勾选的功能直接放在指令头下，如 /p b30；取消勾选后仅在已选分类中显示。'),
        koishiShortcutCategories: Schema.array(Schema.union(Object.entries(commandCategories).map(([key, [name, label]]) =>
            Schema.const(key).description(`${label} (${name})`),
        ))).hidden().default(defaultShortcutCategories)
            .description('快捷分类：勾选后显示该分类下的其余功能，如 /p songs alias。未选的功能仍支持聊天调用。全部取消可关闭快捷菜单。指令与非空分类合计最多 25 个顶层入口，保存后自动重载并同步。'),
    }).description('Koishi 快捷指令'), ...groups.map(group => Schema.object(Object.fromEntries(
        editable.filter(item => item.group === group).map(item => {
            /** @type {import('koishi').Schema<any>} */
            let schema
            if (item.type === 'boolean') schema = Schema.boolean()
            else if (item.type === 'number') {
                schema = Schema.number()
                if (item.min !== undefined) schema = schema.min(item.min)
                if (item.max !== undefined) schema = schema.max(item.max)
                if (item.step !== undefined) schema = schema.step(item.step)
            } else if (item.type === 'select') {
                /** @type {import('koishi').Schema<any>[]} */
                const options = (item.options || []).map(option => Schema.const(option.value).description(option.label))
                if (item.allowCustom) options.push(Schema.string().description('自定义地址'))
                schema = Schema.union(options)
            } else {
                schema = Schema.string()
                if (item.secret) schema = schema.role('secret')
                if (item.allowFalse) schema = Schema.union([Schema.const(false).description('不使用代理'), schema])
            }
            schema = schema.description(`${item.label}：${item.description || ''}`).default(defaults[item.key])
            if (item.generated) {
                Object.defineProperty(schema.meta, 'default', {
                    enumerable: true,
                    get: () => readGeneratedSettings()[item.key],
                })
            }
            return [item.key, schema]
        }),
    )).description(group))])
}

module.exports = { createKoishiSchema, Config: createKoishiSchema() }
