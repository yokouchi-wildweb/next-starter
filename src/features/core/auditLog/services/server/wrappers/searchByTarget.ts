// src/features/core/auditLog/services/server/wrappers/searchByTarget.ts

import type { PaginatedResult, SearchParams } from "@/lib/crud/types";

import type { AuditLog } from "@/features/core/auditLog/entities/model";
import { auditLogBase } from "../drizzleBase";

export type SearchByTargetParams = Omit<SearchParams, "where"> & {
  /**
   * ターゲット ID を絞り込みたい場合に指定。targetType と組み合わせて使う。
   * 省略時は targetType に紐づく全レコードを返す。
   */
  targetId?: string;
};

/**
 * 指定ターゲットの監査ログをタイムライン順に取得する。
 *
 * - createdAt DESC が既定 (drizzleBase 設定済み)
 * - targetId 省略時は targetType 全体を返す
 *
 * cross-domain 検索や actor 起点の検索は base.search() を直接使う。
 */
export async function searchByTarget(
  targetType: string,
  params: SearchByTargetParams = {},
): Promise<PaginatedResult<AuditLog>> {
  const { targetId, ...rest } = params;

  const targetCondition = targetId
    ? {
        and: [
          { field: "targetType", op: "eq" as const, value: targetType },
          { field: "targetId", op: "eq" as const, value: targetId },
        ],
      }
    : { field: "targetType", op: "eq" as const, value: targetType };

  return auditLogBase.search({
    ...rest,
    where: targetCondition,
  }) as Promise<PaginatedResult<AuditLog>>;
}
