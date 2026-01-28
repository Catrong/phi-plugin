/**
 * @type {any} segment 消息段处理模块
 */
let segment;

// @ts-ignore
if (!global.segment) {
  try {
    // @ts-ignore
    segment = (await import("icqq")).segment
  } catch {
    segment = (await import("oicq")).segment
  }
} else {
  // @ts-ignore
  segment = global.segment
}

export default segment;