import plugin from '../../../lib/plugins/plugin.js'


export class phitest extends plugin {
    constructor() {
        super({
            name: 'phi-test',
            dsc: 'phigros屁股肉ces',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^test111$`,
                    fnc: 'mark'
                }

            ]
        })
    }

    async mark(e) {
        console.info(1)
        e.reply(segment.markdown("**加粗文字**\n*斜体文字*\n***加粗斜体***\n~~删除线~~\n---\n> hello world\n\n(ins)下划线内容(ins)\n(spl)剧透(spl)"))
        let content = [
            {
                type: 'card',
                size: 'lg',
                theme: 'warning',
                modules: [
                    {
                        type: 'header',
                        text: {
                            type: 'plain-text',
                            content: '近期活动公告',
                        },
                    },
                    {
                        type: 'divider',
                    },
                    {
                        type: 'section',
                        mode: 'left',
                        accessory: {
                            type: 'image',
                            src: 'https://img.kaiheila.cn/assets/2021-01/FckX3MDe6S02i020.png',
                            circle: true,
                        },
                        text: {
                            type: 'plain-text',
                            content:
                                '社区将在1月20日开启副本速通挑战，参与本次活动的小伙伴均有礼品相送！',
                        },
                    },
                    {
                        type: 'section',
                        text: {
                            type: 'kmarkdown',
                            content: '**报名方法**',
                        },
                    },
                    {
                        type: 'section',
                        mode: 'right',
                        accessory: {
                            type: 'button',
                            theme: 'primary',
                            value: '123',
                            text: {
                                type: 'plain-text',
                                content: '报名',
                            },
                        },
                        text: {
                            type: 'kmarkdown',
                            content: '点击右侧“报名”按钮，即可完成报名。',
                        },
                    },
                    {
                        type: 'section',
                        text: {
                            type: 'kmarkdown',
                            content: '**挑战奖励**\n',
                        },
                    },
                    {
                        type: 'section',
                        accessory: {},
                        text: {
                            type: 'paragraph',
                            cols: 3,
                            fields: [
                                {
                                    type: 'kmarkdown',
                                    content: '第一名',
                                },
                                {
                                    type: 'kmarkdown',
                                    content: '第二名',
                                },
                                {
                                    type: 'kmarkdown',
                                    content: '参与奖',
                                },
                                {
                                    type: 'kmarkdown',
                                    content: '游戏加速器年卡',
                                },
                                {
                                    type: 'kmarkdown',
                                    content: '游戏加速器季卡',
                                },
                                {
                                    type: 'kmarkdown',
                                    content: '游戏加速器月卡',
                                },
                            ],
                        },
                    },
                ],
            },
        ]
        e.reply("**加粗文字**\n*斜体文字*\n***加粗斜体***\n~~删除线~~\n---\n> hello world\n\n(ins)下划线内容(ins)\n(spl)剧透(spl)")
        // e.reply(`<MessagePreview type="card" content=${content} external="https://cdn.jsdelivr.net/npm/@kookapp/kook-message-preview@0.0.3/dist/markdown-parse.0.0.10.js"/>`)
        // console.info(Bot.adapter)
        // e.reply(segment.makeCardMsg(content))
    }
}
