// src/features/core/analytics/hooks/useCoinIssuanceSummary.ts
// 統合コイン創出サマリー取得フック

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import {
  fetchCoinIssuanceSummary,
  type CoinIssuanceSummaryClientParams,
} from "@/features/core/analytics/services/client/coinIssuanceClient";

const buildKey = (params: CoinIssuanceSummaryClientParams) =>
  [
    "coinIssuanceSummary",
    params.days ?? null,
    params.dateFrom ?? null,
    params.dateTo ?? null,
    params.timezone ?? null,
    params.roles ?? null,
    params.excludeDemo ?? false,
  ] as const;

export function useCoinIssuanceSummary(
  params: CoinIssuanceSummaryClientParams = {},
  config?: SWRConfiguration,
) {
  return useSWR(
    buildKey(params),
    async () => fetchCoinIssuanceSummary(params),
    config,
  );
}
