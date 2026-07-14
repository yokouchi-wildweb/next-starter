// src/features/core/analytics/hooks/useDauSummary.ts
// DAU 期間サマリー取得フック（userId 指定時は単一ユーザーのアクティブ日数ドリルダウン）

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import {
  fetchDauSummary,
  type DauSummaryClientParams,
} from "@/features/core/analytics/services/client/dauAnalyticsClient";

const buildKey = (params: DauSummaryClientParams) =>
  [
    "dauSummary",
    params.days ?? null,
    params.dateFrom ?? null,
    params.dateTo ?? null,
    params.timezone ?? null,
    params.granularity ?? null,
    params.userId ?? null,
    params.roles ?? null,
    params.excludeDemo ?? false,
  ] as const;

export function useDauSummary(
  params: DauSummaryClientParams = {},
  config?: SWRConfiguration,
) {
  return useSWR(buildKey(params), async () => fetchDauSummary(params), config);
}
