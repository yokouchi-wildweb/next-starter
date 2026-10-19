// src/features/core/walletHistory/hooks/useAdminWalletHistoryBatches.ts

"use client";

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import { walletHistoryBatchClient } from "@/features/core/walletHistory/services/client/walletHistoryBatchClient";
import type { WalletHistoryBatchSummarySerialized } from "@/features/core/walletHistory/types/batch";

const DEFAULT_LIMIT = 20;

export type UseAdminWalletHistoryBatchesOptions = {
  /** 対象ユーザー ID。null/undefined の間は取得しない */
  userId: string | null | undefined;
  /** 1 ページの件数(既定 20) */
  limit?: number;
  /** false で取得を止める */
  enabled?: boolean;
  /** IntersectionObserver のオプション(スクロールコンテナを root にする場合など) */
  observerOptions?: IntersectionObserverInit;
};

/**
 * 管理者向け: 指定ユーザーのウォレット履歴(バッチ集約、全通貨)を無限スクロールで取得する。
 *
 * 本人向けの useMyWalletHistoryBatches の管理者版。
 * 返り値は useInfiniteScrollQuery と同じ(items / total / isInitialLoading / hasMore / sentinelRef ...)。
 */
export function useAdminWalletHistoryBatches({
  userId,
  limit = DEFAULT_LIMIT,
  enabled = true,
  observerOptions,
}: UseAdminWalletHistoryBatchesOptions) {
  return useInfiniteScrollQuery<WalletHistoryBatchSummarySerialized, Record<string, never>>({
    fetcher: ({ page, limit: pageLimit }) =>
      walletHistoryBatchClient.list({ userId: userId ?? undefined, page, limit: pageLimit }),
    limit,
    enabled: enabled && Boolean(userId),
    deps: [userId],
    observerOptions,
  });
}
