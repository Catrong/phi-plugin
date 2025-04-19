import { stdout as slog } from 'single-line-log';

export default class ProgressBar {
    constructor(dsc, bar_length) {
        /**进度条的描述信息 */
        this.dsc = dsc || '进度';
        /**进度条的长度(单位：字符)，默认设为 25 */
        this.length = bar_length || 25;
    }

    // 刷新进度条图案、文字的方法
    render = function (opts) {
        var cell_num = Math.floor((opts.completed / opts.total) * this.length);             // 计算需要多少个 █ 符号来拼凑图案

        // 拼接黑色条
        var cell = '';
        for (var i = 0; i < cell_num; i++) {
            cell += '█';
        }

        // 拼接灰色条
        var empty = '';
        for (var i = 0; i < this.length - cell_num; i++) {
            empty += '░';
        }

        // 在单行输出文本
        slog(`${this.dsc}：${cell}${empty} ${opts.completed}/${opts.total}`);
    };
}