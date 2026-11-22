"use client";

// src/domains/core/messaging/hooks/useDispatchReaders.ts
//
// 送信の既読した利用者(公開の hook、D210): 時刻のある既読を既読の新しい順に無限スクロール(カーソルのモード)。
// 部品 DispatchReaders に戻り値をそのまま渡す。まとめて既読で読んだ人は時刻が無いので並ばない(既読の数は集計の値)

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";

import { getAdminDispatchReaders, type DispatchReader } from "../services/client/dispatchReadersClient";

const DEFAULT_LIMIT = 50;

export type UseDispatchReadersOptions = {
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
  enabled?: boolean;
  observerOptions?: IntersectionObserverInit;
};

/** dispatchId = 見る送信(null = 取らない) */
export function useDispatchReaders(dispatchId: string | null, options: UseDispatchReadersOptions = {}) {
  const { limit = DEFAULT_LIMIT, enabled = true, observerOptions } = options;
  return useInfiniteScrollQuery<DispatchReader, Record<string, never>>({
    cursorFetcher: ({ cursor, limit: pageLimit }) => getAdminDispatchReaders(dispatchId as string, { cursor, limit: pageLimit }),
    limit,
    enabled: enabled && dispatchId !== null,
    observerOptions,
    deps: [dispatchId, limit],
  });
}
