// src/features/core/pairedDevice/utils/scopeContains.ts

/**
 * JSONB の @> と同じ判定（container が pattern を含むか）。
 * manageableScopes の 1 件ごとの権限判定に使う（一覧の SQL 側は @> そのもの）。
 */
export function scopeContains(container: unknown, pattern: unknown): boolean {
  if (pattern === null || typeof pattern !== "object") {
    return container === pattern;
  }
  if (Array.isArray(pattern)) {
    if (!Array.isArray(container)) return false;
    return pattern.every((item) => container.some((candidate) => scopeContains(candidate, item)));
  }
  if (container === null || typeof container !== "object" || Array.isArray(container)) {
    return false;
  }
  return Object.entries(pattern as Record<string, unknown>).every(([key, value]) =>
    scopeContains((container as Record<string, unknown>)[key], value),
  );
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** JSON に損失なく往復できる値か（undefined・関数・NaN / Infinity・Date 等のクラスを含まない） */
function isJsonSafe(value: unknown): boolean {
  if (value === null) return true;
  switch (typeof value) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(value);
    case "object":
      if (Array.isArray(value)) return value.every(isJsonSafe);
      return isPlainObject(value) && Object.values(value).every(isJsonSafe);
    default:
      return false;
  }
}

/**
 * manageableScopes の 1 件（scope の部分オブジェクト）として使えるか。
 * - キーを 1 つ以上持つプレーンオブジェクトであること（`{}` は全件に一致するので不可。全件は "all" で表す）
 * - 値がすべて JSON に損失なく往復できること。`{ storeId: undefined }` は JSON にすると `{}` になり
 *   SQL の @> では全件に一致してしまうため、キーを消して使うのではなくパターンごと拒否する
 */
export function isValidScopePattern(pattern: unknown): pattern is Record<string, unknown> {
  return isPlainObject(pattern) && Object.keys(pattern).length > 0 && isJsonSafe(pattern);
}
