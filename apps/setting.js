import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import picmodle from '../model/picmodle.js'
import getInfo from '../model/getInfo.js'
import getNotes from '../model/getNotes.js'


/**直接从guoba.support.js导入设置 */
let configInfo = (await import('../guoba.support.js')).supportGuoba().configInfo


export class phihelp extends plugin {
    constructor() {
        super({
            name: 'phi-setting',
            dsc: 'phigros屁股肉设置',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(设置|set).*$`,
                    fnc: 'set'
                }
            ]
        })

    }

    async set(e) {
        if (!e.isMaster) {
            e.reply("无权限");
            return false;
        }
        let schemas = configInfo.schemas

        /**修改设置部分 */
        let msg = e.msg.replace(new RegExp(`^[#/](pgr|PGR|屁股肉|phi|Phi|(${Config.getUserCfg('config', 'cmdhead')}))(\\s*)(设置|set)`), '')
        for (let i in schemas) {
            let schema = schemas[i]
            if (!schema.field) continue
            if (msg.match(schema.label)) {
                let value = msg.replace(schema.label, '')
                switch (schema.component) {
                    case 'Select':
                        let options = schema.componentProps.options
                        for (let j in options) {
                            if (options[j].label == value) {
                                Config.modify('config', schema.field, options[j].value)
                                break;
                            }
                        }
                        break;
                    case 'Input':
                        Config.modify('config', schema.field, value)
                        break;
                    case 'InputNumber':
                        Config.modify('config', schema.field, Math.max(Math.min(Number(value), schema.componentProps.max), schema.componentProps.min))
                        break;
                    case 'Switch':
                        switch (value) {
                            case 'true':
                            case 'ON':
                            case 'on':
                            case '开启':
                            case '开':
                                Config.modify('config', schema.field, true)
                                break;
                            case 'false':
                            case 'OFF':
                            case 'off':
                            case '关闭':
                            case '关':
                                Config.modify('config', schema.field, false)
                                break;
                            default:
                                break;
                        }
                        break;
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
                    let value = config[schema.field]
                    let options = schema.componentProps.options
                    for (let j in options) {
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
                    data.push({
                        label: schema.label,
                        bottomHelpMessage: schema.bottomHelpMessage,
                        type: 'space',
                        value: config[schema.field],
                        drc: schema.componentProps.addonAfter || ''
                    })
                    break;
                case 'Switch':
                    data.push({
                        label: schema.label,
                        bottomHelpMessage: schema.bottomHelpMessage,
                        type: 'switch',
                        value: config[schema.field],
                    })
                    break;
                default:
                    break;
            }
        }
        // console.info(data)
        let plugin_data = await getNotes.getPluginData(e.user_id)
        e.reply(await picmodle.common(e, 'setting', {
            data,
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))]),
            theme: plugin_data?.plugin_data?.theme || 'star'
        }))
    }
}
