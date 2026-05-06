// src/features/core/analytics/hooks/useWalletStateDistribution.ts
// ウォレット現在状態の保有量分布フック

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import type { WalletType } from "@/config/app/currency.config";
import {
  fetchWalletStateDistribution,
  type WalletStateDistributionClientParams,
} from "@/features/core/analytics/services/client/walletStateAnalyticsClient";

const buildKey = (
  walletType: WalletType | null | undefined,
  params: WalletStateDistributionClientParams | null,
) =>
  walletType && params && params.boundaries.length > 0
    ? ([
        "walletStateDistribution",
        walletType,
        params.boundaries.join(","),
        params.roles ?? null,
        params.excludeDemo ?? false,
      ] as const)
    : null;

/**
 * @param params boundaries が空配列または未指定の場合はリクエストを発火させない
 */
export function useWalletStateDistribution(
  walletType: WalletType | null | undefined,
  params: WalletStateDistributionClientParams | null,
  config?: SWRConfiguration,
) {
  const key = buildKey(walletType, params);
  return useSWR(
    key,
    async () =>
      fetchWalletStateDistribution(walletType as WalletType, params!),
    config,
  );
}
