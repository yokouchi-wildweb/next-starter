"use client";

// src/features/core/messaging/hooks/useAdminDispatchDeliveries.ts
//
// 管理: 回の配達(無限スクロール、カーソルのモード)。絞り込み(状態・経路)が変われば先頭から取り直す

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";

import {
  listAdminDispatchDeliveries,
  type AdminDeliveryFilters,
  type AdminDeliveryRow,
} from "../services/client/adminMessagingClient";

const DEFAULT_LIMIT = 50;

export type UseAdminDispatchDeliveriesOptions = {
  filters?: AdminDeliveryFilters;
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
  enabled?: boolean;
  observerOptions?: IntersectionObserverInit;
};

export function useAdminDispatchDeliveries(dispatchId: string, options: UseAdminDispatchDeliveriesOptions = {}) {
  const { filters = {}, limit = DEFAULT_LIMIT, enabled, observerOptions } = options;
  const { status, channel } = filters;
  return useInfiniteScrollQuery<AdminDeliveryRow, Record<string, never>>({
    cursorFetcher: ({ cursor, limit: pageLimit }) =>
      listAdminDispatchDeliveries(dispatchId, { status, channel, cursor, limit: pageLimit }),
    limit,
    enabled,
    observerOptions,
    deps: [dispatchId, status, channel, limit],
  });
}
