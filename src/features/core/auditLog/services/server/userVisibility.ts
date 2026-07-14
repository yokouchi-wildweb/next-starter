// src/features/core/auditLog/services/server/userVisibility.ts
//
// USER_VISIBLE_AUDIT_ACTIONS（許可リスト）から、本人開示用の action フィルタ
// WhereExpr を組み立てる。GET /api/me/audit-logs が使用する。
//
// fail-closed: レジストリが空（= 何も許可されていない）場合は null を返し、
// 呼び出し側は DB を照会せず空結果を返すこと。

import type { WhereExpr } from "@/lib/crud";
import { USER_VISIBLE_AUDIT_ACTIONS } from "@/registry/userVisibleAuditActionsRegistry";

/**
 * 許可リストを action フィルタの WhereExpr に変換する。
 *
 * - 完全一致エントリ → { field: "action", op: "in", value: [...] }
 * - "xxx.*" エントリ → { field: "action", op: "startsWith", value: "xxx." }
 * - 複数条件は or で結合
 * - 有効なエントリが 1 件もなければ null（呼び出し側で空結果を返す）
 *
 * 単独の "*" は全開示となりレジストリの趣旨に反するため無視する。
 */
export function buildUserVisibleActionsWhere(
  allowList: readonly string[] = USER_VISIBLE_AUDIT_ACTIONS,
): WhereExpr | null {
  const exact: string[] = [];
  const prefixes: string[] = [];

  for (const entry of allowList) {
    if (!entry || entry === "*" || entry === ".*") continue;
    if (entry.endsWith(".*")) {
      prefixes.push(entry.slice(0, -1)); // "user.profile.*" → "user.profile."
    } else {
      exact.push(entry);
    }
  }

  const conditions: WhereExpr[] = [];
  if (exact.length > 0) {
    conditions.push({ field: "action", op: "in", value: exact });
  }
  for (const prefix of prefixes) {
    conditions.push({ field: "action", op: "startsWith", value: prefix });
  }

  if (conditions.length === 0) return null;
  return conditions.length === 1 ? conditions[0] : { or: conditions };
}
