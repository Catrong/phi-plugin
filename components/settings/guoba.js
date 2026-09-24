import shared from './shared.cjs'

/** @param {boolean} [includeCredentials] @returns {any[]} */
export function createGuobaSchemas(includeCredentials = true) {
    const items = shared.editable.filter(item => includeCredentials || !item.generated)
    const groups = [...new Set(items.map(item => item.group))]
    return groups.flatMap(group => [
        { label: group, component: 'SOFT_GROUP_BEGIN' },
        ...items.filter(item => item.group === group).map(item => ({
            field: item.key,
            label: item.label,
            bottomHelpMessage: item.description,
            component: item.type === 'number' ? 'InputNumber'
                : item.type === 'boolean' ? 'Switch'
                    : item.type === 'select' ? 'RadioGroup' : 'Input',
            required: item.required || false,
            componentProps: {
                ...(item.min === undefined ? {} : { min: item.min }),
                ...(item.max === undefined ? {} : { max: item.max }),
                ...(item.step === undefined ? {} : { step: item.step }),
                ...(item.options ? { options: item.options.map(option => ({ ...option })) } : {}),
                ...(item.unit ? { addonAfter: item.unit } : {}),
                ...(item.placeholder ? { placeholder: item.placeholder } : {}),
                ...(item.secret ? { type: 'password' } : {}),
            },
        })),
    ])
}

/** @param {any} config @param {{includeCredentials?: boolean}} [options] */
export function createGuobaConfigInfo(config, options = {}) {
    const items = shared.editable.filter(item => options.includeCredentials !== false || !item.generated)
    // 锅巴会解构后单独调用 setConfigData，方法内不能用 this
    const getConfigData = () => Object.fromEntries(items.map(item => [item.key, config.getUserCfg('config', item.key)]))
    return {
        schemas: createGuobaSchemas(options.includeCredentials !== false),
        getConfigData,
        /** @param {Record<string, any>} data */
        setConfigData(data) {
            const current = getConfigData()
            const values = shared.validateSettings({ ...current, ...data })
            for (const [key, value] of Object.entries(values)) {
                if (current[key] !== value) config.modify('config', key, value)
            }
        },
    }
}
