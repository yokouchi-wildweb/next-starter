"use client";

// src/features/core/messaging/hooks/useAdminDispatches.ts
//
// 管理: 回の一覧(無限スクロール、カーソルのモード)。絞り込みが変われば先頭から取り直す。
// 画面は @/components/Widgets/InfiniteScrollList に items / hasMore / sentinelRef を渡す

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";

import {
  listAdminDispatches,
  type AdminDispatchFilters,
  type AdminDispatchSummary,
} from "../services/client/adminMessagingClient";

const DEFAULT_LIMIT = 50;

export type UseAdminDispatchesOptions = {
  filters?: AdminDispatchFilters;
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
  enabled?: boolean;
  observerOptions?: IntersectionObserverInit;
};

export function useAdminDispatches(options: UseAdminDispatchesOptions = {}) {
  const { filters = {}, limit = DEFAULT_LIMIT, enabled, observerOptions } = options;
  const { from, to, messageKey, kind, channel, status } = filters;
  return useInfiniteScrollQuery<AdminDispatchSummary, Record<string, never>>({
    cursorFetcher: ({ cursor, limit: pageLimit }) =>
      listAdminDispatches({ from, to, messageKey, kind, channel, status, cursor, limit: pageLimit }),
    limit,
    enabled,
    observerOptions,
    deps: [from, to, messageKey, kind, channel, status, limit],
  });
}
