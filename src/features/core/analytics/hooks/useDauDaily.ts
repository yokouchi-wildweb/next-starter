// src/features/core/analytics/hooks/useDauDaily.ts
// バケット別アクティブユーザー数（day=DAU / week=WAU / month=MAU）取得フック

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import {
  fetchDauDaily,
  type DauDailyClientParams,
} from "@/features/core/analytics/services/client/dauAnalyticsClient";

const buildKey = (params: DauDailyClientParams) =>
  [
    "dauDaily",
    params.days ?? null,
    params.dateFrom ?? null,
    params.dateTo ?? null,
    params.timezone ?? null,
    params.granularity ?? null,
    params.userId ?? null,
    params.roles ?? null,
    params.excludeDemo ?? false,
  ] as const;

export function useDauDaily(
  params: DauDailyClientParams = {},
  config?: SWRConfiguration,
) {
  return useSWR(buildKey(params), async () => fetchDauDaily(params), config);
}
