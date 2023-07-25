import plugin from '../../../lib/plugins/plugin.js'
import Config from '../components/Config.js'
import get from '../model/getdata.js'

await get.init()

export class phiuser extends plugin {
    constructor() {
        super({
            name: 'phi-user',
            dsc: 'phi-plugin数据统计',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(data)$`,
                    fnc: 'data'
                }

            ]
        })

    }

    /**查询data */
    async data(e) {
        var User = await get.getsave(e.user_id)
        if (User) {
            if (User.gameProgress) {
                var data = User.gameProgress.money
                e.reply(`您的data数为：${data[4] ? `${data[4]}PiB ` : ''}${data[3] ? `${data[3]}TiB ` : ''}${data[2] ? `${data[2]}GiB ` : ''}${data[1] ? `${data[1]}MiB ` : ''}${data[0] ? `${data[0]}KiB ` : ''}`)
            } else {
                e.reply(`请先更新数据哦！\n#${Config.getDefOrConfig('config', 'cmdhead')} update`)
            }
        } else {
            e.reply(`没有找到你的数据哦！请先绑定！\n#${Config.getDefOrConfig('config', 'cmdhead')} bind <sessionToken>`)
        }
        return true
    }
}
