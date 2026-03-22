import Config from '../components/Config.js'
import picmodle from '../model/picmodle.js'
import getInfo from '../model/getInfo.js'
import getNotes from '../model/getNotes.js'
import phiPluginBase from '../components/baseClass.js'
import { USER_SETTING_META, USER_SETTING_OPTIONS } from '../model/constNum.js'
import getBanGroup from '../model/getBanGroup.js'
import send from '../model/send.js'

/**@import {botEvent} from '../components/baseClass.js' */

/**直接从guoba.support.js导入设置 */
let configInfo = (await import('../guoba.support.js')).supportGuoba().configInfo


export class phihelp extends phiPluginBase {
    constructor() {
        super({
            name: 'phi-setting',
            dsc: 'phigros屁股肉设置',
            event: 'message',
            priority: 1001,
            rule: [
                {
                    reg: `^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(用户设置|个人设置|mysetting|myset)(\\s*.*)?$`,
                    fnc: 'showUserSetting'
                },
                {
                    reg: `^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(设置|set).*$`,
                    fnc: 'set'
                }
            ]
        })

    }

    /**
     * 
     * @param {botEvent} e 
     * @returns 
     */
    async set(e) {
        if (!e.isMaster) {
            return false;
        }
        let schemas = configInfo.schemas

        /**修改设置部分 */
        let msg = e.msg.replace(new RegExp(`^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(设置|set)`), '')
        for (let i in schemas) {
            let schema = schemas[i]
            if (!schema.field) continue

            const field = /**@type {configName} */(schema.field)
            if (msg.match(schema.label)) {
                let value = msg.replace(schema.label, '')
                switch (schema.component) {
                    case 'Select':
                        let options = schema.componentProps?.options
                        if (!options) break;
                        for (let j = 0; j < options.length; j++) {
                            if (options[j].label == value) {
                                Config.modify('config', field, options[j].value)
                                break;
                            }
                        }
                        break;
                    case 'Input':
                        Config.modify('config', field, value)
                        break;
                    case 'InputNumber':
                        Config.modify('config', field, Math.max(Math.min(Number(value), schema.componentProps?.max || Infinity), schema.componentProps?.min || -Infinity))
                        break;
                    case 'Switch':
                        switch (value) {
                            case 'true':
                            case 'ON':
                            case 'on':
                            case '开启':
                            case '开':
                                Config.modify('config', field, true)
                                break;
                            case 'false':
                            case 'OFF':
                            case 'off':
                            case '关闭':
                            case '关':
                                Config.modify('config', field, false)
                                break;
                            default:
                                break;
                        }
                        break;
                    case 'RadioGroup': {
                        let options = schema.componentProps?.options
                        if (!options) break;
                        for (let j = 0; j < options.length; j++) {
                            if (options[j].label == value) {
                                Config.modify('config', field, options[j].value)
                                break;
                            }
                        }
                        break;
                    }
                    default:
                        break;
                }
            }
        }


        /**渲染图片部分 */
        let config = configInfo.getConfigData()
        let data = []
        for (let i in schemas) {
            let schema = schemas[i]
            switch (schema.component) {
                case 'Divider':
                    data.push({
                        label: schema.label,
                        type: 'divider'
                    })
                    break;
                case 'Select':
                    if (!schema.field) break;
                    // @ts-ignore
                    let value = config[schema.field]
                    let options = schema.componentProps?.options
                    if (!options) break;
                    for (let j = 0; j < options.length; j++) {
                        if (options[j].value == value) {
                            value = options[j].label
                            break;
                        }
                    }
                    data.push({
                        label: schema.label,
                        bottomHelpMessage: schema.bottomHelpMessage,
                        type: 'space',
                        value,
                    })
                    break;
                case 'Input':
                case 'InputNumber':
                    if (!schema.field) break;
                    data.push({
                        label: schema.label,
                        bottomHelpMessage: schema.bottomHelpMessage,
                        type: 'space',
                        // @ts-ignore
                        value: config[schema.field],
                        // @ts-ignore
                        drc: schema.componentProps.addonAfter || ''
                    })
                    break;
                case 'Switch':
                    data.push({
                        label: schema.label,
                        bottomHelpMessage: schema.bottomHelpMessage,
                        type: 'switch',
                        // @ts-ignore
                        value: config[schema.field],
                    })
                    break;
                case 'RadioGroup':
                    if (!schema.field) break;
                    data.push({
                        label: schema.label,
                        bottomHelpMessage: schema.bottomHelpMessage,
                        type: 'space',
                        // @ts-ignore
                        value: schema.componentProps?.options.find(o => o.value == config[schema.field])?.label || '未知',
                    })
                    break;
                default:
                    break;
            }
        }
        // console.info(data)
        let plugin_data = await getNotes.getNotesData(e.user_id)
        e.reply(await picmodle.common(e, 'setting', {
            data,
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))]),
            theme: plugin_data?.theme || 'star'
        }))
    }

    /**
     * 渲染用户个性化设置展示图
     * @param {botEvent} e
     */
    async showUserSetting(e) {
        if (await getBanGroup.get(e, 'help')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }
        const pluginData = await getNotes.getNotesData(e.user_id)

        /**@type {Record<'theme' | 'b30AvgKind' | 'b30AvgColor', string[]>} */
        const settingKeyAlias = {
            theme: ['theme', '主题', '主题风格'],
            b30AvgKind: ['b30avgkind', 'b30kind', 'avgkind', '均值范围', '统计范围', '均值类型'],
            b30AvgColor: ['b30avgcolor', 'avgcolor', '颜色', '配色', '均值颜色']
        }

        /**@type {Record<'theme' | 'b30AvgKind' | 'b30AvgColor', Record<string, string>>} */
        const settingValueAlias = {
            theme: {
                default: 'default',
                snow: 'snow',
                star: 'star',
                dss2: 'dss2',
                默认: 'default',
                寒冬: 'snow',
                星空: 'star',
                使一颗心免于哀伤: 'star',
                大师赛2: 'dss2'
            },
            b30AvgKind: {
                all: 'all',
                b30: 'b30',
                top: 'top',
                全部: 'all',
                全部统计: 'all',
                仅b30: 'b30',
                仅top: 'top'
            },
            b30AvgColor: {
                red: 'red',
                gold: 'gold',
                blue: 'blue',
                green: 'green',
                红: 'red',
                红色: 'red',
                金: 'gold',
                金色: 'gold',
                蓝: 'blue',
                蓝色: 'blue',
                绿: 'green',
                绿色: 'green'
            }
        }

        const usage = [
            '用法示例：',
            `/${Config.getUserCfg('config', 'cmdhead')} 用户设置`,
            `/${Config.getUserCfg('config', 'cmdhead')} 用户设置 主题 star`,
            `/${Config.getUserCfg('config', 'cmdhead')} 用户设置 主题 3`,
            `/${Config.getUserCfg('config', 'cmdhead')} 用户设置 均值范围 b30`,
            `/${Config.getUserCfg('config', 'cmdhead')} 用户设置 配色 gold`
        ].join('\n')

        const rawArgs = e.msg.replace(new RegExp(`^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(用户设置|个人设置|mysetting|myset)`), '').trim()

        if (rawArgs) {
            const normalized = rawArgs.replace(/[：:=]/g, ' ').replace(/\s+/g, ' ').trim()
            const args = normalized.split(' ')

            if (args.length < 2) {
                send.send_with_At(e, `参数不足，请提供“设置项 + 目标值”。\n${usage}`)
                return true
            }

            const keyInput = args[0].toLowerCase()
            const valueInputRaw = args.slice(1).join('')
            const valueInput = valueInputRaw.toLowerCase()

            /**@type {'theme' | 'b30AvgKind' | 'b30AvgColor' | null} */
            let settingKey = null
            for (const key of /**@type {('theme' | 'b30AvgKind' | 'b30AvgColor')[]} */ (Object.keys(settingKeyAlias))) {
                if (settingKeyAlias[key].map(i => i.toLowerCase()).includes(keyInput)) {
                    settingKey = key
                    break
                }
            }

            if (!settingKey) {
                send.send_with_At(e, `未知设置项：${args[0]}\n支持：主题 / 均值范围 / 配色\n${usage}`)
                return true
            }

            const optionMap = /** @type {Record<string, { title: string, description: string }>} */ (USER_SETTING_OPTIONS[settingKey])
            const optionKeys = Object.keys(optionMap)
            const valueAliasMap = settingValueAlias[settingKey]

            let canonicalValue = valueAliasMap[valueInput] || valueAliasMap[valueInputRaw] || valueInputRaw

            // 支持通过 1 开始的序号选择：1=第一个选项
            if (/^\d+$/.test(valueInputRaw)) {
                const optionIndex = Number(valueInputRaw) - 1
                if (optionIndex >= 0 && optionIndex < optionKeys.length) {
                    canonicalValue = optionKeys[optionIndex]
                }
            }

            if (!optionMap[canonicalValue]) {
                const optionalValues = optionKeys.map((value, index) => `${index + 1}.${value}`).join(' / ')
                send.send_with_At(e, `无效值：${valueInputRaw}\n${USER_SETTING_META[settingKey].title} 可选：${optionalValues}`)
                return true
            }

            // @ts-ignore
            pluginData[settingKey] = canonicalValue
            await getNotes.putNotesData(e.user_id, pluginData)

            send.send_with_At(e, `设置成功：${USER_SETTING_META[settingKey].title} -> ${optionMap[canonicalValue].title}`)
        }

        /**
         * @param {'theme' | 'b30AvgKind' | 'b30AvgColor'} key
         * @param {string} current
         */
        const buildItem = (key, current) => {
            const options = /** @type {Record<string, { title: string, description: string }>} */ (USER_SETTING_OPTIONS[key])
            return {
                key,
                title: USER_SETTING_META[key].title,
                description: USER_SETTING_META[key].description,
                currentTitle: options[current]?.title || current,
                options: Object.keys(options).map((value) => ({
                    value,
                    title: options[value].title,
                    description: options[value].description,
                    selected: value === current
                }))
            }
        }

        const data = {
            pageTitle: 'Phi-Plugin 用户设置',
            pageDescription: '以下选项为你的个人偏好展示，选择结果将用于对应图片渲染。',
            items: [
                buildItem('theme', pluginData?.theme || 'default'),
                buildItem('b30AvgKind', pluginData?.b30AvgKind || 'all'),
                buildItem('b30AvgColor', pluginData?.b30AvgColor || 'red')
            ]
        }

        send.send_with_At(e, await picmodle.common(e, 'setting', {
            ...data,
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))]),
            theme: 'default'
        }, 'userSetting'))
        return true
    }
}
