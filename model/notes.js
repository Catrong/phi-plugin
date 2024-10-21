import fs from 'fs'
import readFile from './getFile.js'

function com(json) {
    let notes = { tap: 0, drag: 0, hold: 0, flicke: 0 }
    // let notes = [0, 0, 0, 0]
    for (let i in json.judgeLineList) {
        let line = json.judgeLineList[i]
        let list = [...line.notesAbove, ...line.notesBelow]
        for (let j in list) {
            let note = list[j]
            switch (note.type) {
                case 1:
                    notes.tap++
                    break
                case 2:
                    notes.drag++
                    break
                case 3:
                    notes.hold++
                    break
                case 4:
                    notes.flicke++
                    break
            }
            // notes[note.type - 1]++
        }
    }
    return notes
}


// let files = fs.readdirSync("../../../../tools/wen_jiang/Chart_IN")
// console.info(files)

// let ans = {}

// for (let i in files) {
//     console.info(files[i])
//     ans[files[i].replace(/.0.json/g, '')] = {}
//     let json = await readFile.FileReader(`../../../../tools/wen_jiang/Chart_EZ/${files[i]}`)
//     ans[files[i].replace(/.0.json/g, '')]['EZ'] = com(json)
// }
// for (let i in files) {
//     console.info(files[i])
//     let json = await readFile.FileReader(`../../../../tools/wen_jiang/Chart_HD/${files[i]}`)
//     ans[files[i].replace(/.0.json/g, '')]['HD'] = com(json)
// }
// for (let i in files) {
//     console.info(files[i])
//     let json = await readFile.FileReader(`../../../../tools/wen_jiang/Chart_IN/${files[i]}`)
//     ans[files[i].replace(/.0.json/g, '')]['IN'] = com(json)
// }
// for (let i in files) {
//     console.info(files[i])
//     let json = await readFile.FileReader(`../../../../tools/wen_jiang/Chart_AT/${files[i]}`)
//     ans[files[i].replace(/.0.json/g, '')]['AT'] = com(json)
// }

// console.info(ans)



// readFile.SetFile("../resources/info/notesInfo.json", ans)

// let ans = await readFile.FileReader("../resources/info/notesInfo.json")

// 将 ans 对象转换为 CSV 格式
// let csvContent = "name,EZ_tap,EZ_drag,EZ_hold,EZ_flicke,HD_tap,HD_drag,HD_hold,HD_flicke,IN_tap,IN_drag,IN_hold,IN_flicke,AT_tap,AT_drag,AT_hold,AT_flicke\n";
// for (let key in ans) {
//     let row = `${key},${ans[key]['EZ']?.tap},${ans[key]['EZ']?.drag},${ans[key]['EZ']?.hold},${ans[key]['EZ']?.flicke},${ans[key]['HD']?.tap},${ans[key]['HD']?.drag},${ans[key]['HD']?.hold},${ans[key]['HD']?.flicke},${ans[key]['IN']?.tap},${ans[key]['IN']?.drag},${ans[key]['IN']?.hold},${ans[key]['IN']?.flicke},${ans[key]['AT']?.tap},${ans[key]['AT']?.drag},${ans[key]['AT']?.hold},${ans[key]['AT']?.flicke}\n`;
//     csvContent += row;
// }

// 保存为 CSV 格式的 txt 文件
// fs.writeFileSync('../resources/info/notesInfo.csv', csvContent);
// console.info('CSV file has been saved as notesInfo.txt.');
