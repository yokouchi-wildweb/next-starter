// src/utils/object.ts

/**
 * オブジェクトから `undefined` の値を持つプロパティを取り除きます。
 *
 * @param input - 対象のオブジェクト
 * @returns `undefined` を含まない新しいオブジェクト
 */
export function omitUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};

  for (const key in input) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      continue;
    }

    const value = input[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}
