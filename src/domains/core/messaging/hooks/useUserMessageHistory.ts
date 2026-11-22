"use client";

// src/domains/core/messaging/hooks/useUserMessageHistory.ts
//
// 利用者ごとの連絡の履歴(公開の hook、D37・D215): 配達と、その利用者の受け取り箱に見える全員・ロール宛ての共有のお知らせ
// (type "sharedInApp"、status・sentAt は null)を時刻の新しい順に無限スクロール(カーソルのモード)。
// 上流は画面を出さない(利用者の管理画面などに fork が置く)。行の形: services/server/history/README.md

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";

import { getAdminUserMessageHistory, type UserMessageHistoryItem } from "../services/client/userHistoryClient";

const DEFAULT_LIMIT = 50;

export type UseUserMessageHistoryOptions = {
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
  enabled?: boolean;
  observerOptions?: IntersectionObserverInit;
};

/** userId = 見る利用者(null = 取らない) */
export function useUserMessageHistory(userId: string | null, options: UseUserMessageHistoryOptions = {}) {
  const { limit = DEFAULT_LIMIT, enabled = true, observerOptions } = options;
  return useInfiniteScrollQuery<UserMessageHistoryItem, Record<string, never>>({
    cursorFetcher: ({ cursor, limit: pageLimit }) => getAdminUserMessageHistory(userId as string, { cursor, limit: pageLimit }),
    limit,
    enabled: enabled && userId !== null,
    observerOptions,
    deps: [userId, limit],
  });
}
