import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import get from '../model/getdata.js'
import Vika from '../model/Vika.js'
import { segment } from 'oicq'
import common from '../../../lib/common/common.js'

const read = '（建设中）'
const sheet = 'https://f.kdocs.cn/g/fxsg4EM2/'
const word = `想要了解有关 Phigros民间段位标准 的有关信息可以查看这个专栏！\n${read}\n提交审核请前往这个链接哦！\n${sheet}\n`

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

            ]
        })

    }

    async dan(e) {
        var name = e.msg.replace(/[#/].*(dan|dan)/g, '')
        if (!name) {
            var plugindata = await get.getpluginData(e.user_id)
            try {
                var dan = plugindata.plugin_data.CLGMOD;
                send.send_with_At(e, `你的认证段位为 ${dan.Dan.replace('/', ' ')}`)
                send.send_with_At(e, segment.image(dan.img))
                return true
            } catch (err) {
                console.info(err)
                send.send_with_At(e, `当前服务忙，请稍后重试QAQ！`)
                return true
            }
        } else {
            try {
                var dan = Vika.GetUserDanByName(name);
                if (!dan) {
                    send.send_with_At(e, `唔，暂时没有在审核通过列表里找到你哦！如果提交过审核的话，请耐心等待审核通过哦！${word}`)
                    return true
                }
                var plugindata = await get.getpluginData(e.user_id, true)
                plugindata.plugin_data.CLGMOD = dan
                get.putpluginData(e.user_id, plugindata)
                send.send_with_At(e, `你的认证段位为 ${dan.Dan.replace('/', ' ')} ${dan.EX ? 'EX' : ''}`)
                send.send_with_At(e, segment.image(dan.img))
                return true
            } catch (err) {
                console.info(err)
                send.send_with_At(e, `当前服务忙，请稍后重试QAQ！`)
                return true
            }
        }
        send.send_with_At(e, `${word}`)
    }

    async danupdate(e) {
        var save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        try {

            var dan = await Vika.GetUserDanBySstk(save.session);
            if (!dan) {
                await common.sleep(1000)
                dan = await Vika.GetUserDanById(save.saveInfo.objectId);
            }

        } catch (err) {
            console.info(err)
            send.send_with_At(e, `当前服务忙，请稍后重试QAQ！`)
            return true
        }

        if (!dan) {
            send.send_with_At(e, `唔，暂时没有在审核通过列表里找到你哦！如果提交过审核的话，请耐心等待审核通过哦！${word}`)
            return true
        }
        var plugindata = await get.getpluginData(e.user_id, true)
        plugindata.plugin_data.CLGMOD = dan
        get.putpluginData(e.user_id, plugindata)
        send.send_with_At(e, `更新成功！你的认证段位为 ${dan.Dan.replace('/', ' ')} ${dan.EX ? 'EX' : ''}`)
        send.send_with_At(e, segment.image(dan.img))
        return true
    }
}
