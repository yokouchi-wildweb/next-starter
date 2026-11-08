// src/features/core/auditLog/utils/searchWhere.ts
//
// 監査ログの横断検索の絞り込み(管理画面の入力欄の値)を、useAuditLogSearch に渡す where に直す純粋な関数。
// 空白だけの欄は使わない。値は前後の空白を落とす。条件が無ければ undefined(全件、createdAt の新しい順)。

import type { WhereExpr } from "@/lib/crud";

export type AuditLogSearchFilters = {
  /** 対象の種類(一致) */
  targetType: string;
  /** 対象の id(一致) */
  targetId: string;
  /** 実行者の id(一致) */
  actorId: string;
  /** 操作名の前方一致(例: "user.email" → "user.email%") */
  actionPrefix: string;
  /** recordMany / recordManyDiff が発番する共通の UUID(一致。dead-letter の復旧の追跡や同じバッチの全行の取得) */
  batchId: string;
};

export const EMPTY_AUDIT_LOG_SEARCH_FILTERS: AuditLogSearchFilters = {
  targetType: "",
  targetId: "",
  actorId: "",
  actionPrefix: "",
  batchId: "",
};

export function buildAuditLogSearchWhere(filters: AuditLogSearchFilters): WhereExpr | undefined {
  const conds: WhereExpr[] = [];
  const eq = (field: "targetType" | "targetId" | "actorId" | "batchId") => {
    const value = filters[field].trim();
    if (value) conds.push({ field, op: "eq", value });
  };
  eq("targetType");
  eq("targetId");
  eq("actorId");
  const actionPrefix = filters.actionPrefix.trim();
  if (actionPrefix) conds.push({ field: "action", op: "startsWith", value: actionPrefix });
  eq("batchId");
  if (conds.length === 0) return undefined;
  if (conds.length === 1) return conds[0];
  return { and: conds };
}
