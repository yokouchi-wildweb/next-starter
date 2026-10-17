// src/features/core/walletHistory/hooks/useMyWalletHistoryBatches.ts

"use client";

import type { WalletType } from "@/config/app/currency.config";
import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import { walletHistoryBatchClient } from "@/features/core/walletHistory/services/client/walletHistoryBatchClient";
import type { WalletHistoryBatchSummarySerialized } from "@/features/core/walletHistory/types/batch";

const DEFAULT_LIMIT = 20;

export type UseMyWalletHistoryBatchesOptions = {
  /** 対象の通貨種別。null/undefined の間は取得しない(無効なスラッグ等) */
  walletType: WalletType | null | undefined;
  /** 1 ページの件数(既定 20) */
  limit?: number;
  /** false で取得を止める */
  enabled?: boolean;
  /** IntersectionObserver のオプション(スクロールコンテナを root にする場合など) */
  observerOptions?: IntersectionObserverInit;
};

/**
 * 本人のウォレット履歴(バッチ集約)を通貨種別ごとに無限スクロールで取得する。
 *
 * 通貨の絞り込みはサーバー側(GET /api/wallet/history/batches?type=)で行う。
 * クライアント側で取得後に絞るとページ件数と total が食い違い、2 ページ目以降が
 * 取得されなくなるため、このフック以外の経路で通貨別の履歴を組み立てないこと。
 * 返り値は useInfiniteScrollQuery と同じ(items / total / isLoading / hasMore / sentinelRef ...)。
 */
export function useMyWalletHistoryBatches({
  walletType,
  limit = DEFAULT_LIMIT,
  enabled = true,
  observerOptions,
}: UseMyWalletHistoryBatchesOptions) {
  return useInfiniteScrollQuery<WalletHistoryBatchSummarySerialized, Record<string, never>>({
    fetcher: ({ page, limit: pageLimit }) =>
      walletHistoryBatchClient.list({ type: walletType ?? undefined, page, limit: pageLimit }),
    limit,
    enabled: enabled && Boolean(walletType),
    deps: [walletType],
    observerOptions,
  });
}
