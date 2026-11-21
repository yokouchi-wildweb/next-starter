// src/lib/crud/utils/object.ts
// サーバー側の小さなオブジェクトの道具(Firestore のサービス・集まり・多対多と、入口 ./server の omitUndefined)。

/** 自分のプロパティとして key を持つか(継承した物は数えない) */
export function hasOwn(target: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

/**
 * オブジェクトから `undefined` の値を持つプロパティを取り除きます。
 *
 * @param input - 対象のオブジェクト
 * @returns `undefined` を含まない新しいオブジェクト
 */
export function omitUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};

  for (const key in input) {
    if (!hasOwn(input, key)) {
      continue;
    }

    const value = input[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}
