import chalk from 'chalk';

/** 依赖库列表 */
export const needPackage = [
    '@vikadata/vika',
    'crypto-js',
    'csv',
    'csvtojson',
    'jszip',
    'node-csv',
    'pinyin-pro',
    'qrcode',
];

/** 检查依赖库 */
export async function checkPackage() {
    for (let pkgName of needPackage) {
        try {
            await import(pkgName);
        } catch (e) {
            packageTips(e);
            return false;
        }
    }
    return true;
}

function extractPackageName(errorStack) {
    return errorStack.match(/'(.+?)'/)[0].replace(/'/g, '');
}

export function packageTips(error) {
    const loggerMark = logger.mark.bind(logger);

    loggerMark('---- Phi插件启动失败 ----');
    const missingPackage = chalk.red(extractPackageName(error.stack));
    const packageName = chalk.white(extractPackageName(error.stack));
    loggerMark(`缺少依赖：${missingPackage}`);
    loggerMark(`请在插件目录下执行安装依赖命令：pnpm install ${packageName}`);
    loggerMark('---------------------');
}
