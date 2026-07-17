// src/features/core/analytics/hooks/useDauActiveDaysHistogram.ts
// アクティブ日数ヒストグラム（activeDays → userCount 分布）取得フック

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import {
  fetchDauActiveDaysHistogram,
  type DauActiveDaysHistogramClientParams,
} from "@/features/core/analytics/services/client/dauAnalyticsClient";

const buildKey = (params: DauActiveDaysHistogramClientParams) =>
  [
    "dauActiveDaysHistogram",
    params.days ?? null,
    params.dateFrom ?? null,
    params.dateTo ?? null,
    params.timezone ?? null,
    params.roles ?? null,
    params.excludeDemo ?? false,
  ] as const;

export function useDauActiveDaysHistogram(
  params: DauActiveDaysHistogramClientParams = {},
  config?: SWRConfiguration,
) {
  return useSWR(buildKey(params), async () => fetchDauActiveDaysHistogram(params), config);
}
