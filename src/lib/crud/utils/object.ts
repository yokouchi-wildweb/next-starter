// src/lib/crud/utils/object.ts
// サーバー側の小さなオブジェクトの道具(入口 ./server の omitUndefined)。自分のプロパティかの判定は組み込みの Object.hasOwn

/**
 * オブジェクトから `undefined` の値を持つプロパティを取り除きます。
 *
 * @param input - 対象のオブジェクト
 * @returns `undefined` を含まない新しいオブジェクト
 */
export function omitUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};

  for (const key in input) {
    if (!Object.hasOwn(input, key)) {
      continue;
    }

    const value = input[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}
