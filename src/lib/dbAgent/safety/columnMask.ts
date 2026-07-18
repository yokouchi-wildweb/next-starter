// src/lib/dbAgent/safety/columnMask.ts
//
// クエリ結果の機微カラムをマスクする。
//
// カラム名の判定は監査ログと同じ思想の共有 denylist
// (@/lib/audit の isDenylistedField: password / token / secret / apikey 等) を使う。
// ハッシュ化済みの値であっても、モデルのコンテキスト (= 外部 API 送信) に
// 資格情報系の値を載せない方針。

import { isDenylistedField } from "@/lib/audit";

export const MASKED_VALUE = "***MASKED***";

/**
 * 行配列の denylist 対象カラムの値をマスクした新しい配列を返す。
 */
export function maskSensitiveColumns(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (rows.length === 0) return rows;

  const columns = Object.keys(rows[0]);
  const maskedColumns = columns.filter((c) => isDenylistedField(c));
  if (maskedColumns.length === 0) return rows;

  return rows.map((row) => {
    const copy: Record<string, unknown> = { ...row };
    for (const col of maskedColumns) {
      if (copy[col] !== null && copy[col] !== undefined) {
        copy[col] = MASKED_VALUE;
      }
    }
    return copy;
  });
}
