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

/**
 * 文字列表現を真偽値へ変換します。
 *
 * HTMLフォームやURLクエリから取得した値のように、`"true"`, `"false"`, `"1"`, `"0"` といった
 * 文字列を安全にBooleanへマッピングしたい場合に使用します。
 *
 * - 真と判定される値: `true`, `"true"`, `"1"`, `"yes"`, `"on"`
 * - 偽と判定される値: `false`, `"false"`, `"0"`, `"no"`, `"off"`
 * - 上記に該当しない場合は `fallback` を返します（指定がなければ `undefined`）
 *
 * @param value - 判定したい値
 * @param fallback - 判定できなかった場合に返すフォールバック値
 * @returns 変換された真偽値。判定できない場合は `fallback`
 */
export const parseBoolean = (
  value: unknown,
  fallback?: boolean
): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return fallback;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }

    return fallback;
  }

  return fallback;
};
