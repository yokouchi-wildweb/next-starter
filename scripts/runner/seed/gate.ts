// scripts/runner/seed/gate.ts
//
// seed の失敗の見分け(純関数。run.ts とテストが使う)。閉じた機能の判定は scan.ts の closedByOf(ドメインのフォルダを features に持つ規則)。

/** 表が無い(PostgreSQL 42P01 undefined_table)エラーか。drizzle が包んだ cause もたどる */
export function isUndefinedTableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    if ((current as { code?: unknown }).code === "42P01") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
