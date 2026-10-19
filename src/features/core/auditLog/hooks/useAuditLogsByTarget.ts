// src/features/core/auditLog/hooks/useAuditLogsByTarget.ts

"use client";

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import { auditLogClient } from "@/features/core/auditLog/services/client/auditLogClient";
import type { AuditLog } from "@/features/core/auditLog/entities";

export type UseAuditLogsByTargetOptions = {
  /** 監査対象ドメイン名(auditLogger.record の targetType) */
  targetType: string;
  /** 個別ターゲット ID。省略時は targetType 全体の履歴 */
  targetId?: string;
  /** 1 ページの件数(既定 20) */
  limit?: number;
  /** IntersectionObserver のオプション */
  observerOptions?: IntersectionObserverInit;
};

/**
 * 管理者用: target_type / target_id 軸の監査ログを無限スクロールで取得する(AuditTimeline が使用)。
 * 返り値は useInfiniteScrollQuery と同じ。
 */
export function useAuditLogsByTarget({
  targetType,
  targetId,
  limit = 20,
  observerOptions,
}: UseAuditLogsByTargetOptions) {
  return useInfiniteScrollQuery<AuditLog, Record<string, never>>({
    fetcher: ({ page, limit: pageLimit }) =>
      auditLogClient.searchByTarget(targetType, { page, limit: pageLimit, targetId }),
    limit,
    deps: [targetType, targetId ?? "*"],
    observerOptions,
  });
}
