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
