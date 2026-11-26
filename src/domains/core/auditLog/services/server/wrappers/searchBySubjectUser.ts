// src/domains/core/auditLog/services/server/wrappers/searchBySubjectUser.ts

import type { BoundedSearchParams, PaginatedResult } from "@/lib/crud";

import type { AuditLog } from "@/domains/core/auditLog/entities/model";
import { auditLogBase } from "../auditLogBase";

/**
 * 指定ユーザーが "data subject" となっている監査ログをタイムライン順に取得する。
 *
 * searchByTarget が「特定のレコード」軸なのに対し、これは「特定のユーザーに対する全操作」軸。
 * target_type を跨いで（user / wallet / user_item / subscription 等）ユーザー単位に
 * アクティビティを集約したいユースケース用。`audit_logs.subject_user_id` の部分インデックス
 * を活用する。
 *
 * - createdAt DESC が既定 (auditLogBase 設定済み)
 * - cross-domain 検索や bulk aggregate (subject_user_id=null) は base.search() を直接使う
 */
export async function searchBySubjectUser(
  subjectUserId: string,
  params: Omit<BoundedSearchParams, "where">,
): Promise<PaginatedResult<AuditLog>> {
  return auditLogBase.search({
    ...params,
    where: { field: "subjectUserId", op: "eq", value: subjectUserId },
  }) as Promise<PaginatedResult<AuditLog>>;
}
