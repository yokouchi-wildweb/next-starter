// src/lib/firestore/timestamps.ts
// Firestore の Timestamp を Date に戻す再帰(1 つだけ)。SDK は読まない: Timestamp かどうかの判定は呼ぶ側が自分の SDK で渡す
// (画面側 = lib/firestore/client の convertTimestamps、保存側 = lib/crud/firestore の convertTimestamps)

/** toDate() を持つ Timestamp(firebase/firestore と firebase-admin/firestore の両方が満たす形) */
export type TimestampLike = { toDate(): Date };

/** 中に入って値を変換するオブジェクトかどうか: 素のオブジェクト(prototype が Object か null)だけ。Date・GeoPoint・参照などのインスタンスはそのまま返す */
function shouldWalk(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * data の中の Timestamp(isTimestamp が真の値)を Date に再帰的に変換する。配列と素のオブジェクトの中も辿り、それ以外のインスタンスはそのまま
 * Server Components → Client Components へ渡せる形にする(Timestamp はそのままでは渡せない)
 */
export function convertTimestampsWith<T>(data: T, isTimestamp: (value: unknown) => value is TimestampLike): T {
  const walk = (value: unknown): unknown => {
    if (value === null || value === undefined) return value;
    if (isTimestamp(value)) return value.toDate();
    if (Array.isArray(value)) return value.map(walk);
    if (typeof value === "object" && shouldWalk(value)) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
    }
    return value;
  };
  return walk(data) as T;
}
