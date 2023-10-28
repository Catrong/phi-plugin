import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import send from '../model/send.js'
import get from '../model/getdata.js'
import atlas from '../model/picmodle.js'

export class phiset extends plugin {
    constructor() {
        super({
            name: 'phi-setting',
            dsc: 'phigros屁股肉设置',
            event: 'message',
            priority: 1000,
            rule: [
                // {
                //     reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(禁用|ban).*$`,
                //     fnc: 'ban'
                // },
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(repu)$`,
                    fnc: 'restartpu'
                },

            ]
        })

    }

    async ban(e) {
        if (e.msg.match(/guess|(猜)曲绘/g)) {
            Config.getDefOrConfig('config', 'ban').includes(e)
        }
    }

    async restartpu(e) {
        if (!(this.e.is_admin || this.e.isMaster)) {
            return true
        }
        try {
            await atlas.restart()
            send.send_with_At(e, `成功`)
        } catch (err) {
            send.send_with_At(e, err)
        }
    }

}