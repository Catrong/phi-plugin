import { MAX_DIFFICULTY } from './constNum.js'

/** 定数表能够请求的最小定数：0 级谱面就近并入 1 级 */
const TABLE_DIF_MIN = 1

/** 定数表能够请求的最大定数：18 级谱面就近并入 17 级 */
const TABLE_DIF_MAX = 17

/**
 * 计算定数表查询实际展示的定数与档位。
 *
 * Phigros 中 0 级与 18 级的谱面各只有一首，分别就近并入 1 级与 17 级的定数表，
 * 因此 `#table 0` 等同于 `#table 1`、`#table 18` 等同于 `#table 17`；
 * 1 级的表格最上方显示 `1-`，17 级显示 `17+`，指令本身仍然使用 1 / 17。
 *
 * 每页最多展示 10 个 0.1 档位，1 级额外向下包含 0.x 档位，17 级额外向上包含
 * 18.x 至 {@link MAX_DIFFICULTY} 的档位。
 *
 * @param {number} dif 指令请求的定数
 * @returns {{difficulty: number, label: string, buckets: string[]}} 实际展示的定数、标题文本与升序排列的 0.1 档位
 */
export function getTableDifficulty(dif) {
    const difficulty = Math.min(Math.max(dif, TABLE_DIF_MIN), TABLE_DIF_MAX)
    const from = Math.round((difficulty === TABLE_DIF_MIN ? 0 : difficulty) * 10)
    const to = Math.round((difficulty === TABLE_DIF_MAX ? MAX_DIFFICULTY : difficulty + 0.9) * 10)
    /** @type {string[]} */
    const buckets = []
    for (let tenth = from; tenth <= to; tenth++) {
        buckets.push((tenth / 10).toFixed(1))
    }
    return {
        difficulty,
        label: difficulty === TABLE_DIF_MIN ? '1-' : difficulty === TABLE_DIF_MAX ? '17+' : String(difficulty),
        buckets,
    }
}
