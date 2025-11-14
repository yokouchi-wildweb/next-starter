// src/utils/math.ts

/**
 * 指定した範囲内のランダムな数値を返す（float）
 * @param min 最小値（含む）
 * @param max 最大値（含まない）
 * @returns min以上max未満のランダムな数値
 */
export const getRandomInRange = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

/**
 * Deterministically generate a pseudo random number within a range.
 *
 * Uses a simple sine based algorithm so the value will be the same
 * for the same seed on both the server and client.
 */
export const getDeterministicRandomInRange = (
  seed: number,
  min: number,
  max: number,
): number => {
  const x = Math.sin(seed + 1) * 10000;
  const r = x - Math.floor(x);
  return r * (max - min) + min;
};

/**
 * 指定した範囲内で振り子運動のように値を繰り返し返す関数
 *
 * @param sheed - 現在のステップ数（0から始まる整数）
 * @param min - 値の最小値（振り子の左端）
 * @param max - 値の最大値（振り子の右端）
 * @param step - 値の増加量（変化の間隔、小数も可）
 * @returns 振り子状に循環する値
 */
export function getSwingValue(sheed: number, min: number, max: number, step: number): number {
  const range: number[] = [];

  // 上り方向（min → max）を作成
  for (let i = 0; i <= (max - min) / step; i++) {
    range.push(min + i * step);
  }

  // 下り方向（max → min）を作成（端点は重複させず）
  for (let i = (max - min) / step - 1; i > 0; i--) {
    range.push(min + i * step);
  }

  // 現在のステップに対応するインデックスを求め、値を返す
  const index = sheed % range.length;
  return range[index];
}

/**
 * 指定した確率で抽選を行う関数
 * @param denominator 分母（例：10）
 * @param numerator 分子（例：3）→ 3/10 の確率
 * @returns 抽選成功なら true、失敗なら false
 */
export function hitByRate(denominator: number, numerator: number): boolean {
  if (denominator <= 0) throw new Error("Denominator must be greater than 0");
  if (numerator < 0 || numerator > denominator)
    throw new Error("Numerator must be between 0 and denominator");

  const rand = Math.random(); // 0以上1未満の乱数
  return rand < numerator / denominator;
}

