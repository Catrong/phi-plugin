import { createRequire } from 'module';
import send from '../model/send.js';
import Config from '../components/Config.js';
const require = createRequire(import.meta.url);
var PhigrosRe8
switch (process.platform) {
    //unix 系统内核
    case "darwin": {
        logger.info('[Phi-Plugin][re8] 导入 unix 模块');
        PhigrosRe8 = await require('../lib/PhigrosLibrary_linux.node');
        break;
    }
    //windows 系统内核
    case "win32": {
        logger.info('[Phi-Plugin][re8] 导入 windows 模块');
        PhigrosRe8 = await require('../lib/PhigrosLibrary_win.node');
        break;
    }
    default: {
        console.info(process.platform)
    }
}

var session = []

export class phire8 extends plugin {
    constructor() {
        super({
            name: 'phi-re8',
            dsc: 'phigros重置第八章',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)re8$`,
                    fnc: 're8'
                }
            ]
        })

    }

    async re8(e) {
        const save = await send.getsave_result(e)

        if (!save) {
            return true
        }

        session[e.user_id] = save.session

        this.setContext('dore8', false, 30)

        send.send_with_At(e, `本功能暂处于实验阶段，不保证存档的安全性，继续重置请发送 [确认] 进行确认`)

        return true
    }

    async dore8(e) {

        e = this.e
        logger.info(e.msg)
        if (e.msg.includes('确认')) {

            var stk = session[e.user_id]
            try {
                await PhigrosRe8.re8(stk)
            } catch (err) {
                e.reply(`重置失败！\n${err}`)
                return
            }

            send.send_with_At(e, '重置成功')

        } else {
            send.send_with_At(e, `取消成功`)
        }

        delete session[e.user_id]

        this.finish('dore8', false)
        return true
    }

}
