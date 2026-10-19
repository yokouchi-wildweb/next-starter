// src/features/core/auditLog/hooks/useAuditLogSearch.ts

"use client";

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import type { WhereExpr } from "@/lib/crud";
import { auditLogClient } from "@/features/core/auditLog/services/client/auditLogClient";
import type { AuditLog } from "@/features/core/auditLog/entities";

export type UseAuditLogSearchOptions = {
  /** 検索条件。undefined で全件(createdAt DESC) */
  where?: WhereExpr;
  /** 1 ページの件数(既定 100) */
  limit?: number;
  /** IntersectionObserver のオプション */
  observerOptions?: IntersectionObserverInit;
};

/**
 * 管理者用: 任意条件で監査ログを横断検索し、無限スクロールで取得する。
 * where の内容(JSON)が変わると 1 ページ目から取り直す。返り値は useInfiniteScrollQuery と同じ。
 */
export function useAuditLogSearch({ where, limit = 100, observerOptions }: UseAuditLogSearchOptions) {
  return useInfiniteScrollQuery<AuditLog, Record<string, never>>({
    fetcher: ({ page, limit: pageLimit }) => auditLogClient.search({ page, limit: pageLimit, where }),
    limit,
    deps: [JSON.stringify(where ?? null)],
    observerOptions,
  });
}
