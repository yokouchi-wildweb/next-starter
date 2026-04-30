// src/lib/audit/diff.ts

import { isDenylistedField } from "./denylist";

/**
 * 監査ログ用の差分計算結果。
 * - changedFields: 変更が検出されたフィールド名一覧
 * - before / after: 変更されたフィールドのみを抜き出した shallow コピー
 * - hasChanges: 1 つでも変更があれば true
 */
export type AuditDiff = {
  hasChanges: boolean;
  changedFields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

/**
 * before / after のうち trackedFields に含まれるフィールドだけを比較し、
 * 値が変わったものだけを抜き出す。
 *
 * - trackedFields 省略時は両者の union を対象にする
 * - denylist 対象のフィールドは結果に含めない（誤って機微情報を保存しないためのガード）
 * - 値の比較は JSON.stringify ベース（参照比較ではなく値ベース）
 *
 * 大量データの一括 update 等で使うため、O(n) で完結させる。
 */
export function computeAuditDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  trackedFields?: readonly string[],
): AuditDiff {
  const fields = trackedFields
    ? Array.from(new Set(trackedFields))
    : Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));

  const beforeChanged: Record<string, unknown> = {};
  const afterChanged: Record<string, unknown> = {};
  const changedFields: string[] = [];

  for (const field of fields) {
    if (isDenylistedField(field)) continue;
    const b = before?.[field];
    const a = after?.[field];
    if (isDeepEqual(b, a)) continue;
    beforeChanged[field] = sanitize(b);
    afterChanged[field] = sanitize(a);
    changedFields.push(field);
  }

  return {
    hasChanges: changedFields.length > 0,
    changedFields,
    before: changedFields.length ? beforeChanged : null,
    after: changedFields.length ? afterChanged : null,
  };
}

/**
 * Date / undefined / プリミティブ / オブジェクトをまとめて値ベースで比較する。
 * jsonb / 配列 / Date が主な比較対象。深いネストでも問題ない範囲で機能する。
 */
function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return a === b;
  if (a === null || b === null) return a === b;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * undefined を null に正規化、Date を ISO 文字列化（jsonb 永続化を想定）。
 */
function sanitize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}
