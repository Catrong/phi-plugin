import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import get from '../model/getdata.js'
import Vika from '../model/Vika.js'
import { segment } from 'oicq'
import common from '../../../lib/common/common.js'

const read = 'https://www.bilibili.com/read/cv27354116'
const sheet = 'https://f.kdocs.cn/g/fxsg4EM2/'
const word = [get.getimg('dan_code')]

const cancanneed = Vika.PhigrosDan ? true : false

if (!cancanneed) {
    logger.info(`[Phi-Plugin]未填写 Vika Token ，将禁用段位认证。`)
}

export class phiDan extends plugin {
    constructor() {
        super({
            name: 'phi-dan',
            dsc: 'phigros屁股肉段位',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(Dan|dan)(\\s*)(bind|update)$`,
                    fnc: 'danupdate'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(Dan|dan).*$`,
                    fnc: 'dan'
                },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(sessionToken)$`,
                    fnc: 'sstk'
                },

            ]
        })

    }

    async dan(e) {
        if (!cancanneed) {
            return false
        }
        let name = e.msg.replace(/[#/].*(dan|Dan)(\s*)/g, '')
        if (!name) {
            let plugindata = await get.getpluginData(e.user_id)
            try {
                let dan = plugindata.plugin_data.CLGMOD;

                if (Object.prototype.toString.call(dan) == '[object Array]') {
                    let resmsg = [`你的认证段位为`]
                    for (let i in dan) {
                        resmsg.push(`\n${dan[i].Dan.replace('/', ' ')} ${dan[i].EX ? 'EX' : ''}`)
                        resmsg.push(segment.image(dan[i].img))
                        send.send_with_At(e, resmsg)
                        resmsg = []
                    }
                } else {
                    send.send_with_At(e, `你的认证段位为 ${dan.Dan.replace('/', ' ')}`)
                    send.send_with_At(e, segment.image(dan.img))
                }

                return true
            } catch (err) {
                send.send_with_At(e, [`唔，本地没有你的认证记录哦！如果提交过审核的话，可以试试更新一下嗷！\n格式：/${Config.getDefOrConfig('config', 'cmdhead')} dan update`, word])
                return true
            }
        } else {
            try {
                let dan = await Vika.GetUserDanByName(name);
                if (!dan) {
                    send.send_with_At(e, [`唔，暂时没有在审核通过列表里找到你哦！如果提交过审核的话，请耐心等待审核通过哦！`, word])
                    return true
                }
                let plugindata = await get.getpluginData(e.user_id)
                plugindata.plugin_data.CLGMOD = dan
                let resmsg = [`${name}的认证段位为\n`]
                for (let i in dan) {
                    resmsg.push(`${dan[i].Dan.replace('/', ' ')} ${dan[i].EX ? 'EX' : ''}`)
                    resmsg.push(segment.image(dan[i].img))
                    send.send_with_At(e, resmsg)
                    resmsg = []
                }
                return true
            } catch (err) {
                console.info(err)
                send.send_with_At(e, `当前服务忙，请稍后重试QAQ！`)
                return true
            }
        }
        send.send_with_At(e, word)
    }

    async danupdate(e) {
        if (!cancanneed) {
            return false
        }
        let save = await send.getsave_result(e)

        if (!save) {
            return true
        }
        let dan
        try {

            dan = await Vika.GetUserDanBySstk(save.session);

        } catch (err) {
            console.info(err)
            send.send_with_At(e, `当前服务忙，请稍后重试QAQ！`)
            return true
        }


        if (!dan) {
            send.send_with_At(e, [`唔，暂时没有在审核通过列表里找到你哦！如果提交过审核的话，请耐心等待审核通过哦！`, word])
            return true
        }
        let plugindata = await get.getpluginData(e.user_id, true)
        if (!plugindata.plugin_data) {
            plugindata.plugin_data = {}
        }
        plugindata.plugin_data.CLGMOD = dan
        get.putpluginData(e.user_id, plugindata)
        let resmsg = [`更新成功！你的认证段位为\n`]
        for (let i in dan) {
            resmsg.push(`${dan[i].Dan.replace('/', ' ')} ${dan[i].EX ? 'EX' : ''}`)
            resmsg.push(segment.image(dan[i].img))
            send.send_with_At(e, resmsg)
            resmsg = []
        }
        return true
    }

    async sstk(e) {
        if (e.isGroup) {
            send.send_with_At(e, `请私聊使用嗷`)
            return false
        }
        let save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        send.send_with_At(e, `sessionToken: ${save.session}\nObjectId: ${save.saveInfo.objectId}\nQQGuildId: ${e.user_id}`)

    }
}
