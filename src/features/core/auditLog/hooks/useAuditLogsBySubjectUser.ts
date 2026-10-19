// src/features/core/auditLog/hooks/useAuditLogsBySubjectUser.ts

"use client";

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import { auditLogClient } from "@/features/core/auditLog/services/client/auditLogClient";
import type { AuditLog } from "@/features/core/auditLog/entities";

export type UseAuditLogsBySubjectUserOptions = {
  /** "data subject"(操作対象)となるユーザー ID */
  userId: string;
  /** 1 ページの件数(既定 20) */
  limit?: number;
  /** IntersectionObserver のオプション */
  observerOptions?: IntersectionObserverInit;
};

/**
 * 管理者用: subject_user_id 軸(target_type を跨ぐ)の監査ログを無限スクロールで取得する
 * (UserActivityTimeline が使用)。返り値は useInfiniteScrollQuery と同じ。
 */
export function useAuditLogsBySubjectUser({
  userId,
  limit = 20,
  observerOptions,
}: UseAuditLogsBySubjectUserOptions) {
  return useInfiniteScrollQuery<AuditLog, Record<string, never>>({
    fetcher: ({ page, limit: pageLimit }) =>
      auditLogClient.searchBySubjectUser(userId, { page, limit: pageLimit }),
    limit,
    deps: [`subject:${userId}`],
    observerOptions,
  });
}
