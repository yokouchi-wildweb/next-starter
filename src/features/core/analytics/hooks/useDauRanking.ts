// src/features/core/analytics/hooks/useDauRanking.ts
// ユーザー別アクティブ日数ランキング取得フック

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import {
  fetchDauRanking,
  type DauRankingClientParams,
} from "@/features/core/analytics/services/client/dauAnalyticsClient";

const buildKey = (params: DauRankingClientParams) =>
  [
    "dauRanking",
    params.days ?? null,
    params.dateFrom ?? null,
    params.dateTo ?? null,
    params.timezone ?? null,
    params.limit ?? null,
    params.page ?? null,
    params.roles ?? null,
    params.excludeDemo ?? false,
  ] as const;

export function useDauRanking(
  params: DauRankingClientParams = {},
  config?: SWRConfiguration,
) {
  return useSWR(buildKey(params), async () => fetchDauRanking(params), config);
}
