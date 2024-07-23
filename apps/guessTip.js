
// export class phiGuessMic extends plugin {
//         constructor() {
//         super({
//             name: 'phi-b19',
//             dsc: 'phiros b19查询',
//             event: 'message',
//             priority: 1000,
//             rule: [
//                 {
//                     reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(b[0-9]+|rks|pgr|PGR|B[0-9]+|RKS).*$`,
//                     fnc: 'b19'
//                 },
//                 {
//                     reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)best(\\s*)[1-9]?[0-9]?$`,
//                     fnc: 'bestn'
//                 },
//                 {
//                     reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(score|单曲成绩)[1-2]?.*$`,
//                     fnc: 'singlescore'
//                 },
//                 {
//                     reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)(suggest|推分(建议)?)$`,
//                     fnc: 'suggest'
//                 },
//                 {
//                     reg: `^[#/](${Config.getDefOrConfig('config', 'cmdhead')})(\\s*)chap.*$`,
//                     fnc: 'chap'
//                 }
//             ]
//         })
//     }
// }