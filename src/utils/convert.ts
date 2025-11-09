// src/utils/convert.ts

/**
 * 単位付きのCSS値（例: '50px', '30deg', '100%'）から数値部分だけを取り出して返します。
 * 主にアニメーション用に数値として扱いたい transform 値を処理するのに使用します。
 *
 * @param value - パース対象の文字列。単位付きでもOK（例: '50px'）
 * @param fallback - 無効な値だった場合に使用するデフォルト値（デフォルトは 0）
 * @returns 数値としてパースされた値。失敗した場合は fallback を返します。
 */
export const parseUnitValue = (value: string | undefined, fallback: number = 0): number => {

  console.log(value);

  if (!value) return fallback;

  // 文字列の先頭から数値を抽出（'50px' → 50）
  const num = parseFloat(value);

  // 数値でなければフォールバック値を返す
  return isNaN(num) ? fallback : num;
};
