import Config from './components/Config.js'
import { createGuobaConfigInfo } from './components/settings/guoba.js'

// 支持锅巴
export function supportGuoba() {
    return {
        // 插件信息，将会显示在前端页面
        // 如果你的插件没有在插件库里，那么需要填上补充信息
        // 如果存在的话，那么填不填就无所谓了，填了就以你的信息为准
        pluginInfo: {
            name: 'phi-plugin',
            title: 'Phi-Plugin',
            author: '@Catrong',
            authorLink: 'https://github.com/Catrong',
            link: 'https://gitee.com/Catrong/phi-plugin',
            isV3: true,
            isV2: false,
            description: 'Phigros查分及娱乐插件',
            // 显示图标，此为个性化配置
            // 图标可在 https://icon-sets.iconify.design 这里进行搜索
            icon: 'icon-park-solid:pigeon',
            // 图标颜色，例：#FF0000 或 rgb(255, 0, 0)
            iconColor: '#000'
        },
        // 配置项信息
        configInfo: createGuobaConfigInfo(Config),
    }
}
