// src/features/core/auditLog/services/client/auditLogClient.ts

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";
import type { PaginatedResult, SearchParams, WhereExpr } from "@/lib/crud/types";

import type { AuditLog } from "@/features/core/auditLog/entities";

const ADMIN_BASE = "/api/admin/audit-logs";
const ME_BASE = "/api/me/audit-logs";

type SearchByTargetParams = Omit<SearchParams, "where"> & {
  targetId?: string;
};

/**
 * 管理者用: 任意条件で監査ログを横断検索する。
 * `where` を渡さない場合は全件 (createdAt DESC)。
 */
async function searchAsAdmin(params: SearchParams = {}): Promise<PaginatedResult<AuditLog>> {
  try {
    const queryParams: Record<string, unknown> = { ...params };
    if (params.where) {
      queryParams.where = JSON.stringify(params.where);
    } else {
      delete queryParams.where;
    }
    return (
      await axios.get<PaginatedResult<AuditLog>>(`${ADMIN_BASE}/search`, {
        params: queryParams,
      })
    ).data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

/**
 * 管理者用: targetType + targetId を絞り込んで検索する糖衣構文。
 * AuditTimeline コンポーネントから利用される。
 */
async function searchByTarget(
  targetType: string,
  params: SearchByTargetParams = {},
): Promise<PaginatedResult<AuditLog>> {
  const { targetId, ...rest } = params;
  const where: WhereExpr = targetId
    ? {
        and: [
          { field: "targetType", op: "eq", value: targetType },
          { field: "targetId", op: "eq", value: targetId },
        ],
      }
    : { field: "targetType", op: "eq", value: targetType };

  return searchAsAdmin({ ...rest, where });
}

/**
 * 管理者用: 指定ユーザーが "data subject" になっている全監査ログを取得する糖衣構文。
 * UserActivityTimeline コンポーネントから利用される。
 *
 * target_type を跨いで（user / wallet / user_item 等）ユーザー単位にアクティビティを
 * 集約するユースケース向け。
 */
async function searchBySubjectUser(
  subjectUserId: string,
  params: Omit<SearchParams, "where"> = {},
): Promise<PaginatedResult<AuditLog>> {
  return searchAsAdmin({
    ...params,
    where: { field: "subjectUserId", op: "eq", value: subjectUserId },
  });
}

/**
 * 認証ユーザー本人用: 自分が target または actor になっているログを取得する。
 */
async function fetchMine(params: { page?: number; limit?: number } = {}): Promise<PaginatedResult<AuditLog>> {
  try {
    return (await axios.get<PaginatedResult<AuditLog>>(ME_BASE, { params })).data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

export const auditLogClient = {
  search: searchAsAdmin,
  searchByTarget,
  searchBySubjectUser,
  fetchMine,
};
