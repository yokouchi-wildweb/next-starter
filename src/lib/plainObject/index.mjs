// src/lib/plainObject/index.mjs
// 素のオブジェクト(object リテラル・JSON.parse の結果・Object.create(null))かどうかの判定。
// .mjs なのは、tsx を通さない Node の道具からも TS からも同じ物を読むため(仕組み: ./README.md)

/**
 * 素のオブジェクトか: null でない object で、prototype が Object.prototype か null。
 * 配列・Date・Map・クラスのインスタンスは素ではない
 *
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
