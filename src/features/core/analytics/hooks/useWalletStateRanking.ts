// src/features/core/analytics/hooks/useWalletStateRanking.ts
// ウォレット現在状態のランキング取得フック

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import type { WalletType } from "@/config/app/currency.config";
import {
  fetchWalletStateRanking,
  type WalletStateRankingClientParams,
} from "@/features/core/analytics/services/client/walletStateAnalyticsClient";

const buildKey = (
  walletType: WalletType | null | undefined,
  params: WalletStateRankingClientParams,
) =>
  walletType
    ? ([
        "walletStateRanking",
        walletType,
        params.sortBy ?? null,
        params.limit ?? null,
        params.page ?? null,
        params.roles ?? null,
        params.excludeDemo ?? false,
      ] as const)
    : null;

export function useWalletStateRanking(
  walletType: WalletType | null | undefined,
  params: WalletStateRankingClientParams = {},
  config?: SWRConfiguration,
) {
  const key = buildKey(walletType, params);
  return useSWR(
    key,
    async () => fetchWalletStateRanking(walletType as WalletType, params),
    config,
  );
}
