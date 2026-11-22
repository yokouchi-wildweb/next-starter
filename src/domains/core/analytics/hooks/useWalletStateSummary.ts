// src/domains/core/analytics/hooks/useWalletStateSummary.ts
// ウォレット現在状態のサマリー取得フック

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import type { WalletType } from "@/domains/wallet/config";
import {
  fetchWalletStateSummary,
  type WalletStateClientUserFilter,
} from "@/domains/core/analytics/services/client/walletStateAnalyticsClient";

const buildKey = (
  walletType: WalletType | null | undefined,
  params: WalletStateClientUserFilter,
) =>
  walletType
    ? (["walletStateSummary", walletType, params.roles ?? null, params.excludeDemo ?? false] as const)
    : null;

export function useWalletStateSummary(
  walletType: WalletType | null | undefined,
  params: WalletStateClientUserFilter = {},
  config?: SWRConfiguration,
) {
  const key = buildKey(walletType, params);
  return useSWR(
    key,
    async () => fetchWalletStateSummary(walletType as WalletType, params),
    config,
  );
}
