import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import get from '../model/getdata.js'
import Vika from '../model/Vika.js'
import { segment } from 'oicq'
import getSave from '../model/getSave.js'
import getBanGroup from '../model/getBanGroup.js';

const read = 'https://www.bilibili.com/read/cv27354116'
const sheet = 'https://f.kdocs.cn/g/fxsg4EM2/'
const word = get.getimg('dan_code')

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
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(Dan|dan)(\\s*)update$`,
                    fnc: 'danupdate'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(Dan|dan).*$`,
                    fnc: 'dan'
                }
            ]
        })

    }

    async dan(e) {
        if (!cancanneed) {
            return false
        }

        if (await getBanGroup.get(e, 'dan')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let name = e.msg.replace(/[#/].*(dan|Dan)(\s*)/g, '')
        if (!name) {
            let dan = await getSave.getDan(e.user_id, true)
            if (dan[0]) {
                let resmsg = [`你的认证段位为`]
                for (let i in dan) {
                    resmsg.push(`\n${dan[i].Dan.replace('/', ' ')} ${dan[i].EX ? 'EX' : ''}`)
                    resmsg.push(segment.image(dan[i].img))
                }
                send.send_with_At(e, resmsg)
            } else {
                send.send_with_At(e, [`唔，本地没有你的认证记录哦！如果提交过审核的话，可以试试更新一下嗷！\n格式：/${Config.getUserCfg('config', 'cmdhead')} dan update`, word])
            }

            return true

        } else {
            try {
                let dan = await Vika.GetUserDanByName(name);
                if (!dan) {
                    send.send_with_At(e, [`唔，暂时没有在审核通过列表里找到${name}哦！如果提交过审核的话，请耐心等待审核通过哦！`, word])
                    return true
                }
                let resmsg = [`${name}的认证段位为`]
                for (let i in dan) {
                    resmsg.push(`\n${dan[i].Dan.replace('/', ' ')} ${dan[i].EX ? 'EX' : ''}`)
                    resmsg.push(segment.image(dan[i].img))
                }
                send.send_with_At(e, resmsg)
                return true
            } catch (err) {
                logger.info(err)
                send.send_with_At(e, `当前服务忙，请稍后重试QAQ！` + err)
                return true
            }
        }
    }

    async danupdate(e) {
        if (!cancanneed) {
            return false
        }

        if (await getBanGroup.get(e, 'danupdate')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        /**检查是否绑定并提示 */
        let save = await send.getsave_result(e)
        if (!save) {
            return true
        }
        let dan = undefined
        try {
            dan = await Vika.GetUserDanBySstk(save.session);
        } catch (err) {
            logger.info(err)
            send.send_with_At(e, `当前服务忙，请稍后重试QAQ！` + err)
            return true
        }

        if (!dan) {
            send.send_with_At(e, [`唔，暂时没有在审核通过列表里找到你哦！如果提交过审核的话，请耐心等待审核通过哦！`, word])
            return true
        }

        let history = await getSave.getHistory(e.user_id)
        history.dan = dan
        getSave.putHistory(e.user_id, history)

        let resmsg = [`更新成功！你的认证段位为\n`]
        for (let i in dan) {
            resmsg.push(`${dan[i].Dan.replace('/', ' ')} ${dan[i].EX ? 'EX' : ''}`)
            resmsg.push(segment.image(dan[i].img))
        }
        send.send_with_At(e, resmsg)
        return true
    }

}
