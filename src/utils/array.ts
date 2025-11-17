// src/utils/array.ts

/**
 * 任意の型の配列からランダムに1つの要素を返す関数（オプションで重み指定）
 *
 * @template T - 配列の要素の型
 * @param items - 候補となる要素の配列（文字列、数値など）
 * @param weights - 各要素に対応する重み（確率）。items と同じ長さで、すべての値は 0 以上。
 * @returns ランダムに選ばれた1つの要素
 * @throws 配列が空、weights の長さが一致しない、または負の重みがある場合はエラーを投げる
 */
export function getRandomItem<T>(items: T[], weights?: number[]): T {
  if (items.length === 0) {
    throw new Error("配列が空です");
  }

  if (weights) {
    if (weights.length !== items.length) {
      throw new Error("weights の長さが items と一致しません");
    }
    if (weights.some((w) => w < 0)) {
      throw new Error("重みは 0 以上でなければなりません");
    }

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const random = Math.random() * totalWeight;

    let cumulative = 0;
    for (let i = 0; i < items.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        return items[i];
      }
    }
  }

  // 重みが指定されていない場合は等確率で選ぶ
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}